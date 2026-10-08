/**
 * Pruebas de apoyo de `porcentajeCapitalRecuperado` (no es un escenario del SPEC): la barra de
 * progreso del ciclo en Inicio. La pantalla no calcula; pide este porcentaje al dominio.
 */

import { porcentajeCapitalRecuperado } from '@dominio/ciclo';
import type { ResumenCiclo } from '@dominio/tipos';

const resumen = (venta: number, capital: number): ResumenCiclo => ({
  venta,
  capital,
  teQueda: venta - capital,
  capitalRecuperadoEn: venta >= capital ? '2026-10-06' : undefined,
  faltaParaCapital: Math.max(0, capital - venta),
});

describe('porcentajeCapitalRecuperado', () => {
  it('es el porcentaje del capital que ya se vendió, entero', () => {
    expect(porcentajeCapitalRecuperado(resumen(100, 200))).toBe(50);
    expect(porcentajeCapitalRecuperado(resumen(0, 200))).toBe(0);
    expect(porcentajeCapitalRecuperado(resumen(70, 100))).toBe(70);
  });

  it('nunca pasa de 100 aunque haya vendido más que el capital', () => {
    expect(porcentajeCapitalRecuperado(resumen(200, 200))).toBe(100);
    expect(porcentajeCapitalRecuperado(resumen(712, 318))).toBe(100);
  });

  it('con capital 0 no hay nada que recuperar: 100', () => {
    expect(porcentajeCapitalRecuperado(resumen(0, 0))).toBe(100);
    expect(porcentajeCapitalRecuperado(resumen(150, 0))).toBe(100);
  });

  it('redondea hacia abajo: 100 solo si de verdad recuperó el capital', () => {
    // 99.9 % no es 100: todavía faltan S/ 0.10.
    expect(porcentajeCapitalRecuperado(resumen(99.9, 100))).toBe(99);
    expect(porcentajeCapitalRecuperado(resumen(100, 160))).toBe(62);
    expect(porcentajeCapitalRecuperado(resumen(1, 3))).toBe(33);
  });

  it('no se equivoca por los decimales de los montos', () => {
    // 0.29 / 1 * 100 da 28.999999999999996 con decimales binarios: aquí es exactamente 29.
    expect(porcentajeCapitalRecuperado(resumen(0.29, 1))).toBe(29);
    expect(porcentajeCapitalRecuperado(resumen(57.0, 100))).toBe(57);
    expect(porcentajeCapitalRecuperado(resumen(14.35, 100))).toBe(14);
  });

  it('el resultado es 0 si no se vendió nada y sí hay capital', () => {
    expect(porcentajeCapitalRecuperado(resumen(0, 50))).toBe(0);
  });
});
