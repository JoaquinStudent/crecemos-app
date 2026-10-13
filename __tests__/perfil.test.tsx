/**
 * Pruebas de apoyo de la pantalla Perfil y de la hoja "Cambiar precio"
 * (no son escenarios del SPEC; el recorrido completo es spec02_e9).
 * La app real, por testID, como lo haría una persona.
 */

import { createElement } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { spacing } from '@theme';
import App from '../App';
import { crearTecladoSimulado } from '../testutils/teclado';
import { fechaLocal } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarProducto, listarProductos, obtenerPerfil } from '@storage/repositorio';

// Texto de un nodo, incluido el de los Text anidados ("Te deja S/ 1.80" va dentro de su línea).
const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  montada = app;

  const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
  const nodo = (testID: string, prop: 'onPress' | 'onChangeText' | 'onValueChange') =>
    app.root.findAll(n => n.props.testID === testID && typeof n.props[prop] === 'function')[0];
  const tocar = (testID: string) =>
    act(async () => {
      await nodo(testID, 'onPress').props.onPress();
    });
  const escribir = (testID: string, texto: string) =>
    act(async () => {
      nodo(testID, 'onChangeText').props.onChangeText(texto);
    });
  const cambiarInterruptor = (testID: string, valor: boolean) =>
    act(async () => {
      await nodo(testID, 'onValueChange').props.onValueChange(valor);
    });
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const textos = () => app.root.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  const textoDe = (testID: string) =>
    textoCompleto(app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0]);
  const interruptor = (testID: string) =>
    app.root.findAll(n => n.props.testID === testID && 'value' in n.props)[0];

  const estiloDeVista = (testID: string) =>
    StyleSheet.flatten(app.root.findAll(n => typeof n.type === 'string' && n.props.testID === testID)[0].props.style);
  const etiquetaDe = (testID: string): unknown =>
    app.root.findAll(n => typeof n.type === 'string' && n.props.testID === testID)[0].props.accessibilityLabel;

  const buscar = (predicado: (n: ReactTestInstance) => boolean) => app.root.findAll(predicado);
  const valorDe = (testID: string): string =>
    app.root.findAll(n => esHost(n, 'TextInput') && n.props.testID === testID)[0].props.value;

  return {
    tocar,
    escribir,
    cambiarInterruptor,
    existe,
    textos,
    textoDe,
    interruptor,
    estiloDeVista,
    etiquetaDe,
    buscar,
    valorDe,
  };
};

const haceDias = (dias: number) => fechaLocal(new Date(Date.now() - dias * 24 * 60 * 60 * 1000));

describe('Perfil y hoja "Cambiar precio"', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    for (const producto of PRODUCTOS_POR_DEFECTO) await guardarProducto(producto);
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('sin nombre muestra "Agrega tu nombre" y un ícono de persona "Sin foto", no un "?"', async () => {
    const { tocar, textos, existe } = await montarApp();

    expect(existe('inicio-avatar-iniciales-sin-foto')).toBe(true);
    expect(existe('inicio-avatar-iniciales')).toBe(false);
    await tocar('abrir-perfil');

    expect(textos()).toContain('Agrega tu nombre');
    expect(textos()).not.toContain('?');
    expect(existe('perfil-iniciales-sin-foto')).toBe(true);
  });

  it('el ícono "Sin foto" se anuncia y la tarjeta del recordatorio tiene aire arriba y abajo', async () => {
    const { tocar, etiquetaDe, estiloDeVista } = await montarApp();
    expect(etiquetaDe('inicio-avatar-iniciales-sin-foto')).toBe('Sin foto');
    await tocar('abrir-perfil');
    expect(etiquetaDe('perfil-iniciales-sin-foto')).toBe('Sin foto');
    await tocar('perfil-opcion-recordatorio');
    expect(estiloDeVista('recordatorio-tarjeta').paddingVertical).toBe(12);
  });

  it('"Mis datos" abre un formulario: guardar actualiza el Perfil y las iniciales en Inicio', async () => {
    const { tocar, escribir, textoDe, existe, valorDe } = await montarApp();
    await tocar('abrir-perfil');

    await tocar('perfil-opcion-datos');
    expect(existe('guardar-datos')).toBe(true);
    expect(valorDe('input-nombre')).toBe('');
    await escribir('input-nombre', 'persona de prueba');
    await escribir('input-negocio', 'Negocio de prueba');
    await escribir('input-ubicacion', 'Mercado central');
    await tocar('guardar-datos');

    // Guardar vuelve al Perfil, que ya muestra los datos nuevos.
    expect(existe('guardar-datos')).toBe(false);
    expect(textoDe('perfil-nombre')).toBe('persona de prueba');
    expect(textoDe('perfil-iniciales')).toBe('P');
    expect(textoDe('perfil-opcion-datos-resumen')).toBe('persona de prueba · Negocio de prueba');
    const guardado = await obtenerPerfil();
    expect(guardado).toMatchObject({
      nombre: 'persona de prueba',
      negocio: 'Negocio de prueba',
      ubicacion: 'Mercado central',
    });

    await tocar('perfil-atras');
    expect(textoDe('inicio-avatar-iniciales')).toBe('P');
  });

  it('"Mis datos" parte de lo guardado y "Cancelar" vuelve sin guardar nada', async () => {
    const { tocar, escribir, existe, valorDe } = await montarApp();
    await tocar('abrir-perfil');

    await tocar('perfil-opcion-datos');
    await escribir('input-negocio', 'Negocio de prueba');
    await tocar('cancelar-datos');

    expect(existe('input-negocio')).toBe(false);
    expect(await obtenerPerfil()).toBeNull();
    await tocar('perfil-opcion-datos');
    expect(valorDe('input-negocio')).toBe('');
  });

  it('"Atrás" de una sección vuelve al Perfil, y desde ahí a Inicio', async () => {
    const { tocar, existe } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-pagos');
    expect(existe('switch-acepta-yape')).toBe(true);

    await tocar('seccion-atras');
    expect(existe('switch-acepta-yape')).toBe(false);
    expect(existe('perfil-menu')).toBe(true);
    await tocar('perfil-atras');
    expect(existe('perfil-menu')).toBe(false);
  });

  it('avisa el precio viejo (más de 90 días) y no el reciente', async () => {
    // Las cuatro fechas explícitas: el resultado no depende de qué día se corra la prueba.
    const [anticucho, ...otros] = PRODUCTOS_POR_DEFECTO;
    await guardarProducto({ ...anticucho, actualizadoEn: haceDias(100) });
    for (const p of otros) await guardarProducto({ ...p, actualizadoEn: haceDias(5) });

    const { tocar, existe, textos } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-productos');

    expect(existe('aviso-precio-p-anticucho')).toBe(true);
    expect(textos().some(t => t.startsWith('No cambias este precio desde hace 3 meses'))).toBe(
      true,
    );
    expect(existe('aviso-precio-p-pancita')).toBe(false);
    expect(existe('aviso-precio-p-rachi')).toBe(false);
    expect(existe('aviso-precio-p-chicha')).toBe(false);
  });

  it('cada producto muestra lo que cuesta y lo que deja, en soles y sin porcentaje', async () => {
    const { tocar, textos } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-productos');

    // Anticucho: S/ 10.00 − S/ 8.20 = S/ 1.80 por porción.
    expect(textos()).toContain('Costo S/ 8.20 · Te deja S/ 1.80 por porción');
    expect(textos().some(t => t.includes('%'))).toBe(false);
    // La explicación va una sola vez, arriba de la lista, no repetida en cada producto.
    expect(textos().filter(t => /precio de venta menos tu costo/i.test(t))).toHaveLength(1);
    expect(textos().some(t => t.includes('Precio de venta menos costo estimado por unidad'))).toBe(false);
    expect(textos()).toContain('Precio actualizado el 15 de julio');
  });

  it('un precio de cero muestra el error al pie del campo y no guarda', async () => {
    const { tocar, escribir, existe, textos } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-productos');

    await tocar('cambiar-precio-p-anticucho');
    await escribir('precio-input', '0');
    await tocar('guardar-precio');

    expect(textos()).toContain('El precio tiene que ser mayor a cero');
    expect(existe('guardar-precio')).toBe(true); // la hoja sigue abierta
    const anticucho = (await listarProductos()).find(p => p.id === 'p-anticucho');
    expect(anticucho?.precioVenta).toBe(10);
    expect(anticucho?.actualizadoEn).toBe('2026-07-15');
  });

  it('la hoja trae los valores actuales, el aviso y el resultado en vivo', async () => {
    const { tocar, escribir, textos, existe } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-productos');
    await tocar('cambiar-precio-p-anticucho');

    expect(textos()).toContain('Precio actual: S/ 10.00 desde el 15 de julio');
    expect(textos()).toContain(
      'Esto vale desde hoy. Los días que ya registraste se quedan con el precio que tenían, para que tu historial no cambie.',
    );
    expect(textos()).toContain('S/ 1.80 por porción');

    await escribir('precio-input', '10.60');
    await escribir('costo-input', '8.20');
    expect(textos()).toContain('S/ 2.40 por porción');
    expect(textos()).toContain('+ S/ 0.60 que antes');

    await tocar('cancelar-precio');
    expect(existe('guardar-precio')).toBe(false);
    expect((await listarProductos()).find(p => p.id === 'p-anticucho')?.precioVenta).toBe(10);
  });

  it('guardar un precio nuevo cierra la hoja y la tarjeta muestra el precio y la fecha de hoy', async () => {
    const { tocar, escribir, existe, textos } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-productos');
    await tocar('cambiar-precio-p-anticucho');
    await escribir('precio-input', '11');

    await tocar('guardar-precio');

    expect(existe('guardar-precio')).toBe(false);
    expect(textos()).toContain('S/ 11.00');
    expect(textos()).toContain('Costo S/ 8.20 · Te deja S/ 2.80 por porción');
    const anticucho = (await listarProductos()).find(p => p.id === 'p-anticucho');
    expect(anticucho?.precioVenta).toBe(11);
    expect(anticucho?.actualizadoEn).toBe(fechaLocal(new Date()));
  });

  it('el interruptor "El Yape no está a mi nombre" persiste', async () => {
    const { tocar, cambiarInterruptor, interruptor } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-pagos');
    expect(interruptor('switch-yape-ajeno').props.value).toBe(false);

    await cambiarInterruptor('switch-yape-ajeno', true);

    expect(interruptor('switch-yape-ajeno').props.value).toBe(true);
    expect((await obtenerPerfil())?.yapeAjeno).toBe(true);
  });

  it('el interruptor del Yape ajeno comparte borde izquierdo con "Acepto Yape" (sin sangría anidada)', async () => {
    const { tocar, interruptor } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-pagos');
    const sangria = (testID: string) => {
      let total = 0;
      for (let n = interruptor(testID).parent; n; n = n.parent) {
        if (typeof n.type !== 'string') continue;
        const e = StyleSheet.flatten(n.props.style) ?? {};
        if (e.borderWidth === 1) break; // llegó a la tarjeta
        total += Number(e.paddingLeft ?? e.paddingHorizontal ?? 0) + Number(e.marginLeft ?? e.marginHorizontal ?? 0);
      }
      return total;
    };
    expect(sangria('switch-yape-ajeno')).toBe(sangria('switch-acepta-yape'));
  });

  it('las acciones del producto van compactas: filas separadas por spacing.sm, botones de 48 y sin márgenes sueltos', async () => {
    const { tocar, estiloDeVista } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-productos');
    const id = PRODUCTOS_POR_DEFECTO[0].id;
    const acciones = estiloDeVista(`acciones-producto-${id}`);
    expect(acciones.gap).toBe(spacing.sm);
    expect(acciones.margin ?? acciones.marginTop ?? acciones.marginBottom ?? acciones.paddingBottom ?? 0).toBe(0);
    const tarjeta = StyleSheet.flatten(
      montada!.root.findAll(n => n.props.testID === `producto-${id}`)[0].props.style,
    );
    expect(tarjeta.padding).toBe(spacing.md);
    for (const b of ['editar-producto', 'activo-producto']) {
      const e = StyleSheet.flatten(
        montada!.root.findAll(n => n.props.testID === `${b}-${id}` && typeof n.type !== 'string')[0].props.style,
      ) as { flex?: number; minHeight?: number };
      expect(e.flex).toBe(1);
      expect(e.minHeight).toBe(48);
    }
  });

  it('sin "Acepto Yape" el otro interruptor se desactiva', async () => {
    const { tocar, cambiarInterruptor, interruptor } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-pagos');
    expect(interruptor('switch-yape-ajeno').props.disabled).toBeFalsy();

    await cambiarInterruptor('switch-acepta-yape', false);

    expect((await obtenerPerfil())?.aceptaYape).toBe(false);
    expect(interruptor('switch-yape-ajeno').props.disabled).toBe(true);
  });

  it('pide el número de Yape en los dos casos, solo con 9 dígitos', async () => {
    const { tocar, escribir, existe, textoDe } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-pagos');

    await tocar('editar-yapeNumero');
    await escribir('input-yapeNumero', '98-76 x');
    await tocar('guardar-yapeNumero');
    expect(existe('input-yapeNumero')).toBe(true);
    expect(await obtenerPerfil()).toBeNull();

    await escribir('input-yapeNumero', '987654321');
    await tocar('guardar-yapeNumero');
    expect(textoDe('valor-yapeNumero')).toBe('987654321');
    expect((await obtenerPerfil())?.yapeNumero).toBe('987654321');
  });

  it('con el Yape ajeno pide de quién es y qué es para él; sin ajeno no los muestra', async () => {
    const { tocar, escribir, cambiarInterruptor, existe, textoDe } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-pagos');
    expect(existe('editar-yapeTitular')).toBe(false);
    expect(existe('editar-yapeParentesco')).toBe(false);

    await cambiarInterruptor('switch-yape-ajeno', true);
    await tocar('editar-yapeTitular');
    await escribir('input-yapeTitular', 'persona de prueba');
    await tocar('guardar-yapeTitular');
    await tocar('editar-yapeParentesco');
    await escribir('input-yapeParentesco', 'hermana');
    await tocar('guardar-yapeParentesco');

    expect(textoDe('valor-yapeTitular')).toBe('persona de prueba');
    expect(textoDe('valor-yapeParentesco')).toBe('hermana');
    const perfil = await obtenerPerfil();
    expect(perfil?.yapeTitular).toBe('persona de prueba');
    expect(perfil?.yapeParentesco).toBe('hermana');
  });

  it('sin "Acepto Yape" no pide ningún dato de Yape', async () => {
    const { tocar, cambiarInterruptor, existe } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-pagos');
    expect(existe('editar-yapeNumero')).toBe(true);

    await cambiarInterruptor('switch-acepta-yape', false);

    expect(existe('editar-yapeNumero')).toBe(false);
  });

  // P17: un Yape que no se acepta no puede estar "a nombre de otra persona", pero lo que ya
  // se escribió (número, de quién es, qué es para él) no se pierde.
  it('apagar "Acepto Yape" con "no está a mi nombre" encendido apaga ese interruptor y conserva los datos', async () => {
    const { tocar, escribir, cambiarInterruptor, interruptor } = await montarApp();
    await tocar('abrir-perfil');
    await tocar('perfil-opcion-pagos');
    await cambiarInterruptor('switch-yape-ajeno', true);
    await tocar('editar-yapeNumero');
    await escribir('input-yapeNumero', '987654321');
    await tocar('guardar-yapeNumero');
    await tocar('editar-yapeTitular');
    await escribir('input-yapeTitular', 'persona de prueba');
    await tocar('guardar-yapeTitular');
    await tocar('editar-yapeParentesco');
    await escribir('input-yapeParentesco', 'hermana');
    await tocar('guardar-yapeParentesco');
    expect(interruptor('switch-yape-ajeno').props.value).toBe(true);

    await cambiarInterruptor('switch-acepta-yape', false);

    expect(interruptor('switch-acepta-yape').props.value).toBe(false);
    expect(interruptor('switch-yape-ajeno').props.value).toBe(false);
    expect(interruptor('switch-yape-ajeno').props.disabled).toBe(true);
    const perfil = await obtenerPerfil();
    expect(perfil?.aceptaYape).toBe(false);
    expect(perfil?.yapeAjeno).toBe(false);
    expect(perfil?.yapeNumero).toBe('987654321');
    expect(perfil?.yapeTitular).toBe('persona de prueba');
    expect(perfil?.yapeParentesco).toBe('hermana');

    // Si vuelve a aceptar Yape, los datos siguen ahí y "no está a mi nombre" queda apagado.
    await cambiarInterruptor('switch-acepta-yape', true);
    const despues = await obtenerPerfil();
    expect(despues?.aceptaYape).toBe(true);
    expect(despues?.yapeAjeno).toBe(false);
    expect(despues?.yapeNumero).toBe('987654321');
    expect(despues?.yapeTitular).toBe('persona de prueba');
    expect(despues?.yapeParentesco).toBe('hermana');
  });

  // Jest no ve el teclado: con uno simulado se comprueba que el ScrollConTeclado suma su alto al
  // relleno (UN solo mecanismo: sin KeyboardAvoidingView, que contaría el teclado dos veces).
  // Que el campo quede sobre el teclado se comprueba a mano en el teléfono.
  it.each([
    ['perfil-opcion-datos', 'perfil-datos'],
    ['perfil-opcion-pagos', 'perfil-pagos'],
    ['perfil-opcion-recordatorio', 'perfil-recordatorio'],
  ])('guarda: la pantalla de %s se hace sitio sobre el teclado sin contarlo dos veces', async (fila, pantalla) => {
    const teclado = crearTecladoSimulado();
    const { tocar, buscar } = await montarApp();
    const propsDe = (id: string) =>
      buscar(n => n.props.testID === id && typeof n.type === 'string')[0].props;
    await tocar('abrir-perfil');
    await tocar(fila);

    expect(buscar(n => (n.type as unknown) === 'KeyboardAvoidingView' || n.type === KeyboardAvoidingView)).toHaveLength(0);
    const relleno = () =>
      StyleSheet.flatten(propsDe(`${pantalla}-scroll`).contentContainerStyle).paddingBottom;
    expect(propsDe(`${pantalla}-scroll`).keyboardShouldPersistTaps).toBe('handled');
    expect(relleno()).toBe(spacing.xxl);

    await teclado.abrir(312, 528);
    expect(relleno()).toBe(312 + spacing.lg);
    await teclado.cerrar();
    expect(relleno()).toBe(spacing.xxl);
    jest.restoreAllMocks();
  });
});
