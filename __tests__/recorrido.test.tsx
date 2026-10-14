/**
 * El recorrido guiado de primera vez, a través de nuestra API: <PasoGuia>, useRecorrido() y
 * useRecorridoAutomatico(). Jest no tiene diseño nativo, así que las mockMedidas se simulan.
 */
import React, { ReactNode } from 'react';
import { BackHandler, Dimensions, StyleSheet, Text as RNText } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { PasoGuia } from '@components/molecules/PasoGuia';
import {
  RecorridoProvider,
  useRecorrido,
  useRecorridoAutomatico,
} from '@context/RecorridoProvider';
import { recorridoVisto } from '@storage/repositorio';
import { soltarRecorridoReal, usarRecorridoReal } from '../testutils/recorrido';

type Rect = { x: number; y: number; width: number; height: number };
let mockMedidas: Record<string, Rect | null> = {};

jest.mock('@components/molecules/PasoGuia/medir', () => ({
  medirVista: (_ref: unknown, nombre: string) => Promise.resolve(mockMedidas[nombre] ?? null),
}));

const ARRIBA: Rect = { x: 16, y: 120, width: 300, height: 200 };
const ABAJO: Rect = { x: 130, y: 1150, width: 90, height: 120 };
const MEDIO: Rect = { x: 16, y: 500, width: 300, height: 100 };

const PASOS = [
  { nombre: 'a', orden: 1, titulo: 'Titulo A', texto: 'Texto A' },
  { nombre: 'b', orden: 2, titulo: 'Titulo B', texto: 'Texto B' },
  { nombre: 'c', orden: 3, titulo: 'Titulo C', texto: 'Texto C' },
];

let api!: ReturnType<typeof useRecorrido>;
const Sonda = () => {
  api = useRecorrido();
  return null;
};
const Automatico = ({ listo }: { listo: boolean }) => {
  useRecorridoAutomatico(listo);
  return null;
};

const Pantalla = ({ listo = false, orden }: { listo?: boolean; orden?: string[] }) => {
  const pasos = orden ? orden.map(n => PASOS.find(p => p.nombre === n)!) : PASOS;
  return (
    <>
      <Sonda />
      <Automatico listo={listo} />
      {pasos.map(p => (
        <PasoGuia key={p.nombre} {...p}>
          <RNText>{p.titulo}</RNText>
        </PasoGuia>
      ))}
    </>
  );
};

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
// El recorrido cuenta sus pasos hasta que el número se repite (~0,25 s): se le da ese tiempo.
const asentar = async () => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 80));
    });
  }
};
const montar = async (hijo: ReactNode, esperar = true) => {
  await act(async () => {
    montada = ReactTestRenderer.create(
      <SafeAreaProvider>
        <RecorridoProvider>{hijo}</RecorridoProvider>
      </SafeAreaProvider>,
    );
  });
  if (esperar) await asentar();
};
const raiz = () => montada!.root;
const porId = (id: string): ReactTestInstance | undefined =>
  raiz().findAll(n => n.props.testID === id && typeof n.type === 'string')[0];
const hay = (id: string) => porId(id) !== undefined;
const texto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(texto).join('');
const textoDe = (id: string) => texto(raiz().findAll(n => n.props.testID === id)[0]);
const tocar = (id: string) =>
  act(async () => {
    raiz().findAll(n => n.props.testID === id && typeof n.props.onPress === 'function')[0].props.onPress();
  });

beforeEach(() => {
  clearAllMockStorages();
  usarRecorridoReal();
  mockMedidas = { a: ARRIBA, b: MEDIO, c: ABAJO };
});
afterEach(async () => {
  soltarRecorridoReal();
  jest.restoreAllMocks();
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
});

describe('recorrido guiado: pasos', () => {
  it('recorre los pasos por su orden, aunque estén montados en otro', async () => {
    await montar(<Pantalla listo orden={['c', 'a', 'b']} />);
    await act(async () => {});
    expect(textoDe('recorrido-contador')).toBe('Paso 1 de 3');
    expect(textoDe('recorrido-titulo')).toBe('Titulo A');
    await tocar('recorrido-siguiente');
    expect(textoDe('recorrido-contador')).toBe('Paso 2 de 3');
    expect(textoDe('recorrido-titulo')).toBe('Titulo B');
    await tocar('recorrido-siguiente');
    expect(textoDe('recorrido-titulo')).toBe('Titulo C');
  });

  it('muestra Atrás desde el segundo paso y vuelve; el último dice Entendido', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    expect(hay('recorrido-atras')).toBe(false);
    expect(textoDe('recorrido-siguiente')).toBe('Siguiente');
    await tocar('recorrido-siguiente');
    expect(hay('recorrido-atras')).toBe(true);
    await tocar('recorrido-atras');
    expect(textoDe('recorrido-titulo')).toBe('Titulo A');
    await tocar('recorrido-siguiente');
    await tocar('recorrido-siguiente');
    expect(textoDe('recorrido-siguiente')).toBe('Entendido');
  });

  it('Entendido cierra y deja la marca de visto', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    await tocar('recorrido-siguiente');
    await tocar('recorrido-siguiente');
    await tocar('recorrido-siguiente');
    expect(hay('recorrido-overlay')).toBe(false);
    expect(await recorridoVisto()).toBe(true);
  });

  it('Saltar recorrido está en cada paso, mide 48 dp o más, cierra y marca visto', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    for (let paso = 0; paso < 3; paso += 1) {
      const saltar = porId('recorrido-saltar')!;
      expect(StyleSheet.flatten(saltar.props.style).minHeight).toBeGreaterThanOrEqual(48);
      expect(saltar.props.accessibilityLabel).toBe('Saltar recorrido');
      await tocar('recorrido-siguiente');
    }
  });

  it('saltar en el primer paso cierra y no vuelve a salir', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    await tocar('recorrido-saltar');
    expect(hay('recorrido-overlay')).toBe(false);
    expect(await recorridoVisto()).toBe(true);
  });

  it('un paso cuyo pedazo no está montado se salta y el contador no deja huecos', async () => {
    mockMedidas = { a: ARRIBA, c: ABAJO }; // b no está en pantalla
    await montar(<Pantalla listo />);
    await act(async () => {});
    expect(textoDe('recorrido-contador')).toBe('Paso 1 de 2');
    await tocar('recorrido-siguiente');
    expect(textoDe('recorrido-contador')).toBe('Paso 2 de 2');
    expect(textoDe('recorrido-titulo')).toBe('Titulo C');
    await tocar('recorrido-atras');
    expect(textoDe('recorrido-titulo')).toBe('Titulo A');
  });

  it('si ningún paso se puede medir, no muestra nada ni lo da por visto', async () => {
    mockMedidas = {};
    await montar(<Pantalla listo />);
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(false);
    expect(await recorridoVisto()).toBe(false);
  });

  it('un paso con activo={false} no participa', async () => {
    await montar(
      <>
        <Automatico listo />
        <PasoGuia {...PASOS[0]}>
          <RNText>a</RNText>
        </PasoGuia>
        <PasoGuia {...PASOS[1]} activo={false}>
          <RNText>b</RNText>
        </PasoGuia>
      </>,
    );
    await act(async () => {});
    expect(textoDe('recorrido-contador')).toBe('Paso 1 de 1');
  });
});

describe('recorrido guiado: medir otra vez', () => {
  const marcoTop = () => StyleSheet.flatten(porId('recorrido-marco')!.props.style).top;
  const MOVIDO: Rect = { ...ARRIBA, y: ARRIBA.y + 100 };

  it('al dibujarse el hueco (onLayout) vuelve a medir y sigue a lo señalado', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    expect(marcoTop()).toBe(ARRIBA.y - 8);
    mockMedidas = { ...mockMedidas, a: MOVIDO }; // el hero cambió de alto/lugar mientras tanto
    await act(async () => {
      porId('recorrido-marco')!.props.onLayout();
    });
    expect(marcoTop()).toBe(MOVIDO.y - 8);
  });

  it('cuando lo señalado cambia de tamaño (onLayout del PasoGuia) mide otra vez', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    mockMedidas = { ...mockMedidas, a: MOVIDO };
    const guia = raiz().findAll(
      n => typeof n.type === 'string' && n.props.collapsable === false && typeof n.props.onLayout === 'function',
    )[0];
    await act(async () => {
      guia.props.onLayout();
    });
    expect(marcoTop()).toBe(MOVIDO.y - 8);
  });

  it('al cambiar de paso mide el nuevo; el aviso de un paso que no es el activo se ignora', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    await tocar('recorrido-siguiente');
    expect(marcoTop()).toBe(MEDIO.y - 8);
    mockMedidas = { ...mockMedidas, a: MOVIDO, b: { ...MEDIO, y: 560 } };
    const guias = raiz().findAll(
      n => typeof n.type === 'string' && n.props.collapsable === false && typeof n.props.onLayout === 'function',
    );
    await act(async () => {
      guias[0].props.onLayout(); // paso A: no es el activo
    });
    expect(marcoTop()).toBe(MEDIO.y - 8);
    await act(async () => {
      guias[1].props.onLayout(); // paso B: sí
    });
    expect(marcoTop()).toBe(560 - 8);
  });

  it('si la medida no cambió no vuelve a dibujar el hueco', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    const antes = porId('recorrido-marco')!.props.style;
    await act(async () => {
      porId('recorrido-marco')!.props.onLayout();
    });
    expect(porId('recorrido-marco')!.props.style).toEqual(antes);
  });
});

describe('recorrido guiado: botón Atrás del teléfono', () => {
  const capturar = () => {
    const manejadores: Array<() => boolean | null | undefined> = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, fn) => {
      const manejador = fn as unknown as () => boolean | null | undefined;
      manejadores.push(manejador);
      return { remove: () => manejadores.splice(manejadores.indexOf(manejador), 1) };
    });
    return manejadores;
  };

  it('vuelve un paso, y en el primero cierra (nunca queda bloqueado)', async () => {
    const manejadores = capturar();
    await montar(<Pantalla listo />);
    await act(async () => {});
    await tocar('recorrido-siguiente');
    expect(textoDe('recorrido-titulo')).toBe('Titulo B');
    let consumido: boolean | null | undefined;
    await act(async () => {
      consumido = manejadores[manejadores.length - 1]();
    });
    expect(consumido).toBe(true);
    expect(textoDe('recorrido-titulo')).toBe('Titulo A');
    await act(async () => {
      manejadores[manejadores.length - 1]();
    });
    expect(hay('recorrido-overlay')).toBe(false);
    expect(await recorridoVisto()).toBe(true);
  });
});

describe('recorrido guiado: primer arranque', () => {
  it('arranca solo la primera vez, cuando todo está listo', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(true);
  });

  it('no arranca mientras no está listo (cargando, con error o Inicio sin foco)', async () => {
    await montar(<Pantalla listo={false} />);
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(false);
  });

  it('arranca cuando pasa a estar listo', async () => {
    await montar(<Pantalla listo={false} />);
    await act(async () => {});
    await act(async () => {
      montada!.update(
        <SafeAreaProvider>
          <RecorridoProvider>
            <Pantalla listo />
          </RecorridoProvider>
        </SafeAreaProvider>,
      );
    });
    await asentar();
    expect(hay('recorrido-overlay')).toBe(true);
  });

  it('solo una vez: tras saltarlo no vuelve, ni en la sesión ni en otro arranque', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    await tocar('recorrido-saltar');
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(false);
    // Otro arranque: la marca ya está guardada.
    await act(async () => montada!.unmount());
    await montar(<Pantalla listo />);
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(false);
  });

  it('no vuelve a salir aunque no se haya podido guardar la marca (no insiste en la sesión)', async () => {
    jest.spyOn(createAsyncStorage('crecemos'), 'setItem').mockRejectedValue(new Error('lleno'));
    await montar(<Pantalla listo />);
    await act(async () => {});
    await tocar('recorrido-saltar');
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(false);
  });

  it('si no se puede leer la marca, NO lo muestra', async () => {
    jest.spyOn(createAsyncStorage('crecemos'), 'getItem').mockRejectedValue(new Error('disco roto'));
    await montar(<Pantalla listo />);
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(false);
  });

  it('si ya lo vio, no lo muestra', async () => {
    await createAsyncStorage('crecemos').setItem('@crecemos/recorrido-visto', 'true');
    await montar(<Pantalla listo />);
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(false);
  });
});

describe('recorrido guiado: repetir', () => {
  it('repetir() olvida la marca y arranca otra vez', async () => {
    await createAsyncStorage('crecemos').setItem('@crecemos/recorrido-visto', 'true');
    await montar(<Pantalla listo />);
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(false);
    await act(async () => {
      await api.repetir();
    });
    await asentar();
    expect(hay('recorrido-overlay')).toBe(true);
    expect(textoDe('recorrido-contador')).toBe('Paso 1 de 3');
  });

  it('repetir() espera a que Inicio esté listo para empezar', async () => {
    await montar(<Pantalla listo={false} />);
    await act(async () => {
      await api.repetir();
    });
    await act(async () => {});
    expect(hay('recorrido-overlay')).toBe(false);
    await act(async () => {
      montada!.update(
        <SafeAreaProvider>
          <RecorridoProvider>
            <Pantalla listo />
          </RecorridoProvider>
        </SafeAreaProvider>,
      );
    });
    await asentar();
    expect(hay('recorrido-overlay')).toBe(true);
  });
});

describe('recorrido guiado: accesibilidad y diseño', () => {
  const abrir = async (rect: Rect) => {
    mockMedidas = { a: rect };
    await montar(<Pantalla listo orden={['a']} />);
    await act(async () => {});
  };

  it('atrapa el foco del lector de pantalla y oculta lo de abajo', async () => {
    await abrir(ARRIBA);
    expect(porId('recorrido-overlay')!.props.accessibilityViewIsModal).toBe(true);
    const ocultos = raiz().findAll(
      n => n.props.importantForAccessibility === 'no-hide-descendants',
    );
    expect(ocultos.length).toBeGreaterThan(0);
  });

  it('el título se anuncia como encabezado y todos los botones llevan texto', async () => {
    await abrir(ARRIBA);
    expect(raiz().findAll(n => n.props.accessibilityRole === 'header').length).toBeGreaterThan(0);
    expect(textoDe('recorrido-siguiente')).toBe('Entendido'); // un solo paso: es el último
    expect(raiz().findAll(n => n.props.accessibilityLabel === 'Saltar recorrido').length).toBeGreaterThan(0);
  });

  it('los textos del recorrido aceptan fuente grande, pero con tope', async () => {
    await abrir(ARRIBA);
    const tituloTexto = raiz().findAll(
      n => n.props.testID === 'recorrido-titulo' && typeof n.type === 'string',
    )[0];
    expect(tituloTexto.props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
    expect(tituloTexto.props.maxFontSizeMultiplier).toBeGreaterThan(1);
  });

  it('con lo señalado arriba, la tarjeta va debajo y no lo tapa', async () => {
    await abrir(ARRIBA);
    const tarjeta = StyleSheet.flatten(porId('recorrido-tarjeta')!.props.style);
    expect(tarjeta.top).toBeGreaterThanOrEqual(ARRIBA.y + ARRIBA.height);
    expect(tarjeta.bottom).toBeUndefined();
  });

  it('con lo señalado abajo (barra), la tarjeta va arriba y no lo tapa', async () => {
    await abrir(ABAJO);
    const tarjeta = StyleSheet.flatten(porId('recorrido-tarjeta')!.props.style);
    expect(tarjeta.top).toBeUndefined();
    // `bottom` es la distancia desde el borde inferior: el borde de la tarjeta queda sobre el hueco.
    const { height } = Dimensions.get('window');
    expect(height - tarjeta.bottom).toBeLessThanOrEqual(ABAJO.y);
  });

  it('deja un hueco sin velo sobre lo señalado y absorbe los toques de alrededor', async () => {
    await abrir(MEDIO);
    const marco = StyleSheet.flatten(porId('recorrido-marco')!.props.style);
    expect(marco.top).toBeLessThanOrEqual(MEDIO.y);
    expect(marco.left).toBeLessThanOrEqual(MEDIO.x);
    expect(marco.top! + marco.height!).toBeGreaterThanOrEqual(MEDIO.y + MEDIO.height);
    expect(porId('recorrido-overlay')!.props.onStartShouldSetResponder()).toBe(true);
  });

  it('tocar el velo fuera de la tarjeta no hace nada: solo los botones cierran o avanzan', async () => {
    await montar(<Pantalla listo />);
    await act(async () => {});
    const conToque = porId('recorrido-overlay')!.findAll(n => typeof n.props.onPress === 'function');
    const ids = conToque.map(n => n.props.testID).filter(Boolean);
    expect(new Set(ids)).toEqual(new Set(['recorrido-siguiente', 'recorrido-saltar']));
    // Ni el overlay ni los velos reaccionan al soltar el dedo: solo absorben el toque.
    const overlay = porId('recorrido-overlay')!;
    expect(overlay.props.onResponderRelease).toBeUndefined();
    expect(overlay.props.onPress).toBeUndefined();
    expect(hay('recorrido-overlay')).toBe(true);
    expect(textoDe('recorrido-contador')).toBe('Paso 1 de 3');
    expect(await recorridoVisto()).toBe(false);
  });

  it('lo señalado en la barra de abajo lleva un hueco más justo que el resto', async () => {
    const BARRA: Rect = { x: 200, y: 1250, width: 80, height: 70 };
    await abrir(BARRA);
    const barra = StyleSheet.flatten(porId('recorrido-marco')!.props.style);
    expect(BARRA.y - barra.top!).toBe(4);
    // A los lados no pasa de lo medido: no tapa las etiquetas vecinas de la barra.
    expect(barra.left).toBe(BARRA.x);
    expect(barra.left! + barra.width!).toBe(BARRA.x + BARRA.width);
    await act(async () => montada!.unmount());
    montada = null;
    await abrir(MEDIO);
    const medio = StyleSheet.flatten(porId('recorrido-marco')!.props.style);
    expect(MEDIO.y - medio.top!).toBe(8);
    expect(MEDIO.x - medio.left!).toBe(8);
  });

  it('el hueco nunca se sale de la ventana', async () => {
    const { width, height } = Dimensions.get('window');
    await abrir({ x: -30, y: -20, width: width + 80, height: height + 100 });
    const m = StyleSheet.flatten(porId('recorrido-marco')!.props.style);
    expect(m.left).toBe(0);
    expect(m.top).toBe(0);
    expect(m.left! + m.width!).toBeLessThanOrEqual(width);
    expect(m.top! + m.height!).toBeLessThanOrEqual(height);
  });

  it('nada avanza solo: sin botones tocados el paso no cambia', async () => {
    jest.useFakeTimers();
    try {
      await montar(<Pantalla listo />, false);
      // Con timers falsos el tiempo corre a mano: lo justo para que el recorrido cuente sus pasos.
      for (let i = 0; i < 20; i += 1) {
        await act(async () => {
          jest.advanceTimersByTime(100);
        });
      }
      expect(textoDe('recorrido-contador')).toBe('Paso 1 de 3');
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(textoDe('recorrido-contador')).toBe('Paso 1 de 3');
    } finally {
      jest.useRealTimers();
    }
  });
});
