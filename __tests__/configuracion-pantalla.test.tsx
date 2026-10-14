/**
 * Perfil → Configuración, con la app real y por testID: arranca en letra Normal, cambiar el tamaño
 * se ve al instante y queda guardado en el Perfil, y los interruptores se guardan.
 */
import { createElement } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { obtenerPerfil } from '@storage/repositorio';

beforeEach(() => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  clearAllMockStorages();
});

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
});

const esperar = async (veces = 5) => {
  for (let i = 0; i < veces; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
};

const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  await esperar();
  montada = app;
  const nodo = (testID: string, prop: 'onPress' | 'onValueChange') =>
    app.root.findAll(n => n.props.testID === testID && typeof n.props[prop] === 'function')[0];
  const tocar = async (testID: string) => {
    await act(async () => {
      await nodo(testID, 'onPress').props.onPress();
    });
    await esperar(2);
  };
  const cambiarInterruptor = async (testID: string, valor: boolean) => {
    await act(async () => {
      await nodo(testID, 'onValueChange').props.onValueChange(valor);
    });
    await esperar(2);
  };
  const tamanoDe = (testID: string): number => {
    const t = app.root.findAll(
      (n: ReactTestInstance) => (n.type as unknown) === 'Text' && n.props.testID === testID,
    )[0];
    return StyleSheet.flatten(t.props.style)?.fontSize as number;
  };
  const abrirConfiguracion = async () => {
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-configuracion');
  };
  return { tocar, cambiarInterruptor, tamanoDe, abrirConfiguracion };
};

describe('Perfil → Configuración', () => {
  it('arranca en letra Normal: el cuerpo mide 16', async () => {
    const { abrirConfiguracion, tamanoDe } = await montarApp();
    await abrirConfiguracion();

    expect(tamanoDe('configuracion-muestra-texto')).toBe(16);
  });

  it('cambiar a Extra grande se ve al instante (20) y se guarda en el Perfil', async () => {
    const { abrirConfiguracion, tocar, tamanoDe } = await montarApp();
    await abrirConfiguracion();

    await tocar('configuracion-tamano-extra');

    expect(tamanoDe('configuracion-muestra-texto')).toBe(20);
    expect((await obtenerPerfil())?.tamanoLetra).toBe('extra');
  });

  it('Grande devuelve los 18 de siempre', async () => {
    const { abrirConfiguracion, tocar, tamanoDe } = await montarApp();
    await abrirConfiguracion();

    await tocar('configuracion-tamano-grande');

    expect(tamanoDe('configuracion-muestra-texto')).toBe(18);
  });

  it('los interruptores de vibración y animaciones se guardan', async () => {
    const { abrirConfiguracion, cambiarInterruptor } = await montarApp();
    await abrirConfiguracion();

    await cambiarInterruptor('switch-vibracion', false);
    await cambiarInterruptor('switch-animaciones', true);

    const perfil = await obtenerPerfil();
    expect(perfil?.vibracion).toBe(false);
    expect(perfil?.reducirAnimaciones).toBe(true);
  });
});
