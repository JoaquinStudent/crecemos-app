/** El splash de la marca: avisa al nativo, espera lo mínimo y se va cuando la app está lista. */
import { createElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MINIMO_MS, SplashAnimado } from '@components/organisms/SplashAnimado';
import { ocultarSplashNativo } from '@services/splash';

jest.mock('@services/splash', () => ({ ocultarSplashNativo: jest.fn() }));

const hayCartel = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAllByProps({ testID: 'splash-animado' }).length > 0;

const montar = (listo: boolean) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    r = ReactTestRenderer.create(createElement(SplashAnimado, { listo }));
  });
  return r;
};

const avanzar = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
    await Promise.resolve();
  });

describe('SplashAnimado', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (ocultarSplashNativo as jest.Mock).mockClear();
    // Sin animación: la salida es inmediata y no depende de temporizadores de Animated.
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  });
  afterEach(() => jest.useRealTimers());

  it('avisa al splash nativo cuando el logo ya está pintado', async () => {
    montar(false);
    await avanzar(600);
    expect(ocultarSplashNativo).toHaveBeenCalledTimes(1);
  });

  it('mientras la app carga, el splash se queda aunque pase el mínimo', async () => {
    const r = montar(false);
    await avanzar(MINIMO_MS + 1500);
    expect(hayCartel(r)).toBe(true);
  });

  it('con la app lista no se va antes del mínimo, y después sí', async () => {
    const r = montar(true);
    await avanzar(MINIMO_MS - 200);
    expect(hayCartel(r)).toBe(true);
    await avanzar(1500);
    expect(hayCartel(r)).toBe(false);
  });

  it('el lector de pantalla no lo anuncia', () => {
    const r = montar(false);
    const [cartel] = r.root.findAllByProps({ testID: 'splash-animado' });
    expect(cartel.props.accessibilityElementsHidden).toBe(true);
    expect(cartel.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
