/**
 * Tests del Sprint-06. Generados desde sdd/spec/Sprint-06/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

import { restarDias } from '@dominio/fecha';
import { formatoSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, Perfil } from '@dominio/tipos';
import { senalesBanco, textoReporte } from '@analisis/senales';

// "Hoy" es explícito: el reloj no decide ningún resultado.
const HOY: FechaNegocio = '2026-10-07';
const INSTANTE = '2026-10-07T12:00:00-05:00';

/** Un cierre de un solo producto a S/ 10.00 la porción y sin sobrantes: venta = vendidas × 10. */
const cierreDe = (fecha: FechaNegocio, vendidas: number, gasto: number): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [
    {
      productoId: 'p-anticucho',
      nombre: 'Anticucho',
      preparadas: vendidas,
      sobrantes: 0,
      precioUnitario: 10,
      costoUnitario: 8,
    },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
  abreCiclo: false,
  creadoEn: INSTANTE,
  actualizadoEn: INSTANTE,
});

/**
 * Julio, agosto y septiembre completos (hoy es 7 de octubre). El primer cierre del registro es el
 * 3 de julio, dentro de los primeros 7 días del mes. Más un cierre de octubre, mes en curso.
 *   julio       venta 2,450 + 2,450 = 4,900   gastos 1,000 + 1,800 = 2,800  → te queda 2,100
 *   agosto      venta 3,100 + 2,000 = 5,100   gastos 1,500 + 1,400 = 2,900  → te queda 2,200
 *   septiembre  venta 2,860 + 2,500 = 5,360   gastos 1,500 + 1,620 = 3,120  → te queda 2,240
 */
const tresMesesCompletos = (): Cierre[] => [
  cierreDe('2026-07-03', 245, 1000),
  cierreDe('2026-07-17', 245, 1800),
  cierreDe('2026-08-05', 310, 1500),
  cierreDe('2026-08-19', 200, 1400),
  cierreDe('2026-09-08', 286, 1500),
  cierreDe('2026-09-22', 250, 1620),
  cierreDe('2026-10-05', 120, 0),
];

describe('SPEC-06: Reporte para el banco y cierre de entrega', () => {
  // @spec06_e1 — Constancia de registro
  it('spec06_e1 constancia de registro', () => {
    // Given: hoy 2026-10-07 y 58 cierres con fecha dentro de los últimos 90 días
    // When: se calculan las señales para el banco
    // Then: la constancia es 64% y los días registrados son 58
    // 57 días seguidos hasta ayer más uno de hace 89 días (el más viejo que entra en la ventana).
    const fechas = [...Array.from({ length: 57 }, (_, i) => restarDias(HOY, i + 1)), restarDias(HOY, 89)];
    const cierres = fechas.map(f => cierreDe(f, 20, 100));
    expect(cierres).toHaveLength(58);
    expect(new Set(fechas).size).toBe(58);

    const s = senalesBanco(cierres, HOY);

    expect(s.diasRegistrados).toBe(58);
    expect(s.constancia).toBe(64);
  });

  // @spec06_e2 — Promedios mensuales
  it('spec06_e2 promedios mensuales', () => {
    // Given: tres meses completos con ventas de S/ 4,900.00, S/ 5,100.00 y S/ 5,360.00, y "te queda" de S/ 2,100.00, S/ 2,200.00 y S/ 2,240.00
    // When: se calculan las señales para el banco
    // Then: la venta promedio mensual es S/ 5,120.00 y la ganancia promedio mensual es S/ 2,180.00
    const s = senalesBanco(tresMesesCompletos(), HOY);

    expect(s.mesesCompletos).toBe(3);
    expect(s.meses.map(m => [m.mes, m.venta, m.teQueda])).toEqual([
      ['2026-07', 4900, 2100],
      ['2026-08', 5100, 2200],
      ['2026-09', 5360, 2240],
    ]);
    expect(s.ventaPromedioMensual).toBe(5120);
    expect(s.gananciaPromedioMensual).toBe(2180);
  });

  // @spec06_e3 — El reporte lleva solo totales
  it('spec06_e3 el reporte lleva solo totales', () => {
    // Given: el perfil "Freddy" con negocio "Anticuchos Freddy" y las señales del escenario 2
    // When: se genera el texto del reporte
    // Then: el texto contiene "Venta promedio mensual: S/ 5,120.00", no contiene el monto de ningún cierre individual y tiene 2,000 caracteres o menos
    const perfil: Perfil = {
      nombre: 'Freddy',
      negocio: 'Anticuchos Freddy',
      aceptaYape: true,
      yapeAjeno: false,
      actualizadoEn: INSTANTE,
    };
    const cierres = tresMesesCompletos();
    const s = senalesBanco(cierres, HOY);

    const texto = textoReporte(s, perfil);

    expect(texto).toContain('Venta promedio mensual: S/ 5,120.00');
    expect(texto.length).toBeLessThanOrEqual(2000);
    // Ni la venta, ni el "te queda", ni los gastos de ningún cierre individual (ninguno coincide con un promedio).
    for (const c of cierres) {
      const venta = c.lineas.reduce((t, l) => t + (l.preparadas - l.sobrantes) * l.precioUnitario, 0);
      const gastos = c.gastos.reduce((t, g) => t + g.monto, 0);
      for (const monto of [venta, venta - gastos, gastos].filter(m => m > 0)) {
        expect(texto).not.toContain(formatoSoles(monto));
      }
    }
    // Los únicos montos en soles del texto son los dos promedios.
    expect(texto.match(/S\/ [\d,]+\.\d{2}/g)).toEqual(['S/ 5,120.00', 'S/ 2,180.00']);
  });

  // @spec06_e4 — Con poco registro, el reporte avisa
  it('spec06_e4 con poco registro el reporte avisa', () => {
    // Given: 9 cierres registrados en total
    // When: se generan las señales para el banco
    // Then: el reporte queda marcado como en construcción con el texto "Te faltan 21 días de registro para que tu reporte sea convincente"
    // Nueve días seguidos, del 28 de septiembre al 6 de octubre.
    const cierres = Array.from({ length: 9 }, (_, i) => cierreDe(restarDias(HOY, i + 1), 20, 100));
    expect(cierres).toHaveLength(9);

    const s = senalesBanco(cierres, HOY);
    const texto = textoReporte(s, null);

    expect(s.enConstruccion).toBe(true);
    expect(s.diasFaltantes).toBe(21);
    expect(texto).toContain('Te faltan 21 días de registro para que tu reporte sea convincente');
  });

  // @spec06_e5 — Nada se comparte sin tocar el botón
  it('spec06_e5 nada se comparte sin tocar el boton', () => {
    // Given: la pantalla Mi reporte con la vista previa generada
    // When: se abre la pantalla y luego se toca "Compartir reporte"
    // Then: la función de compartir no se llama al abrir la pantalla y se llama 1 sola vez, con el texto del reporte, al tocar el botón
    throw new Error('Rojo: no implementado');
  });

  // @spec06_e6 — e2e: del dato al reporte
  it('spec06_e6 e2e del dato al reporte', () => {
    // Given: la app con la semilla cargada
    // When: se abre Mi reporte y se toca "Compartir reporte"
    // Then: la pantalla muestra "Venta promedio mensual" con un monto en soles y la hoja de compartir recibe un texto que empieza con "Reporte de actividad del negocio"
    throw new Error('Rojo: no implementado');
  });
});
