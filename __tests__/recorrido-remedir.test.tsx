/**
 * Si el paso se mide mientras su pantalla aún se mueve (la animación de volver desde Perfil), el
 * hueco no se queda corrido: el recorrido sigue midiendo un rato y lo acomoda en su sitio.
 */
import { createElement, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { soltarRecorridoReal, usarRecorridoReal } from '../testutils/recorrido';
import {
  RecorridoProvider,
  useRecorridoAutomatico,
  useRegistroDePasos,
} from '@context/RecorridoProvider';

const Y_VIEJA = 100;
const Y_FINAL = 240;
/** Las primeras mediciones llegan "durante la animación"; después la vista ya está quieta. */
const MEDIDAS_CON_ANIMACION = 3;

const Paso = () => {
  const registrar = useRegistroDePasos();
  const llamadas = useRef(0);
  useEffect(
    () =>
      registrar({
        nombre: 'prueba',
        orden: 1,
        titulo: 'Paso de prueba',
        texto: 'Texto',
        medir: () => {
          llamadas.current += 1;
          const y = llamadas.current <= MEDIDAS_CON_ANIMACION ? Y_VIEJA : Y_FINAL;
          return Promise.resolve({ x: 16, y, width: 200, height: 100 });
        },
      }),
    [registrar],
  );
  useRecorridoAutomatico(true);
  return createElement(View);
};

/** Un segundo paso que al arrancar "aún no está medible" (la pantalla se está reacomodando). */
const PasoTardio = () => {
  const registrar = useRegistroDePasos();
  const llamadas = useRef(0);
  useEffect(
    () =>
      registrar({
        nombre: 'tardio',
        orden: 2,
        titulo: 'Paso tardío',
        texto: 'Texto',
        medir: () => {
          llamadas.current += 1;
          return Promise.resolve(
            llamadas.current <= 2 ? null : { x: 16, y: 400, width: 200, height: 100 },
          );
        },
      }),
    [registrar],
  );
  return createElement(View);
};

const espera = (ms: number) =>
  act(async () => {
    await new Promise(resolver => setTimeout(resolver, ms));
  });

describe('recorrido: el hueco sigue a lo señalado', () => {
  beforeEach(() => {
    clearAllMockStorages();
    usarRecorridoReal();
  });
  afterEach(soltarRecorridoReal);

  it('corrige un hueco medido en plena animación', async () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      r = ReactTestRenderer.create(createElement(RecorridoProvider, null, createElement(Paso)));
    });
    const marco = () => r.root.findAllByProps({ testID: 'recorrido-marco' })[0];
    for (let i = 0; i < 40 && !marco(); i += 1) await espera(50);
    expect(marco()).toBeDefined();
    // Deja correr el seguimiento (≈1 s) para que llegue la medida ya quieta.
    await espera(1200);
    // El borde superior del hueco es la y medida menos el margen: ya no es la vieja.
    expect(StyleSheet.flatten(marco().props.style).top).toBeGreaterThan(Y_VIEJA);
    expect(StyleSheet.flatten(marco().props.style).top).toBeLessThanOrEqual(Y_FINAL);
    await act(async () => r.unmount());
  });

  it('no pierde un paso que todavía no se podía medir al arrancar', async () => {
    let r!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      r = ReactTestRenderer.create(
        createElement(RecorridoProvider, null, createElement(Paso), createElement(PasoTardio)),
      );
    });
    const contador = () => r.root.findAllByProps({ testID: 'recorrido-contador' })[0];
    for (let i = 0; i < 40 && !contador(); i += 1) await espera(50);
    expect(contador()).toBeDefined();
    const texto = (n: ReactTestRenderer.ReactTestInstance): string =>
      n.children.map(c => (typeof c === 'string' ? c : texto(c))).join('');
    expect(texto(contador())).toBe('Paso 1 de 2');
    await act(async () => r.unmount());
  });
});
