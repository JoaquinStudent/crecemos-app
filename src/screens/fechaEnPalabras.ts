// src/screens/fechaEnPalabras.ts
// "Martes 6 de octubre" (UX: fechas en palabras). Provisional de la capa de UI:
// el contrato pone formatoFecha en src/dominio en el Sprint-03 (spec03_e9);
// entonces este archivo se reemplaza por esa función.
import type { FechaNegocio } from '@dominio/tipos';

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

export const fechaEnPalabras = (fecha: FechaNegocio): string => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  // Fecha local, sin pasar por UTC (AGENTS.md, regla 12).
  const diaSemana = new Date(anio, mes - 1, dia).getDay();
  return `${DIAS[diaSemana]} ${dia} de ${MESES[mes - 1]}`;
};
