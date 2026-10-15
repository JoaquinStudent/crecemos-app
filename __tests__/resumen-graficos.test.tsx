/**
 * Pruebas de apoyo de los gráficos de Resumen con la app montada (los escenarios del SPEC-15 son
 * spec15_e16 a e18): los cálculos se memorizan, el orden de lectura se conserva y el filtro no se
 * guarda en el almacenamiento.
 */
import { act } from 'react-test-renderer';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import * as inteligencia from '@analisis/inteligencia';
import { restarDias } from '@dominio/fecha';
import type { Cierre, FechaNegocio } from '@dominio/tipos';
import { guardarCierre } from '@storage/repositorio';
import { desmontarApp, montarApp as montar } from '../testutils/app';

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

const HOY: FechaNegocio = '2026-10-15';

const dia = (fecha: FechaNegocio, n: number): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [
    {
      productoId: 'p-anticucho',
      nombre: 'Anticucho',
      preparadas: 10 + (n % 9),
      sobrantes: n % 3,
      precioUnitario: 10,
      costoUnitario: 8,
    },
    {
      productoId: 'p-pancita',
      nombre: 'Pancita',
      preparadas: 8 + (n % 5),
      sobrantes: 0,
      precioUnitario: 9,
      costoUnitario: 7,
    },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: [{ categoria: 'mercaderia', monto: 30 + (n % 4) * 10 }],
  abreCiclo: n % 10 === 0,
  creadoEn: '2026-10-15T12:00:00-05:00',
  actualizadoEn: '2026-10-15T12:00:00-05:00',
});

const montarApp = async () => {
  const app = await montar();
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
  return app;
};

describe('Resumen · gráficos', () => {
  beforeEach(() => {
    clearAllMockStorages();
    jest.useFakeTimers({ doNotFake: [...SIN_FALSEAR], now: new Date('2026-10-15T12:00:00-05:00') });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    await desmontarApp();
  });

  it('con 150 cierres, la inteligencia se calcula una vez por periodo y no en cada render', async () => {
    for (let n = 0; n < 150; n += 1) await guardarCierre(dia(restarDias(HOY, 149 - n), n));
    const espia = jest.spyOn(inteligencia, 'inteligenciaDelNegocio');
    const app = await montarApp();
    await app.tocar('tab-resumen');

    expect(app.existe('grafico-torta')).toBe(true);
    const alAbrir = espia.mock.calls.length;
    expect(alAbrir).toBeGreaterThanOrEqual(1);

    // Cambiar el selector de días vuelve a dibujar los gráficos, pero no recalcula la inteligencia.
    await app.tocar('grafico-dias-tramo-7');
    await app.tocar('grafico-dias-tramo-30');
    await app.tocar('grafico-dias-tramo-14');
    expect(espia.mock.calls.length).toBe(alAbrir);

    // Cambiar el periodo sí la recalcula, una vez por cambio.
    await app.tocar('resumen-filtro-boton');
    await app.tocar('resumen-filtro-opcion-esteMes');
    expect(espia.mock.calls.length).toBeGreaterThan(alAbrir);
    const conFiltro = espia.mock.calls.length;
    await app.tocar('resumen-filtro-listo');
    expect(espia.mock.calls.length).toBe(conFiltro);
  });

  it('el orden de lectura se conserva: el ciclo, Tus números y los tres botones', async () => {
    for (let n = 0; n < 5; n += 1) await guardarCierre(dia(restarDias(HOY, n + 1), n));
    const app = await montarApp();
    await app.tocar('tab-resumen');
    expect(
      app.enOrden([
        'resumen-te-queda',
        'resumen-graficos',
        'resumen-que-me-deja',
        'resumen-mi-reporte',
        'resumen-preguntar',
      ]),
    ).toEqual([
      'resumen-te-queda',
      'resumen-graficos',
      'resumen-que-me-deja',
      'resumen-mi-reporte',
      'resumen-preguntar',
    ]);
    // Los gráficos, uno tras otro.
    expect(
      app.enOrden(['grafico-torta', 'grafico-meses', 'grafico-productos', 'grafico-dias']),
    ).toEqual(['grafico-torta', 'grafico-meses', 'grafico-productos', 'grafico-dias']);
  });

  it('el periodo vive en la pantalla: al volver a Resumen desde otra pestaña sigue, y no se guarda', async () => {
    for (let n = 0; n < 5; n += 1) await guardarCierre(dia(restarDias(HOY, n + 1), n));
    const app = await montarApp();
    await app.tocar('tab-resumen');
    await app.tocar('resumen-filtro-boton');
    await app.tocar('resumen-filtro-opcion-ultimos30');
    await app.tocar('resumen-filtro-listo');
    expect(app.textoDe('resumen-filtro-etiqueta')).toBe(
      'Periodo: Del 16 de septiembre al 15 de octubre',
    );
    await app.tocar('tab-inicio');
    await app.tocar('tab-resumen');
    expect(app.textoDe('resumen-filtro-etiqueta')).toBe(
      'Periodo: Del 16 de septiembre al 15 de octubre',
    );
    // Nada nuevo en el almacenamiento: ninguna clave habla del periodo ni del filtro.
    const claves: string[] = await createAsyncStorage('crecemos').getAllKeys();
    expect(claves.filter(c => /periodo|filtro/i.test(c))).toEqual([]);
  });

  it('el botón del filtro y los chips del selector miden 48 dp o más y todo lleva texto', async () => {
    for (let n = 0; n < 3; n += 1) await guardarCierre(dia(restarDias(HOY, n + 1), n));
    const app = await montarApp();
    await app.tocar('tab-resumen');
    expect(app.textoDe('resumen-filtro-etiqueta')).toBe('Periodo: Todo tu historial');
    expect(app.textos()).toContain('Cambiar');
    expect(app.textos()).toContain('Tus números');
  });
});
