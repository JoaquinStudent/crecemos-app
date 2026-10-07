/**
 * Pruebas de apoyo del repositorio (no son escenarios del SPEC).
 * Cubren los invariantes de obtenerPerfil, guardarPerfil y guardarProducto,
 * y el borrado de cierres con eliminarCierre.
 */

import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, Perfil } from '@dominio/tipos';
import {
  eliminarCierre,
  guardarCierre,
  guardarProducto,
  listarCierres,
  guardarPerfil,
  listarProductos,
  obtenerPerfil,
} from '@storage/repositorio';

const perfil: Perfil = {
  nombre: 'Persona de prueba',
  negocio: 'Negocio de prueba',
  aceptaYape: true,
  yapeAjeno: true,
  actualizadoEn: '2026-10-07T12:00:00.000Z',
};

describe('Repositorio: perfil y productos', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });

  it('guardar un producto con el almacenamiento vacio conserva los otros tres', async () => {
    const anticucho = PRODUCTOS_POR_DEFECTO.find(p => p.id === 'p-anticucho');
    if (!anticucho) throw new Error('Falta el anticucho por defecto');

    await guardarProducto({ ...anticucho, precioVenta: 11 });

    const productos = await listarProductos();
    expect(productos).toHaveLength(PRODUCTOS_POR_DEFECTO.length);
    expect(productos.map(p => p.id)).toEqual(PRODUCTOS_POR_DEFECTO.map(p => p.id));
    expect(productos.find(p => p.id === 'p-anticucho')?.precioVenta).toBe(11);
    // Los demás quedan intactos.
    for (const original of PRODUCTOS_POR_DEFECTO.filter(p => p.id !== 'p-anticucho')) {
      expect(productos).toContainEqual(original);
    }
  });

  it('guardar un producto reemplaza por id sin duplicar ni mover de lugar', async () => {
    const [primero, segundo] = PRODUCTOS_POR_DEFECTO;

    await guardarProducto({ ...segundo, precioVenta: 3 });
    await guardarProducto({ ...segundo, precioVenta: 4 });

    const productos = await listarProductos();
    expect(productos).toHaveLength(PRODUCTOS_POR_DEFECTO.length);
    expect(productos.filter(p => p.id === segundo.id)).toHaveLength(1);
    expect(productos[0]).toEqual(primero);
    expect(productos[1].id).toBe(segundo.id);
    expect(productos[1].precioVenta).toBe(4);
  });

  it('guardar un producto nuevo lo agrega al final', async () => {
    await guardarProducto({ ...PRODUCTOS_POR_DEFECTO[0], id: 'p-nuevo' });

    const productos = await listarProductos();
    expect(productos).toHaveLength(PRODUCTOS_POR_DEFECTO.length + 1);
    expect(productos[productos.length - 1].id).toBe('p-nuevo');
  });

  it('guardar el perfil y leerlo devuelve el mismo perfil', async () => {
    await guardarPerfil(perfil);

    expect(await obtenerPerfil()).toEqual(perfil);
  });

  it('guardar el perfil reemplaza al anterior', async () => {
    await guardarPerfil(perfil);
    await guardarPerfil({ ...perfil, yapeAjeno: false });

    expect((await obtenerPerfil())?.yapeAjeno).toBe(false);
  });

  it('obtener el perfil sin nada guardado devuelve null', async () => {
    expect(await obtenerPerfil()).toBeNull();
  });
});

const cierreDe = (fecha: string): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [],
  montoYape: 0,
  yapePendiente: false,
  gastos: [{ categoria: 'gas', monto: 5 }],
  abreCiclo: false,
  creadoEn: '2026-10-07T12:00:00.000Z',
  actualizadoEn: '2026-10-07T12:00:00.000Z',
});

describe('Repositorio: eliminar cierres', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });

  it('borra el cierre con ese id y deja el resto', async () => {
    await guardarCierre(cierreDe('2026-10-04'));
    await guardarCierre(cierreDe('2026-10-05'));
    await guardarCierre(cierreDe('2026-10-06'));

    await eliminarCierre('c-2026-10-05');

    const cierres = await listarCierres();
    expect(cierres.map(c => c.id).sort()).toEqual(['c-2026-10-04', 'c-2026-10-06']);
  });

  it('un id que no existe no hace nada ni falla', async () => {
    await guardarCierre(cierreDe('2026-10-04'));

    await expect(eliminarCierre('no-existe')).resolves.toBeUndefined();

    expect((await listarCierres()).map(c => c.id)).toEqual(['c-2026-10-04']);
  });

  it('borrar con el almacenamiento vacio no falla', async () => {
    await expect(eliminarCierre('lo-que-sea')).resolves.toBeUndefined();
    expect(await listarCierres()).toEqual([]);
  });

  it('borrar el unico cierre deja la lista vacia', async () => {
    await guardarCierre(cierreDe('2026-10-04'));

    await eliminarCierre('c-2026-10-04');

    expect(await listarCierres()).toEqual([]);
  });
});
