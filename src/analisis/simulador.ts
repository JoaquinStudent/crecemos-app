// src/analisis/simulador.ts
// "¿Y si subo S/ 1?": cuánto ganarías por ciclo con otro precio, si se vende lo mismo. Es solo una
// cuenta: no toca ningún dato. Sin React ni reloj (AGENTS.md, regla 3).
import { agruparCiclos } from '@dominio/ciclo';
import { formatoSoles, redondearSoles } from '@dominio/formato';
import type { Cierre, Producto } from '@dominio/tipos';

/** De cuánto en cuánto se mueve el precio simulado. */
export const PASO_PRECIO = 0.5;
/** Lo máximo que se puede simular por encima del precio actual. */
export const MAXIMO_AUMENTO = 3;
/** Cuántos ciclos recientes entran en el promedio de lo que se vende. */
export const CICLOS_PROMEDIO = 3;
/** Desde este aumento (en soles) se avisa que es mucho de golpe. */
export const AUMENTO_CON_AVISO = 2;
/** Desde esta fracción del precio actual (0.25 = una cuarta parte) también se avisa. */
const FRACCION_CON_AVISO = 0.25;

export const AVISO_SUBIR_DE_A_POCO =
  'Subir de a poco suele funcionar mejor. Muchos vendedores suben de a un sol: más que eso, la gente puede dejar de comprar.';

export interface SimulacionPrecio {
  productoId: string;
  delta: number;
  precioActual: number;
  precioSimulado: number;
  costo: number;
  /** Porciones que se venden por ciclo, promedio de los últimos ciclos. */
  unidadesPorCiclo: number;
  gananciaActual: number;
  gananciaSimulada: number;
  /** Simulada − actual: lo que ganarías de más (o de menos si bajas) por ciclo. */
  gananciaExtra: number;
  /** Hay ventas del producto para estimar. */
  hayDatos: boolean;
  /** El aumento es grande: conviene subir de a poco. */
  avisoSubirDeAPoco: boolean;
  /** "Con S/ 8.00 ganarías S/ 40.00 más por ciclo si se vende lo mismo." */
  frase: string;
}

/** Mueve el aumento un paso y lo deja dentro de 0 … +S/ 3. */
export const moverDelta = (delta: number, pasos: 1 | -1): number =>
  Math.min(MAXIMO_AUMENTO, Math.max(0, redondearSoles(delta + pasos * PASO_PRECIO)));

/**
 * Porciones vendidas por ciclo: promedio de los últimos ciclos con ventas del producto. El ciclo en
 * curso se deja fuera si hay otro completo, porque está a medias y bajaría el promedio.
 */
export const unidadesPorCiclo = (cierres: Cierre[], productoId: string): number => {
  const vendidasPorCiclo = agruparCiclos(cierres)
    .map(ciclo =>
      ciclo.cierres.reduce((total, c) => {
        const l = c.lineas.find(x => x.productoId === productoId);
        return l ? total + Math.max(0, l.preparadas - l.sobrantes) : total;
      }, 0),
    )
    .map((vendidas, i) => ({ vendidas, i }));
  const conVentas = vendidasPorCiclo.filter(c => c.vendidas > 0);
  const ultimo = vendidasPorCiclo.length - 1;
  const completos = conVentas.filter(c => c.i !== ultimo);
  const elegidos = (completos.length > 0 ? completos : conVentas).slice(-CICLOS_PROMEDIO);
  if (elegidos.length === 0) return 0;
  return redondearSoles(elegidos.reduce((t, c) => t + c.vendidas, 0) / elegidos.length);
};

/** Simula `delta` soles más (o menos, hasta volver al actual) sobre el precio de venta del producto. */
export const simularPrecio = (
  cierres: Cierre[],
  producto: Producto,
  delta: number,
): SimulacionPrecio => {
  const unidades = unidadesPorCiclo(cierres, producto.id);
  const precioSimulado = redondearSoles(producto.precioVenta + delta);
  const gananciaActual = redondearSoles((producto.precioVenta - producto.costoUnitario) * unidades);
  const gananciaSimulada = redondearSoles((precioSimulado - producto.costoUnitario) * unidades);
  const gananciaExtra = redondearSoles(gananciaSimulada - gananciaActual);
  const hayDatos = unidades > 0;
  const avisoSubirDeAPoco =
    delta > AUMENTO_CON_AVISO ||
    (producto.precioVenta > 0 && delta >= producto.precioVenta * FRACCION_CON_AVISO);
  return {
    productoId: producto.id,
    delta,
    precioActual: producto.precioVenta,
    precioSimulado,
    costo: producto.costoUnitario,
    unidadesPorCiclo: unidades,
    gananciaActual,
    gananciaSimulada,
    gananciaExtra,
    hayDatos,
    avisoSubirDeAPoco,
    frase: fraseDe(producto, precioSimulado, delta, hayDatos, gananciaActual, gananciaExtra),
  };
};

const fraseDe = (
  producto: Producto,
  precioSimulado: number,
  delta: number,
  hayDatos: boolean,
  gananciaActual: number,
  gananciaExtra: number,
): string => {
  if (!hayDatos) {
    return `Aún no tengo ventas de ${producto.nombre.toLowerCase()} para estimar.`;
  }
  if (delta === 0) {
    return `Con tu precio de ${formatoSoles(precioSimulado)} ganas ${formatoSoles(
      gananciaActual,
    )} por ciclo.`;
  }
  return `Con ${formatoSoles(precioSimulado)} ganarías ${formatoSoles(
    Math.abs(gananciaExtra),
  )} ${gananciaExtra >= 0 ? 'más' : 'menos'} por ciclo si se vende lo mismo.`;
};
