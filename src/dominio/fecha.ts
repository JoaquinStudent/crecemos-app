// src/dominio/fecha.ts
import type { FechaNegocio } from './tipos';

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/**
 * Fecha del negocio en la zona del teléfono (AGENTS.md, regla 12).
 * Nunca toISOString(): a las 10 p.m. en Lima ya es el día siguiente en UTC.
 */
export const fechaLocal = (ahora: Date): FechaNegocio =>
  `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Milisegundos UTC de la medianoche de 'YYYY-MM-DD': sin pasar por la zona local. */
const medianocheUTC = (f: FechaNegocio): number => {
  const [anio, mes, dia] = f.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
};

/** Resta `n` días a una fecha del negocio (con `n` negativo suma). Aritmética UTC: no depende de la zona local (regla 12). */
export const restarDias = (f: FechaNegocio, n: number): FechaNegocio => {
  const d = new Date(medianocheUTC(f) - n * MS_POR_DIA);
  return `${d.getUTCFullYear()}-${dosDigitos(d.getUTCMonth() + 1)}-${dosDigitos(d.getUTCDate())}`;
};

/** Días de calendario de `desde` a `hasta` (negativo si `hasta` es anterior). */
export const diasEntre = (desde: FechaNegocio, hasta: FechaNegocio): number =>
  Math.round((medianocheUTC(hasta) - medianocheUTC(desde)) / MS_POR_DIA);

/** Día de la semana de la fecha del negocio: 0 = domingo … 6 = sábado. Sin zona horaria. */
export const diaSemana = (f: FechaNegocio): number => new Date(medianocheUTC(f)).getUTCDay();
