// src/dominio/cobro.ts
import { redondearSoles } from './formato';
import type { Cierre, FechaNegocio, ResumenPorCobrar } from './tipos';

const estaPendiente = (c: Cierre): boolean => c.yapePendiente && !c.cobradoEn;

/** Suma el Yape de los cierres por cobrar. `desde` es la fecha pendiente más antigua. */
export const totalPorCobrar = (cierres: Cierre[]): ResumenPorCobrar => {
  const pendientes = cierres.filter(estaPendiente);
  const resumen: ResumenPorCobrar = {
    total: redondearSoles(pendientes.reduce((suma, c) => suma + c.montoYape, 0)),
    pagos: pendientes.length,
  };
  if (pendientes.length > 0) {
    // 'YYYY-MM-DD' ordena bien como texto.
    resumen.desde = pendientes.map(c => c.fecha).reduce((a, b) => (b < a ? b : a));
  }
  return resumen;
};

/** Copias con `cobradoEn` en los cierres pendientes pedidos. No muta ni toca `actualizadoEn`. */
export const marcarCobrados = (cierres: Cierre[], ids: string[], fecha: FechaNegocio): Cierre[] =>
  cierres.map(c => (ids.includes(c.id) && estaPendiente(c) ? { ...c, cobradoEn: fecha } : c));
