/**
 * El teclado en Android con borde a borde (Android 16): la ventana ya no se redimensiona y el
 * teclado se dibuja encima. Se prueba con eventos de teclado simulados: el hook, la barra que se
 * esconde y el Asistente (pie apoyado en el teclado, chat que baja al último mensaje).
 */
import { createElement } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { spacing } from '@theme';
import { useTecladoVisible } from '@hooks/useTecladoVisible';
import { medidasBarra } from '@navigation/medidasBarra';
import { desmontarApp, montarApp } from '../testutils/app';

type Manejador = (e?: unknown) => void;
const manejadores: Record<string, Manejador[]> = {};

/** Intercepta los oyentes del teclado: así se "abre" y se "cierra" a voluntad. */
const interceptarTeclado = () => {
  for (const k of Object.keys(manejadores)) delete manejadores[k];
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((evento: string, fn: Manejador) => {
    (manejadores[evento] ??= []).push(fn);
    return { remove: () => undefined };
  }) as unknown as typeof Keyboard.addListener);
};
const emitir = (patron: RegExp, e?: unknown) =>
  act(async () => {
    for (const [nombre, fns] of Object.entries(manejadores)) {
      if (patron.test(nombre)) fns.forEach(fn => fn(e));
    }
  });
const abrirTeclado = (height = 300) => emitir(/Show$/, { endCoordinates: { height, screenY: 600 } });
const cerrarTeclado = () => emitir(/Hide$/);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useTecladoVisible', () => {
  const Sonda = () => {
    const { visible, height } = useTecladoVisible();
    return createElement(Text, null, `${visible}:${height}`);
  };
  const leer = (r: ReactTestRenderer.ReactTestRenderer) => r.root.findByType(Text).props.children;

  it('arranca cerrado, informa la altura al abrirse y vuelve a cero al cerrarse', async () => {
    interceptarTeclado();
    let r!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      r = ReactTestRenderer.create(createElement(Sonda));
    });
    expect(leer(r)).toBe('false:0');
    await abrirTeclado(312);
    expect(leer(r)).toBe('true:312');
    await cerrarTeclado();
    expect(leer(r)).toBe('false:0');
    await act(async () => r.unmount());
  });
});

describe('Teclado en el Asistente y la barra', () => {
  beforeEach(() => {
    clearAllMockStorages();
    interceptarTeclado();
  });
  afterEach(desmontarApp);

  const irAlAsistente = async () => {
    const app = await montarApp();
    await app.tocar('tab-asistente');
    return app;
  };

  it('el KeyboardAvoidingView usa padding y el chat deja tocar sin cerrar el teclado', async () => {
    const app = await irAlAsistente();
    const kav = app.buscar(n => (n.type as unknown) === KeyboardAvoidingView)[0];
    expect(kav.props.behavior).toBe('padding');
    expect(kav.props.keyboardVerticalOffset).toBe(0);
    const chat = app.buscar(n => n.props.testID === 'preguntar-chat' && (n.type as unknown) === 'RCTScrollView')[0];
    expect(chat.props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('con el teclado abierto la barra se esconde y el pie se apoya en el teclado; al cerrar vuelve todo', async () => {
    const app = await irAlAsistente();
    const conBarra = medidasBarra(0).alturaTotal + spacing.sm;
    const relleno = () => app.estiloDe('preguntar-pie').paddingBottom;

    expect(app.existe('barra-navegacion')).toBe(true);
    expect(relleno()).toBe(conBarra);

    await abrirTeclado();
    expect(app.existe('barra-navegacion')).toBe(false);
    expect(relleno()).toBe(spacing.sm);
    // El campo y el botón de enviar siguen en el árbol, dentro del pie.
    expect(app.existe('preguntar-campo')).toBe(true);
    expect(app.existe('preguntar-enviar')).toBe(true);

    await cerrarTeclado();
    expect(app.existe('barra-navegacion')).toBe(true);
    expect(relleno()).toBe(conBarra);
  });

  it('al abrirse el teclado el chat baja hasta el último mensaje', async () => {
    const app = await irAlAsistente();
    const alFinal = (ScrollView as unknown as { prototype: { scrollToEnd: jest.Mock } }).prototype
      .scrollToEnd;
    alFinal.mockClear();

    await abrirTeclado();
    expect(alFinal).toHaveBeenCalled();

    // Y cuando el chat cambia de alto (el teclado lo encoge) vuelve a bajar.
    alFinal.mockClear();
    const chat = app.buscar(n => n.props.testID === 'preguntar-chat' && (n.type as unknown) === 'RCTScrollView')[0];
    await act(async () => {
      chat.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 200 } } });
    });
    expect(alFinal).toHaveBeenCalledWith({ animated: false });
  });
});
