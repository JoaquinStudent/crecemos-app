// src/analisis/graficos.ts
// Los datos de los gráficos de Resumen y del reporte: ventas por producto (la torta) y el
// resultado de cada uno de los últimos días. Puro: sin React, sin reloj (AGENTS.md, regla 3).
// Los componentes solo dibujan lo que sale de aquí.
import { colors } from '@theme/colors';
import { calcularCierre } from '@dominio/cierre';
import { restarDias } from '@dominio/fecha';
import { formatoSoles, redondearSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, Producto } from '@dominio/tipos';
import { gananciaPorProducto, ventaPorProducto } from './metricas';
import type { Periodo } from './periodo';

/** Lo que se vendió de un producto en el periodo. */
export interface ProductoPeriodo {
  productoId: string;
  /** El nombre actual del catálogo (o el de la línea del cierre si ya no está). */
  nombre: string;
  /** Unidades vendidas: preparadas menos sobrantes. */
  porciones: number;
  /** Soles vendidos, con el precio copiado en cada línea. */
  venta: number;
}

/** Una porción de la torta. */
export interface PorcionTorta {
  /** `null` en "Otros". */
  productoId: string | null;
  nombre: string;
  venta: number;
  /** Entero; las porciones de una torta suman 100. */
  porcentaje: number;
  esOtros: boolean;
  /** Cuántos productos junta ("Otros" junta varios; una porción normal, uno). */
  cantidad: number;
}

/** Un día de la ventana de "últimos días". */
export interface DiaBarra {
  fecha: FechaNegocio;
  /** El resultado registrado del día; `null` si ese día no tiene cierre (un hueco, no un cero). */
  resultado: number | null;
  /** Lo vendido ese día; 0 en un hueco. */
  venta: number;
}

export interface UltimosDias {
  dias: DiaBarra[];
  /** El día con más resultado entre los que tienen cierre. */
  mejor: DiaBarra | null;
  /** El día con menos resultado entre los que tienen cierre. */
  peor: DiaBarra | null;
}

/** Cuántas porciones tiene a lo más la torta, "Otros" incluido. */
export const MAX_PORCIONES_TORTA = 5;

const DESDE_SIEMPRE: FechaNegocio = '0000-00-00';

/**
 * Lo vendido por producto en esos cierres, de mayor a menor venta (empate: por nombre). Solo los
 * productos con ventas. Reutiliza `gananciaPorProducto` y `ventaPorProducto`. No muta la entrada.
 */
export const productosDelPeriodo = (
  cierres: Cierre[],
  productos: Producto[],
): ProductoPeriodo[] => {
  const ventas = ventaPorProducto(cierres, DESDE_SIEMPRE);
  return gananciaPorProducto(cierres, DESDE_SIEMPRE, productos)
    .map(g => ({
      productoId: g.productoId,
      nombre: g.nombre,
      porciones: g.seVende,
      venta: ventas.get(g.productoId) ?? 0,
    }))
    .filter(p => p.venta > 0)
    .sort((a, b) => b.venta - a.venta || a.nombre.localeCompare(b.nombre));
};

/** Reparte 100 entre las partes con el método del mayor resto: enteros que siempre suman 100. */
const porcentajesQueSuman100 = (ventas: number[]): number[] => {
  const total = ventas.reduce((suma, v) => suma + v, 0);
  if (total <= 0) return ventas.map(() => 0);
  const exactos = ventas.map(v => (v * 100) / total);
  const base = exactos.map(e => Math.floor(e + 1e-9));
  let faltan = 100 - base.reduce((suma, b) => suma + b, 0);
  const porResto = exactos
    .map((e, i) => ({ i, resto: e - base[i] }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of porResto) {
    if (faltan <= 0) break;
    base[i] += 1;
    faltan -= 1;
  }
  return base;
};

/**
 * Las porciones de la torta: los productos que más venden y, si no caben, "Otros" con el resto. A
 * lo más `maximo` porciones; con exactamente `maximo` productos no hay "Otros". Los porcentajes son
 * enteros y suman 100. Sin ventas, sin porciones.
 */
export const porcionesTorta = (
  productos: ProductoPeriodo[],
  maximo: number = MAX_PORCIONES_TORTA,
): PorcionTorta[] => {
  const conVenta = productos
    .filter(p => p.venta > 0)
    .sort((a, b) => b.venta - a.venta || a.nombre.localeCompare(b.nombre));
  if (conVenta.length === 0) return [];

  const propias = conVenta.length <= maximo ? conVenta : conVenta.slice(0, maximo - 1);
  const resto = conVenta.slice(propias.length);
  const porciones: Omit<PorcionTorta, 'porcentaje'>[] = propias.map(p => ({
    productoId: p.productoId,
    nombre: p.nombre,
    venta: p.venta,
    esOtros: false,
    cantidad: 1,
  }));
  if (resto.length > 0) {
    porciones.push({
      productoId: null,
      nombre: 'Otros',
      venta: redondearSoles(resto.reduce((suma, p) => suma + p.venta, 0)),
      esOtros: true,
      cantidad: resto.length,
    });
  }
  const porcentajes = porcentajesQueSuman100(porciones.map(p => p.venta));
  return porciones.map((p, i) => ({ ...p, porcentaje: porcentajes[i] }));
};

/** '44 %'; una porción de menos de 1 % dice "menos de 1 %" (nunca "0 %"). */
export const textoPorcentaje = (porcentaje: number): string =>
  porcentaje <= 0 ? 'menos de 1 %' : `${porcentaje} %`;

/** 'Pancita, 44 % de lo que vendiste' · 'Otros (2 productos), 7 % de lo que vendiste'. */
export const textoPorcion = (p: PorcionTorta): string => {
  const nombre = p.esOtros
    ? `${p.nombre} (${p.cantidad} ${p.cantidad === 1 ? 'producto' : 'productos'})`
    : p.nombre;
  return `${nombre}, ${textoPorcentaje(p.porcentaje)} de lo que vendiste`;
};

/** Lo que oye el lector de pantalla: la lista completa, con palabras y sin depender del color. */
export const etiquetaTorta = (porciones: PorcionTorta[]): string => {
  if (porciones.length === 0) return 'Torta de ventas por producto. Sin ventas en este periodo.';
  const partes = porciones.map(p => {
    const nombre = p.esOtros ? `${p.nombre} (${p.cantidad} productos)` : p.nombre;
    const porciento = p.porcentaje <= 0 ? 'menos de 1' : String(p.porcentaje);
    return `${nombre}, ${porciento} por ciento de lo que vendiste, ${formatoSoles(p.venta)}`;
  });
  return `Torta de ventas por producto. ${partes.join('. ')}.`;
};

/** Cómo se rellena cada porción: un color del tema y una marca, para que el color no vaya solo. */
export interface EstiloPorcion {
  /** Nombre de la marca, en palabras. */
  patron: 'liso' | 'rayas' | 'puntos' | 'cuadrícula' | 'líneas';
  relleno: string;
  /** Color de la marca dibujada encima del relleno. */
  marca: string;
}

/**
 * Los cinco estilos, en orden. El naranja solo es relleno (con la marca oscura): nunca texto. El
 * último es gris: es "Otros" cuando hay más de cinco productos.
 */
export const ESTILOS_TORTA: readonly EstiloPorcion[] = [
  { patron: 'liso', relleno: colors.primary, marca: colors.textInverse },
  { patron: 'rayas', relleno: colors.info, marca: colors.textInverse },
  { patron: 'puntos', relleno: colors.success, marca: colors.textInverse },
  { patron: 'cuadrícula', relleno: colors.accent, marca: colors.text },
  { patron: 'líneas', relleno: colors.textMuted, marca: colors.textInverse },
];

/**
 * El resultado registrado de cada día de los últimos `n` (7, 14 o 30), contando hasta el último día
 * del periodo y sin empezar antes de su primer día. Un día sin cierre es un hueco (`null`), no un
 * cero. `cierres` son los del periodo. Sin cierres, sin días.
 */
export const ultimosDias = (
  cierres: Cierre[],
  periodo: Pick<Periodo, 'desde' | 'hasta'>,
  n: number,
): UltimosDias => {
  if (periodo.desde === null || cierres.length === 0 || n < 1) {
    return { dias: [], mejor: null, peor: null };
  }
  const tramo = restarDias(periodo.hasta, n - 1);
  const inicio = periodo.desde > tramo ? periodo.desde : tramo;
  if (inicio > periodo.hasta) return { dias: [], mejor: null, peor: null };

  const porFecha = new Map(cierres.map(c => [c.fecha, calcularCierre(c)]));
  const dias: DiaBarra[] = [];
  for (let f = inicio; f <= periodo.hasta; f = restarDias(f, -1)) {
    const resumen = porFecha.get(f);
    dias.push({
      fecha: f,
      resultado: resumen ? resumen.teQueda : null,
      venta: resumen ? resumen.venta : 0,
    });
  }
  const conCierre = dias.filter(d => d.resultado !== null);
  let mejor: DiaBarra | null = null;
  let peor: DiaBarra | null = null;
  for (const d of conCierre) {
    if (mejor === null || (d.resultado as number) > (mejor.resultado as number)) mejor = d;
    if (peor === null || (d.resultado as number) < (peor.resultado as number)) peor = d;
  }
  return { dias, mejor, peor };
};
