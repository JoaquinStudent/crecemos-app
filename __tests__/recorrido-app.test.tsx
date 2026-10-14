/**
 * El recorrido guiado en la app real: arranca solo en el primer uso, funciona con Inicio vacío y
 * con datos, y "Ver el recorrido otra vez" (Perfil) lo vuelve a abrir. Jest no tiene diseño nativo:
 * las medidas se simulan para cada paso, y lo que cuenta es QUÉ pasos están montados.
 */
import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { nuevoCierre } from '@dominio/cierre';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre } from '@dominio/tipos';
import { guardarCierre, recorridoVisto } from '@storage/repositorio';
import { soltarRecorridoReal, usarRecorridoReal } from '../testutils/recorrido';

jest.mock('@components/molecules/PasoGuia/medir', () => ({
  // Todo paso montado "está en pantalla": lo que cambia entre pruebas es qué pasos existen.
  medirVista: () => Promise.resolve({ x: 16, y: 150, width: 200, height: 100 }),
}));

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
beforeEach(() => {
  clearAllMockStorages();
  usarRecorridoReal();
});
afterEach(async () => {
  soltarRecorridoReal();
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
});

const texto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(texto).join('');

const asentar = async () => {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
};

const montarApp = async () => {
  await act(async () => {
    montada = ReactTestRenderer.create(createElement(App));
  });
  await asentar();
  const app = montada!;
  const existe = (id: string) => app.root.findAll(n => n.props.testID === id).length > 0;
  const textoDe = (id: string) =>
    texto(app.root.findAll(n => n.props.testID === id)[0]);
  const tocar = async (id: string) => {
    await act(async () => {
      await app.root
        .findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0]
        .props.onPress();
    });
    await asentar();
  };
  return { existe, textoDe, tocar };
};

const sembrarDias = async () => {
  for (const k of [1, 2, 3]) {
    const fecha = restarDias(fechaLocal(new Date()), k);
    const cierre: Cierre = {
      ...nuevoCierre(
        {
          fecha,
          lineas: [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 2 }],
          montoYape: 0,
          gastos: [],
          abreCiclo: k === 3,
        },
        PRODUCTOS_POR_DEFECTO,
        null,
        new Date(),
      ),
      id: `c-${fecha}`,
    };
    await guardarCierre(cierre);
  }
};

describe('recorrido guiado en la app', () => {
  it('Inicio vacío (instalación nueva): arranca solo y salta lo que no está montado', async () => {
    const { existe, textoDe, tocar } = await montarApp();
    expect(existe('recorrido-overlay')).toBe(true);
    // Sin datos no hay tarjeta "Te queda" ni "Para decidir hoy": quedan tres pasos.
    expect(textoDe('recorrido-contador')).toBe('Paso 1 de 3');
    expect(textoDe('recorrido-titulo')).toBe('Cierra tu día');
    await tocar('recorrido-siguiente');
    expect(textoDe('recorrido-titulo')).toBe('Pregúntame lo que quieras');
    await tocar('recorrido-siguiente');
    expect(textoDe('recorrido-titulo')).toBe('Tu cuota y tus yapes');
    expect(textoDe('recorrido-siguiente')).toBe('Entendido');
    await tocar('recorrido-siguiente');
    expect(existe('recorrido-overlay')).toBe(false);
    expect(await recorridoVisto()).toBe(true);
  });

  it('con datos: los cinco pasos, en orden, con sus textos', async () => {
    await sembrarDias();
    const { existe, textoDe, tocar } = await montarApp();
    expect(existe('recorrido-overlay')).toBe(true);
    expect(textoDe('recorrido-contador')).toBe('Paso 1 de 5');
    const titulos: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      titulos.push(textoDe('recorrido-titulo'));
      await tocar('recorrido-siguiente');
    }
    expect(titulos).toEqual([
      'Lo que te queda',
      'Cierra tu día',
      'Qué hacer hoy y mañana',
      'Pregúntame lo que quieras',
      'Tu cuota y tus yapes',
    ]);
    expect(existe('recorrido-overlay')).toBe(false);
  });

  it('Saltar recorrido lo cierra, lo marca visto y no vuelve en otro arranque', async () => {
    const { existe, tocar } = await montarApp();
    await tocar('recorrido-saltar');
    expect(existe('recorrido-overlay')).toBe(false);
    expect(await recorridoVisto()).toBe(true);
    await act(async () => montada!.unmount());
    const otra = await montarApp();
    expect(otra.existe('recorrido-overlay')).toBe(false);
  });

  it('si no se puede leer la marca, no lo muestra', async () => {
    jest.spyOn(createAsyncStorage('crecemos'), 'getItem').mockImplementation(async clave => {
      if (clave === '@crecemos/recorrido-visto') throw new Error('disco roto');
      return null;
    });
    const { existe } = await montarApp();
    expect(existe('recorrido-overlay')).toBe(false);
    jest.restoreAllMocks();
  });

  it('Perfil → "Ver el recorrido otra vez" lo reinicia desde Inicio', async () => {
    await createAsyncStorage('crecemos').setItem('@crecemos/recorrido-visto', 'true');
    const { existe, textoDe, tocar } = await montarApp();
    expect(existe('recorrido-overlay')).toBe(false);
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-ayuda');
    expect(existe('ver-recorrido')).toBe(true);
    await tocar('ver-recorrido');
    expect(existe('recorrido-overlay')).toBe(true);
    expect(textoDe('recorrido-contador')).toBe('Paso 1 de 3');
    await tocar('recorrido-saltar');
    expect(existe('recorrido-overlay')).toBe(false);
  });

  it('con la marca puesta (como en Jest por defecto) no estorba a nadie', async () => {
    soltarRecorridoReal();
    const { existe } = await montarApp();
    expect(existe('recorrido-overlay')).toBe(false);
    expect(existe('inicio-cerrar-dia')).toBe(true);
  });
});
