// src/context/CrecemosProvider.tsx
// Estado de la app: cierres, productos y perfil, cargados una vez desde el repositorio.
// La UI nunca llama al repositorio directamente: pasa por las acciones del contexto.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { crearId, editarCierre, nuevoCierre } from '@dominio/cierre';
import { marcarCobrados } from '@dominio/cobro';
import { fechaLocal } from '@dominio/fecha';
import { redondearSoles } from '@dominio/formato';
import { DatosMeta, Meta, NOMBRE_META, validarAporte, validarMeta } from '@dominio/meta';
import { horaLocal, validarYape, YapeAnotado } from '@dominio/yape';
import { quitarFoto as quitarFotoDelPerfil, validarFoto } from '@dominio/foto';
import { normalizarPerfil, PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { cambiarPrecio } from '@dominio/producto';
import { contarDatosDeEjemplo, DatosDeEjemplo } from '@dominio/origen';
import { materializarSemilla } from '@dominio/semilla';
import type { Cierre, DatosCierre, FechaNegocio, Perfil, Producto } from '@dominio/tipos';
import { DatosProducto, ResultadoValidacion, validarCierre, validarDatosProducto, validarProducto } from '@dominio/validacion';
import { SEED_URL } from '../config';
import { cargarSemilla } from '@services/seed';
import {
  borrarDatosDeEjemplo as borrarDatosDeEjemploRepo,
  borrarMeta as borrarMetaRepo,
  eliminarCierre,
  guardarCierre,
  guardarMeta as guardarMetaRepo,
  guardarPerfil as guardarPerfilRepo,
  guardarProducto,
  guardarYapes as guardarYapesRepo,
  importarSemilla,
  listarCierres,
  listarProductos,
  listarYapes,
  marcarCobrado as marcarCobradoRepo,
  marcarSemillaResuelta,
  obtenerMeta,
  obtenerPerfil,
  semillaCargada,
} from '@storage/repositorio';

/** Cómo va la semilla de ejemplo; la pantalla decide qué texto poner (no la ve Freddy en crudo). */
export type EstadoSemilla = 'ninguna' | 'cargando' | 'lista' | 'sinRed' | 'invalida';

interface Estado {
  cierres: Cierre[];
  productos: Producto[];
  perfil: Perfil;
  /** La meta de ahorro de la cuota; `null` si no creó ninguna. */
  meta: Meta | null;
  /** Los yapes que anotó durante el día, todavía sin sumar a un cierre. */
  yapes: YapeAnotado[];
  cargando: boolean;
  /** `true` si no se pudo leer lo guardado al abrir: la pantalla ofrece reintentar. */
  error: boolean;
  semilla: EstadoSemilla;
}

type Accion =
  | { tipo: 'cargado'; cierres: Cierre[]; productos: Producto[]; perfil: Perfil; meta: Meta | null; yapes: YapeAnotado[] }
  | { tipo: 'falloLaCarga' }
  | { tipo: 'reintentando' }
  | { tipo: 'semilla'; estado: EstadoSemilla }
  | { tipo: 'semillaLista'; cierres: Cierre[]; productos: Producto[] }
  | { tipo: 'ejemploBorrado'; cierres: Cierre[]; productos: Producto[] }
  | { tipo: 'cobrado'; ids: string[]; fecha: string }
  | { tipo: 'perfilGuardado'; perfil: Perfil }
  | { tipo: 'metaGuardada'; meta: Meta | null }
  | { tipo: 'yapesGuardados'; yapes: YapeAnotado[] }
  | { tipo: 'productoGuardado'; producto: Producto }
  | { tipo: 'cierreGuardado'; cierre: Cierre }
  | { tipo: 'cierreEliminado'; id: string };

const estadoInicial: Estado = {
  cierres: [],
  productos: [],
  perfil: PERFIL_POR_DEFECTO,
  meta: null,
  yapes: [],
  cargando: true,
  error: false,
  semilla: 'ninguna',
};

const reducer = (estado: Estado, accion: Accion): Estado => {
  switch (accion.tipo) {
    case 'cargado':
      return {
        cierres: accion.cierres,
        productos: accion.productos,
        perfil: accion.perfil,
        meta: accion.meta,
        yapes: accion.yapes,
        cargando: false,
        error: false,
        semilla: 'ninguna',
      };
    case 'falloLaCarga':
      return { ...estado, cargando: false, error: true };
    case 'reintentando':
      return { ...estado, cargando: true, error: false };
    case 'semilla':
      return { ...estado, semilla: accion.estado };
    case 'semillaLista':
      return {
        ...estado,
        cierres: accion.cierres,
        productos: accion.productos,
        semilla: 'lista',
      };
    case 'ejemploBorrado':
      return { ...estado, cierres: accion.cierres, productos: accion.productos, semilla: 'ninguna' };
    case 'cobrado':
      return { ...estado, cierres: marcarCobrados(estado.cierres, accion.ids, accion.fecha) };
    case 'perfilGuardado':
      return { ...estado, perfil: accion.perfil };
    case 'metaGuardada':
      return { ...estado, meta: accion.meta };
    case 'yapesGuardados':
      return { ...estado, yapes: accion.yapes };
    case 'productoGuardado':
      // Reemplaza por id sin mover el producto de lugar.
      return {
        ...estado,
        productos: estado.productos.some(p => p.id === accion.producto.id)
          ? estado.productos.map(p => (p.id === accion.producto.id ? accion.producto : p))
          : [...estado.productos, accion.producto],
      };
    case 'cierreGuardado':
      // Un cierre por fecha (D9): el nuevo reemplaza al de su misma fecha.
      return {
        ...estado,
        cierres: [...estado.cierres.filter(c => c.fecha !== accion.cierre.fecha), accion.cierre],
      };
    case 'cierreEliminado':
      return { ...estado, cierres: estado.cierres.filter(c => c.id !== accion.id) };
  }
};

export interface OpcionesGuardarDia {
  /**
   * Si el monto de Yape ya incluye los yapes anotados de esa fecha, pasa la fecha: una vez
   * guardado el día, esos apuntes se borran (se consumieron) y no se vuelven a sumar.
   */
  consumirYapesDe?: FechaNegocio;
}

interface ContextoCrecemos extends Estado {
  /** Vuelve a leer lo guardado después de un error al abrir. */
  reintentar: () => Promise<void>;
  /** Valida, arma y guarda el cierre del día. Devuelve los errores si no pasa. */
  guardarDia: (datos: DatosCierre, opciones?: OpcionesGuardarDia) => Promise<ResultadoValidacion>;
  /** Borra el cierre con ese id. */
  eliminarDia: (id: string) => Promise<void>;
  guardarPerfil: (parcial: Partial<Perfil>) => Promise<void>;
  guardarFoto: (fotoUri: string) => Promise<ResultadoValidacion>;
  quitarFoto: () => Promise<void>;
  /** Valida y cambia precio y costo desde hoy. Devuelve los errores si no pasa. */
  cambiarPrecioProducto: (
    productoId: string,
    precio: number,
    costo: number,
  ) => Promise<ResultadoValidacion>;
  crearProducto: (datos: DatosProducto) => Promise<ResultadoValidacion>;
  editarProducto: (id: string, datos: DatosProducto) => Promise<ResultadoValidacion>;
  establecerProductoActivo: (id: string, activo: boolean) => Promise<void>;
  /** Pide la semilla de ejemplo. Si ya hay días guardados no hace nada (nunca los pisa). */
  cargarDatosDeEjemplo: () => Promise<void>;
  /** Cuántos días y productos de ejemplo hay ahora (todo en cero si no hay). */
  datosDeEjemplo: DatosDeEjemplo;
  /** Borra solo lo marcado como ejemplo; lo propio no se toca. Devuelve lo que quitó. */
  borrarDatosDeEjemplo: () => Promise<DatosDeEjemplo>;
  /** Marca como cobrado, con la fecha de hoy, todo el Yape que estaba por cobrar. */
  marcarCobrado: () => Promise<void>;
  /**
   * Crea la meta de la cuota. Si ya hay una, la edita (monto y fecha) y conserva lo ya separado.
   * Devuelve los errores si no pasa.
   */
  crearMeta: (datos: DatosMeta) => Promise<ResultadoValidacion>;
  /** Separa `monto` hoy para la meta. Sin meta o con un monto inválido, devuelve el error. */
  aportarAMeta: (monto: number) => Promise<ResultadoValidacion>;
  /** Quita un aporte de la meta (por si se equivocó). */
  quitarAporte: (id: string) => Promise<void>;
  /** Borra la meta y todo lo que tenía separado en ella. */
  borrarMeta: () => Promise<void>;
  /** Anota un yape de hoy, con la hora de ahora. Devuelve el error si el monto no sirve. */
  anotarYape: (monto: number) => Promise<ResultadoValidacion>;
  /** Quita un yape anotado (por si se equivocó). */
  quitarYape: (id: string) => Promise<void>;
}

const Contexto = createContext<ContextoCrecemos | null>(null);

export const CrecemosProvider = ({ children }: { children: React.ReactNode }) => {
  const [estado, dispatch] = useReducer(reducer, estadoInicial);

  // El Provider sigue montado: ninguna respuesta tardía toca el estado de un Provider ya desmontado.
  const montado = useRef(true);
  // Una sola descarga a la vez, aunque el botón se toque dos veces.
  const descargando = useRef(false);
  // El perfil más reciente, incluso el que aún se está guardando: dos cambios seguidos
  // (dos switches) se apoyan uno en el otro en vez de pisarse con un `estado.perfil` viejo.
  const perfilRef = useRef<Perfil>(PERFIL_POR_DEFECTO);
  // La meta más reciente, incluso la que aún se está guardando: dos aportes seguidos se suman.
  const metaRef = useRef<Meta | null>(null);
  // Igual con los yapes anotados: dos apuntes seguidos no se pisan.
  const yapesRef = useRef<YapeAnotado[]>([]);

  /**
   * Pide la semilla en segundo plano y, si llega bien, la guarda y la deja en el estado.
   * Sin red, tarde o inválida no guarda nada. Los datos del usuario nunca se pisan: si
   * mientras tanto guardó un día, la semilla se descarta.
   */
  const descargarSemilla = useCallback(async (): Promise<void> => {
    if (descargando.current) return;
    descargando.current = true;
    const avisar = (accion: Accion) => {
      if (montado.current) dispatch(accion);
    };
    try {
      if ((await listarCierres()).length > 0 || (await listarProductos()).length > 0) return;
      avisar({ tipo: 'semilla', estado: 'cargando' });
      const resultado = await cargarSemilla(globalThis.fetch, SEED_URL);
      if (!resultado.ok) {
        avisar({
          tipo: 'semilla',
          estado: resultado.error === 'SEMILLA_INVALIDA' ? 'invalida' : 'sinRed',
        });
        return;
      }
      const ahora = new Date();
      if ((await listarCierres()).length > 0 || (await listarProductos()).length > 0) {
        await marcarSemillaResuelta(ahora.toISOString());
        avisar({ tipo: 'semilla', estado: 'ninguna' });
        return;
      }
      const materializada = materializarSemilla(resultado.semilla, ahora);
      await importarSemilla(materializada, ahora.toISOString());
      avisar({ tipo: 'semillaLista', ...materializada });
    } catch {
      // Un fallo del almacenamiento tampoco bloquea la app: queda lista para reintentar.
      avisar({ tipo: 'semilla', estado: 'sinRed' });
    } finally {
      descargando.current = false;
    }
  }, []);

  // La app queda lista apenas lee lo guardado. Si la lectura falla, se muestra el error (con
  // "Reintentar") en vez de dejar la pantalla en blanco para siempre.
  const cargar = useCallback(async (): Promise<void> => {
    try {
      const [cierres, productos, perfil, meta, yapes] = await Promise.all([
        listarCierres(),
        listarProductos(),
        obtenerPerfil(),
        // La meta y los yapes anotados son extras: si no se pueden leer, la app abre igual.
        obtenerMeta().catch(() => null),
        listarYapes().catch(() => [] as YapeAnotado[]),
      ]);
      if (!montado.current) return;
      perfilRef.current = perfil ?? PERFIL_POR_DEFECTO;
      metaRef.current = meta;
      yapesRef.current = yapes;
      dispatch({ tipo: 'cargado', cierres, productos, perfil: perfilRef.current, meta, yapes });
      // La demostración es voluntaria: solo se descarga cuando se toca el botón.
    } catch {
      if (montado.current) dispatch({ tipo: 'falloLaCarga' });
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    cargar();
    return () => {
      montado.current = false;
    };
  }, [cargar]);

  const reintentar = useCallback(async (): Promise<void> => {
    dispatch({ tipo: 'reintentando' });
    await cargar();
  }, [cargar]);

  /** Guarda la lista de yapes anotados apoyada en `yapesRef`; si falla, el ref vuelve atrás. */
  const persistirYapes = useCallback(async (yapes: YapeAnotado[]): Promise<void> => {
    const previos = yapesRef.current;
    yapesRef.current = yapes;
    try {
      await guardarYapesRepo(yapes);
    } catch (error) {
      if (yapesRef.current === yapes) yapesRef.current = previos;
      throw error;
    }
    dispatch({ tipo: 'yapesGuardados', yapes });
  }, []);

  const guardarDia = useCallback(
    async (datos: DatosCierre, opciones?: OpcionesGuardarDia): Promise<ResultadoValidacion> => {
      const resultado = validarCierre(datos, estado.productos);
      if (!resultado.ok) return resultado;
      const ahora = new Date();
      // Un día ya cerrado se edita (conserva id y precios viejos, P13); si no, se crea.
      const fecha = datos.fecha ?? fechaLocal(ahora);
      const existente = estado.cierres.find(c => c.fecha === fecha);
      const cierre = existente
        ? editarCierre(existente, datos, estado.productos, estado.perfil, ahora)
        : nuevoCierre(datos, estado.productos, estado.perfil, ahora);
      await guardarCierre(cierre);
      dispatch({ tipo: 'cierreGuardado', cierre });
      const consumida = opciones?.consumirYapesDe;
      if (consumida && yapesRef.current.some(y => y.fecha === consumida)) {
        // El día ya quedó guardado: si esto falla, los apuntes se quedan (nunca se pierde el
        // cierre) y solo se vuelven a sumar si la persona lo pide con "Sumar mis yapes anotados".
        await persistirYapes(yapesRef.current.filter(y => y.fecha !== consumida)).catch(
          () => undefined,
        );
      }
      return resultado;
    },
    [estado.cierres, estado.productos, estado.perfil, persistirYapes],
  );

  const eliminarDia = useCallback(async (id: string): Promise<void> => {
    await eliminarCierre(id);
    dispatch({ tipo: 'cierreEliminado', id });
  }, []);

  /** Guarda `perfil` apoyado en `perfilRef`; si falla, deja el ref como estaba y relanza. */
  const persistirPerfil = useCallback(async (perfil: Perfil): Promise<void> => {
    const previo = perfilRef.current;
    perfilRef.current = perfil;
    try {
      await guardarPerfilRepo(perfil);
    } catch (error) {
      if (perfilRef.current === perfil) perfilRef.current = previo;
      throw error;
    }
    dispatch({ tipo: 'perfilGuardado', perfil });
  }, []);

  const guardarPerfil = useCallback(
    async (parcial: Partial<Perfil>): Promise<void> => {
      await persistirPerfil(
        normalizarPerfil({
          ...perfilRef.current,
          ...parcial,
          actualizadoEn: new Date().toISOString(),
        }),
      );
    },
    [persistirPerfil],
  );

  const guardarFoto = useCallback(
    async (fotoUri: string): Promise<ResultadoValidacion> => {
      const resultado = validarFoto(fotoUri);
      if (resultado.ok) await guardarPerfil({ fotoUri });
      return resultado;
    },
    [guardarPerfil],
  );

  const quitarFoto = useCallback(async (): Promise<void> => {
    // No pasa por `guardarPerfil`: mezclar `{ fotoUri: undefined }` dejaría el campo en el objeto.
    await persistirPerfil({
      ...quitarFotoDelPerfil(perfilRef.current),
      actualizadoEn: new Date().toISOString(),
    });
  }, [persistirPerfil]);

  const cambiarPrecioProducto = useCallback(
    async (productoId: string, precio: number, costo: number): Promise<ResultadoValidacion> => {
      const resultado = validarProducto({ precioVenta: precio, costoUnitario: costo });
      if (!resultado.ok) return resultado;
      const producto = estado.productos.find(p => p.id === productoId);
      if (!producto) throw new Error(`Producto desconocido: ${productoId}`);
      const cambiado = cambiarPrecio(producto, precio, costo, fechaLocal(new Date()));
      await guardarProducto(cambiado);
      dispatch({ tipo: 'productoGuardado', producto: cambiado });
      return resultado;
    },
    [estado.productos],
  );

  const crearProducto = useCallback(async (datos: DatosProducto): Promise<ResultadoValidacion> => {
    const resultado = validarDatosProducto(datos, estado.productos);
    if (!resultado.ok) return resultado;
    const producto: Producto = {
      ...datos,
      nombre: datos.nombre.trim(),
      unidad: datos.unidad.trim(),
      precioVenta: redondearSoles(datos.precioVenta),
      costoUnitario: redondearSoles(datos.costoUnitario),
      id: `p-${crearId()}`,
      activo: true,
      actualizadoEn: fechaLocal(new Date()),
    };
    await guardarProducto(producto);
    dispatch({ tipo: 'productoGuardado', producto });
    return resultado;
  }, [estado.productos]);

  const editarProducto = useCallback(async (id: string, datos: DatosProducto): Promise<ResultadoValidacion> => {
    const actual = estado.productos.find(p => p.id === id);
    if (!actual) throw new Error(`Producto desconocido: ${id}`);
    const resultado = validarDatosProducto(datos, estado.productos, id);
    if (!resultado.ok) return resultado;
    const producto: Producto = {
      ...actual,
      ...datos,
      nombre: datos.nombre.trim(),
      unidad: datos.unidad.trim(),
      precioVenta: redondearSoles(datos.precioVenta),
      costoUnitario: redondearSoles(datos.costoUnitario),
      actualizadoEn: fechaLocal(new Date()),
    };
    await guardarProducto(producto);
    dispatch({ tipo: 'productoGuardado', producto });
    return resultado;
  }, [estado.productos]);

  const establecerProductoActivo = useCallback(async (id: string, activo: boolean): Promise<void> => {
    const actual = estado.productos.find(p => p.id === id);
    if (!actual) throw new Error(`Producto desconocido: ${id}`);
    const producto = { ...actual, activo };
    await guardarProducto(producto);
    dispatch({ tipo: 'productoGuardado', producto });
  }, [estado.productos]);

  const cargarDatosDeEjemplo = useCallback(async (): Promise<void> => {
    // Se mira lo guardado, no el estado: es lo que de verdad se perdería.
    if ((await listarCierres()).length > 0 || (await listarProductos()).length > 0 || await semillaCargada()) return;
    await descargarSemilla();
  }, [descargarSemilla]);

  const borrarDatosDeEjemplo = useCallback(async (): Promise<DatosDeEjemplo> => {
    const { cierresRestantes, productosRestantes, ...quitado } = await borrarDatosDeEjemploRepo();
    dispatch({ tipo: 'ejemploBorrado', cierres: cierresRestantes, productos: productosRestantes });
    return quitado;
  }, []);

  const datosDeEjemplo = useMemo(
    () => contarDatosDeEjemplo(estado.cierres, estado.productos),
    [estado.cierres, estado.productos],
  );

  const marcarCobrado = useCallback(async (): Promise<void> => {
    const ids = estado.cierres.filter(c => c.yapePendiente && !c.cobradoEn).map(c => c.id);
    if (ids.length === 0) return;
    const fecha = fechaLocal(new Date());
    await marcarCobradoRepo(ids, fecha);
    dispatch({ tipo: 'cobrado', ids, fecha });
  }, [estado.cierres]);

  /** Guarda (o borra, con `null`) la meta apoyada en `metaRef`; si falla, el ref vuelve a como estaba. */
  const persistirMeta = useCallback(async (meta: Meta | null): Promise<void> => {
    const previa = metaRef.current;
    metaRef.current = meta;
    try {
      if (meta) await guardarMetaRepo(meta);
      else await borrarMetaRepo();
    } catch (error) {
      if (metaRef.current === meta) metaRef.current = previa;
      throw error;
    }
    dispatch({ tipo: 'metaGuardada', meta });
  }, []);

  const crearMeta = useCallback(
    async (datos: DatosMeta): Promise<ResultadoValidacion> => {
      const hoy = fechaLocal(new Date());
      const actual = metaRef.current;
      // Al editar solo el monto de una meta ya vencida, su fecha pasada no se reclama.
      const resultado = validarMeta(
        datos,
        actual && datos.fechaLimite === actual.fechaLimite ? actual.fechaLimite : hoy,
      );
      if (!resultado.ok) return resultado;
      await persistirMeta({
        id: actual?.id ?? `m-${crearId()}`,
        nombre: datos.nombre?.trim() || actual?.nombre || NOMBRE_META,
        montoObjetivo: redondearSoles(datos.montoObjetivo),
        fechaLimite: datos.fechaLimite,
        creada: actual?.creada ?? hoy,
        aportes: actual?.aportes ?? [],
      });
      return resultado;
    },
    [persistirMeta],
  );

  const aportarAMeta = useCallback(
    async (monto: number): Promise<ResultadoValidacion> => {
      const actual = metaRef.current;
      if (!actual) return { ok: false, errores: { meta: 'Primero crea tu meta' } };
      const resultado = validarAporte(monto);
      if (!resultado.ok) return resultado;
      await persistirMeta({
        ...actual,
        aportes: [
          ...actual.aportes,
          { id: `a-${crearId()}`, fecha: fechaLocal(new Date()), monto: redondearSoles(monto) },
        ],
      });
      return resultado;
    },
    [persistirMeta],
  );

  const quitarAporte = useCallback(
    async (id: string): Promise<void> => {
      const actual = metaRef.current;
      if (!actual || !actual.aportes.some(a => a.id === id)) return;
      await persistirMeta({ ...actual, aportes: actual.aportes.filter(a => a.id !== id) });
    },
    [persistirMeta],
  );

  const borrarMeta = useCallback(async (): Promise<void> => {
    if (!metaRef.current) return;
    await persistirMeta(null);
  }, [persistirMeta]);

  const anotarYape = useCallback(
    async (monto: number): Promise<ResultadoValidacion> => {
      const resultado = validarYape(monto);
      if (!resultado.ok) return resultado;
      const ahora = new Date();
      await persistirYapes([
        ...yapesRef.current,
        {
          id: `y-${crearId()}`,
          fecha: fechaLocal(ahora),
          hora: horaLocal(ahora),
          monto: redondearSoles(monto),
        },
      ]);
      return resultado;
    },
    [persistirYapes],
  );

  const quitarYape = useCallback(
    async (id: string): Promise<void> => {
      if (!yapesRef.current.some(y => y.id === id)) return;
      await persistirYapes(yapesRef.current.filter(y => y.id !== id));
    },
    [persistirYapes],
  );

  const valor = useMemo(
    () => ({
      ...estado,
      reintentar,
      guardarDia,
      eliminarDia,
      guardarPerfil,
      guardarFoto,
      quitarFoto,
      cambiarPrecioProducto,
      crearProducto,
      editarProducto,
      establecerProductoActivo,
      cargarDatosDeEjemplo,
      datosDeEjemplo,
      borrarDatosDeEjemplo,
      marcarCobrado,
      crearMeta,
      aportarAMeta,
      quitarAporte,
      borrarMeta,
      anotarYape,
      quitarYape,
    }),
    [
      estado,
      reintentar,
      guardarDia,
      eliminarDia,
      guardarPerfil,
      guardarFoto,
      quitarFoto,
      cambiarPrecioProducto,
      crearProducto,
      editarProducto,
      establecerProductoActivo,
      cargarDatosDeEjemplo,
      datosDeEjemplo,
      borrarDatosDeEjemplo,
      marcarCobrado,
      crearMeta,
      aportarAMeta,
      quitarAporte,
      borrarMeta,
      anotarYape,
      quitarYape,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
};

export const useCrecemos = (): ContextoCrecemos => {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useCrecemos se usa dentro de CrecemosProvider');
  return contexto;
};
