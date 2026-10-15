// src/storage/repositorio.ts
// La única puerta a AsyncStorage (sdd/api-contracts.md, "Repositorio").
// Claves y formato: sdd/database/esquema.md, "Claves de AsyncStorage".
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { marcarCobrados } from '@dominio/cobro';
import { Meta, normalizarMeta } from '@dominio/meta';
import {
  esEntradaReporte,
  estaVigente,
  MAX_ENLACES_TEMPORALES,
  MAX_REPORTES_GUARDADOS,
  sanearTitulo,
  type EntradaReporte,
} from '@dominio/reporteGuardado';
import { contarDatosDeEjemplo, DatosDeEjemplo, sinDatosDeEjemplo } from '@dominio/origen';
import type {
  Cierre,
  FechaNegocio,
  Instante,
  Perfil,
  Producto,
  SemillaMaterializada,
} from '@dominio/tipos';
import { normalizarYapes, YapeAnotado } from '@dominio/yape';

const PREFIJO_CLAVE = '@crecemos/';
const PREFIJO_RESPALDO = '@crecemos/respaldo-';
const CLAVE_CIERRES = '@crecemos/cierres';
const CLAVE_PRODUCTOS = '@crecemos/productos';
const CLAVE_PERFIL = '@crecemos/perfil';
const CLAVE_SEED = '@crecemos/seed';
const CLAVE_META = '@crecemos/meta';
const CLAVE_YAPES = '@crecemos/yapes';
const CLAVE_VERSION = '@crecemos/version';
const CLAVE_RECORRIDO = '@crecemos/recorrido-visto';
const CLAVE_ENLACES = '@crecemos/enlaces-reporte';

/** Versión actual del esquema guardado. Subirla exige agregar su paso en `MIGRACIONES`. */
export const VERSION_ESQUEMA = 1;

// Cola de escrituras (un mutex mínimo). Todo read-modify-write pasa por aquí, uno detrás de otro,
// así dos operaciones simultáneas nunca leen el mismo estado viejo y se pisan. Un fallo no
// bloquea la cola: la siguiente tarea corre igual y quien llamó recibe su propio error.
let cola: Promise<unknown> = Promise.resolve();
const enCola = <T>(tarea: () => Promise<T>): Promise<T> => {
  const resultado = cola.then(tarea);
  cola = resultado.catch(() => undefined);
  return resultado;
};

// Base propia de la app (D21). Se pide en cada operación: en nativo la instancia
// solo guarda el nombre, y en Jest el mock la reutiliza por nombre, así que
// clearAllMockStorages() deja al repositorio con una base vacía de verdad.
const base = () => createAsyncStorage('crecemos');

// T es el valor completo guardado: un arreglo (cierres, productos) o un objeto (perfil).
// Si lo guardado está corrupto no se tira ni se pisa: se respalda tal cual bajo
// `@crecemos/respaldo-<clave>` y se devuelve `null`, como si nunca se hubiera guardado.
// Si el respaldo mismo falla, el error sube: mejor no arrancar que perder el original.
const leer = async <T>(clave: string): Promise<T | null> => {
  const json = await base().getItem(clave);
  if (json === null) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    await base().setItem(`${PREFIJO_RESPALDO}${clave.replace(PREFIJO_CLAVE, '')}`, json);
    return null;
  }
};

export const listarCierres = async (): Promise<Cierre[]> =>
  (await leer<Cierre[]>(CLAVE_CIERRES)) ?? [];

/** Inserta o reemplaza el cierre de esa fecha (D9), en una sola escritura. */
export const guardarCierre = (c: Cierre): Promise<void> => enCola(async () => {
  const otros = (await listarCierres()).filter(existente => existente.fecha !== c.fecha);
  await base().setItem(CLAVE_CIERRES, JSON.stringify([...otros, c]));
});

/** Quita el cierre con ese id. Si no existe, no hace nada. */
export const eliminarCierre = (id: string): Promise<void> => enCola(async () => {
  const cierres = await listarCierres();
  const restantes = cierres.filter(c => c.id !== id);
  if (restantes.length === cierres.length) return;
  await base().setItem(CLAVE_CIERRES, JSON.stringify(restantes));
});

/** Pone `cobradoEn` en los cierres pedidos y reescribe la lista completa (e2). */
export const marcarCobrado = (ids: string[], fecha: FechaNegocio): Promise<void> => enCola(async () => {
  const cierres = await listarCierres();
  const cobrados = marcarCobrados(cierres, ids, fecha);
  if (cobrados.every((c, i) => c === cierres[i])) return; // nada pendiente que cobrar
  await base().setItem(CLAVE_CIERRES, JSON.stringify(cobrados));
});

/** Migra catálogos antiguos; una instalación realmente nueva queda vacía. */
const leerProductos = async (): Promise<Producto[]> => {
  const guardados = await leer<Producto[]>(CLAVE_PRODUCTOS);
  if (guardados !== null) return guardados;
  const [cierres, semilla, perfil] = await Promise.all([
    leer<Cierre[]>(CLAVE_CIERRES),
    leer<{ cargadoEn: Instante }>(CLAVE_SEED),
    leer<Perfil>(CLAVE_PERFIL),
  ]);
  const productos = (cierres?.length || semilla || perfil)
    ? PRODUCTOS_POR_DEFECTO.map(p => ({ ...p }))
    : [];
  await base().setItem(CLAVE_PRODUCTOS, JSON.stringify(productos));
  return productos;
};

/** Puede escribir (migración de catálogos), por eso también va por la cola. */
export const listarProductos = (): Promise<Producto[]> => enCola(leerProductos);

/** `null` si el perfil nunca se guardó. */
export const obtenerPerfil = async (): Promise<Perfil | null> =>
  leer<Perfil>(CLAVE_PERFIL);

/** Reemplaza el perfil, en una sola escritura. */
export const guardarPerfil = (p: Perfil): Promise<void> =>
  enCola(() => base().setItem(CLAVE_PERFIL, JSON.stringify(p)));

/**
 * Inserta o reemplaza por `id`, conservando el orden. Parte de `listarProductos()`
 * (que incluye los por defecto aunque nunca se hayan escrito) y reescribe la lista
 * completa: guardar solo el producto cambiado haría desaparecer a los demás.
 */
export const guardarProducto = (p: Producto): Promise<void> => enCola(async () => {
  const actuales = await leerProductos();
  const existe = actuales.some(existente => existente.id === p.id);
  const lista = existe
    ? actuales.map(existente => (existente.id === p.id ? p : existente))
    : [...actuales, p];
  await base().setItem(CLAVE_PRODUCTOS, JSON.stringify(lista));
});

/**
 * Guarda los productos y los cierres de la semilla (la lista completa, una escritura cada
 * una) y, al final, la marca de carga: si algo falla a medias, la marca no queda puesta.
 */
export const importarSemilla = (s: SemillaMaterializada, ahora: Instante): Promise<void> => enCola(async () => {
  if ((await leerProductos()).length > 0 || (await listarCierres()).length > 0) return;
  await base().setItem(CLAVE_PRODUCTOS, JSON.stringify(s.productos));
  await base().setItem(CLAVE_CIERRES, JSON.stringify(s.cierres));
  await base().setItem(CLAVE_SEED, JSON.stringify({ cargadoEn: ahora }));
});

/** Si la semilla ya se resolvió alguna vez (cargada, o descartada porque ya había datos). */
export const semillaCargada = async (): Promise<boolean> =>
  (await leer<{ cargadoEn: Instante }>(CLAVE_SEED)) !== null;

/** Escribe solo la marca: se usa cuando ya había datos y no se descarga nada. */
export const marcarSemillaResuelta = (ahora: Instante): Promise<void> =>
  enCola(() => base().setItem(CLAVE_SEED, JSON.stringify({ cargadoEn: ahora })));

/**
 * Borra solo lo marcado 'ejemplo': los días de ejemplo y los productos de ejemplo que ningún día
 * propio usa (los que sí usa pasan a ser propios). También suelta la marca de la semilla, así la
 * demostración se puede volver a cargar. Devuelve lo que quitó y lo que quedó.
 */
type ResultadoBorrado = DatosDeEjemplo & { cierresRestantes: Cierre[]; productosRestantes: Producto[] };
export const borrarDatosDeEjemplo = (): Promise<ResultadoBorrado> => enCola(async () => {
  const cierres = await listarCierres();
  const productos = await leerProductos();
  const quitado = contarDatosDeEjemplo(cierres, productos);
  const resto = sinDatosDeEjemplo(cierres, productos);
  await base().setItem(CLAVE_CIERRES, JSON.stringify(resto.cierres));
  await base().setItem(CLAVE_PRODUCTOS, JSON.stringify(resto.productos));
  await base().removeItem(CLAVE_SEED);
  return { ...quitado, cierresRestantes: resto.cierres, productosRestantes: resto.productos };
});

/** La meta de ahorro "Mi cuota". `null` si no hay, o si lo guardado no se puede usar. */
export const obtenerMeta = async (): Promise<Meta | null> =>
  normalizarMeta(await leer<unknown>(CLAVE_META));

/** Reemplaza la meta, en una sola escritura. */
export const guardarMeta = (m: Meta): Promise<void> =>
  enCola(() => base().setItem(CLAVE_META, JSON.stringify(m)));

/** Borra la meta. Sin meta guardada, no hace nada. */
export const borrarMeta = (): Promise<void> => enCola(() => base().removeItem(CLAVE_META));

/** Los yapes anotados, de todas las fechas. Lo ilegible se ignora. */
export const listarYapes = async (): Promise<YapeAnotado[]> =>
  normalizarYapes(await leer<unknown>(CLAVE_YAPES));

/** Reemplaza la lista completa de yapes anotados, en una sola escritura. */
export const guardarYapes = (yapes: YapeAnotado[]): Promise<void> =>
  enCola(() => base().setItem(CLAVE_YAPES, JSON.stringify(yapes)));

/**
 * Si la persona ya vio (o saltó) el recorrido guiado. Solo da `false` cuando la lectura funciona y
 * no hay nada guardado: si leer falla, responde `true` para NO mostrarlo (mejor callar que repetirlo
 * en cada arranque). Nunca lanza.
 */
export const recorridoVisto = async (): Promise<boolean> => {
  try {
    return (await base().getItem(CLAVE_RECORRIDO)) !== null;
  } catch {
    return true;
  }
};

/** Marca el recorrido como visto, para que no vuelva a salir solo. */
export const marcarRecorridoVisto = (): Promise<void> =>
  enCola(() => base().setItem(CLAVE_RECORRIDO, JSON.stringify(true)));

/** Olvida que lo vio: lo usa "Ver el recorrido otra vez". */
export const olvidarRecorridoVisto = (): Promise<void> =>
  enCola(() => base().removeItem(CLAVE_RECORRIDO));

// --- Enlaces del reporte en la nube y "Mis reportes" (Sprint-16) -------------------------------
// Una sola lista de entradas (ver `EntradaReporte`): las GUARDADAS (con título) aparecen en "Mis reportes" y
// son a lo más 20; las TEMPORALES solo recuerdan el enlace para no subir dos veces el mismo contenido (a lo
// más 5 vigentes, ocultas). Los vencidos temporales se descartan; los guardados vencidos se conservan para
// mostrarlos como «Caducó el …». Ninguna entrada lleva cierres, Yape ni ubicación.

/** Resultado de guardar un reporte en "Mis reportes". */
export type ResultadoGuardarReporte = 'ok' | 'limite' | 'titulo-vacio' | 'no-existe';

const leerEntradas = async (): Promise<{ entradas: EntradaReporte[]; limpias: boolean }> => {
  const crudo = await leer<unknown>(CLAVE_ENLACES);
  if (crudo === null) return { entradas: [], limpias: true };
  const lista = Array.isArray(crudo) ? crudo : [];
  const entradas = lista.filter(esEntradaReporte);
  return { entradas, limpias: Array.isArray(crudo) && entradas.length === lista.length };
};

const escribirEntradas = (entradas: EntradaReporte[]): Promise<void> =>
  base().setItem(CLAVE_ENLACES, JSON.stringify(entradas));

/** Sin los temporales vencidos y con solo los últimos 5 temporales vigentes (los guardados se quedan). */
const depuradas = (entradas: EntradaReporte[], ahora: number): EntradaReporte[] => {
  const vigentesTemporales = entradas.filter(e => !e.guardado && estaVigente(e, ahora));
  const sobrantes = new Set(vigentesTemporales.slice(0, -MAX_ENLACES_TEMPORALES));
  return entradas.filter(e => (e.guardado ? true : estaVigente(e, ahora) && !sobrantes.has(e)));
};

/**
 * La entrada VIGENTE de esa clave (temporal o guardada), o `null`. Lo vencido que no está guardado se
 * descarta y se limpia. Nunca lanza: si leer falla responde `null` (lo peor: se crea un enlace de más).
 */
export const entradaDeReporte = (
  clave: string,
  ahora: number = Date.now(),
): Promise<EntradaReporte | null> =>
  enCola(async () => {
    try {
      const { entradas, limpias } = await leerEntradas();
      const buenas = depuradas(entradas, ahora);
      if (!limpias || buenas.length !== entradas.length) await escribirEntradas(buenas);
      return buenas.find(e => e.clave === clave && estaVigente(e, ahora)) ?? null;
    } catch {
      return null;
    }
  });

/**
 * Recuerda un enlace recién creado. Si ya había una entrada con esa clave (por ejemplo una guardada que
 * caducó), la nueva la reemplaza y hereda su lugar en "Mis reportes" y su título. Nunca lanza.
 */
export const registrarEntradaDeReporte = (
  entrada: EntradaReporte,
  ahora: number = Date.now(),
): Promise<void> =>
  enCola(async () => {
    try {
      const { entradas } = await leerEntradas();
      const previa = entradas.find(e => e.clave === entrada.clave);
      const nueva: EntradaReporte = previa?.guardado
        ? { ...entrada, guardado: true, titulo: previa.titulo }
        : entrada;
      await escribirEntradas(
        depuradas([...entradas.filter(e => e.clave !== entrada.clave), nueva], ahora),
      );
    } catch {
      // No recordar el enlace no rompe nada: a lo más se crea otro si lo piden de nuevo.
    }
  });

/** Los reportes guardados, del más reciente al más viejo (incluye los que ya caducaron). */
export const listarReportesGuardados = async (): Promise<EntradaReporte[]> => {
  try {
    const { entradas } = await leerEntradas();
    return entradas
      .filter(e => e.guardado)
      .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : a.creadoEn > b.creadoEn ? -1 : 0));
  } catch {
    return [];
  }
};

/**
 * Guarda (o cambia el título de) el reporte de esa clave en "Mis reportes". `limite` si ya hay 20 guardados y
 * este no lo estaba; `titulo-vacio` si el título queda vacío al limpiarlo. Nunca lanza.
 */
export const guardarReporteEnLista = (
  clave: string,
  titulo: string,
  ahora: number = Date.now(),
): Promise<ResultadoGuardarReporte> =>
  enCola(async () => {
    try {
      const limpio = sanearTitulo(titulo);
      if (limpio === '') return 'titulo-vacio';
      const { entradas } = await leerEntradas();
      const objetivo = entradas.find(e => e.clave === clave);
      if (!objetivo || (!objetivo.guardado && !estaVigente(objetivo, ahora))) return 'no-existe';
      if (!objetivo.guardado && entradas.filter(e => e.guardado).length >= MAX_REPORTES_GUARDADOS) {
        return 'limite';
      }
      await escribirEntradas(
        entradas.map(e => (e.clave === clave ? { ...e, guardado: true, titulo: limpio } : e)),
      );
      return 'ok';
    } catch {
      return 'no-existe';
    }
  });

/** Olvida la entrada de esa clave (solo en el teléfono; el archivo en la nube sigue hasta que caduque). */
export const quitarReporteDeLista = (clave: string): Promise<void> =>
  enCola(async () => {
    try {
      const { entradas } = await leerEntradas();
      await escribirEntradas(entradas.filter(e => e.clave !== clave));
    } catch {
      // Sin cambios.
    }
  });

/** Olvida TODOS los enlaces recordados (para cualquier opción que borre todos los datos). */
export const borrarEnlacesDeReporte = (): Promise<void> =>
  enCola(() => base().removeItem(CLAVE_ENLACES));

// Pasos de migración: MIGRACIONES[n] lleva los datos de la versión n a la n + 1.
// Hoy no hay ninguno que hacer (la versión 1 es la forma actual), pero el mecanismo ya corre.
const MIGRACIONES: Array<() => Promise<void>> = [
  async () => undefined, // v0 -> v1: los datos previos ya tienen la forma vigente.
];

/**
 * Lleva lo guardado a `VERSION_ESQUEMA` y sella `@crecemos/version`. Idempotente y nunca
 * lanza: una versión ausente o ilegible se trata como v0, y cualquier fallo se traga (la app
 * abre igual y lo reintenta en el próximo arranque). Devuelve la versión en que quedó.
 */
export const migrarEsquema = (): Promise<number> =>
  enCola(async () => {
    try {
      const guardada = await leer<unknown>(CLAVE_VERSION);
      let version =
        typeof guardada === 'number' && Number.isInteger(guardada) && guardada >= 0 ? guardada : 0;
      if (version >= VERSION_ESQUEMA && guardada === version) return version;
      while (version < VERSION_ESQUEMA) {
        await MIGRACIONES[version]();
        version += 1;
      }
      await base().setItem(CLAVE_VERSION, JSON.stringify(version));
      return version;
    } catch {
      return 0;
    }
  });

