/**
 * La tarjeta "Tu semana" de Inicio: solo de lunes a miércoles, solo con 3 días registrados en la
 * semana pasada, con el rótulo "Datos de ejemplo" si todo es de ejemplo, y con "Preguntar por qué"
 * que abre el Asistente. La app real, por testID. Solo se falsea `Date`: los demás relojes siguen.
 */
import { createElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { nuevoCierre } from '@dominio/cierre';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, Origen } from '@dominio/tipos';
import { PREGUNTA_SEMANA } from '@analisis/semanal';
import { guardarCierre } from '@storage/repositorio';

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

const OTROS_RELOJES = [
  'nextTick',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'hrtime',
  'performance',
  'queueMicrotask',
] as const;

/** Congela solo la fecha (hora de Lima) para que "hoy" sea el día de la prueba. */
const hoyEs = (iso: string) => {
  jest.useFakeTimers({ now: new Date(iso), doNotFake: [...OTROS_RELOJES] });
};

beforeEach(() => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  clearAllMockStorages();
});

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
  jest.useRealTimers();
});

const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
  montada = app;
  const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
  const textoDe = (testID: string) => {
    const t = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!t) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return textoCompleto(t);
  };
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const tocar = (testID: string) =>
    act(async () => {
      await app.root
        .findAll(n => n.props.testID === testID && typeof n.props.onPress === 'function')[0]
        .props.onPress();
    });
  return { textoDe, existe, tocar };
};

const sembrar = async (fecha: string, porciones: number, origen?: Origen): Promise<void> => {
  const cierre: Cierre = {
    ...nuevoCierre(
      {
        fecha,
        lineas: [{ productoId: 'p-anticucho', preparadas: porciones, sobrantes: 0 }],
        montoYape: 0,
        gastos: [],
        abreCiclo: false,
      },
      PRODUCTOS_POR_DEFECTO,
      null,
      new Date('2026-10-01T12:00:00-05:00'),
    ),
    id: `c-${fecha}`,
    ...(origen ? { origen } : {}),
  };
  await guardarCierre(cierre);
};

// 2026-10-13 es martes; la semana pasada fue del lunes 5 al domingo 11 de octubre.
const sembrarSemanaPasada = async (origen?: Origen) => {
  await sembrar('2026-10-05', 10, origen); // S/ 100.00
  await sembrar('2026-10-07', 20, origen); // S/ 200.00 (el mejor)
  await sembrar('2026-10-10', 5, origen); // S/ 50.00 (el más flojo)
};

describe('Inicio: Tu semana', () => {
  it('el martes muestra la semana pasada con el mejor día y el botón "Preguntar por qué"', async () => {
    hoyEs('2026-10-13T10:00:00-05:00');
    await sembrarSemanaPasada();
    const { textoDe, existe } = await montarApp();

    expect(existe('inicio-semana')).toBe(true);
    expect(textoDe('inicio-semana-te-queda')).toBe('Te quedó S/ 350.00');
    expect(textoDe('inicio-semana-rango')).toBe('5 de octubre al 11 de octubre · 3 de 7 días registrados');
    expect(textoDe('inicio-semana-mejor')).toBe('El miércoles fue tu mejor día: te quedó S/ 200.00');
    expect(textoDe('inicio-semana-peor')).toBe('El sábado fue el más flojo: te quedó S/ 50.00');
    expect(existe('inicio-semana-comparacion')).toBe(false);
    expect(existe('inicio-semana-ejemplo')).toBe(false);
    expect(existe('inicio-semana-preguntar')).toBe(true);
  });

  it('muestra la comparación en soles cuando hay semana anterior', async () => {
    hoyEs('2026-10-13T10:00:00-05:00');
    await sembrarSemanaPasada();
    await sembrar('2026-09-30', 26.5); // S/ 265.00 la semana anterior → 350 − 265 = 85
    const { textoDe } = await montarApp();

    expect(textoDe('inicio-semana-comparacion')).toBe('S/ 85.00 más que la semana anterior');
  });

  it('"Preguntar por qué" abre el Asistente con la pregunta de la semana', async () => {
    hoyEs('2026-10-13T10:00:00-05:00');
    await sembrarSemanaPasada();
    const { tocar, existe, textoDe } = await montarApp();
    expect(existe('preguntar-pantalla')).toBe(false);

    await tocar('inicio-semana-preguntar');

    expect(existe('preguntar-pantalla')).toBe(true);
    expect(textoDe('chat-burbuja-0-texto')).toBe(PREGUNTA_SEMANA);
  });

  it('el jueves ya no aparece, aunque la semana pasada tenga sus días', async () => {
    hoyEs('2026-10-15T10:00:00-05:00');
    await sembrarSemanaPasada();
    const { existe } = await montarApp();

    expect(existe('inicio-semana')).toBe(false);
  });

  it('con menos de 3 días registrados la semana pasada no aparece', async () => {
    hoyEs('2026-10-13T10:00:00-05:00');
    await sembrar('2026-10-05', 10);
    await sembrar('2026-10-07', 20);
    const { existe } = await montarApp();

    expect(existe('inicio-semana')).toBe(false);
  });

  it('si todo es de ejemplo lo dice con el rótulo "Datos de ejemplo"', async () => {
    hoyEs('2026-10-13T10:00:00-05:00');
    await sembrarSemanaPasada('ejemplo');
    const { textoDe, existe } = await montarApp();

    expect(existe('inicio-semana')).toBe(true);
    expect(textoDe('inicio-semana-ejemplo')).toBe('Datos de ejemplo');
  });
});
