// src/context/CrecemosProvider.tsx
// Estado de la app: cierres y productos, cargados una vez desde el repositorio.
// La UI nunca llama al repositorio directamente: pasa por guardarDia.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { nuevoCierre } from '@dominio/cierre';
import type { Cierre, DatosCierre, Producto } from '@dominio/tipos';
import { ResultadoValidacion, validarCierre } from '@dominio/validacion';
import { guardarCierre, listarCierres, listarProductos } from '@storage/repositorio';

interface Estado {
  cierres: Cierre[];
  productos: Producto[];
  cargando: boolean;
}

type Accion =
  | { tipo: 'cargado'; cierres: Cierre[]; productos: Producto[] }
  | { tipo: 'cierreGuardado'; cierre: Cierre };

const estadoInicial: Estado = { cierres: [], productos: [], cargando: true };

const reducer = (estado: Estado, accion: Accion): Estado => {
  switch (accion.tipo) {
    case 'cargado':
      return { cierres: accion.cierres, productos: accion.productos, cargando: false };
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
}

const Contexto = createContext<ContextoCrecemos | null>(null);

export const CrecemosProvider = ({ children }: { children: React.ReactNode }) => {
  const [estado, dispatch] = useReducer(reducer, estadoInicial);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarCierres(), listarProductos()]).then(([cierres, productos]) => {
      if (vigente) dispatch({ tipo: 'cargado', cierres, productos });
    });
    return () => {
      vigente = false;
    };
  }, []);

  const guardarDia = useCallback(
    async (datos: DatosCierre): Promise<ResultadoValidacion> => {
      const resultado = validarCierre(datos, estado.productos);
      if (!resultado.ok) return resultado;
      const cierre = nuevoCierre(datos, estado.productos, null, new Date());
      await guardarCierre(cierre);
      dispatch({ tipo: 'cierreGuardado', cierre });
      return resultado;
    },
    [estado.productos],
  );

  const valor = useMemo(() => ({ ...estado, guardarDia }), [estado, guardarDia]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
};

export const useCrecemos = (): ContextoCrecemos => {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useCrecemos se usa dentro de CrecemosProvider');
  return contexto;
};
