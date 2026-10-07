// src/dominio/historial.ts
import { calcularCierre } from './cierre';
import { ETIQUETA_GASTO } from './categorias';
import { formatoFecha, formatoSoles, redondearSoles } from './formato';
import type { Cierre, FiltroHistorial, GrupoDia, Movimiento } from './tipos';

/**
 * La confirmación para borrar, con la consecuencia en soles: si el día le dejaba plata se
 * resta del ciclo; si lo dejaba en rojo, se suma; si quedó en cero, el ciclo no cambia.
 */
export const mensajeBorrar = (c: Cierre): string => {
  const teQueda = calcularCierre(c).teQueda;
  const pregunta = `¿Borrar el cierre del ${formatoFecha(c.fecha).toLowerCase()}? `;
  if (teQueda > 0) return `${pregunta}Se van a restar ${formatoSoles(teQueda)} de tu ciclo.`;
  if (teQueda < 0) return `${pregunta}Se van a sumar ${formatoSoles(-teQueda)} a tu ciclo.`;
  return `${pregunta}Lo que te queda del ciclo no cambia.`;
};

const ETIQUETA_VENTA = 'Venta del día';

/** Los movimientos de un día: venta en efectivo, venta por Yape y un gasto por fila. */
const movimientosDe = (c: Cierre): Movimiento[] => {
  const { efectivo } = calcularCierre(c);
  const movimientos: Movimiento[] = [];
  if (efectivo > 0) {
    movimientos.push({
      tipo: 'venta',
      etiqueta: ETIQUETA_VENTA,
      metodo: 'Efectivo',
      monto: efectivo,
      porCobrar: false,
    });
  }
  if (c.montoYape > 0) {
    movimientos.push({
      tipo: 'venta',
      etiqueta: ETIQUETA_VENTA,
      metodo: 'Yape',
      monto: redondearSoles(c.montoYape),
      porCobrar: c.yapePendiente && !c.cobradoEn,
    });
  }
  for (const gasto of c.gastos) {
    movimientos.push({
      tipo: 'gasto',
      etiqueta: ETIQUETA_GASTO[gasto.categoria],
      metodo: null,
      monto: redondearSoles(-gasto.monto),
      porCobrar: false,
    });
  }
  return movimientos;
};

const pasaFiltro = (m: Movimiento, filtro: FiltroHistorial): boolean => {
  switch (filtro) {
    case 'ingresos':
      return m.tipo === 'venta';
    case 'gastos':
      return m.tipo === 'gasto';
    case 'porCobrar':
      return m.porCobrar;
    default:
      return true;
  }
};

/**
 * Un grupo por cierre (un cierre por fecha, D9), del día más reciente al más
 * antiguo. Con filtro, el neto suma solo lo que queda visible y un día sin
 * movimientos no aparece. No muta la entrada.
 */
export const armarHistorial = (cierres: Cierre[], filtro: FiltroHistorial): GrupoDia[] =>
  // 'YYYY-MM-DD' ordena como texto.
  [...cierres]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .flatMap(c => {
      const movimientos = movimientosDe(c).filter(m => pasaFiltro(m, filtro));
      if (movimientos.length === 0) return [];
      return [
        {
          fecha: c.fecha,
          titulo: formatoFecha(c.fecha),
          neto: redondearSoles(movimientos.reduce((total, m) => total + m.monto, 0)),
          cierreId: c.id,
          movimientos,
        },
      ];
    });
