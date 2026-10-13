/**
 * Teclado en los formularios (Android 16, borde a borde: el teclado se dibuja ENCIMA):
 *  - Perfil > Mis productos > Agregar producto: el scroll suma el alto del teclado.
 *  - Cerrar mi día: el pie "Guardar mi día" sube con el teclado (KeyboardAvoidingView, como el
 *    Asistente) y la zona de scroll NO suma el teclado otra vez.
 * Teclado simulado: Jest no tiene pantalla; lo que se ve sobre el teclado se comprueba en el teléfono.
 */
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { spacing } from '@theme';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarProducto } from '@storage/repositorio';
import { desmontarApp, montarApp } from '../testutils/app';
import { crearTecladoSimulado } from '../testutils/teclado';

beforeEach(async () => {
  clearAllMockStorages();
  await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
});
afterEach(async () => {
  await desmontarApp();
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
});

const kavDe = (app: Awaited<ReturnType<typeof montarApp>>) =>
  app.buscar(n => (n.type as unknown) === KeyboardAvoidingView)[0];
/** La vista nativa del KeyboardAvoidingView: la que recibe onLayout y dibuja el relleno. */
const vistaDeKav = (app: Awaited<ReturnType<typeof montarApp>>) =>
  kavDe(app).findAll(n => typeof n.type === 'string' && typeof n.props.onLayout === 'function')[0];
const paddingBottomDe = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style)?.paddingBottom;

describe('Mis productos > Agregar producto', () => {
  it('el formulario vive en un ScrollConTeclado: con el teclado abierto suma su alto', async () => {
    const teclado = crearTecladoSimulado();
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-productos');
    await app.tocar('agregar-producto');

    const relleno = () =>
      StyleSheet.flatten(app.propsDe('perfil-productos-scroll').contentContainerStyle).paddingBottom;
    expect(relleno()).toBe(spacing.xxl);
    await teclado.abrir(312, 528);
    expect(relleno()).toBe(312 + spacing.lg);
    await teclado.cerrar();
    expect(relleno()).toBe(spacing.xxl);
  });
});

describe.each(['android', 'ios'])('Cerrar mi día con el teclado (%s)', os => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  });

  it('el pie sube con el teclado y el scroll no lo cuenta dos veces', async () => {
    const teclado = crearTecladoSimulado();
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');

    const kav = kavDe(app);
    expect(kav.props.behavior).toBe('padding');
    expect(kav.props.keyboardVerticalOffset).toBe(0);
    // El KeyboardAvoidingView necesita saber su marco para calcular cuánto se solapa con el teclado.
    await act(async () => {
      vistaDeKav(app).props.onLayout({
        persist: () => undefined,
        nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 800 } },
      });
    });
    expect(paddingBottomDe(vistaDeKav(app)) ?? 0).toBe(0);

    await teclado.abrir(312, 528);
    // Teclado desde 528 en un marco de 800: el pie sube 272, justo lo que se solapa.
    expect(paddingBottomDe(vistaDeKav(app))).toBe(800 - 528);
    // La zona de scroll termina sobre el pie: no suma el teclado otra vez.
    const scroll = app.propsDe('cerrar-scroll');
    expect(scroll.keyboardShouldPersistTaps).toBe('handled');
    const contenido = StyleSheet.flatten(scroll.contentContainerStyle);
    expect(contenido.paddingBottom).toBeUndefined();
    expect(contenido.padding).toBe(spacing.lg);

    await teclado.cerrar();
    expect(paddingBottomDe(vistaDeKav(app)) ?? 0).toBe(0);
    // "Guardar mi día" sigue en el árbol, dentro del pie.
    expect(app.existe('guardar-dia')).toBe(true);
  });
});
