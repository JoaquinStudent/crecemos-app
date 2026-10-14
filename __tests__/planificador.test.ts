/**
 * Pruebas de apoyo del planificador "¿Cuánto preparo mañana?": día de la semana en bordes de
 * semana y de mes (TZ America/Lima), datos insuficientes, regla de sobrantes, pesos y la semilla.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { Cierre, Producto } from '@dominio/tipos';
import { planificarManana, textoPorciones } from '@analisis/planificador';

const producto = (extra: Partial<Producto> = {}): Producto => ({
  id: 'p-a',
  nombre: 'Anticucho',
  unidad: 'porcion',
  precioVenta: 10,
  costoUnitario: 8,
  actualizadoEn: '2026-01-01',
  activo: true,
  ...extra,
});

const cierre = (fecha: string, preparadas: number, sobrantes: number, id = 'p-a'): Cierre => ({
  id: `c-${fecha}-${id}`,
  fecha,
  lineas: [
    { productoId: id, nombre: id, preparadas, sobrantes, precioUnitario: 10, costoUnitario: 8 },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: [],
  abreCiclo: false,
  creadoEn: `${fecha}T12:00:00-05:00`,
  actualizadoEn: `${fecha}T12:00:00-05:00`,
});

// Mañana = sábado 2026-10-10. Los sábados anteriores: 10-03 (1 semana), 09-26 (2), 09-19 (3)…
const HOY = '2026-10-09';
const sabadoHace = (semanas: number) => restarDias('2026-10-10', 7 * semanas);

describe('planificarManana', () => {
  it('mañana es el día siguiente a hoy, también en borde de semana, mes, año y bisiesto', () => {
    expect(planificarManana([], [], '2026-10-09')).toMatchObject({ fecha: '2026-10-10', dia: 'sábado' });
    expect(planificarManana([], [], '2026-10-10')).toMatchObject({ fecha: '2026-10-11', dia: 'domingo' });
    expect(planificarManana([], [], '2026-10-31')).toMatchObject({ fecha: '2026-11-01', dia: 'domingo' });
    expect(planificarManana([], [], '2026-12-31')).toMatchObject({ fecha: '2027-01-01', dia: 'viernes' });
    expect(planificarManana([], [], '2028-02-28')).toMatchObject({ fecha: '2028-02-29', dia: 'martes' });
  });

  it('usa solo cierres del mismo día de la semana y de las últimas 8 semanas', () => {
    const cierres = [
      cierre(sabadoHace(1), 10, 0),
      cierre(sabadoHace(2), 10, 0),
      cierre(sabadoHace(8), 10, 0),
      cierre(sabadoHace(9), 10, 0), // fuera de la ventana
      cierre('2026-10-07', 99, 0), // miércoles: otro día
    ];
    const [s] = planificarManana(cierres, [producto()], HOY).sugerencias;
    expect(s.muestras).toBe(3);
  });

  it('con menos de 3 muestras dice la verdad y no sugiere', () => {
    const cierres = [cierre(sabadoHace(1), 10, 0), cierre(sabadoHace(2), 10, 0)];
    const plan = planificarManana(cierres, [producto()], HOY);
    expect(plan.datosInsuficientes).toBe(true);
    expect(plan.sugerencias[0]).toMatchObject({
      porciones: null,
      datosInsuficientes: true,
      texto: 'Aún no tengo suficientes sábados para sugerirte',
    });
    expect(plan.capital).toBe(0);
  });

  it('pluraliza el día sin duplicar la "s" (lunes, miércoles)', () => {
    expect(planificarManana([], [producto()], '2026-10-11').sugerencias[0].texto).toBe(
      'Aún no tengo suficientes lunes para sugerirte',
    );
    expect(planificarManana([], [producto()], '2026-10-13').sugerencias[0].texto).toBe(
      'Aún no tengo suficientes miércoles para sugerirte',
    );
  });

  it('suma 10 % al promedio y compara con lo último que preparó', () => {
    // Siempre vendió 20: 20 × 1.10 = 22; el último sábado preparó 20, así que +2.
    const cierres = [1, 2, 3].map(k => cierre(sabadoHace(k), 20, 0));
    const [s] = planificarManana(cierres, [producto()], HOY).sugerencias;
    expect(s.porciones).toBe(22);
    expect(s.ultimaPreparada).toBe(20);
    expect(s.diferencia).toBe(2);
    expect(s.texto).toBe('+2 más que el último sábado');
    expect(s.capital).toBe(176);
  });

  it('dice "menos" cuando prepararía menos que la última vez', () => {
    const menos = [cierre(sabadoHace(1), 30, 20), cierre(sabadoHace(2), 12, 0), cierre(sabadoHace(3), 12, 0)];
    expect(planificarManana(menos, [producto()], HOY).sugerencias[0].texto).toMatch(
      /^\d+ menos que el último sábado$/,
    );
  });

  it('las semanas recientes pesan más', () => {
    // Vendidas: reciente 30, luego 10 y 10. Pesos 8, 7, 6: (240+70+60)/21 = 17.6 → ×1.1 = 19.4 → 19.
    const cierres = [
      cierre(sabadoHace(1), 30, 0),
      cierre(sabadoHace(2), 10, 0),
      cierre(sabadoHace(3), 10, 0),
    ];
    expect(planificarManana(cierres, [producto()], HOY).sugerencias[0].porciones).toBe(19);
    // Al revés (lo alto es lo viejo): (80+70+180)/21 = 15.7 → ×1.1 = 17.3 → 17.
    const alReves = [
      cierre(sabadoHace(1), 10, 0),
      cierre(sabadoHace(2), 10, 0),
      cierre(sabadoHace(3), 30, 0),
    ];
    expect(planificarManana(alReves, [producto()], HOY).sugerencias[0].porciones).toBe(17);
  });

  it('nunca sugiere menos que lo menos que vendió', () => {
    const cierres = [1, 2, 3].map(k => cierre(sabadoHace(k), 5, 0));
    expect(
      planificarManana(cierres, [producto()], HOY).sugerencias[0].porciones,
    ).toBeGreaterThanOrEqual(5);
  });

  it('si sobró en 2 de los últimos 3 sábados, no sube de lo último que preparó', () => {
    // Vendidas 18, 17, 40; el último preparó 20. Sin tope: (144+119+240)/21 = 24 → 26.
    const conSobra = [
      cierre(sabadoHace(1), 20, 2),
      cierre(sabadoHace(2), 20, 3),
      cierre(sabadoHace(3), 40, 0),
    ];
    expect(planificarManana(conSobra, [producto()], HOY).sugerencias[0].porciones).toBe(20);
    // Si sobró solo en 1 de 3, el tope no aplica.
    const sinRegla = [
      cierre(sabadoHace(1), 20, 2),
      cierre(sabadoHace(2), 20, 0),
      cierre(sabadoHace(3), 40, 0),
    ];
    expect(
      planificarManana(sinRegla, [producto()], HOY).sugerencias[0].porciones,
    ).toBeGreaterThan(20);
  });

  it('el tope por sobrantes nunca baja del piso de lo vendido', () => {
    // El último preparó 10 y vendió 5; antes vendió 30 y 30. El tope (10) no puede bajar del piso (5).
    const cierres = [
      cierre(sabadoHace(1), 10, 5),
      cierre(sabadoHace(2), 31, 1),
      cierre(sabadoHace(3), 30, 0),
    ];
    expect(planificarManana(cierres, [producto()], HOY).sugerencias[0].porciones).toBe(10);
  });

  it('solo planifica productos activos y suma el capital con el costo actual', () => {
    const cierres = [1, 2, 3].flatMap(k => [
      cierre(sabadoHace(k), 10, 0, 'p-a'),
      cierre(sabadoHace(k), 5, 0, 'p-b'),
    ]);
    const productos = [
      producto({ id: 'p-a', costoUnitario: 8 }),
      producto({ id: 'p-b', nombre: 'Rachi', costoUnitario: 4 }),
      producto({ id: 'p-c', nombre: 'Viejo', activo: false }),
    ];
    const plan = planificarManana(cierres, productos, HOY);
    expect(plan.sugerencias.map(s => s.productoId)).toEqual(['p-a', 'p-b']);
    // 10 × 1.1 = 11 → S/ 88; 5 × 1.1 = 5.5 → 6 → S/ 24
    expect(plan.capital).toBe(112);
  });

  it('textoPorciones respeta singular y unidad', () => {
    expect(textoPorciones(1, 'porcion')).toBe('1 porción');
    expect(textoPorciones(12, 'porcion')).toBe('12 porciones');
    expect(textoPorciones(3, 'vaso')).toBe('3 vasos');
  });

  it('con la semilla de demostración sugiere para mañana', () => {
    const texto = readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8');
    const r = validarSemilla(JSON.parse(texto));
    if (!r.ok) throw new Error('La semilla real no valida');
    const ahora = new Date(2026, 9, 7, 12);
    const { cierres, productos } = materializarSemilla(r.semilla, ahora);
    const plan = planificarManana(cierres, productos, fechaLocal(ahora));
    expect(plan.fecha).toBe('2026-10-08');
    expect(plan.dia).toBe('jueves');
    const conDatos = plan.sugerencias.filter(s => !s.datosInsuficientes);
    expect(conDatos.length).toBeGreaterThan(0);
    for (const s of conDatos) {
      expect(s.porciones).toBeGreaterThan(0);
      expect(s.muestras).toBeGreaterThanOrEqual(3);
    }
    expect(plan.capital).toBe(
      Math.round(conDatos.reduce((t, s) => t + s.capital, 0) * 100) / 100,
    );
  });
});
