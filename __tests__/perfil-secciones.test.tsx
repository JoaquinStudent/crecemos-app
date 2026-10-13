/**
 * Las pantallas que se abren desde el menú del Perfil, una por una: su flujo principal con la app
 * real, por testID, como lo haría una persona.
 */
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarProducto, listarProductos } from '@storage/repositorio';
import { desmontarApp, montarApp } from '../testutils/app';

beforeEach(async () => {
  clearAllMockStorages();
});
afterEach(desmontarApp);

describe('Mis productos', () => {
  const abrir = async () => {
    for (const p of PRODUCTOS_POR_DEFECTO) await guardarProducto(p);
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-productos');
    return app;
  };

  it('el menú resume cuántos productos hay activos', async () => {
    for (const p of PRODUCTOS_POR_DEFECTO) await guardarProducto(p);
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    expect(app.textoDe('perfil-opcion-productos-resumen')).toBe(
      `${PRODUCTOS_POR_DEFECTO.length} productos activos`,
    );
  });

  it('lista los productos con "Agregar producto" arriba y la frase una sola vez', async () => {
    const app = await abrir();
    expect(app.existe('agregar-producto')).toBe(true);
    for (const p of PRODUCTOS_POR_DEFECTO) expect(app.existe(`producto-${p.id}`)).toBe(true);
    expect(app.textos().filter(t => /precio de venta menos tu costo/i.test(t))).toHaveLength(1);
    expect(app.enOrden(['agregar-producto', `producto-${PRODUCTOS_POR_DEFECTO[0].id}`])).toEqual([
      'agregar-producto',
      `producto-${PRODUCTOS_POR_DEFECTO[0].id}`,
    ]);
  });

  it('agregar abre el formulario, guarda y vuelve a la lista con el producto nuevo', async () => {
    const app = await abrir();
    await app.tocar('agregar-producto');
    expect(app.existe('formulario-producto')).toBe(true);
    expect(app.existe('agregar-producto')).toBe(false);

    await app.escribir('producto-nombre', 'Mazamorra');
    await app.escribir('producto-unidad', 'vaso');
    await app.escribir('producto-precio', '3');
    await app.escribir('producto-costo', '1,5');
    await app.tocar('guardar-producto');

    expect(app.existe('formulario-producto')).toBe(false);
    expect((await listarProductos()).some(p => p.nombre === 'Mazamorra' && p.costoUnitario === 1.5)).toBe(true);
    expect(app.textos()).toContain('Mazamorra');
  });

  it('un nombre vacío muestra el error bajo el campo y el formulario sigue abierto', async () => {
    const app = await abrir();
    await app.tocar('agregar-producto');
    await app.escribir('producto-precio', '3');
    await app.escribir('producto-costo', '1');
    await app.tocar('guardar-producto');

    expect(app.existe('formulario-producto')).toBe(true);
    expect(await listarProductos()).toHaveLength(PRODUCTOS_POR_DEFECTO.length);
  });

  it('editar trae los valores del producto y "Cancelar" vuelve sin cambiar nada', async () => {
    const app = await abrir();
    const id = PRODUCTOS_POR_DEFECTO[0].id;
    await app.tocar(`editar-producto-${id}`);
    expect(app.valorDe('producto-nombre')).toBe(PRODUCTOS_POR_DEFECTO[0].nombre);
    expect(app.textos()).toContain('Editar producto');
    await app.escribir('producto-nombre', 'Otro nombre');
    await app.tocar('cancelar-producto');

    expect(app.existe('formulario-producto')).toBe(false);
    expect((await listarProductos()).find(p => p.id === id)?.nombre).toBe(PRODUCTOS_POR_DEFECTO[0].nombre);
  });

  it('desactivar y reactivar cambian el producto y el resumen del menú', async () => {
    const app = await abrir();
    const id = PRODUCTOS_POR_DEFECTO[0].id;
    await app.tocar(`activo-producto-${id}`);
    expect((await listarProductos()).find(p => p.id === id)?.activo).toBe(false);
    expect(app.textos()).toContain('Reactivar');

    await app.tocar('seccion-atras');
    expect(app.textoDe('perfil-opcion-productos-resumen')).toBe(
      `${PRODUCTOS_POR_DEFECTO.length - 1} productos activos`,
    );
  });

  it('sin productos explica qué hacer y ofrece cargar los de ejemplo', async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-productos');
    expect(app.textos()).toContain('Agrega lo que vendes para registrar tu día.');
    expect(app.existe('cargar-ejemplo-perfil')).toBe(true);
  });
});
