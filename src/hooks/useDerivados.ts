// src/hooks/useDerivados.ts
// Lo que se calcula a partir de los cierres y se usa en más de una pantalla (ciclos y sus
// resúmenes). Se agrupa UNA vez por lista de cierres: el estado del Provider es inmutable, así
// que la misma lista (mismo objeto) siempre da el mismo resultado y las pantallas lo comparten
// en vez de recalcularlo en cada render.
import { useMemo } from 'react';
import { agruparCiclos, resumirCiclo } from '@dominio/ciclo';
import type { Cierre, Ciclo, ResumenCiclo } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';

export interface Derivados {
  /** Ciclos de compra en orden cronológico. */
  ciclos: Ciclo[];
  /** El último ciclo, o `null` si no hay cierres. */
  cicloActual: Ciclo | null;
  /** El ciclo anterior al actual, o `null`. */
  cicloAnterior: Ciclo | null;
  resumenActual: ResumenCiclo | null;
  resumenAnterior: ResumenCiclo | null;
}

const porCierres = new WeakMap<Cierre[], Derivados>();

/** Puro y cacheado por identidad de la lista; la usa el hook y se puede probar sin React. */
export const derivarDe = (cierres: Cierre[]): Derivados => {
  const guardado = porCierres.get(cierres);
  if (guardado) return guardado;
  const ciclos = agruparCiclos(cierres);
  const cicloActual = ciclos.length > 0 ? ciclos[ciclos.length - 1] : null;
  const cicloAnterior = ciclos.length > 1 ? ciclos[ciclos.length - 2] : null;
  const derivados: Derivados = {
    ciclos,
    cicloActual,
    cicloAnterior,
    resumenActual: cicloActual ? resumirCiclo(cicloActual) : null,
    resumenAnterior: cicloAnterior ? resumirCiclo(cicloAnterior) : null,
  };
  porCierres.set(cierres, derivados);
  return derivados;
};

export const useDerivados = (): Derivados => {
  const { cierres } = useCrecemos();
  return useMemo(() => derivarDe(cierres), [cierres]);
};
