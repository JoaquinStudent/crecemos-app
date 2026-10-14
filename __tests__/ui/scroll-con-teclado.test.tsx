/**
 * ScrollConTeclado: con borde a borde (`adjustResize` ignorado) el teclado se dibuja ENCIMA. El
 * componente suma el alto del teclado al relleno inferior y lleva el campo enfocado sobre él.
 * Teclado simulado + mediciones simuladas (Jest no tiene pantalla).
 */
import { createElement } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { spacing } from '@theme';
import {
  desplazamientoParaVer,
  ScrollConTeclado,
} from '@components/molecules/ScrollConTeclado';
import { montar, desmontar, hostPorTestID } from '../../testutils/componente';
import { crearTecladoSimulado } from '../../testutils/teclado';

type Medida = (cb: (x: number, y: number, w: number, h: number) => void) => void;

const scrollMock = (ScrollView as unknown as { prototype: Record<string, jest.Mock> }).prototype;
const estadoOriginal = (TextInput as unknown as { State?: unknown }).State;

/** Simula dónde está la zona de scroll y el campo enfocado (en dp de ventana). */
const simularMedidas = (
  zona: { y: number; alto: number },
  campo: { y: number; alto: number } | null,
) => {
  scrollMock.measureInWindow.mockImplementation(((cb: Parameters<Medida>[0]) =>
    cb(0, zona.y, 360, zona.alto)) as Medida);
  const enfocado = campo
    ? {
        measureInWindow: (cb: Parameters<Medida>[0]) => cb(16, campo.y, 328, campo.alto),
      }
    : null;
  (TextInput as unknown as { State: unknown }).State = {
    currentlyFocusedInput: () => enfocado,
  };
};

const relleno = (r: ReactTestRenderer.ReactTestRenderer) =>
  StyleSheet.flatten(hostPorTestID(r, 'sc').props.contentContainerStyle)?.paddingBottom;

const montarScroll = (props: Record<string, unknown> = {}) =>
  montar(
    createElement(
      ScrollConTeclado,
      { testID: 'sc', contentContainerStyle: { paddingBottom: spacing.xxl }, ...props },
      createElement(Text, null, 'contenido'),
    ),
  );

let teclado: ReturnType<typeof crearTecladoSimulado>;

beforeEach(() => {
  teclado = crearTecladoSimulado();
  scrollMock.scrollTo.mockClear();
});
afterEach(() => {
  jest.restoreAllMocks();
  (TextInput as unknown as { State?: unknown }).State = estadoOriginal;
  scrollMock.measureInWindow.mockReset();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
});

describe('desplazamientoParaVer (la cuenta)', () => {
  const base = { zonaArriba: 100, zonaAbajo: 800, margen: 24 };
  it('no mueve nada si el campo ya se ve con su margen', () => {
    expect(desplazamientoParaVer({ ...base, campoArriba: 300, campoAlto: 56 })).toBe(0);
  });
  it('baja lo justo para que el borde de abajo quede a un margen del teclado', () => {
    expect(desplazamientoParaVer({ ...base, campoArriba: 760, campoAlto: 56 })).toBe(40);
  });
  it('si el campo es más alto que la zona, deja visible su borde de arriba', () => {
    const d = desplazamientoParaVer({ ...base, campoArriba: 300, campoAlto: 900 });
    expect(300 - d).toBe(base.zonaArriba + base.margen);
  });
  it('con margenAbajo deja ese espacio libre bajo el campo (para ver sus botones)', () => {
    expect(
      desplazamientoParaVer({ ...base, margenAbajo: 80, campoArriba: 700, campoAlto: 56 }),
    ).toBe(36);
  });
  it('sube si el campo quedó tapado por arriba', () => {
    expect(desplazamientoParaVer({ ...base, campoArriba: 60, campoAlto: 56 })).toBe(-64);
  });
});

describe('ScrollConTeclado: relleno inferior', () => {
  it.each(['android', 'ios'])('en %s: relleno = teclado + spacing.lg y vuelve al normal al cerrar', async os => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    simularMedidas({ y: 0, alto: 800 }, null);
    const r = await montarScroll();
    expect(relleno(r)).toBe(spacing.xxl);
    expect(hostPorTestID(r, 'sc').props.keyboardShouldPersistTaps).toBe('handled');

    await teclado.abrir(312, 528);
    expect(relleno(r)).toBe(312 + spacing.lg);

    await teclado.cerrar();
    expect(relleno(r)).toBe(spacing.xxl);
    await desmontar(r);
  });

  it('con conRelleno={false} no suma el teclado (la pantalla ya sube su pie)', async () => {
    simularMedidas({ y: 0, alto: 800 }, null);
    const r = await montarScroll({ conRelleno: false });
    await teclado.abrir(312, 528);
    expect(relleno(r)).toBe(spacing.xxl);
    await desmontar(r);
  });

  it('deja pasar las props y entrega la ref del ScrollView', async () => {
    simularMedidas({ y: 0, alto: 800 }, null);
    const ref = { current: null as unknown };
    const r = await montarScroll({ ref, bounces: false });
    expect(hostPorTestID(r, 'sc').props.bounces).toBe(false);
    expect(typeof (ref.current as { scrollTo: unknown }).scrollTo).toBe('function');
    await desmontar(r);
  });
});

describe('ScrollConTeclado: lleva el campo enfocado sobre el teclado', () => {
  it('al abrirse el teclado, baja lo justo para que el campo quede a spacing.lg del teclado', async () => {
    // Teclado desde 528; el campo ocupa 500..560: tapado. Debe quedar su borde en 528 - lg.
    simularMedidas({ y: 80, alto: 760 }, { y: 500, alto: 60 });
    const r = await montarScroll();
    await teclado.abrir(312, 528);
    expect(scrollMock.scrollTo).toHaveBeenCalledTimes(1);
    const { y, animated } = scrollMock.scrollTo.mock.calls[0][0];
    expect(animated).toBe(false);
    expect(560 - y).toBeLessThanOrEqual(528 - spacing.lg);
    expect(y).toBe(560 - (528 - spacing.lg));
    await desmontar(r);
  });

  it('con un pie bajo el scroll, el campo queda sobre el pie (la zona termina donde empieza el pie)', async () => {
    // El pie sube con el teclado: la zona de scroll mide 80..400 y el teclado empieza en 528.
    simularMedidas({ y: 80, alto: 320 }, { y: 380, alto: 56 });
    const r = await montarScroll({ conRelleno: false });
    await teclado.abrir(312, 528);
    expect(scrollMock.scrollTo.mock.calls[0][0].y).toBe(436 - (400 - spacing.lg));
    await desmontar(r);
  });

  it('con margenInferior deja ese espacio bajo el campo, sobre el teclado', async () => {
    simularMedidas({ y: 80, alto: 760 }, { y: 440, alto: 56 });
    const r = await montarScroll({ margenInferior: 80 });
    await teclado.abrir(312, 528);
    expect(scrollMock.scrollTo.mock.calls[0][0].y).toBe(496 - (528 - 80));
    await desmontar(r);
  });

  it('no mueve nada si el campo ya está a la vista', async () => {
    simularMedidas({ y: 80, alto: 760 }, { y: 200, alto: 56 });
    const r = await montarScroll();
    await teclado.abrir(312, 528);
    expect(scrollMock.scrollTo).not.toHaveBeenCalled();
    await desmontar(r);
  });

  it('si el teclado no informa dónde empieza usa alto de ventana - alto del teclado', async () => {
    jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 360, height: 800, scale: 1, fontScale: 1 });
    simularMedidas({ y: 0, alto: 800 }, { y: 560, alto: 60 });
    const r = await montarScroll();
    await act(async () => {
      await teclado.abrir(300, 0);
    });
    // Teclado desde 500: el borde de abajo (620) debe quedar en 500 - lg.
    expect(scrollMock.scrollTo.mock.calls[0][0].y).toBe(620 - (500 - spacing.lg));
    await desmontar(r);
  });

  it('al enfocar otro campo con el teclado ya abierto (onFocus) vuelve a acomodar, sumando al scroll actual', async () => {
    simularMedidas({ y: 80, alto: 760 }, { y: 200, alto: 56 });
    const r = await montarScroll();
    await teclado.abrir(312, 528);
    expect(scrollMock.scrollTo).not.toHaveBeenCalled();

    // La persona ya había scrolleado 100 y ahora enfoca un campo tapado (480..540).
    await act(async () => {
      hostPorTestID(r, 'sc').props.onScroll({ nativeEvent: { contentOffset: { x: 0, y: 100 } } });
    });
    simularMedidas({ y: 80, alto: 760 }, { y: 480, alto: 60 });
    await act(async () => {
      hostPorTestID(r, 'sc').props.onFocus({});
    });
    expect(scrollMock.scrollTo).toHaveBeenCalledWith({
      y: 100 + (540 - (528 - spacing.lg)),
      animated: false,
    });
    await desmontar(r);
  });

  it('cuando el contenido cambia de alto (el relleno nuevo) se revisa otra vez, sin repetir si ya se ve', async () => {
    simularMedidas({ y: 80, alto: 760 }, { y: 200, alto: 56 });
    const r = await montarScroll();
    await teclado.abrir(312, 528);
    await act(async () => {
      hostPorTestID(r, 'sc').props.onContentSizeChange(360, 1400);
    });
    expect(scrollMock.scrollTo).not.toHaveBeenCalled();
    await desmontar(r);
  });

  it('con el teclado cerrado, enfocar no hace nada', async () => {
    simularMedidas({ y: 80, alto: 760 }, { y: 700, alto: 60 });
    const r = await montarScroll();
    await act(async () => {
      hostPorTestID(r, 'sc').props.onFocus({});
    });
    expect(scrollMock.scrollTo).not.toHaveBeenCalled();
    await desmontar(r);
  });
});
