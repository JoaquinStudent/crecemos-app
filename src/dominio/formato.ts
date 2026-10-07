// src/dominio/formato.ts
import type { FechaNegocio, LineaCierre } from './tipos';

/** Monto a 2 decimales (AGENTS.md, regla 13). */
export const redondearSoles = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * 'S/ 1,240.00'. Sin Intl a propósito: Intl ('es-PE', PEN) separa con un espacio
 * no separable (U+00A0) y depende del ICU del motor (Hermes); aquí el texto es
 * siempre el mismo.
 */
export const formatoSoles = (n: number): string => {
  const [entero, decimales] = Math.abs(redondearSoles(n)).toFixed(2).split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0 ? '-' : ''}S/ ${conMiles}.${decimales}`;
};

export const sanitizeAmount = (text: string): string => {
  const normalized = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const [integer, ...decimals] = normalized.split('.');
  if (decimals.length === 0) return integer;
  return `${integer}.${decimals.join('').slice(0, 2)}`;
};

export const parseAmount = (text: string): number => {
  const value = parseFloat(text);
  return Number.isFinite(value) ? value : 0;
};

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** 'Martes 6 de octubre'. Fecha local, sin pasar por UTC (AGENTS.md, regla 12). */
export const formatoFecha = (f: FechaNegocio): string => {
  const [anio, mes, dia] = f.split('-').map(Number);
  const diaSemana = new Date(anio, mes - 1, dia).getDay();
  return `${DIAS[diaSemana]} ${dia} de ${MESES[mes - 1]}`;
};

/** '15 de julio', sin día de la semana: para fechas de referencia. */
export const formatoFechaCorta = (f: FechaNegocio): string => {
  const [, mes, dia] = f.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]}`;
};

/** Sobrantes × costo por porción: lo que costó lo que no se vendió (D10: no es caja). */
export const sobranteSoles = (linea: LineaCierre): number =>
  redondearSoles(linea.sobrantes * linea.costoUnitario);

/** 'Te sobró S/ 38.00 en rachi'. */
export const textoSobrante = (linea: LineaCierre): string =>
  `Te sobró ${formatoSoles(sobranteSoles(linea))} en ${linea.nombre.toLowerCase()}`;
