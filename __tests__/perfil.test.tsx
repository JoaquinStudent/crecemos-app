/**
 * Pruebas de apoyo de la pantalla Perfil y de la hoja "Cambiar precio"
 * (no son escenarios del SPEC; el recorrido completo es spec02_e9).
 * La app real, por testID, como lo haría una persona.
 */

import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
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

  return { tocar, escribir, cambiarInterruptor, existe, textos, textoDe, interruptor };
};

const haceDias = (dias: number) => fechaLocal(new Date(Date.now() - dias * 24 * 60 * 60 * 1000));

describe('Perfil y hoja "Cambiar precio"', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('sin nombre muestra "Agrega tu nombre" y la inicial "?"', async () => {
    const { tocar, textos, textoDe } = await montarApp();

    expect(textoDe('inicio-avatar-iniciales')).toBe('?');
    await tocar('abrir-perfil');

    expect(textos()).toContain('Agrega tu nombre');
    expect(textos()).toContain('Mi perfil');
    expect(textoDe('perfil-iniciales')).toBe('?');
  });

  it('guardar el nombre actualiza las iniciales en Inicio', async () => {
    const { tocar, escribir, textoDe } = await montarApp();
    await tocar('abrir-perfil');

    await tocar('editar-nombre');
    await escribir('input-nombre', 'persona de prueba');
    await tocar('guardar-nombre');

    expect(textoDe('perfil-nombre')).toBe('persona de prueba');
    expect(textoDe('perfil-iniciales')).toBe('P');
    expect((await obtenerPerfil())?.nombre).toBe('persona de prueba');

    await tocar('perfil-atras');
    expect(textoDe('inicio-avatar-iniciales')).toBe('P');
  });

  it('cancelar la edición no guarda nada', async () => {
    const { tocar, escribir, existe, textos } = await montarApp();
    await tocar('abrir-perfil');

    await tocar('editar-negocio');
    await escribir('input-negocio', 'Negocio de prueba');
    await tocar('cancelar-negocio');

    expect(existe('input-negocio')).toBe(false);
    expect(textos()).toContain('Escribe el nombre de tu negocio');
    expect(await obtenerPerfil()).toBeNull();
  });

  it('avisa el precio viejo (más de 90 días) y no el reciente', async () => {
    // Las cuatro fechas explícitas: el resultado no depende de qué día se corra la prueba.
    const [anticucho, ...otros] = PRODUCTOS_POR_DEFECTO;
    await guardarProducto({ ...anticucho, actualizadoEn: haceDias(100) });
    for (const p of otros) await guardarProducto({ ...p, actualizadoEn: haceDias(5) });

    const { tocar, existe, textos } = await montarApp();
    await tocar('abrir-perfil');

    expect(existe('aviso-precio-p-anticucho')).toBe(true);
    expect(textos().some(t => t.startsWith('No cambias este precio desde hace 3 meses'))).toBe(
      true,
    );
    expect(existe('aviso-precio-p-pancita')).toBe(false);
    expect(existe('aviso-precio-p-rachi')).toBe(false);
    expect(existe('aviso-precio-p-chicha')).toBe(false);
  });

  it('cada producto muestra lo que cuesta y lo que deja, con el monto junto al porcentaje', async () => {
    const { tocar, textos } = await montarApp();
    await tocar('abrir-perfil');

    // Anticucho: S/ 10.00 − S/ 8.20 = S/ 1.80, el 18% del precio.
    expect(textos()).toContain('Te cuesta S/ 8.20 · Te deja S/ 1.80 · 18%');
    expect(textos()).toContain('Precio actualizado el 15 de julio');
  });

  it('un precio de cero muestra el error al pie del campo y no guarda', async () => {
    const { tocar, escribir, existe, textos } = await montarApp();
    await tocar('abrir-perfil');

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
    await tocar('cambiar-precio-p-anticucho');
    await escribir('precio-input', '11');

    await tocar('guardar-precio');

    expect(existe('guardar-precio')).toBe(false);
    expect(textos()).toContain('S/ 11.00');
    expect(textos()).toContain('Te cuesta S/ 8.20 · Te deja S/ 2.80 · 25%');
    const anticucho = (await listarProductos()).find(p => p.id === 'p-anticucho');
    expect(anticucho?.precioVenta).toBe(11);
    expect(anticucho?.actualizadoEn).toBe(fechaLocal(new Date()));
  });

  it('el interruptor "El Yape no está a mi nombre" persiste', async () => {
    const { tocar, cambiarInterruptor, interruptor } = await montarApp();
    await tocar('abrir-perfil');
    expect(interruptor('switch-yape-ajeno').props.value).toBe(false);

    await cambiarInterruptor('switch-yape-ajeno', true);

    expect(interruptor('switch-yape-ajeno').props.value).toBe(true);
    expect((await obtenerPerfil())?.yapeAjeno).toBe(true);
  });

  it('sin "Acepto Yape" el otro interruptor se desactiva', async () => {
    const { tocar, cambiarInterruptor, interruptor } = await montarApp();
    await tocar('abrir-perfil');
    expect(interruptor('switch-yape-ajeno').props.disabled).toBeFalsy();

    await cambiarInterruptor('switch-acepta-yape', false);

    expect((await obtenerPerfil())?.aceptaYape).toBe(false);
    expect(interruptor('switch-yape-ajeno').props.disabled).toBe(true);
  });
});
