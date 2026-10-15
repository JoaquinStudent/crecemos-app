/**
 * @jest-environment node
 *
 * Pruebas de apoyo de la inteligencia de negocio (los escenarios del SPEC-15 son spec15_e4, e9,
 * e10 y e11): cruces de año, entradas que no se mutan y las líneas del texto.
 */
import {
  COMPARACIONES_EN_TEXTO,
  inteligenciaDelNegocio,
  lineasTextoInteligencia,
  NOTA_SIN_DIAS_SEMANA,
  ultimosMeses,
} from '@analisis/inteligencia';
import type { Cierre, FechaNegocio } from '@dominio/tipos';

const venta = (fecha: FechaNegocio, soles: number, gasto = 0): Cierre => ({
  id: fecha,
  fecha,
  lineas: [
    {
      productoId: 'p-a',
      nombre: 'A',
      preparadas: soles / 10,
      sobrantes: 0,
      precioUnitario: 10,
      costoUnitario: 8,
    },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
  abreCiclo: false,
  creadoEn: '',
  actualizadoEn: '',
});

const HOY = '2026-10-15';

describe('inteligenciaDelNegocio', () => {
  it('sin cierres no hay datos y nada lanza', () => {
    const i = inteligenciaDelNegocio([], [], HOY);
    expect(i.hayDatos).toBe(false);
    expect(i.dias).toBe(0);
    expect(i.notaMeses).toBeNull();
    expect(i.torta).toEqual([]);
    expect(lineasTextoInteligencia(i, 12)).toEqual(['Sin días cerrados en este periodo.']);
  });

  it('los meses cruzan el cambio de año', () => {
    const i = inteligenciaDelNegocio([venta('2025-11-10', 100), venta('2026-02-10', 100)], [], HOY);
    expect(i.meses.map(m => m.mes)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(i.meses.map(m => m.dias)).toEqual([1, 0, 0, 1]);
  });

  it('los cierres posteriores a hoy no cuentan', () => {
    const i = inteligenciaDelNegocio([venta('2026-10-15', 100), venta('2026-10-16', 900)], [], HOY);
    expect(i.venta).toBe(100);
    expect(i.dias).toBe(1);
  });

  it('el resultado de un mes en pérdida es negativo y no se pierde', () => {
    const i = inteligenciaDelNegocio([venta('2026-09-10', 100, 250)], [], HOY);
    expect(i.meses[0].resultado).toBe(-150);
    expect(i.resultado).toBe(-150);
  });

  it('no muta los cierres ni los productos', () => {
    const c = Object.freeze([Object.freeze(venta('2026-10-01', 100))]) as Cierre[];
    expect(() => inteligenciaDelNegocio(c, Object.freeze([]) as never, HOY)).not.toThrow();
  });

  it('los días de la semana piden 4 semanas: sin ellas, la nota lo explica', () => {
    const i = inteligenciaDelNegocio([venta('2026-10-01', 100), venta('2026-10-08', 100)], [], HOY);
    const lineas = lineasTextoInteligencia(i, 3);
    expect(lineas.some(l => l.startsWith('Día que más deja'))).toBe(false);
    expect(NOTA_SIN_DIAS_SEMANA).toContain('Aún faltan semanas');
  });

  it('150 cierres se calculan rápido (la pantalla los memoriza además)', () => {
    const cierres: Cierre[] = [];
    let f = '2026-05-01';
    for (let n = 0; n < 150; n += 1) {
      cierres.push(venta(f, 100 + (n % 7) * 10, 30));
      const d = new Date(Date.UTC(+f.slice(0, 4), +f.slice(5, 7) - 1, +f.slice(8, 10) + 1));
      f = d.toISOString().slice(0, 10);
    }
    const desde = Date.now();
    const i = inteligenciaDelNegocio(
      cierres.filter(c => c.fecha <= HOY),
      [],
      HOY,
    );
    expect(Date.now() - desde).toBeLessThan(1000);
    expect(i.dias).toBe(i.meses.reduce((s, m) => s + m.dias, 0));
  });
});

describe('ultimosMeses y las líneas del texto', () => {
  const i = inteligenciaDelNegocio(
    [
      venta('2026-05-10', 100),
      venta('2026-06-10', 200),
      venta('2026-07-10', 300),
      venta('2026-08-10', 400),
      venta('2026-09-10', 500),
      venta('2026-10-05', 50),
    ],
    [],
    HOY,
  );

  it('toma los más recientes, en orden cronológico', () => {
    expect(ultimosMeses(i.meses, 2).map(m => m.mes)).toEqual(['2026-09', '2026-10']);
    expect(ultimosMeses(i.meses, 99)).toHaveLength(6);
  });

  it('la lista de meses se recorta por los más viejos', () => {
    const tres = lineasTextoInteligencia(i, 3).filter(l => l.startsWith('- '));
    expect(tres).toHaveLength(3);
    expect(tres[0]).toContain('Agosto 2026');
    expect(tres[2]).toContain('Octubre 2026 (en curso)');
    expect(lineasTextoInteligencia(i, 0).some(l => l.startsWith('- '))).toBe(false);
  });

  it('sin detalle no hay comparaciones ni días de la semana', () => {
    const sin = lineasTextoInteligencia(i, 2, false);
    expect(sin.some(l => l.startsWith('Comparación'))).toBe(false);
    const con = lineasTextoInteligencia(i, 2, true);
    expect(con.filter(l => l.startsWith('Comparación'))).toHaveLength(COMPARACIONES_EN_TEXTO);
  });

  it('el resultado de cada mes lleva la palabra "resultado registrado" y ningún porcentaje solo', () => {
    const todo = lineasTextoInteligencia(i, 12).join('\n');
    expect(todo).toContain('resultado registrado');
    expect(todo).not.toMatch(/ganancia|te queda|balance|margen/i);
  });
});
