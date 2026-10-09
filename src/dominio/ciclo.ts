// src/dominio/ciclo.ts
import { calcularCierre } from './cierre';
import { formatoFecha, formatoSoles, redondearSoles, sobranteSoles } from './formato';
import type { Cierre, Ciclo, MercaderiaProducto, Producto, ResumenCiclo } from './tipos';

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

/**
 * Por producto, lo preparado, lo vendido y lo que costó lo que sobró (D10: no es caja),
 * sumado en todos los días del ciclo. Ordenado por nombre; el nombre es el de la línea
 * más reciente. No muta el ciclo.
 */
export const mercaderiaDelCiclo = (
  ciclo: Ciclo,
  productos: Producto[] = [],
): MercaderiaProducto[] => {
  const nombres = new Map(productos.map(p => [p.id, p.nombre]));
  const porProducto = new Map<string, MercaderiaProducto>();
  for (const cierre of ciclo.cierres) {
    for (const linea of cierre.lineas) {
      const previo = porProducto.get(linea.productoId);
      porProducto.set(linea.productoId, {
        productoId: linea.productoId,
        nombre: nombres.get(linea.productoId) ?? linea.nombre,
        preparadas: (previo?.preparadas ?? 0) + linea.preparadas,
        vendidas: (previo?.vendidas ?? 0) + linea.preparadas - linea.sobrantes,
        sobranteSoles: (previo?.sobranteSoles ?? 0) + sobranteSoles(linea),
      });
    }
  }
  return [...porProducto.values()]
    .map(m => ({ ...m, sobranteSoles: redondearSoles(m.sobranteSoles) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre) || a.productoId.localeCompare(b.productoId));
};

/**
 * Cuánto del capital del ciclo ya se recuperó con lo vendido: entero de 0 a 100. Sin capital
 * no hay nada que recuperar (100). Redondea hacia abajo, así que 100 significa que de verdad
 * recuperó el capital y nunca "casi". Cuenta en centavos para que 0.29 / 1 dé 29 y no 28.
 */
export const porcentajeCapitalRecuperado = (r: ResumenCiclo): number => {
  if (r.capital <= 0) return 100;
  const centavosVendidos = Math.max(0, Math.round(r.venta * 100));
  const centavosCapital = Math.round(r.capital * 100);
  return Math.min(100, Math.floor((centavosVendidos * 100) / centavosCapital));
};
