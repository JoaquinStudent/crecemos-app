/**
 * Mientras se leen los datos del teléfono, las pantallas muestran marcadores de carga (Skeleton)
 * en vez de quedar en blanco.
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TemaProvider } from '@components/organisms/TemaProvider';
import { InicioScreen } from '@screens/InicioScreen';
import { HistorialScreen } from '@screens/HistorialScreen';
import { ResumenScreen } from '@screens/ResumenScreen';
import { QueMeDejaScreen } from '@screens/QueMeDejaScreen';
import { MiReporteScreen } from '@screens/MiReporteScreen';

jest.mock('@context/CrecemosProvider', () => ({
  useCrecemos: () => ({
    cierres: [],
    productos: [],
    perfil: jest.requireActual('@dominio/perfil').PERFIL_POR_DEFECTO,
    cargando: true,
    error: false,
    semilla: 'ninguna',
    datosDeEjemplo: { dias: 0, productos: 0 },
    cargarDatosDeEjemplo: jest.fn(),
    marcarCobrado: jest.fn(),
  }),
}));

const Pila = createNativeStackNavigator();

const montar = async (Pantalla: React.ComponentType) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(
      <SafeAreaProvider>
        <TemaProvider>
          <NavigationContainer>
            <Pila.Navigator screenOptions={{ headerShown: false }}>
              <Pila.Screen name="Pantalla" component={Pantalla} />
            </Pila.Navigator>
          </NavigationContainer>
        </TemaProvider>
      </SafeAreaProvider>,
    );
  });
  return r;
};

const hayCargando = (r: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  r.root.findAll(n => n.props.testID === testID).length > 0 &&
  r.root.findAll(n => n.props.accessibilityLabel === 'Cargando').length > 0;

describe('Marcadores de carga', () => {
  it.each([
    ['Inicio', InicioScreen, 'inicio-cargando'],
    ['Historial', HistorialScreen, 'historial-cargando'],
    ['Resumen', ResumenScreen, 'resumen-cargando'],
    ['Qué me deja cada uno', QueMeDejaScreen, 'queme-cargando'],
    ['Mi reporte', MiReporteScreen, 'reporte-cargando'],
  ])('%s muestra marcadores de carga y no una pantalla en blanco', async (_nombre, Pantalla, id) => {
    const r = await montar(Pantalla);
    expect(hayCargando(r, id)).toBe(true);
    await act(async () => r.unmount());
  });

  it('el estado vacío de Inicio no aparece mientras carga', async () => {
    const r = await montar(InicioScreen);
    expect(r.root.findAll(n => n.props.testID === 'inicio-cerrar-dia').length).toBe(0);
    await act(async () => r.unmount());
  });
});

