// src/analisis/resumenNegocio.ts
// El resumen agregado que viaja SOLO al modo conversación del chat: un objeto pequeño y cerrado con
// totales por mes y por producto, el mejor y el peor día de la semana, el ciclo actual y hoy. Es lo
// único que la conversación sabe del negocio, y todas las cifras que diga deben estar aquí
// (`validarConversacion`). NUNCA lleva nombre, negocio, foto, Yape, ubicación, el catálogo completo ni
// un cierre suelto con su fecha: solo sumas y promedios. Reutiliza las cuentas de siempre
// (senales.ts, metricas.ts, reglas.ts y el dominio): no calcula nada por su cuenta.
// Puro: sin red, sin reloj, sin React (AGENTS.md, reglas 3 y 8). La fecha de hoy entra por `ctx.hoy`.
import { calcularCierre } from '@dominio/cierre';
import { agruparCiclos, resumirCiclo } from '@dominio/ciclo';
import { restarDias } from '@dominio/fecha';
import { nombreMes, redondearSoles } from '@dominio/formato';
import type { Cierre, ContextoAnalisis } from '@dominio/tipos';
import { extraerCifras } from './cifras';
import { gananciaPorProducto, ventaPorProducto } from './metricas';
import { DIAS_PLURAL, medirDias, mejorDiaDeLaSemana, peorDiaDeLaSemana } from './reglas';
import { mesAnterior, totalesDelMes } from './senales';

/** Cuántos meses entran, contando el actual. */
export const MESES_RESUMEN = 6;
/** Los productos se miden en los últimos 90 días, contando hoy. */
export const DIAS_PRODUCTOS_RESUMEN = 90;
/** Tope del resumen serializado; si se pasa, se quitan primero los productos que menos venden. */
export const MAX_CARACTERES_RESUMEN = 1500;
/** Largo máximo del nombre de un producto en el resumen. */
export const MAX_NOMBRE_PRODUCTO = 30;

export interface MesResumen {
  /** 'octubre 2026': el mes y el año, nunca un día. */
  mes: string;
  ventas: number;
  gastos: number;
  /** Ventas menos gastos: el "resultado registrado". */
  resultado: number;
  /** Cuántos días tienen cierre en ese mes. */
  dias: number;
  /** Solo en el mes de hoy (llega hasta hoy). */
  enCurso?: true;
}

export interface ProductoResumen {
  nombre: string;
  /** Porciones vendidas en los últimos 90 días. */
  porciones: number;
  /** Soles vendidos en los últimos 90 días. */
  venta: number;
}

export interface DiaResumen {
  /** 'lunes', 'miércoles'… en plural, como en las recomendaciones. */
  dia: string;
  /** Lo que deja en promedio ese día de la semana (ganancia del día, no "resultado registrado"). */
  gananciaPromedio: number;
}

export interface ResumenNegocio {
  /** Del más antiguo al actual; solo los meses con días cerrados. */
  meses: MesResumen[];
  /** De los que más venden a los que menos. */
  productos: ProductoResumen[];
  /** `null` si todavía no hay cuatro semanas de cierres para compararlos. */
  diasDeLaSemana: { mejor: DiaResumen | null; peor: DiaResumen | null } | null;
  /** El ciclo de compra actual; `null` sin cierres. */
  ciclo: { ventas: number; gastos: number; resultado: number } | null;
  hoy: { ventas: number; gastos: number; resultado: number; cerrado: boolean };
}

/** Un nombre de catálogo apto para viajar: sin símbolos raros y de a lo más 30 caracteres. */
const nombreSeguro = (nombre: string): string =>
  nombre
    .replace(/[^\wáéíóúüñÁÉÍÓÚÜÑ .'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NOMBRE_PRODUCTO)
    .trim();

const diaDe = (dia: { dia: number } | null, promedios: Map<number, number>): DiaResumen | null =>
  dia === null || !promedios.has(dia.dia)
    ? null
    : { dia: DIAS_PLURAL[dia.dia], gananciaPromedio: promedios.get(dia.dia) as number };

/** Un solo cierre sin cifras de otro día: los totales del día de hoy. */
const deHoy = (cierres: Cierre[], hoy: string): ResumenNegocio['hoy'] => {
  const delDia = cierres.filter(c => c.fecha === hoy).map(calcularCierre);
  const suma = (valor: (r: ReturnType<typeof calcularCierre>) => number): number =>
    redondearSoles(delDia.reduce((total, r) => total + valor(r), 0));
  return {
    ventas: suma(r => r.venta),
    gastos: suma(r => r.gastoTotal),
    resultado: suma(r => r.teQueda),
    cerrado: delDia.length > 0,
  };
};

/**
 * Arma el resumen del negocio con los cierres que ya usa el chat. Los cierres posteriores a `hoy` no
 * cuentan. No muta la entrada y cabe en `MAX_CARACTERES_RESUMEN` serializado.
 */
export const armarResumenNegocio = (ctx: ContextoAnalisis): ResumenNegocio => {
  const cierres = ctx.cierres.filter(c => c.fecha <= ctx.hoy);
  const base: ContextoAnalisis = { cierres, productos: ctx.productos, hoy: ctx.hoy };

  const mesesAtras: string[] = [];
  let mes = ctx.hoy.slice(0, 7);
  for (let i = 0; i < MESES_RESUMEN; i++) {
    mesesAtras.unshift(mes);
    mes = mesAnterior(mes);
  }
  const meses: MesResumen[] = mesesAtras
    .map(m => ({ m, totales: totalesDelMes(cierres, m) }))
    .filter(({ totales }) => totales.dias > 0)
    .map(({ m, totales }) => ({
      mes: `${nombreMes(`${m}-01`)} ${m.slice(0, 4)}`,
      ventas: totales.venta,
      gastos: totales.gastos,
      resultado: totales.teQueda,
      dias: totales.dias,
      ...(m === ctx.hoy.slice(0, 7) ? { enCurso: true as const } : {}),
    }));

  const desde = restarDias(ctx.hoy, DIAS_PRODUCTOS_RESUMEN - 1);
  const ventas = ventaPorProducto(cierres, desde);
  const productos: ProductoResumen[] = gananciaPorProducto(cierres, desde, ctx.productos)
    .filter(g => g.seVende > 0 && nombreSeguro(g.nombre) !== '')
    .map(g => ({
      nombre: nombreSeguro(g.nombre),
      porciones: g.seVende,
      venta: ventas.get(g.productoId) ?? 0,
    }))
    .sort((a, b) => b.porciones - a.porciones || a.nombre.localeCompare(b.nombre));

  const medido = medirDias(base);
  const promedios = new Map((medido?.dias ?? []).map(d => [d.dia, d.promedio]));
  const mejor = diaDe(mejorDiaDeLaSemana(base), promedios);
  const peor = diaDe(peorDiaDeLaSemana(base), promedios);

  const ciclos = agruparCiclos(cierres);
  const actual = ciclos.length > 0 ? resumirCiclo(ciclos[ciclos.length - 1]) : null;

  const resumen: ResumenNegocio = {
    meses,
    productos,
    diasDeLaSemana: mejor === null && peor === null ? null : { mejor, peor },
    ciclo:
      actual === null
        ? null
        : { ventas: actual.venta, gastos: actual.capital, resultado: actual.teQueda },
    hoy: deHoy(cierres, ctx.hoy),
  };

  // Si se pasa del tope, primero se quitan los productos que menos venden y luego los meses más viejos.
  while (JSON.stringify(resumen).length > MAX_CARACTERES_RESUMEN && resumen.productos.length > 3) {
    resumen.productos.pop();
  }
  while (JSON.stringify(resumen).length > MAX_CARACTERES_RESUMEN && resumen.meses.length > 1) {
    resumen.meses.shift();
  }
  return resumen;
};

/** Todas las cifras que el resumen contiene (`extraerCifras` sobre su forma serializada). */
export const cifrasDelResumen = (resumen: ResumenNegocio): string[] =>
  extraerCifras(JSON.stringify(resumen));
