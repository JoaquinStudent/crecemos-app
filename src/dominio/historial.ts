// src/dominio/historial.ts
import { calcularCierre } from './cierre';
import { formatoFecha, formatoSoles } from './formato';
import type { Cierre } from './tipos';

/** La confirmación para borrar, con la consecuencia en soles. */
export const mensajeBorrar = (c: Cierre): string =>
  `¿Borrar el cierre del ${formatoFecha(c.fecha).toLowerCase()}? ` +
  `Se van a restar ${formatoSoles(calcularCierre(c).teQueda)} de tu ciclo.`;
