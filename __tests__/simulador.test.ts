/**
 * Pruebas de apoyo del simulador "¿Y si subo el precio?" y del aviso de costos por época:
 * la cuenta, el promedio por ciclo, los límites de los pasos y el aviso de octubre y marzo.
 */

import type { Cierre, Producto } from '@dominio/tipos';
import { alertaDeCostos, productoDeMayorCosto } from '@dominio/estacionalidad';
import {
  AVISO_SUBIR_DE_A_POCO,
  moverDelta,
  simularPrecio,
  unidadesPorCiclo,
} from '@analisis/simulador';

const producto = (extra: Partial<Producto> = {}): Producto => ({
  id: 'p-a',
  nombre: 'Anticucho',
  unidad: 'porcion',
  precioVenta: 8,
  costoUnitario: 6,
  actualizadoEn: '2026-01-01',
  activo: true,
  ...extra,
});

const cierre = (
  fecha: string,
  preparadas: number,
  sobrantes: number,
  abreCiclo = false,
  id = 'p-a',
  costo = 6,
): Cierre => ({
  id: `c-${fecha}-${id}`,
  fecha,
  lineas: [
    { productoId: id, nombre: id, preparadas, sobrantes, precioUnitario: 8, costoUnitario: costo },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: [],
  abreCiclo,
  creadoEn: `${fecha}T12:00:00-05:00`,
  actualizadoEn: `${fecha}T12:00:00-05:00`,
});

// Ciclo 1 (completo): vendió 20 + 20 = 40. Ciclo 2 (completo): 30 + 30 = 60. Ciclo 3 (en curso): 10.
const TRES_CICLOS = [
  cierre('2026-09-01', 22, 2, true),
  cierre('2026-09-02', 20, 0),
  cierre('2026-09-10', 32, 2, true),
  cierre('2026-09-11', 30, 0),
  cierre('2026-09-20', 10, 0, true),
];

describe('moverDelta', () => {
  it('sube y baja de a S/ 0.50 entre 0 y S/ 3', () => {
    expect(moverDelta(0, 1)).toBe(0.5);
    expect(moverDelta(0.5, 1)).toBe(1);
    expect(moverDelta(1, -1)).toBe(0.5);
    expect(moverDelta(0, -1)).toBe(0);
    expect(moverDelta(3, 1)).toBe(3);
    expect(moverDelta(2.5, 1)).toBe(3);
  });
});

describe('unidadesPorCiclo', () => {
  it('promedia los ciclos completos y deja fuera el que está en curso', () => {
    expect(unidadesPorCiclo(TRES_CICLOS, 'p-a')).toBe(50);
  });

  it('con un solo ciclo, usa ese aunque esté en curso', () => {
    expect(unidadesPorCiclo([cierre('2026-09-20', 10, 2, true)], 'p-a')).toBe(8);
  });

  it('sin ventas del producto da 0', () => {
    expect(unidadesPorCiclo(TRES_CICLOS, 'p-otro')).toBe(0);
    expect(unidadesPorCiclo([], 'p-a')).toBe(0);
  });

  it('usa a lo más los 3 últimos ciclos', () => {
    const cierres = [
      cierre('2026-08-01', 1000, 0, true),
      cierre('2026-08-10', 10, 0, true),
      cierre('2026-08-20', 20, 0, true),
      cierre('2026-09-01', 30, 0, true),
      cierre('2026-09-10', 5, 0, true),
    ];
    // Completos: 1000, 10, 20, 30 → los 3 últimos: 10, 20, 30.
    expect(unidadesPorCiclo(cierres, 'p-a')).toBe(20);
  });
});

describe('simularPrecio', () => {
  it('proyecta la ganancia por ciclo si se vende lo mismo', () => {
    // 50 porciones por ciclo; hoy (8 − 6) × 50 = S/ 100; con S/ 9 (9 − 6) × 50 = S/ 150.
    const s = simularPrecio(TRES_CICLOS, producto(), 1);
    expect(s.unidadesPorCiclo).toBe(50);
    expect(s.precioSimulado).toBe(9);
    expect(s.gananciaActual).toBe(100);
    expect(s.gananciaSimulada).toBe(150);
    expect(s.gananciaExtra).toBe(50);
    expect(s.frase).toBe('Con S/ 9.00 ganarías S/ 50.00 más por ciclo si se vende lo mismo.');
  });

  it('con delta 0 no hay extra y la frase dice lo que ganas hoy', () => {
    const s = simularPrecio(TRES_CICLOS, producto(), 0);
    expect(s.gananciaExtra).toBe(0);
    expect(s.frase).toBe('Con tu precio de S/ 8.00 ganas S/ 100.00 por ciclo.');
  });

  it('maneja medios soles sin errores de decimales', () => {
    const s = simularPrecio(TRES_CICLOS, producto({ precioVenta: 7.1 }), 0.5);
    expect(s.precioSimulado).toBe(7.6);
    expect(s.gananciaExtra).toBe(25);
  });

  it('sin ventas no inventa: lo dice', () => {
    const s = simularPrecio([], producto(), 1);
    expect(s.hayDatos).toBe(false);
    expect(s.frase).toBe('Aún no tengo ventas de anticucho para estimar.');
  });

  it('no cambia el producto ni los cierres', () => {
    const p = producto();
    const antes = JSON.stringify([p, TRES_CICLOS]);
    simularPrecio(TRES_CICLOS, p, 2);
    expect(JSON.stringify([p, TRES_CICLOS])).toBe(antes);
  });

  it('avisa de subir de a poco con más de S/ 2', () => {
    const caro = producto({ precioVenta: 20 });
    expect(simularPrecio(TRES_CICLOS, caro, 2).avisoSubirDeAPoco).toBe(false);
    expect(simularPrecio(TRES_CICLOS, caro, 2.5).avisoSubirDeAPoco).toBe(true);
    expect(AVISO_SUBIR_DE_A_POCO).not.toMatch(/%/);
  });

  it('avisa también si el aumento es la cuarta parte del precio o más', () => {
    // Chicha de S/ 2: S/ 0.50 ya es la cuarta parte.
    const chicha = producto({ precioVenta: 2, costoUnitario: 1.6 });
    expect(simularPrecio(TRES_CICLOS, chicha, 0.5).avisoSubirDeAPoco).toBe(true);
    expect(simularPrecio(TRES_CICLOS, chicha, 0).avisoSubirDeAPoco).toBe(false);
  });
});

describe('alertaDeCostos', () => {
  const productos = [producto(), producto({ id: 'p-b', nombre: 'Pancita' })];
  const cierres = [
    cierre('2026-10-01', 10, 0, false, 'p-a', 8), // 80
    cierre('2026-10-02', 30, 0, false, 'p-b', 5), // 150
  ];

  it('en octubre y en marzo avisa, con el producto donde más pones', () => {
    expect(alertaDeCostos('2026-10-05', cierres, productos)).toBe(
      'Octubre: tus costos suelen subir, sobre todo en pancita, donde más pones. Revisa tus costos en Perfil.',
    );
    expect(alertaDeCostos('2027-03-31', [], productos)).toBe(
      'Marzo: tus costos suelen subir. Revisa tus costos en Perfil.',
    );
  });

  it('el resto del año no avisa, también en los bordes (septiembre y noviembre)', () => {
    for (const f of ['2026-09-30', '2026-11-01', '2026-01-15', '2026-02-28', '2026-04-01']) {
      expect(alertaDeCostos(f, cierres, productos)).toBeNull();
    }
  });

  it('el producto de mayor costo mira solo los últimos 30 días', () => {
    const viejo = [cierre('2026-08-01', 100, 0, false, 'p-a', 9), ...cierres];
    expect(productoDeMayorCosto(viejo, productos, '2026-10-05')).toBe('pancita');
    expect(productoDeMayorCosto([], productos, '2026-10-05')).toBeNull();
  });
});
