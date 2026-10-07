// src/dominio/formato.ts

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
