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
  return `${pregunta}El resultado registrado del ciclo no cambia.`;
};

const ETIQUETA_VENTA = 'Venta del día';

/** Los movimientos de un día: venta en efectivo, venta por Yape y un gasto por fila. */
const movimientosDe = (c: Cierre): Movimiento[] => {
  const { efectivo } = calcularCierre(c);
  const movimientos: Movimiento[] = [];
  if (efectivo > 0) {
    movimientos.push({
      id: `${c.id}:efectivo`,
      tipo: 'venta',
      etiqueta: ETIQUETA_VENTA,
      metodo: 'Efectivo',
      monto: efectivo,
      porCobrar: false,
    });
  }
  if (c.montoYape > 0) {
    movimientos.push({
      id: `${c.id}:yape`,
      tipo: 'venta',
      etiqueta: ETIQUETA_VENTA,
      metodo: 'Yape',
      monto: redondearSoles(c.montoYape),
      porCobrar: c.yapePendiente && !c.cobradoEn,
    });
  }
  c.gastos.forEach((gasto, i) => {
    movimientos.push({
      id: `${c.id}:gasto-${i}`,
      tipo: 'gasto',
      etiqueta: ETIQUETA_GASTO[gasto.categoria],
      metodo: null,
      monto: redondearSoles(-gasto.monto),
      porCobrar: false,
    });
  });
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

/** Lo que dejó el mes en curso: la suma de lo que te quedó cada día cerrado de ese mes. */
export interface ResumenMes {
  /** 'YYYY-MM'. */
  mes: string;
  /** Ventas menos gastos de los días cerrados del mes (incluye el Yape por cobrar). */
  neto: number;
  /** Días con cierre en el mes. */
  dias: number;
}

/** El resumen del mes de `hoy` ('YYYY-MM-DD'). Sin cierres en el mes: neto 0 y 0 días. */
export const resumenDelMes = (cierres: Cierre[], hoy: string): ResumenMes => {
  const mes = hoy.slice(0, 7);
  const delMes = cierres.filter(c => c.fecha.slice(0, 7) === mes);
  return {
    mes,
    neto: redondearSoles(delMes.reduce((total, c) => total + calcularCierre(c).teQueda, 0)),
    dias: delMes.length,
  };
};
