// src/dominio/referencia.ts
// Constantes de la "cuota de referencia" del pasaporte para el banco. Es una REFERENCIA del propio
// negocio, no una regla ni una aprobación de ninguna entidad: cambiarla no exige tocar la lógica.

/** Qué parte del resultado registrado promedio mensual se toma como cuota de referencia (30 %). */
export const RATIO_CUOTA_REFERENCIA = 0.3;

/** La cuota de referencia se redondea hacia abajo a múltiplos de este monto (S/): una cifra prudente. */
export const REDONDEO_CUOTA_SOLES = 10;
