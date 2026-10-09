/**
 * Tests del Sprint-06. Generados desde sdd/spec/Sprint-06/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../../App';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { formatoSoles } from '@dominio/formato';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { Cierre, FechaNegocio, Perfil } from '@dominio/tipos';
import { senalesBanco, textoReporte } from '@analisis/senales';
import { compartirReporte } from '@services/compartir';
import { guardarCierre, guardarPerfil, importarSemilla } from '@storage/repositorio';

// La hoja nativa de compartir nunca se abre en las pruebas: se mira qué recibiría.
jest.mock('@services/compartir');

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

// La app real, montada como en el teléfono (como en spec04_e10 y spec05_e12).
const RUTA_SEMILLA = join(__dirname, '..', '..', 'seed', 'semilla.json');
let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarApp = async () => {
  await act(async () => {
    montada = ReactTestRenderer.create(createElement(App));
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
};
const desmontarApp = async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
};
const raiz = (): ReactTestInstance => {
  if (!montada) throw new Error('La app no está montada');
  return (montada as ReactTestRenderer.ReactTestRenderer).root;
};
const tocar = (testID: string) =>
  act(async () => {
    const nodo = raiz().findAll(
      n => n.props.testID === testID && typeof n.props.onPress === 'function',
    )[0];
    if (!nodo) throw new Error(`No hay nada con testID "${testID}" que responda a onPress`);
    await nodo.props.onPress();
  });
const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');
const textosEnPantalla = (): string[] =>
  raiz()
    .findAll(n => (n.type as unknown) === 'Text')
    .map(textoCompleto);
const textoDe = (testID: string): string => {
  const nodo = raiz().findAll(n => (n.type as unknown) === 'Text' && n.props.testID === testID)[0];
  if (!nodo) throw new Error(`No hay ningún texto con testID "${testID}"`);
  return textoCompleto(nodo);
};
const hayNodo = (testID: string): boolean => raiz().findAll(n => n.props.testID === testID).length > 0;

// Todos los temporizadores quedan reales (la app y el almacenamiento esperan promesas de verdad);
// solo el reloj se fija, como en spec03_e10.
const SIN_FALSEAR = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

const compartir = compartirReporte as jest.MockedFunction<typeof compartirReporte>;

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
    return (async () => {
      clearAllMockStorages();
      compartir.mockClear();
      // Hoy es el 7 de octubre; hay tres meses completos y el perfil de Freddy.
      jest.useFakeTimers({ doNotFake: [...SIN_FALSEAR], now: new Date('2026-10-07T12:00:00-05:00') });
      try {
        const cierres = tresMesesCompletos();
        for (const c of cierres) await guardarCierre(c);
        const perfil: Perfil = {
          nombre: 'Freddy',
          negocio: 'Anticuchos Freddy',
          aceptaYape: true,
          yapeAjeno: false,
          actualizadoEn: INSTANTE,
        };
        await guardarPerfil(perfil);
        const esperado = textoReporte(senalesBanco(cierres, HOY), perfil);
        expect(esperado).toContain('Venta promedio mensual: S/ 5,120.00');

        await montarApp();
        // Resumen → "Mi reporte": la vista previa ya está generada.
        await tocar('tab-resumen');
        await tocar('resumen-mi-reporte');
        expect(hayNodo('reporte-hoja')).toBe(true);
        expect(textoDe('reporte-venta-promedio')).toBe('S/ 5,120.00');

        // Abrir la pantalla no comparte nada.
        expect(compartir).not.toHaveBeenCalled();

        // Solo el botón comparte: una vez, con el texto del reporte.
        await tocar('reporte-compartir');
        expect(compartir).toHaveBeenCalledTimes(1);
        expect(compartir).toHaveBeenCalledWith(esperado);
      } finally {
        jest.useRealTimers();
        await desmontarApp();
      }
    })();
  });

  // @spec06_e6 — e2e: del dato al reporte
  it('spec06_e6 e2e del dato al reporte', () => {
    // Given: la app con la semilla cargada
    // When: se abre Mi reporte y se toca "Compartir reporte"
    // Then: la pantalla muestra "Venta promedio mensual" con un monto en soles y la hoja de compartir recibe un texto que empieza con "Reporte de actividad del negocio"
    return (async () => {
      clearAllMockStorages();
      compartir.mockClear();
      const texto = readFileSync(RUTA_SEMILLA, 'utf8');
      const validada = validarSemilla(JSON.parse(texto));
      if (!validada.ok) throw new Error('La semilla del repositorio no valida');
      const fetchPorDefecto = global.fetch;
      global.fetch = jest.fn(
        async () => ({ ok: true, status: 200, text: async () => texto } as unknown as Response),
      ) as unknown as typeof fetch;
      try {
        await importarSemilla(materializarSemilla(validada.semilla, new Date()), new Date().toISOString());
        await montarApp();

        // Resumen → "Mi reporte".
        await tocar('tab-resumen');
        await tocar('resumen-mi-reporte');

        // Lo esperado sale del dominio, con la misma semilla y el mismo "hoy" que usa la app.
        const { cierres } = materializarSemilla(validada.semilla, new Date());
        const senales = senalesBanco(cierres, fechaLocal(new Date()));
        expect(senales.ventaPromedioMensual).toBeGreaterThan(0);

        // La pantalla dice "Venta promedio mensual" con un monto en soles.
        expect(textosEnPantalla()).toContain('Venta promedio mensual');
        const venta = textoDe('reporte-venta-promedio');
        expect(venta).toMatch(/^S\/ [\d,]+\.\d{2}$/);
        expect(venta).toBe(formatoSoles(senales.ventaPromedioMensual));

        // Y la hoja de compartir recibe el reporte.
        await tocar('reporte-compartir');
        expect(compartir).toHaveBeenCalledTimes(1);
        const enviado = compartir.mock.calls[0][0];
        expect(enviado.startsWith('Reporte de actividad del negocio')).toBe(true);
        expect(enviado).toContain(`Venta promedio mensual: ${formatoSoles(senales.ventaPromedioMensual)}`);
      } finally {
        global.fetch = fetchPorDefecto;
        await desmontarApp();
      }
    })();
  });
});
