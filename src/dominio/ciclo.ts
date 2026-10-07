// src/dominio/ciclo.ts
import { calcularCierre } from './cierre';
import { formatoFecha, formatoSoles, redondearSoles } from './formato';
import type { Cierre, Ciclo, ResumenCiclo } from './tipos';

/**
 * Agrupa los cierres en ciclos de compra, en orden cronológico. Un ciclo nuevo
 * empieza en cada cierre con `abreCiclo`; los anteriores al primero forman un
 * ciclo inicial. No muta la entrada.
 */
export const agruparCiclos = (cierres: Cierre[]): Ciclo[] => {
  // 'YYYY-MM-DD' ordena como texto.
  const ordenados = [...cierres].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const grupos: Cierre[][] = [];
  for (const cierre of ordenados) {
    if (cierre.abreCiclo || grupos.length === 0) grupos.push([cierre]);
    else grupos[grupos.length - 1].push(cierre);
  }
  return grupos.map(grupo => ({
    inicio: grupo[0].fecha,
    fin: grupo[grupo.length - 1].fecha,
    cierres: grupo,
  }));
};

/** Venta, capital (todos los gastos del ciclo), te queda y cuándo recuperó el capital. */
export const resumirCiclo = (ciclo: Ciclo): ResumenCiclo => {
  const ventas = ciclo.cierres.map(c => calcularCierre(c).venta);
  const venta = redondearSoles(ventas.reduce((total, v) => total + v, 0));
  const capital = redondearSoles(
    ciclo.cierres.reduce(
      (total, c) => total + c.gastos.reduce((subtotal, g) => subtotal + g.monto, 0),
      0,
    ),
  );

  let acumulada = 0;
  let capitalRecuperadoEn: string | undefined;
  for (let i = 0; i < ciclo.cierres.length && capitalRecuperadoEn === undefined; i++) {
    acumulada = redondearSoles(acumulada + ventas[i]);
    if (acumulada >= capital) capitalRecuperadoEn = ciclo.cierres[i].fecha;
  }

  return {
    venta,
    capital,
    teQueda: redondearSoles(venta - capital),
    capitalRecuperadoEn,
    faltaParaCapital: Math.max(0, redondearSoles(capital - venta)),
  };
};

/** 'Te falta S/ 64.00 para recuperar tu capital' o 'Recuperaste tu capital el martes 6 de octubre'. */
export const textoCapital = (r: ResumenCiclo): string =>
  r.capitalRecuperadoEn === undefined
    ? `Te falta ${formatoSoles(r.faltaParaCapital)} para recuperar tu capital`
    : `Recuperaste tu capital el ${formatoFecha(r.capitalRecuperadoEn).toLowerCase()}`;
