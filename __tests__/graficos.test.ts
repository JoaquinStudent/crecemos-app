/**
 * @jest-environment node
 *
 * Pruebas de apoyo de los datos de los gráficos (los escenarios del SPEC-15 son spec15_e3 y e5).
 */
import {
  etiquetaTorta,
  ESTILOS_TORTA,
  MAX_PORCIONES_TORTA,
  porcionesTorta,
  productosDelPeriodo,
  textoPorcentaje,
  ultimosDias,
  type ProductoPeriodo,
} from '@analisis/graficos';
import type { Cierre } from '@dominio/tipos';

const prod = (i: number, venta: number): ProductoPeriodo => ({
  productoId: `p-${i}`,
  nombre: `Producto ${String(i).padStart(2, '0')}`,
  porciones: 1,
  venta,
});

describe('porcionesTorta · propiedades', () => {
  it('siempre suma 100, tiene a lo más 5 porciones y va de mayor a menor', () => {
    let semilla = 12345;
    const azar = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    for (let ronda = 0; ronda < 200; ronda += 1) {
      const n = 1 + Math.floor(azar() * 12);
      const productos = Array.from({ length: n }, (_, i) =>
        prod(i, Math.round(azar() * 5000) / 10 + 1),
      );
      const torta = porcionesTorta(productos);
      expect(torta.length).toBeLessThanOrEqual(MAX_PORCIONES_TORTA);
      expect(torta.reduce((s, p) => s + p.porcentaje, 0)).toBe(100);
      const propias = torta.filter(p => !p.esOtros);
      for (let i = 1; i < propias.length; i += 1) {
        expect(propias[i - 1].venta).toBeGreaterThanOrEqual(propias[i].venta);
      }
      expect(torta.some(p => p.esOtros)).toBe(n > MAX_PORCIONES_TORTA);
      // Nada se pierde: "Otros" junta exactamente lo que no tiene porción propia.
      const total = productos.reduce((s, p) => s + p.venta, 0);
      expect(torta.reduce((s, p) => s + p.venta, 0)).toBeCloseTo(total, 1);
    }
  });

  it('un máximo distinto cambia cuántas porciones hay', () => {
    const productos = [prod(1, 50), prod(2, 30), prod(3, 20)];
    expect(porcionesTorta(productos, 2).map(p => p.nombre)).toEqual(['Producto 01', 'Otros']);
    expect(porcionesTorta(productos, 2)[1].cantidad).toBe(2);
  });

  it('no muta los productos que recibe', () => {
    const productos = Object.freeze([prod(2, 10), prod(1, 90)]) as ProductoPeriodo[];
    expect(() => porcionesTorta(productos)).not.toThrow();
    expect(productos[0].productoId).toBe('p-2');
  });
});

describe('textos de la torta', () => {
  it('"menos de 1 %" nunca dice "0 %"', () => {
    expect(textoPorcentaje(0)).toBe('menos de 1 %');
    expect(textoPorcentaje(1)).toBe('1 %');
  });

  it('la etiqueta del lector de pantalla lista todas las porciones, con "por ciento"', () => {
    const etiqueta = etiquetaTorta(porcionesTorta([prod(1, 750), prod(2, 250)]));
    expect(etiqueta).toContain('Producto 01, 75 por ciento de lo que vendiste, S/ 750.00');
    expect(etiqueta).toContain('Producto 02, 25 por ciento de lo que vendiste, S/ 250.00');
    expect(etiqueta).not.toContain('%');
    expect(etiquetaTorta([])).toContain('Sin ventas');
  });

  it('los cinco estilos tienen color y patrón distintos; el naranja lleva marca oscura', () => {
    expect(new Set(ESTILOS_TORTA.map(e => e.patron)).size).toBe(5);
    expect(new Set(ESTILOS_TORTA.map(e => e.relleno)).size).toBe(5);
    const naranja = ESTILOS_TORTA.find(e => e.relleno === '#FFA400');
    expect(naranja?.marca).toBe('#1A1016');
  });
});

describe('productosDelPeriodo', () => {
  const linea = (id: string, vendidas: number, sobrantes = 0, precio = 10) => ({
    productoId: id,
    nombre: id,
    preparadas: vendidas + sobrantes,
    sobrantes,
    precioUnitario: precio,
    costoUnitario: 1,
  });
  const dia = (fecha: string, lineas: ReturnType<typeof linea>[]): Cierre => ({
    id: fecha,
    fecha,
    lineas,
    montoYape: 0,
    yapePendiente: false,
    gastos: [],
    abreCiclo: false,
    creadoEn: '',
    actualizadoEn: '',
  });

  it('suma entre días, descuenta sobrantes y deja fuera lo que no vendió nada', () => {
    const r = productosDelPeriodo(
      [
        dia('2026-10-01', [linea('a', 5, 2), linea('b', 0, 4)]),
        dia('2026-10-02', [linea('a', 3, 0)]),
      ],
      [],
    );
    expect(r).toEqual([{ productoId: 'a', nombre: 'a', porciones: 8, venta: 80 }]);
  });

  it('el empate de venta se resuelve por nombre', () => {
    const r = productosDelPeriodo([dia('2026-10-01', [linea('zeta', 1), linea('alfa', 1)])], []);
    expect(r.map(p => p.nombre)).toEqual(['alfa', 'zeta']);
  });
});

describe('ultimosDias · bordes', () => {
  const dia = (fecha: string, venta: number, gasto = 0): Cierre => ({
    id: fecha,
    fecha,
    lineas: [
      {
        productoId: 'p',
        nombre: 'P',
        preparadas: venta / 10,
        sobrantes: 0,
        precioUnitario: 10,
        costoUnitario: 1,
      },
    ],
    montoYape: 0,
    yapePendiente: false,
    gastos: gasto > 0 ? [{ categoria: 'otro', monto: gasto }] : [],
    abreCiclo: false,
    creadoEn: '',
    actualizadoEn: '',
  });

  it('cruza el cambio de mes y de año sin perder días', () => {
    const cierres = [dia('2026-12-30', 100), dia('2027-01-02', 50)];
    const r = ultimosDias(cierres, { desde: '2026-12-30', hasta: '2027-01-02' }, 7);
    expect(r.dias.map(d => d.fecha)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    expect(r.dias.map(d => d.resultado)).toEqual([100, null, null, 50]);
  });

  it('un solo día cerrado es a la vez el mejor y el peor', () => {
    const r = ultimosDias(
      [dia('2026-10-15', 100)],
      { desde: '2026-10-15', hasta: '2026-10-15' },
      7,
    );
    expect(r.dias).toHaveLength(1);
    expect(r.mejor?.fecha).toBe('2026-10-15');
    expect(r.peor?.fecha).toBe('2026-10-15');
  });

  it('un tramo de 0 días o sin periodo no devuelve nada', () => {
    const c = [dia('2026-10-15', 100)];
    expect(ultimosDias(c, { desde: '2026-10-15', hasta: '2026-10-15' }, 0).dias).toEqual([]);
    expect(ultimosDias(c, { desde: null, hasta: '2026-10-15' }, 7).dias).toEqual([]);
  });
});
