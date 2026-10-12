/**
 * Fase 1b: la barra de navegación propia (Inicio · Historial · [Cerrar día] · Resumen · Asistente),
 * "Cerrar día" como modal con pantalla de éxito, y el Asistente como pestaña con pregunta precargada.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CrecemosProvider } from '@context/CrecemosProvider';
import { TemaProvider } from '@components/organisms/TemaProvider';
import { Tabs } from '@navigation/Tabs';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarProducto, listarCierres } from '@storage/repositorio';
import { desmontarApp, montarApp, textoCompleto } from '../testutils/app';
import { JEV_URL, SEED_URL } from '../src/config';

describe('BarraNavegacion', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
  });
  afterEach(desmontarApp);

  it('trae las 5 ranuras con su texto visible, y la central es "Cerrar día"', async () => {
    const app = await montarApp();
    const etiquetas: Record<string, string> = {
      'tab-inicio': 'Inicio',
      'tab-historial': 'Historial',
      'tab-cerrar-dia': 'Cerrar día',
      'tab-resumen': 'Resumen',
      'tab-asistente': 'Asistente',
    };
    for (const [testID, etiqueta] of Object.entries(etiquetas)) {
      expect(textoCompleto(app.botonDe(testID))).toBe(etiqueta);
    }
  });

  it('el orden en pantalla es Inicio, Historial, Cerrar día, Resumen, Asistente', async () => {
    const app = await montarApp();
    expect(
      app.enOrden(['tab-inicio', 'tab-historial', 'tab-cerrar-dia', 'tab-resumen', 'tab-asistente']),
    ).toEqual(['tab-inicio', 'tab-historial', 'tab-cerrar-dia', 'tab-resumen', 'tab-asistente']);
  });

  it('las pestañas son role tab con estado seleccionado y la central es un botón de 64 dp', async () => {
    const app = await montarApp();
    expect(app.botonDe('tab-inicio').props.accessibilityRole).toBe('tab');
    expect(app.pestanaActiva('tab-inicio')).toBe(true);
    expect(app.pestanaActiva('tab-asistente')).toBe(false);
    expect(app.botonDe('tab-cerrar-dia').props.accessibilityRole).toBe('button');

    const circulo = app
      .botonDe('tab-cerrar-dia')
      .findAll(n => (n.type as unknown) === 'View' && StyleSheet.flatten(n.props.style)?.width === 64);
    expect(circulo.length).toBeGreaterThan(0);
    const e = StyleSheet.flatten(circulo[0].props.style);
    expect(e.height).toBe(64);
    expect(e.borderRadius).toBe(32);
  });

  it('todas las etiquetas miden al menos 14 px', async () => {
    const app = await montarApp();
    for (const testID of ['tab-inicio', 'tab-historial', 'tab-resumen', 'tab-asistente']) {
      const texto = app
        .botonDe(testID)
        .findAll(n => (n.type as unknown) === 'Text')
        .map(n => StyleSheet.flatten(n.props.style).fontSize);
      expect(texto.every(t => t >= 14)).toBe(true);
    }
  });

  it('tocar Asistente abre el chat como pestaña: sin "Atrás" y sin botón flotante', async () => {
    const app = await montarApp();
    expect(app.existe('inicio-preguntar')).toBe(false);

    await app.tocar('tab-asistente');

    expect(app.pestanaActiva('tab-asistente')).toBe(true);
    expect(app.existe('preguntar-pantalla')).toBe(true);
    expect(app.existe('preguntar-atras')).toBe(false);
  });

  it('el botón central dice "Cerrar día" y, con hoy cerrado, "Hoy ✓"', async () => {
    const app = await montarApp();
    expect(app.textoDe('tab-cerrar-dia-etiqueta')).toBe('Cerrar día');

    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '10');
    await app.tocar('guardar-dia');
    await app.tocar('cierre-listo');

    expect(app.textoDe('tab-cerrar-dia-etiqueta')).toBe('Hoy ✓');
    // Con hoy cerrado abre el cierre de hoy para editarlo.
    await app.tocar('tab-cerrar-dia');
    expect(app.existe('cerrar-ya-cerraste')).toBe(true);
    expect(app.valorDe('preparadas-p-anticucho')).toBe('10');
  });
});

describe('Cerrar día como modal', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
  });
  afterEach(desmontarApp);

  it('tiene un "Atrás" visible que vuelve a las pestañas', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    expect(app.existe('guardar-dia')).toBe(true);
    expect(app.textos()).toContain('Atrás');

    await app.tocar('cerrar-atras');
    // El modal se desmonta: el formulario ya no existe.
    expect(app.existe('guardar-dia')).toBe(false);
  });

  it('al guardar muestra "Tu día quedó cuadrado" con el resultado y "Listo"; nada se cierra solo', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    await app.escribir('sobrantes-p-anticucho', '2');
    await app.escribir('monto-gasto', '30');
    await app.tocar('guardar-dia');

    expect(await listarCierres()).toHaveLength(1);
    expect(app.textos()).toContain('Tu día quedó cuadrado');
    expect(app.textos()).toContain('Te queda');
    // 18 anticuchos vendidos al precio del producto menos 30 de gasto.
    const venta = 18 * PRODUCTOS_POR_DEFECTO[0].precioVenta;
    expect(app.textoDe('cierre-exito-te-queda')).toContain(String(venta - 30));
    expect(app.textoDe('cierre-exito-resumen')).toMatch(/^Vendiste S\/ .* · Gastaste S\/ /);
    expect(textoCompleto(app.botonDe('cierre-listo'))).toBe('Listo');

    // Sigue ahí: nada desaparece solo (UX, regla 9).
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(app.existe('cierre-exito')).toBe(true);

    await app.tocar('cierre-listo');
    expect(app.existe('cierre-exito')).toBe(false);
  });

  it('el resultado de la tarjeta no se desborda: el texto cede y el monto no se parte', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    expect(app.estiloDe('cerrar-resultado-texto').flex).toBe(1);
    const monto = app.estiloTextoDe('cerrar-te-queda');
    expect(monto.flexShrink).toBe(0);
    expect(monto.maxWidth).toBe('55%');
  });
});

describe('Asistente: pregunta precargada por parámetro', () => {
  const Pila = createNativeStackNavigator();
  const fetchPorDefecto = global.fetch;
  let montada: ReactTestRenderer.ReactTestRenderer | null = null;

  const montarConPregunta = async (pregunta: string | undefined) => {
    await act(async () => {
      montada = ReactTestRenderer.create(
        <SafeAreaProvider>
          <TemaProvider>
            <CrecemosProvider>
              <NavigationContainer
                initialState={{
                  index: 0,
                  routes: [
                    {
                      name: 'Tabs',
                      state: {
                        index: 3,
                        routes: [
                          { name: 'Inicio' },
                          { name: 'Historial' },
                          { name: 'Resumen' },
                          { name: 'Asistente', params: pregunta ? { pregunta } : undefined },
                        ],
                      },
                    },
                  ],
                }}
              >
                <Pila.Navigator screenOptions={{ headerShown: false }}>
                  <Pila.Screen name="Tabs" component={Tabs} />
                </Pila.Navigator>
              </NavigationContainer>
            </CrecemosProvider>
          </TemaProvider>
        </SafeAreaProvider>,
      );
    });
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        await new Promise(resolver => setTimeout(resolver, 0));
      });
    }
    return montada!;
  };

  const ponerRed = () => {
    const f = jest.fn(async (url: string) => {
      if (url === SEED_URL || url !== JEV_URL) throw new TypeError('Network request failed');
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            intencion: 'ventaDelDia',
            producto: 'ninguno',
            dia: 'ayer',
            confianza: 0.95,
          }),
      } as unknown as Response;
    });
    global.fetch = f as unknown as typeof fetch;
    return f;
  };

  const burbujas = (r: ReactTestRenderer.ReactTestRenderer) =>
    r.root
      .findAll(n => /^chat-burbuja-[0-9]+$/.test(String(n.props.testID ?? '')) && typeof n.type === 'string')
      .map(textoCompleto);

  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const r = montada;
    montada = null;
    if (r) await act(async () => r.unmount());
    global.fetch = fetchPorDefecto;
  });

  it('con { pregunta } el chat la hace al abrirse, una sola vez', async () => {
    const f = ponerRed();
    const r = await montarConPregunta('¿Cuánto vendí ayer?');

    expect(burbujas(r)[0]).toContain('¿Cuánto vendí ayer?');
    const llamadas = f.mock.calls as unknown as Array<[string, { body?: string } | undefined]>;
    const interpretaciones = llamadas.filter(([url]) => url === JEV_URL);
    expect(interpretaciones.length).toBeGreaterThan(0);
    expect(
      interpretaciones.filter(([, init]) => String(init?.body).includes('"tipo":"interpretar"')),
    ).toHaveLength(1);
    // La pregunta aparece una sola vez en el hilo (el parámetro se consumió).
    expect(burbujas(r).filter(t => t.includes('¿Cuánto vendí ayer?'))).toHaveLength(1);
  });

  it('sin parámetro no se envía nada al abrir el chat', async () => {
    const f = ponerRed();
    const r = await montarConPregunta(undefined);

    expect(burbujas(r)).toEqual([]);
    expect(f.mock.calls.filter(([url]) => url === JEV_URL)).toHaveLength(0);
  });
});
