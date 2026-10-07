/**
 * Tests del Sprint-01. Generados desde sdd/spec/Sprint-01/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { calcularCierre, nuevoCierre } from '@dominio/cierre';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, DatosCierre, Gasto, LineaCierre } from '@dominio/tipos';
import { validarCierre } from '@dominio/validacion';
import { guardarCierre, listarCierres } from '@storage/repositorio';

const anticucho = (preparadas: number, sobrantes: number): LineaCierre => ({
  productoId: 'p-anticucho',
  nombre: 'Anticucho',
  preparadas,
  sobrantes,
  precioUnitario: 10,
  costoUnitario: 8.2,
});

const cierreCon = (lineas: LineaCierre[], gastos: Gasto[] = [], montoYape = 0): Cierre => ({
  id: 'c-1',
  fecha: '2026-10-06',
  lineas,
  montoYape,
  yapePendiente: false,
  gastos,
  abreCiclo: false,
  creadoEn: '2026-10-06T22:30:00.000Z',
  actualizadoEn: '2026-10-06T22:30:00.000Z',
});

const datosCon = (
  lineas: DatosCierre['lineas'],
  gastos: Gasto[] = [],
  montoYape = 0,
): DatosCierre => ({ lineas, gastos, montoYape });

// 2026-10-06 a las 20:00 en Lima (UTC-5): la fecha local del cierre es 2026-10-06.
const noche6deOctubre = new Date('2026-10-06T20:00:00-05:00');

describe('SPEC-01: Flujo mínimo de punta a punta — cerrar el día y ver cuánto te queda', () => {
  // Cada escenario arranca con el almacenamiento vacío.
  beforeEach(() => {
    clearAllMockStorages();
  });

  // @spec01_e1 — Calcula la venta de un producto
  it('spec01_e1 calcula la venta de un producto', () => {
    // Given: un cierre con una línea de "Anticucho" a S/ 10.00, con 20 preparadas y 2 sobrantes
    // When: se calcula el resumen del cierre
    // Then: las porciones vendidas del anticucho son 18 y la venta del cierre es S/ 180.00
    const resumen = calcularCierre(cierreCon([anticucho(20, 2)]));

    expect(resumen.vendidasPorProducto['p-anticucho']).toBe(18);
    expect(resumen.venta).toBe(180);
  });

  // @spec01_e2 — Calcula cuánto te queda en el día
  it('spec01_e2 calcula cuanto te queda en el dia', () => {
    // Given: un cierre con venta de S/ 200.00 y gastos de mercadería S/ 110.00 y movilidad S/ 12.00
    // When: se calcula el resumen del cierre
    // Then: el gasto total es S/ 122.00 y "te queda" es S/ 78.00
    const resumen = calcularCierre(
      cierreCon([anticucho(20, 0)], [
        { categoria: 'mercaderia', monto: 110 },
        { categoria: 'movilidad', monto: 12 },
      ]),
    );

    expect(resumen.venta).toBe(200);
    expect(resumen.gastoTotal).toBe(122);
    expect(resumen.teQueda).toBe(78);
  });

  // @spec01_e3 — Separa efectivo y Yape
  it('spec01_e3 separa efectivo y yape', () => {
    // Given: un cierre con venta de S/ 200.00 y S/ 50.00 cobrados por Yape
    // When: se calcula el resumen del cierre
    // Then: el efectivo es S/ 150.00 y el Yape del día es S/ 50.00
    const resumen = calcularCierre(cierreCon([anticucho(20, 0)], [], 50));

    expect(resumen.venta).toBe(200);
    expect(resumen.efectivo).toBe(150);
    expect(resumen.montoYape).toBe(50);
  });

  // @spec01_e4 — Guarda y recupera un cierre con precio copiado
  it('spec01_e4 guarda y recupera un cierre con precio copiado', async () => {
    // Given: el almacenamiento vacío y un cierre del 2026-10-06 con una línea de anticucho a S/ 10.00 y costo S/ 8.20
    // When: se guarda el cierre y luego se listan los cierres
    // Then: la lista tiene 1 cierre con fecha 2026-10-06 y su línea conserva precio unitario 10 y costo unitario 8.2
    const cierre = nuevoCierre(
      datosCon([{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 2 }]),
      PRODUCTOS_POR_DEFECTO,
      null,
      noche6deOctubre,
    );

    await guardarCierre(cierre);
    const cierres = await listarCierres();

    expect(cierres).toHaveLength(1);
    expect(cierres[0].fecha).toBe('2026-10-06');
    expect(cierres[0].lineas[0].precioUnitario).toBe(10);
    expect(cierres[0].lineas[0].costoUnitario).toBe(8.2);
  });

  // @spec01_e5 — Un cierre por fecha
  it('spec01_e5 un cierre por fecha', async () => {
    // Given: ya existe un cierre del 2026-10-06 con 18 anticuchos vendidos
    // When: se guarda otro cierre con la misma fecha y 15 anticuchos vendidos
    // Then: la lista tiene 1 solo cierre del 2026-10-06 y sus vendidas de anticucho son 15
    const cierreDe = (preparadas: number, sobrantes: number) =>
      nuevoCierre(
        datosCon([{ productoId: 'p-anticucho', preparadas, sobrantes }]),
        PRODUCTOS_POR_DEFECTO,
        null,
        noche6deOctubre,
      );
    await guardarCierre(cierreDe(20, 2)); // 18 vendidas

    await guardarCierre(cierreDe(20, 5)); // 15 vendidas
    const cierres = await listarCierres();

    const delDia = cierres.filter(c => c.fecha === '2026-10-06');
    expect(cierres).toHaveLength(1);
    expect(delDia).toHaveLength(1);
    expect(calcularCierre(delDia[0]).vendidasPorProducto['p-anticucho']).toBe(15);
  });

  // @spec01_e6 — Rechaza sobrantes mayores que preparadas
  it('spec01_e6 rechaza sobrantes mayores que preparadas', () => {
    // Given: una línea con 10 preparadas y 12 sobrantes
    // When: se valida el cierre
    // Then: la validación falla con el mensaje "No te pueden sobrar más de los que preparaste"
    const resultado = validarCierre(
      datosCon([{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 12 }]),
      PRODUCTOS_POR_DEFECTO,
    );

    expect(resultado).toEqual({
      ok: false,
      errores: { 'lineas.0.sobrantes': 'No te pueden sobrar más de los que preparaste' },
    });
  });

  // @spec01_e7 — Rechaza un cierre vacío
  it('spec01_e7 rechaza un cierre vacio', () => {
    // Given: un cierre sin porciones vendidas y sin gastos
    // When: se valida el cierre
    // Then: la validación falla con el mensaje "Anota al menos una venta o un gasto"
    const resultado = validarCierre(
      datosCon([{ productoId: 'p-anticucho', preparadas: 0, sobrantes: 0 }]),
      PRODUCTOS_POR_DEFECTO,
    );

    expect(resultado).toEqual({
      ok: false,
      errores: { cierre: 'Anota al menos una venta o un gasto' },
    });
  });

  // @spec01_e8 — Rechaza Yape mayor que la venta
  it('spec01_e8 rechaza yape mayor que la venta', () => {
    // Given: un cierre con venta de S/ 100.00 y S/ 150.00 por Yape
    // When: se valida el cierre
    // Then: la validación falla con el mensaje "El Yape no puede ser más que lo que vendiste"
    const resultado = validarCierre(
      datosCon([{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }], [], 150),
      PRODUCTOS_POR_DEFECTO,
    );

    expect(resultado).toEqual({
      ok: false,
      errores: { montoYape: 'El Yape no puede ser más que lo que vendiste' },
    });
  });

  // @spec01_e9 — La fecha del cierre es la fecha local
  it('spec01_e9 la fecha del cierre es la fecha local', () => {
    // Given: el reloj marca martes 2026-10-06 a las 22:30 en Lima, que en UTC ya es 2026-10-07 03:30
    // When: se crea un cierre con la fecha de hoy
    // Then: la fecha del cierre es 2026-10-06 y no 2026-10-07
    const ahora = new Date('2026-10-07T03:30:00Z');

    const cierre = nuevoCierre(
      datosCon([{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 2 }]),
      PRODUCTOS_POR_DEFECTO,
      null,
      ahora,
    );

    expect(cierre.fecha).toBe('2026-10-06');
    expect(cierre.fecha).not.toBe('2026-10-07');
  });

  // @spec01_e10 — e2e: cerrar el día y verlo en Inicio
  it('spec01_e10 e2e cerrar el dia y verlo en inicio', () => {
    // Given: la app recién instalada, con los 4 productos por defecto y el anticucho a S/ 10.00
    // When: se registra un cierre con 20 anticuchos preparados, 2 sobrantes y S/ 110.00 de mercadería, y se abre Inicio
    // Then: Inicio muestra "Te queda" con el monto "S/ 70.00"
    throw new Error('Rojo: no implementado');
  });
});
