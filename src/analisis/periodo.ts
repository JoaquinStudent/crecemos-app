// src/analisis/periodo.ts
// El filtro de periodo de Resumen y de Mi reporte: una sola función pura que, dado el filtro, la
// fecha de hoy y los cierres, devuelve el rango, su etiqueta en palabras y los cierres de dentro.
// Puro: sin React, sin reloj (AGENTS.md, regla 3). Los cierres posteriores a hoy nunca cuentan.
import { finDeMes, restarDias } from '@dominio/fecha';
import { formatoFechaCorta, nombreMes } from '@dominio/formato';
import type { Cierre, FechaNegocio, Senales } from '@dominio/tipos';
import { mesAnterior, senalesBanco } from './senales';

export type FiltroPeriodo =
  | { tipo: 'todo' }
  | { tipo: 'esteMes' }
  | { tipo: 'mesPasado' }
  | { tipo: 'ultimos30' }
  | { tipo: 'mes'; mes: string }
  | { tipo: 'rango'; desde: string; hasta: string };

/** El filtro por defecto: todo el historial hasta hoy. */
export const FILTRO_TODO: FiltroPeriodo = { tipo: 'todo' };

export interface Periodo {
  filtro: FiltroPeriodo;
  /** Primer día del periodo; `null` si "todo" y aún no hay cierres. */
  desde: FechaNegocio | null;
  /** Último día del periodo: nunca pasa de hoy. */
  hasta: FechaNegocio;
  /** En palabras: "Todo tu historial", "Septiembre 2026", "Del 16 de septiembre al 15 de octubre". */
  etiqueta: string;
  /** El periodo llega hasta el mes en el que estamos. */
  enCurso: boolean;
  /** Los cierres de dentro, del más antiguo al más reciente. */
  cierres: Cierre[];
}

/** Los días de la ventana de "últimos 30 días": hoy y los 29 anteriores. */
export const DIAS_ULTIMOS = 30;

const ETIQUETA_TODO = 'Todo tu historial';
const EN_CURSO = ' (en curso)';
const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

const capitalizar = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

/** 'Septiembre 2026'. */
export const etiquetaMes = (mes: string): string =>
  `${capitalizar(nombreMes(`${mes}-01`))} ${mes.slice(0, 4)}`;

/** 'Sep 2026': para los chips. */
export const etiquetaMesCorta = (mes: string): string =>
  `${capitalizar(nombreMes(`${mes}-01`).slice(0, 3))} ${mes.slice(0, 4)}`;

const porFecha = (a: Cierre, b: Cierre): number => a.fecha.localeCompare(b.fecha);

const primerDiaDelMes = (mes: string): FechaNegocio => `${mes}-01`;
const ultimoDiaDelMes = (mes: string): FechaNegocio => finDeMes(`${mes}-01`);
const menor = (a: string, b: string): string => (a <= b ? a : b);

/** Los años van en ambos extremos si alguno no es el de hoy: así nunca hay duda de cuál es. */
const rangoEnPalabras = (desde: FechaNegocio, hasta: FechaNegocio, hoy: FechaNegocio): string => {
  const conAnio = desde.slice(0, 4) !== hoy.slice(0, 4) || hasta.slice(0, 4) !== hoy.slice(0, 4);
  const fecha = (f: FechaNegocio): string =>
    conAnio ? `${formatoFechaCorta(f)} de ${f.slice(0, 4)}` : formatoFechaCorta(f);
  return `Del ${fecha(desde)} al ${fecha(hasta)}`;
};

const entre = (cierres: Cierre[], desde: FechaNegocio, hasta: FechaNegocio): Cierre[] =>
  cierres.filter(c => c.fecha >= desde && c.fecha <= hasta).sort(porFecha);

/**
 * El periodo que corresponde a un filtro. Un mes que no existe ('2026-13') se trata como "todo".
 * Un rango con los meses al revés se ordena. No muta la entrada.
 */
export const periodoDe = (filtro: FiltroPeriodo, hoy: FechaNegocio, cierres: Cierre[]): Periodo => {
  const mesActual = hoy.slice(0, 7);
  const hastaHoy = cierres.filter(c => c.fecha <= hoy);

  const delMes = (mes: string, f: FiltroPeriodo): Periodo => {
    const desde = primerDiaDelMes(mes);
    const hasta = menor(ultimoDiaDelMes(mes), hoy);
    const enCurso = mes === mesActual;
    return {
      filtro: f,
      desde,
      hasta,
      etiqueta: `${etiquetaMes(mes)}${enCurso ? EN_CURSO : ''}`,
      enCurso,
      cierres: entre(hastaHoy, desde, hasta),
    };
  };

  const todo = (f: FiltroPeriodo): Periodo => {
    const ordenados = [...hastaHoy].sort(porFecha);
    return {
      filtro: f,
      desde: ordenados.length > 0 ? ordenados[0].fecha : null,
      hasta: hoy,
      etiqueta: ETIQUETA_TODO,
      enCurso: true,
      cierres: ordenados,
    };
  };

  switch (filtro.tipo) {
    case 'esteMes':
      return delMes(mesActual, filtro);
    case 'mesPasado':
      return delMes(mesAnterior(mesActual), filtro);
    case 'mes':
      return FORMATO_MES.test(filtro.mes) ? delMes(filtro.mes, filtro) : todo(filtro);
    case 'ultimos30': {
      const desde = restarDias(hoy, DIAS_ULTIMOS - 1);
      return {
        filtro,
        desde,
        hasta: hoy,
        etiqueta: rangoEnPalabras(desde, hoy, hoy),
        enCurso: true,
        cierres: entre(hastaHoy, desde, hoy),
      };
    }
    case 'rango': {
      if (!FORMATO_MES.test(filtro.desde) || !FORMATO_MES.test(filtro.hasta)) return todo(filtro);
      const primero = menor(filtro.desde, filtro.hasta);
      const ultimo = filtro.desde > filtro.hasta ? filtro.desde : filtro.hasta;
      if (primero === ultimo) return delMes(primero, filtro);
      const desde = primerDiaDelMes(primero);
      const hasta = menor(ultimoDiaDelMes(ultimo), hoy);
      return {
        filtro,
        desde,
        hasta,
        etiqueta: rangoEnPalabras(desde, hasta, hoy),
        enCurso: ultimo >= mesActual,
        cierres: entre(hastaHoy, desde, hasta),
      };
    }
    case 'todo':
    default:
      return todo(filtro);
  }
};

/** Los meses ('AAAA-MM') que tienen cierres hasta hoy, el más reciente primero. */
export const mesesConCierres = (cierres: Cierre[], hoy: FechaNegocio): string[] =>
  [...new Set(cierres.filter(c => c.fecha <= hoy).map(c => c.fecha.slice(0, 7)))].sort().reverse();

/** El reporte se puede emitir siempre que el periodo tenga al menos un cierre. */
export const puedeEmitirReporte = (p: Periodo): boolean => p.cierres.length > 0;

/**
 * La fecha con la que se calculan las señales del banco: hoy si el periodo llega a hoy; si ya
 * terminó, el día siguiente a su último día (así su último mes cuenta como completo).
 */
export const fechaDeCorte = (p: Periodo, hoy: FechaNegocio): FechaNegocio =>
  p.hasta >= hoy ? hoy : restarDias(p.hasta, -1);

/**
 * Las señales del banco de un periodo. `propios` son los cierres del reporte (los de ejemplo ya
 * quedaron fuera, salvo que sean lo único que hay). El aviso de "en construcción" mide cuánto
 * registro tiene en total: que el filtro sea angosto no le quita registro a nadie.
 */
export const senalesDelPeriodo = (
  propios: Cierre[],
  periodo: Periodo,
  hoy: FechaNegocio,
): Senales => {
  const delPeriodo = senalesBanco(periodo.cierres, fechaDeCorte(periodo, hoy));
  const total = senalesBanco(propios, hoy);
  return {
    ...delPeriodo,
    enConstruccion: total.enConstruccion,
    diasFaltantes: total.diasFaltantes,
  };
};
