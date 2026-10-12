import * as ciclo from '@dominio/ciclo';
import type { Cierre, Producto } from '@dominio/tipos';
import { evaluarReglas } from '@analisis/reglas';
import { derivarDe } from '@hooks/useDerivados';

const cierre = (fecha: string, abreCiclo = false): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [
    {
      productoId: 'p-a',
      nombre: 'A',
      preparadas: 30,
      sobrantes: 4,
      precioUnitario: 9,
      costoUnitario: 7,
    },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: [{ categoria: 'mercaderia', monto: 100 }],
  abreCiclo,
  creadoEn: '2026-10-07T12:00:00.000Z',
  actualizadoEn: '2026-10-07T12:00:00.000Z',
});

const PRODUCTOS: Producto[] = [
  {
    id: 'p-a',
    nombre: 'A',
    unidad: 'porcion',
    precioVenta: 9,
    costoUnitario: 7,
    actualizadoEn: '2026-09-01',
    activo: true,
  },
];

describe('derivarDe', () => {
  const cierres = [cierre('2026-09-14', true), cierre('2026-09-28', true), cierre('2026-09-29')];

  it('agrupa una sola vez por lista de cierres (misma identidad = mismo resultado)', () => {
    const espia = jest.spyOn(ciclo, 'agruparCiclos');
    const a = derivarDe(cierres);
    const b = derivarDe(cierres);
    expect(b).toBe(a);
    expect(espia).toHaveBeenCalledTimes(1);
    espia.mockRestore();
  });

  it('actual, anterior y sus resúmenes', () => {
    const d = derivarDe([...cierres]);
    expect(d.ciclos).toHaveLength(2);
    expect(d.cicloActual?.inicio).toBe('2026-09-28');
    expect(d.cicloAnterior?.inicio).toBe('2026-09-14');
    expect(d.resumenActual?.venta).toBe(468);
    expect(d.resumenAnterior?.venta).toBe(234);
  });

  it('sin cierres no hay ciclos', () => {
    const d = derivarDe([]);
    expect(d).toMatchObject({ ciclos: [], cicloActual: null, resumenActual: null });
  });
});

describe('evaluarReglas agrupa los ciclos una sola vez', () => {
  const cierres = [cierre('2026-09-14', true), cierre('2026-09-28', true)];

  it('un solo agruparCiclos por evaluación', () => {
    const espia = jest.spyOn(ciclo, 'agruparCiclos');
    evaluarReglas({ cierres, productos: PRODUCTOS, hoy: '2026-10-07' });
    expect(espia).toHaveBeenCalledTimes(1);
    espia.mockRestore();
  });

  it('con ciclos ya calculados no agrupa de nuevo y da lo mismo', () => {
    const sin = evaluarReglas({ cierres, productos: PRODUCTOS, hoy: '2026-10-07' });
    const ciclos = ciclo.agruparCiclos(cierres);
    const espia = jest.spyOn(ciclo, 'agruparCiclos');
    const con = evaluarReglas({ cierres, productos: PRODUCTOS, hoy: '2026-10-07', ciclos });
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
    expect(con).toEqual(sin);
  });
});
