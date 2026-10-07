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
} from 'react';
import { nuevoCierre } from '@dominio/cierre';
import { fechaLocal } from '@dominio/fecha';
import { PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { cambiarPrecio } from '@dominio/producto';
import type { Cierre, DatosCierre, Perfil, Producto } from '@dominio/tipos';
import { ResultadoValidacion, validarCierre, validarProducto } from '@dominio/validacion';
import {
  guardarCierre,
  guardarPerfil as guardarPerfilRepo,
  guardarProducto,
  listarCierres,
  listarProductos,
  obtenerPerfil,
} from '@storage/repositorio';

interface Estado {
  cierres: Cierre[];
  productos: Producto[];
  perfil: Perfil;
  cargando: boolean;
}

type Accion =
  | { tipo: 'cargado'; cierres: Cierre[]; productos: Producto[]; perfil: Perfil }
  | { tipo: 'perfilGuardado'; perfil: Perfil }
  | { tipo: 'productoGuardado'; producto: Producto }
  | { tipo: 'cierreGuardado'; cierre: Cierre };

const estadoInicial: Estado = {
  cierres: [],
  productos: [],
  perfil: PERFIL_POR_DEFECTO,
  cargando: true,
};

const reducer = (estado: Estado, accion: Accion): Estado => {
  switch (accion.tipo) {
    case 'cargado':
      return {
        cierres: accion.cierres,
        productos: accion.productos,
        perfil: accion.perfil,
        cargando: false,
      };
    case 'perfilGuardado':
      return { ...estado, perfil: accion.perfil };
    case 'productoGuardado':
      // Reemplaza por id sin mover el producto de lugar.
      return {
        ...estado,
        productos: estado.productos.map(p => (p.id === accion.producto.id ? accion.producto : p)),
      };
    case 'cierreGuardado':
      // Un cierre por fecha (D9): el nuevo reemplaza al de su misma fecha.
      return {
        ...estado,
        cierres: [...estado.cierres.filter(c => c.fecha !== accion.cierre.fecha), accion.cierre],
      };
  }
};

interface ContextoCrecemos extends Estado {
  /** Valida, arma y guarda el cierre del día. Devuelve los errores si no pasa. */
  guardarDia: (datos: DatosCierre) => Promise<ResultadoValidacion>;
  guardarPerfil: (parcial: Partial<Perfil>) => Promise<void>;
  /** Valida y cambia precio y costo desde hoy. Devuelve los errores si no pasa. */
  cambiarPrecioProducto: (
    productoId: string,
    precio: number,
    costo: number,
  ) => Promise<ResultadoValidacion>;
}

const Contexto = createContext<ContextoCrecemos | null>(null);

export const CrecemosProvider = ({ children }: { children: React.ReactNode }) => {
  const [estado, dispatch] = useReducer(reducer, estadoInicial);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarCierres(), listarProductos(), obtenerPerfil()]).then(
      ([cierres, productos, perfil]) => {
        if (vigente) {
          dispatch({ tipo: 'cargado', cierres, productos, perfil: perfil ?? PERFIL_POR_DEFECTO });
        }
      },
    );
    return () => {
      vigente = false;
    };
  }, []);

  const guardarDia = useCallback(
    async (datos: DatosCierre): Promise<ResultadoValidacion> => {
      const resultado = validarCierre(datos, estado.productos);
      if (!resultado.ok) return resultado;
      const cierre = nuevoCierre(datos, estado.productos, estado.perfil, new Date());
      await guardarCierre(cierre);
      dispatch({ tipo: 'cierreGuardado', cierre });
      return resultado;
    },
    [estado.productos, estado.perfil],
  );

  const guardarPerfil = useCallback(
    async (parcial: Partial<Perfil>): Promise<void> => {
      const perfil: Perfil = {
        ...estado.perfil,
        ...parcial,
        actualizadoEn: new Date().toISOString(),
      };
      await guardarPerfilRepo(perfil);
      dispatch({ tipo: 'perfilGuardado', perfil });
    },
    [estado.perfil],
  );

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

  const valor = useMemo(
    () => ({ ...estado, guardarDia, guardarPerfil, cambiarPrecioProducto }),
    [estado, guardarDia, guardarPerfil, cambiarPrecioProducto],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
};

export const useCrecemos = (): ContextoCrecemos => {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useCrecemos se usa dentro de CrecemosProvider');
  return contexto;
};
