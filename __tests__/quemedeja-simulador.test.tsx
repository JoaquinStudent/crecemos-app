/**
 * Pruebas de apoyo del simulador de precio en "Qué me deja cada uno": botones con texto (sin
 * deslizador), límites de S/ 0 a S/ 3, frase con "si se vende lo mismo", aviso de subir de a poco,
 * y que simular nunca cambia los datos guardados.
 */

import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { nuevoCierre } from '@dominio/cierre';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, DatosCierre } from '@dominio/tipos';
import { guardarCierre, listarCierres } from '@storage/repositorio';

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
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
  const tocar = (testID: string) =>
    act(async () => {
      const nodo = app.root.findAll(
        n => n.props.testID === testID && typeof n.props.onPress === 'function',
      )[0];
      if (!nodo) throw new Error(`No hay nada con testID "${testID}" que responda a onPress`);
      await nodo.props.onPress();
    });
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const textoDe = (testID: string) => {
    const t = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!t) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return textoCompleto(t);
  };
  const deshabilitado = (testID: string) =>
    app.root.findAll(n => n.props.testID === testID && n.props.disabled !== undefined)[0]?.props
      .disabled === true;
  const hayDeslizador = () => app.root.findAll(n => String(n.type).includes('Slider')).length > 0;
  return { tocar, existe, textoDe, deshabilitado, hayDeslizador };
};

afterEach(async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
});

const ahora = new Date();
const hoy = () => fechaLocal(new Date());
const haceDias = (n: number) => restarDias(hoy(), n);

const sembrar = async (
  fecha: string,
  lineas: DatosCierre['lineas'],
  abreCiclo = false,
): Promise<Cierre> => {
  const cierre: Cierre = {
    ...nuevoCierre(
      { fecha, lineas, montoYape: 0, gastos: [], abreCiclo },
      PRODUCTOS_POR_DEFECTO,
      null,
      ahora,
    ),
    id: `c-${fecha}`,
  };
  await guardarCierre(cierre);
  return cierre;
};

// Anticucho (precio S/ 10, costo S/ 8.20): 30 vendidas en el ciclo completo, otro ciclo en curso.
const sembrarCiclos = async () => {
  await sembrar(haceDias(5), [{ productoId: 'p-anticucho', preparadas: 30, sobrantes: 0 }], true);
  await sembrar(haceDias(1), [{ productoId: 'p-pancita', preparadas: 12, sobrantes: 2 }], true);
};

const abrir = async (app: Awaited<ReturnType<typeof montarApp>>) => {
  await app.tocar('tab-resumen');
  await app.tocar('resumen-que-me-deja');
};

describe('Qué me deja: simulador de precio', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });

  it('muestra el precio simulado igual al actual y dos botones con texto, sin deslizador', async () => {
    await sembrarCiclos();
    const app = await montarApp();
    await abrir(app);

    expect(app.existe('queme-simulador')).toBe(true);
    expect(app.textoDe('queme-sim-precio')).toBe('S/ 10.00');
    expect(app.existe('queme-sim-subir')).toBe(true);
    expect(app.existe('queme-sim-bajar')).toBe(true);
    expect(app.deshabilitado('queme-sim-bajar')).toBe(true);
    expect(app.existe('queme-sim-volver')).toBe(false);
    expect(app.hayDeslizador()).toBe(false);
  });

  it('subir S/ 0.50 dos veces da el precio, la frase y "volver al precio actual"', async () => {
    await sembrarCiclos();
    const app = await montarApp();
    await abrir(app);

    await app.tocar('queme-sim-subir');
    await app.tocar('queme-sim-subir');

    expect(app.textoDe('queme-sim-precio')).toBe('S/ 11.00');
    // 30 porciones por ciclo × S/ 1.00 más.
    expect(app.textoDe('queme-sim-frase')).toBe(
      'Con S/ 11.00 ganarías S/ 30.00 más por ciclo si se vende lo mismo.',
    );
    expect(app.existe('queme-sim-aviso')).toBe(false);

    await app.tocar('queme-sim-volver');
    expect(app.textoDe('queme-sim-precio')).toBe('S/ 10.00');
    expect(app.existe('queme-sim-volver')).toBe(false);
  });

  it('no pasa de S/ 3 sobre el precio actual y avisa de subir de a poco pasando S/ 2', async () => {
    await sembrarCiclos();
    const app = await montarApp();
    await abrir(app);

    for (let i = 0; i < 4; i += 1) await app.tocar('queme-sim-subir');
    expect(app.existe('queme-sim-aviso')).toBe(false);
    await app.tocar('queme-sim-subir');
    expect(app.existe('queme-sim-aviso')).toBe(true);
    for (let i = 0; i < 3; i += 1) await app.tocar('queme-sim-subir');

    expect(app.textoDe('queme-sim-precio')).toBe('S/ 13.00');
    expect(app.deshabilitado('queme-sim-subir')).toBe(true);
  });

  it('simular no cambia los datos guardados', async () => {
    await sembrarCiclos();
    const antes = JSON.stringify(await listarCierres());
    const app = await montarApp();
    await abrir(app);
    await app.tocar('queme-sim-subir');
    await app.tocar('queme-sim-subir');

    expect(JSON.stringify(await listarCierres())).toBe(antes);
  });

  it('cambiar de producto vuelve al precio actual', async () => {
    await sembrar(haceDias(6), [{ productoId: 'p-anticucho', preparadas: 30, sobrantes: 0 }], true);
    await sembrar(haceDias(4), [{ productoId: 'p-pancita', preparadas: 20, sobrantes: 0 }], true);
    await sembrar(haceDias(1), [{ productoId: 'p-anticucho', preparadas: 5, sobrantes: 0 }], true);
    const app = await montarApp();
    await abrir(app);

    await app.tocar('queme-sim-subir');
    expect(app.textoDe('queme-sim-precio')).toBe('S/ 10.50');
    await app.tocar('queme-sim-producto-p-pancita');
    expect(app.textoDe('queme-sim-precio')).toBe('S/ 9.00');
  });

  it('el aviso de costos aparece solo en octubre y marzo', async () => {
    await sembrarCiclos();
    const app = await montarApp();
    await abrir(app);

    const mes = Number(hoy().split('-')[1]);
    expect(app.existe('queme-alerta-costos')).toBe(mes === 10 || mes === 3);
    if (mes === 10 || mes === 3) {
      expect(app.textoDe('queme-alerta-costos-texto')).toMatch(
        /^(Octubre|Marzo): tus costos suelen subir.*Revisa tus costos en Perfil\.$/,
      );
    }
  });
});
