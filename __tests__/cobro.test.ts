/**
 * Pruebas de apoyo de cobro.ts (no son escenarios del SPEC).
 * Bordes de totalPorCobrar y marcarCobrados que el escenario 1 y 2 no tocan.
 */

import { marcarCobrados, totalPorCobrar } from '@dominio/cobro';
import type { Cierre, FechaNegocio } from '@dominio/tipos';

const cierre = (
  id: string,
  fecha: FechaNegocio,
  montoYape: number,
  yapePendiente: boolean,
  cobradoEn?: FechaNegocio,
): Cierre => ({
  id,
  fecha,
  lineas: [],
  montoYape,
  yapePendiente,
  ...(cobradoEn ? { cobradoEn } : {}),
  gastos: [],
  abreCiclo: false,
  creadoEn: '2026-10-07T17:00:00.000Z',
  actualizadoEn: '2026-10-07T17:00:00.000Z',
});

describe('totalPorCobrar', () => {
  it('sin cierres es cero, sin pagos y sin fecha', () => {
    expect(totalPorCobrar([])).toEqual({ total: 0, pagos: 0 });
  });

  it('un Yape que no esta pendiente (efectivo del dueno) no cuenta', () => {
    const resumen = totalPorCobrar([cierre('a', '2026-10-05', 80, false)]);
    expect(resumen).toEqual({ total: 0, pagos: 0 });
  });

  it('un Yape cobrado no cuenta', () => {
    const resumen = totalPorCobrar([cierre('a', '2026-10-05', 80, true, '2026-10-06')]);
    expect(resumen.total).toBe(0);
    expect(resumen.pagos).toBe(0);
    expect(resumen.desde).toBeUndefined();
  });

  it('desde es la fecha pendiente mas antigua, sin importar el orden recibido', () => {
    const resumen = totalPorCobrar([
      cierre('a', '2026-10-06', 20, true),
      cierre('b', '2026-09-30', 10, true),
      cierre('c', '2026-10-02', 15, true),
      cierre('d', '2026-09-01', 99, true, '2026-09-02'),
    ]);
    expect(resumen.desde).toBe('2026-09-30');
    expect(resumen.pagos).toBe(3);
    expect(resumen.total).toBe(45);
  });

  it('redondea a dos decimales al sumar', () => {
    const resumen = totalPorCobrar([
      cierre('a', '2026-10-01', 0.1, true),
      cierre('b', '2026-10-02', 0.2, true),
    ]);
    expect(resumen.total).toBe(0.3);
  });

  it('no muta los cierres recibidos', () => {
    const cierres = [cierre('a', '2026-10-06', 20, true)];
    const copia = JSON.parse(JSON.stringify(cierres));
    totalPorCobrar(cierres);
    expect(cierres).toEqual(copia);
  });
});

describe('marcarCobrados', () => {
  it('pone la fecha de cobro solo en los ids pedidos', () => {
    const cierres = [cierre('a', '2026-10-05', 50, true), cierre('b', '2026-10-06', 46, true)];

    const resultado = marcarCobrados(cierres, ['a'], '2026-10-07');

    expect(resultado.find(c => c.id === 'a')?.cobradoEn).toBe('2026-10-07');
    expect(resultado.find(c => c.id === 'b')?.cobradoEn).toBeUndefined();
  });

  it('no muta los cierres originales y devuelve copias', () => {
    const original = cierre('a', '2026-10-05', 50, true);

    const [copia] = marcarCobrados([original], ['a'], '2026-10-07');

    expect(original.cobradoEn).toBeUndefined();
    expect(copia).not.toBe(original);
  });

  it('ignora ids que no existen', () => {
    const cierres = [cierre('a', '2026-10-05', 50, true)];

    const resultado = marcarCobrados(cierres, ['no-existe'], '2026-10-07');

    expect(resultado).toEqual(cierres);
  });

  it('no cambia un cierre ya cobrado: conserva su fecha de cobro', () => {
    const cobrado = cierre('a', '2026-10-01', 50, true, '2026-10-03');

    const [resultado] = marcarCobrados([cobrado], ['a'], '2026-10-07');

    expect(resultado.cobradoEn).toBe('2026-10-03');
  });

  it('no marca un cierre que no tenia Yape pendiente', () => {
    const efectivo = cierre('a', '2026-10-05', 0, false);

    const [resultado] = marcarCobrados([efectivo], ['a'], '2026-10-07');

    expect(resultado.cobradoEn).toBeUndefined();
  });

  it('no cambia actualizadoEn (el dominio no tiene reloj)', () => {
    const [resultado] = marcarCobrados([cierre('a', '2026-10-05', 50, true)], ['a'], '2026-10-07');

    expect(resultado.actualizadoEn).toBe('2026-10-07T17:00:00.000Z');
  });

  it('despues de marcar, el total por cobrar baja a cero', () => {
    const cierres = [cierre('a', '2026-10-05', 50, true), cierre('b', '2026-10-06', 46, true)];

    const resultado = marcarCobrados(cierres, ['a', 'b'], '2026-10-07');

    expect(totalPorCobrar(resultado)).toEqual({ total: 0, pagos: 0 });
  });
});
