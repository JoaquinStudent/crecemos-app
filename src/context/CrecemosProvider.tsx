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
import { quitarFoto as quitarFotoDelPerfil, validarFoto } from '@dominio/foto';
import { normalizarPerfil, PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { cambiarPrecio } from '@dominio/producto';
import { materializarSemilla } from '@dominio/semilla';
import type { Cierre, DatosCierre, Perfil, Producto } from '@dominio/tipos';
import { DatosProducto, ResultadoValidacion, validarCierre, validarDatosProducto, validarProducto } from '@dominio/validacion';
import { SEED_URL } from '../config';
import { cargarSemilla } from '@services/seed';
import {
  eliminarCierre,
  guardarCierre,
  guardarPerfil as guardarPerfilRepo,
  guardarProducto,
  importarSemilla,
  listarCierres,
  listarProductos,
  marcarCobrado as marcarCobradoRepo,
  marcarSemillaResuelta,
  obtenerPerfil,
  semillaCargada,
} from '@storage/repositorio';

/** Cómo va la semilla de ejemplo; la pantalla decide qué texto poner (no la ve Freddy en crudo). */
export type EstadoSemilla = 'ninguna' | 'cargando' | 'lista' | 'sinRed' | 'invalida';

interface Estado {
  cierres: Cierre[];
  productos: Producto[];
  perfil: Perfil;
  cargando: boolean;
  /** `true` si no se pudo leer lo guardado al abrir: la pantalla ofrece reintentar. */
  error: boolean;
  semilla: EstadoSemilla;
}

type Accion =
  | { tipo: 'cargado'; cierres: Cierre[]; productos: Producto[]; perfil: Perfil }
  | { tipo: 'falloLaCarga' }
  | { tipo: 'reintentando' }
  | { tipo: 'semilla'; estado: EstadoSemilla }
  | { tipo: 'semillaLista'; cierres: Cierre[]; productos: Producto[] }
  | { tipo: 'cobrado'; ids: string[]; fecha: string }
  | { tipo: 'perfilGuardado'; perfil: Perfil }
  | { tipo: 'productoGuardado'; producto: Producto }
  | { tipo: 'cierreGuardado'; cierre: Cierre }
  | { tipo: 'cierreEliminado'; id: string };

const estadoInicial: Estado = {
  cierres: [],
  productos: [],
  perfil: PERFIL_POR_DEFECTO,
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
    case 'cobrado':
      return { ...estado, cierres: marcarCobrados(estado.cierres, accion.ids, accion.fecha) };
    case 'perfilGuardado':
      return { ...estado, perfil: accion.perfil };
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

interface ContextoCrecemos extends Estado {
  /** Vuelve a leer lo guardado después de un error al abrir. */
  reintentar: () => Promise<void>;
  /** Valida, arma y guarda el cierre del día. Devuelve los errores si no pasa. */
  guardarDia: (datos: DatosCierre) => Promise<ResultadoValidacion>;
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
  /** Marca como cobrado, con la fecha de hoy, todo el Yape que estaba por cobrar. */
  marcarCobrado: () => Promise<void>;
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
      const [cierres, productos, perfil] = await Promise.all([
        listarCierres(),
        listarProductos(),
        obtenerPerfil(),
      ]);
      if (!montado.current) return;
      perfilRef.current = perfil ?? PERFIL_POR_DEFECTO;
      dispatch({ tipo: 'cargado', cierres, productos, perfil: perfilRef.current });
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

  const guardarDia = useCallback(
    async (datos: DatosCierre): Promise<ResultadoValidacion> => {
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
      return resultado;
    },
    [estado.cierres, estado.productos, estado.perfil],
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

  const marcarCobrado = useCallback(async (): Promise<void> => {
    const ids = estado.cierres.filter(c => c.yapePendiente && !c.cobradoEn).map(c => c.id);
    if (ids.length === 0) return;
    const fecha = fechaLocal(new Date());
    await marcarCobradoRepo(ids, fecha);
    dispatch({ tipo: 'cobrado', ids, fecha });
  }, [estado.cierres]);

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
      marcarCobrado,
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
      marcarCobrado,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
};

export const useCrecemos = (): ContextoCrecemos => {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useCrecemos se usa dentro de CrecemosProvider');
  return contexto;
};
