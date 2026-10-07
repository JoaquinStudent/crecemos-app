// src/dominio/productosPorDefecto.ts
// Valores supuestos de sdd/domain.md ("Datos del dominio que no están confirmados").
// Se confirman con Freddy antes del Sprint-04 (P4).
import type { Producto } from './tipos';

const actualizadoEn = '2026-07-15';

export const PRODUCTOS_POR_DEFECTO: Producto[] = [
  { id: 'p-anticucho', nombre: 'Anticucho', unidad: 'porcion', precioVenta: 10, costoUnitario: 8.2, actualizadoEn, activo: true },
  { id: 'p-pancita', nombre: 'Pancita', unidad: 'porcion', precioVenta: 9, costoUnitario: 8.0, actualizadoEn, activo: true },
  { id: 'p-rachi', nombre: 'Rachi', unidad: 'porcion', precioVenta: 9, costoUnitario: 7.6, actualizadoEn, activo: true },
  { id: 'p-chicha', nombre: 'Chicha', unidad: 'vaso', precioVenta: 2, costoUnitario: 1.6, actualizadoEn, activo: true },
];
