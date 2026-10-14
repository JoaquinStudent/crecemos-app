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

const FILAS = [
  ['perfil-opcion-datos', 'Mis datos', 'perfil-datos'],
  ['perfil-opcion-pagos', 'Cómo me pagan', 'perfil-pagos'],
  ['perfil-opcion-recordatorio', 'Recordatorio diario', 'perfil-recordatorio'],
  ['perfil-opcion-productos', 'Mis productos', 'perfil-productos'],
  ['perfil-opcion-borrar', 'Borrar datos', 'perfil-borrar'],
  ['perfil-opcion-ayuda', 'Ayuda', 'perfil-ayuda'],
] as const;

describe('Perfil: menú de opciones', () => {
  it('muestra las seis opciones en orden, cada una como un botón con "<título>. <resumen>"', async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');

    expect(app.enOrden(FILAS.map(f => f[0] + '-titulo'))).toEqual(FILAS.map(f => f[0] + '-titulo'));
    for (const [id, titulo] of FILAS) {
      expect(app.textoDe(`${id}-titulo`)).toBe(titulo);
      const props = app.propsDe(id);
      expect(props.accessibilityRole).toBe('button');
      expect(props.accessibilityLabel).toBe(`${titulo}. ${app.textoDe(`${id}-resumen`)}`);
    }
  });

  it('los resúmenes salen de los datos reales', async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    expect(app.textoDe('perfil-opcion-datos-resumen')).toBe('Completa tus datos');
    expect(app.textoDe('perfil-opcion-pagos-resumen')).toBe('Yape activado · sin número');
    expect(app.textoDe('perfil-opcion-recordatorio-resumen')).toBe('Apagado');
    expect(app.textoDe('perfil-opcion-productos-resumen')).toBe('Sin productos activos');
    expect(app.textoDe('perfil-opcion-borrar-resumen')).toBe('No hay datos de ejemplo');
    expect(app.textoDe('perfil-opcion-ayuda-resumen')).toBe('Ver el recorrido');
  });

  it('la pantalla principal no tiene formularios ni interruptores', async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');

    const nativos = (tipo: string) => app.buscar(n => (n.type as unknown) === tipo);
    expect(nativos('TextInput')).toHaveLength(0);
    expect(nativos('RCTSwitch').length + nativos('Switch').length).toBe(0);
    expect(app.buscar(n => n.props.accessibilityRole === 'switch')).toHaveLength(0);
    expect(app.existe('switch-acepta-yape')).toBe(false);
    expect(app.existe('guardar-datos')).toBe(false);
    expect(app.existe('agregar-producto')).toBe(false);
  });

  it.each(FILAS)('«%s» abre su pantalla y "Atrás" vuelve al Perfil', async (fila, titulo, pantalla) => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');

    await app.tocar(fila);
    expect(app.existe(`${pantalla}-scroll`)).toBe(true);
    expect(app.textoDe(`${pantalla}-titulo`)).toBe(titulo);

    await app.tocar('seccion-atras');
    expect(app.existe(`${pantalla}-scroll`)).toBe(false);
    expect(app.existe('perfil-menu')).toBe(true);
  });
});

describe('Cómo me pagan: el resumen sigue al interruptor', () => {
  it('Yape activado / Solo efectivo', async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-pagos');
    await app.cambiarInterruptor('switch-acepta-yape', false);
    await app.tocar('seccion-atras');
    expect(app.textoDe('perfil-opcion-pagos-resumen')).toBe('Solo efectivo');
  });
});

describe('Ayuda', () => {
  it('explica en palabras simples qué hace la app y ofrece el recorrido', async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-ayuda');
    expect(app.textos()).toContain('¿Qué hace Crecemos?');
    expect(app.existe('ver-recorrido')).toBe(true);
  });
});
