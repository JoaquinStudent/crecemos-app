// src/analisis/reporteDelPeriodo.ts
// Todo lo que el reporte necesita de un filtro de periodo, calculado de una vez: el periodo, las
// señales del banco, la inteligencia de negocio y lo que reciben el texto y el documento. Lo usa
// Mi reporte (en un `useMemo`). Puro: sin React, sin reloj (AGENTS.md, regla 3).
import type { Cierre, FechaNegocio, Producto, Senales } from '@dominio/tipos';
import { inteligenciaDelNegocio, type ExtraReporte, type Inteligencia } from './inteligencia';
import { periodoDe, senalesDelPeriodo, type FiltroPeriodo, type Periodo } from './periodo';
import { cierresDelReporte } from './senales';

export interface DatosReporte {
  periodo: Periodo;
  senales: Senales;
  inteligencia: Inteligencia;
  /** Lo que se le pasa a `textoReporte` y a `htmlReporte`. */
  extra: ExtraReporte;
  /** Solo hay datos de ejemplo: el reporte es una demostración. */
  soloEjemplo: boolean;
}

/**
 * Los datos del reporte de un periodo. `todos` son todos los cierres de la app: aquí se aplica la
 * regla del reporte (los de ejemplo quedan fuera, salvo que sean lo único que hay). `hoy` entra como
 * parámetro. No muta la entrada.
 */
export const datosDelReporte = (
  todos: Cierre[],
  filtro: FiltroPeriodo,
  productos: Producto[],
  hoy: FechaNegocio,
): DatosReporte => {
  const { cierres: propios, soloEjemplo } = cierresDelReporte(todos);
  const periodo = periodoDe(filtro, hoy, propios);
  const senales = senalesDelPeriodo(propios, periodo, hoy);
  // La inteligencia mira solo los cierres del periodo; `hoy` solo marca cuál es el mes en curso.
  const inteligencia = inteligenciaDelNegocio(periodo.cierres, productos, hoy);
  return {
    periodo,
    senales,
    inteligencia,
    extra: { etiquetaPeriodo: periodo.etiqueta, inteligencia },
    soloEjemplo,
  };
};
