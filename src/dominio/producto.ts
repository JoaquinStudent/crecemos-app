// src/dominio/producto.ts
import { diasEntre } from './fecha';
import { redondearSoles } from './formato';
import type { FechaNegocio, Producto } from './tipos';

const DIAS_PARA_REVISAR = 90;

/** Parte 'YYYY-MM-DD' sin pasar por Date local: no depende de la zona horaria. */
const partes = (f: FechaNegocio): { a: number; m: number; d: number } => {
  const [a, m, d] = f.split('-').map(Number);
  return { a, m, d };
};

/** Meses calendario completos entre dos fechas. */
const mesesEntre = (desde: FechaNegocio, hasta: FechaNegocio): number => {
  const x = partes(desde);
  const y = partes(hasta);
  const meses = (y.a - x.a) * 12 + (y.m - x.m);
  return y.d < x.d ? meses - 1 : meses;
};

/** Devuelve una copia con el precio y el costo nuevos; no muta el producto recibido. */
export const cambiarPrecio = (
  p: Producto,
  precio: number,
  costo: number,
  hoy: FechaNegocio,
): Producto => ({
  ...p,
  precioVenta: redondearSoles(precio),
  costoUnitario: redondearSoles(costo),
  actualizadoEn: hoy,
});

export const requiereRevision = (
  p: Producto,
  hoy: FechaNegocio,
): { revisar: boolean; mensaje?: string } => {
  if (diasEntre(p.actualizadoEn, hoy) <= DIAS_PARA_REVISAR) return { revisar: false };
  const meses = mesesEntre(p.actualizadoEn, hoy);
  const tiempo = meses === 1 ? '1 mes' : `${meses} meses`;
  return {
    revisar: true,
    mensaje: `No cambias este precio desde hace ${tiempo}. ¿Sigue siendo correcto?`,
  };
};

/** "Te deja": margen estimado por porción, en soles y en % del precio de venta (D10). */
export const teDeja = (p: Producto): { monto: number; porcentaje: number } => {
  const monto = redondearSoles(p.precioVenta - p.costoUnitario);
  const porcentaje = p.precioVenta > 0 ? Math.round((monto / p.precioVenta) * 100) : 0;
  return { monto, porcentaje };
};
