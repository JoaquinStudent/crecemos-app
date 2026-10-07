// src/dominio/fecha.ts
import type { FechaNegocio } from './tipos';

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/**
 * Fecha del negocio en la zona del teléfono (AGENTS.md, regla 12).
 * Nunca toISOString(): a las 10 p.m. en Lima ya es el día siguiente en UTC.
 */
export const fechaLocal = (ahora: Date): FechaNegocio =>
  `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;
