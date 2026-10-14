/**
 * Pruebas de apoyo de la tarjeta "Para mañana" de Inicio (planificador): con datos sugiere porciones
 * y capital; sin datos suficientes lo dice con honestidad. La app real, por testID.
 */

import { createElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { nuevoCierre } from '@dominio/cierre';
import { diaSemana, fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { NOMBRES_DIA } from '@analisis/planificador';
import type { Cierre, DatosCierre } from '@dominio/tipos';
import { guardarCierre } from '@storage/repositorio';

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

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
  const textos = () => app.root.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  return { textoDe, existe, textos };
};

const manana = () => restarDias(fechaLocal(new Date()), -1);
const mismoDiaHace = (semanas: number) => restarDias(manana(), 7 * semanas);

const sembrar = async (fecha: string, lineas: DatosCierre['lineas']): Promise<Cierre> => {
  const cierre: Cierre = {
    ...nuevoCierre(
      { fecha, lineas, montoYape: 0, gastos: [], abreCiclo: false },
      PRODUCTOS_POR_DEFECTO,
      null,
      new Date(),
    ),
    id: `c-${fecha}`,
  };
  await guardarCierre(cierre);
  return cierre;
};

describe('Inicio: Para mañana', () => {
  it('con 3 semanas del mismo día sugiere porciones y lo que pondrías de mercadería', async () => {
    for (const k of [1, 2, 3]) {
      await sembrar(mismoDiaHace(k), [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 0 }]);
    }
    const { textoDe, existe } = await montarApp();

    expect(existe('inicio-manana')).toBe(true);
    expect(textoDe('inicio-manana-p-anticucho-porciones')).toBe('22 porciones');
    expect(textoDe('inicio-manana-p-anticucho-texto')).toBe('+2 más que el último ' + dia());
    const costo = PRODUCTOS_POR_DEFECTO.find(p => p.id === 'p-anticucho')!.costoUnitario;
    expect(textoDe('inicio-manana-capital')).toBe(
      `Pondrías S/ ${(22 * costo).toFixed(2)} de mercadería`,
    );
  });

  it('con pocos datos lo dice y no pone ni cifras ni capital', async () => {
    await sembrar(mismoDiaHace(1), [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 0 }]);
    const { textoDe, existe, textos } = await montarApp();

    expect(existe('inicio-manana')).toBe(true);
    expect(textoDe('inicio-manana-p-anticucho-texto')).toMatch(
      /^Aún no tengo suficientes .+ para sugerirte$/,
    );
    expect(existe('inicio-manana-capital')).toBe(false);
    expect(existe('inicio-manana-p-anticucho-porciones')).toBe(false);
    expect(textos().some(t => t.startsWith('Para mañana · '))).toBe(true);
  });
});

const dia = (): string => NOMBRES_DIA[diaSemana(manana())];
