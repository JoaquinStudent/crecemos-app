/* eslint-disable no-bitwise */
/**
 * Redondeo consistente: las sumas de montos con 2 decimales, pasadas por los puntos de
 * agregación del dominio, nunca devuelven más de 2 decimales. Y sanitizeAmount.
 */
import { calcularCierre } from '@dominio/cierre';
import { agruparCiclos, resumirCiclo } from '@dominio/ciclo';
import { totalPorCobrar } from '@dominio/cobro';
import { redondearSoles, sanitizeAmount } from '@dominio/formato';
import { totalDelDia } from '@dominio/yape';
import type { Cierre } from '@dominio/tipos';

// PRNG determinista (mulberry32) para que la prueba sea reproducible.
const prng = (semilla: number) => () => {
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const centavos = (rnd: () => number, max: number) => Math.round(rnd() * max * 100) / 100;
const tieneMax2Decimales = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 && redondearSoles(n) === n;

const cierreAleatorio = (rnd: () => number, i: number): Cierre => ({
  id: `c-${i}`,
  fecha: `2026-${String(1 + (i % 9)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
  lineas: Array.from({ length: 1 + Math.floor(rnd() * 4) }, (_, k) => {
    const preparadas = 1 + Math.floor(rnd() * 60);
    return {
      productoId: `p-${k}`,
      nombre: `P${k}`,
      preparadas,
      sobrantes: Math.floor(rnd() * preparadas),
      precioUnitario: centavos(rnd, 20),
      costoUnitario: centavos(rnd, 15),
    };
  }),
  montoYape: centavos(rnd, 300),
  yapePendiente: rnd() > 0.5,
  gastos: Array.from({ length: Math.floor(rnd() * 4) }, () => ({
    categoria: 'otro' as const,
    monto: centavos(rnd, 80),
  })),
  abreCiclo: rnd() > 0.7,
  creadoEn: '2026-10-07T12:00:00.000Z',
  actualizadoEn: '2026-10-07T12:00:00.000Z',
});

describe('Dinero: nunca más de 2 decimales tras agregar', () => {
  it('calcularCierre, resumirCiclo y totalPorCobrar en 300 escenarios al azar', () => {
    const rnd = prng(20261016);
    for (let n = 0; n < 300; n++) {
      const cierres = Array.from({ length: 1 + Math.floor(rnd() * 12) }, (_, i) =>
        cierreAleatorio(rnd, n * 20 + i),
      );
      for (const c of cierres) {
        const r = calcularCierre(c);
        for (const v of [r.venta, r.efectivo, r.montoYape, r.gastoTotal, r.teQueda]) {
          expect(tieneMax2Decimales(v)).toBe(true);
        }
      }
      for (const ciclo of agruparCiclos(cierres)) {
        const r = resumirCiclo(ciclo);
        for (const v of [r.venta, r.capital, r.teQueda, r.faltaParaCapital]) {
          expect(tieneMax2Decimales(v)).toBe(true);
        }
      }
      expect(tieneMax2Decimales(totalPorCobrar(cierres).total)).toBe(true);
    }
  });

  it('totalDelDia de muchos yapes con centavos queda a 2 decimales', () => {
    const rnd = prng(7);
    const yapes = Array.from({ length: 200 }, (_, i) => ({
      id: `y${i}`,
      fecha: '2026-10-01',
      hora: '10:00',
      monto: centavos(rnd, 50),
    }));
    expect(tieneMax2Decimales(totalDelDia(yapes, '2026-10-01'))).toBe(true);
  });

  it('el clásico 0.1 + 0.2 se redondea', () => {
    expect(redondearSoles(0.1 + 0.2)).toBe(0.3);
  });
});

describe('sanitizeAmount', () => {
  it.each([
    ['', ''],
    ['12', '12'],
    ['12.5', '12.5'],
    ['12,50', '12.50'],
    ['12.345', '12.34'],
    ['1.2.3', '1.2'],
    ['1..5', '1.'],
    ['abc', ''],
    ['S/ 8.5x', '8.5'],
    ['.5', '.5'],
    ['7.', '7.'],
  ])('%j → %j', (entrada, esperado) => {
    expect(sanitizeAmount(entrada)).toBe(esperado);
  });
});
