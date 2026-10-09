/**
 * Pruebas de apoyo del repositorio (no son escenarios del SPEC).
 * Cubren los invariantes de obtenerPerfil, guardarPerfil y guardarProducto,
 * y el borrado de cierres con eliminarCierre.
 */

import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, Perfil, SemillaMaterializada } from '@dominio/tipos';
import {
  eliminarCierre,
  guardarCierre,
  guardarProducto,
  importarSemilla,
  listarCierres,
  guardarPerfil,
  listarProductos,
  marcarCobrado,
  marcarSemillaResuelta,
  obtenerPerfil,
  semillaCargada,
} from '@storage/repositorio';

const perfil: Perfil = {
  nombre: 'Persona de prueba',
  negocio: 'Negocio de prueba',
  aceptaYape: true,
  yapeAjeno: true,
  actualizadoEn: '2026-10-07T12:00:00.000Z',
};

describe('Repositorio: perfil y productos', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    for (const producto of PRODUCTOS_POR_DEFECTO) await guardarProducto(producto);
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

describe('Repositorio: marcar cobrado', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });

  const conYape = (fecha: string, monto: number, cobradoEn?: string): Cierre => ({
    ...cierreDe(fecha),
    montoYape: monto,
    yapePendiente: true,
    ...(cobradoEn ? { cobradoEn } : {}),
  });

  it('pone la fecha de cobro en los ids pedidos y deja el resto igual', async () => {
    await guardarCierre(conYape('2026-10-04', 50));
    await guardarCierre(conYape('2026-10-05', 46));
    await guardarCierre(cierreDe('2026-10-06'));

    await marcarCobrado(['c-2026-10-04', 'c-2026-10-05'], '2026-10-07');

    const cierres = await listarCierres();
    expect(cierres).toHaveLength(3);
    const por = (id: string) => cierres.find(c => c.id === id);
    expect(por('c-2026-10-04')?.cobradoEn).toBe('2026-10-07');
    expect(por('c-2026-10-05')?.cobradoEn).toBe('2026-10-07');
    expect(por('c-2026-10-06')?.cobradoEn).toBeUndefined();
  });

  it('un id que no existe no cambia nada ni falla', async () => {
    await guardarCierre(conYape('2026-10-04', 50));

    await expect(marcarCobrado(['no-existe'], '2026-10-07')).resolves.toBeUndefined();

    expect((await listarCierres())[0].cobradoEn).toBeUndefined();
  });

  it('con el almacenamiento vacio no falla ni escribe nada', async () => {
    await expect(marcarCobrado(['lo-que-sea'], '2026-10-07')).resolves.toBeUndefined();
    expect(await listarCierres()).toEqual([]);
  });

  it('no pisa la fecha de un cobro anterior', async () => {
    await guardarCierre(conYape('2026-10-04', 50, '2026-10-05'));

    await marcarCobrado(['c-2026-10-04'], '2026-10-07');

    expect((await listarCierres())[0].cobradoEn).toBe('2026-10-05');
  });
});

describe('Repositorio: semilla de ejemplo', () => {
  const AHORA = '2026-10-07T17:00:00.000Z';
  const crudo = (clave: string) => createAsyncStorage('crecemos').getItem(clave);

  const semilla = (): SemillaMaterializada => ({
    productos: PRODUCTOS_POR_DEFECTO.map(p => ({ ...p, precioVenta: p.precioVenta + 1 })),
    cierres: [cierreDe('2026-10-05'), cierreDe('2026-10-06')],
  });

  beforeEach(() => {
    clearAllMockStorages();
  });

  it('sin nada guardado la semilla no está cargada', async () => {
    expect(await semillaCargada()).toBe(false);
  });

  it('importar guarda productos y cierres completos y marca la semilla con la fecha', async () => {
    await importarSemilla(semilla(), AHORA);

    expect(await listarProductos()).toEqual(semilla().productos);
    expect((await listarCierres()).map(c => c.id).sort()).toEqual(['c-2026-10-05', 'c-2026-10-06']);
    expect(JSON.parse((await crudo('@crecemos/seed')) ?? 'null')).toEqual({ cargadoEn: AHORA });
    expect(await semillaCargada()).toBe(true);
  });

  it('importar no reemplaza cierres existentes', async () => {
    await guardarCierre(cierreDe('2026-09-01'));

    await importarSemilla(semilla(), AHORA);

    expect((await listarCierres()).map(c => c.fecha)).toEqual(['2026-09-01']);
  });

  it('marcar la semilla como resuelta escribe solo esa clave', async () => {
    await marcarSemillaResuelta(AHORA);

    expect(await semillaCargada()).toBe(true);
    expect(JSON.parse((await crudo('@crecemos/seed')) ?? 'null')).toEqual({ cargadoEn: AHORA });
    expect(await crudo('@crecemos/productos')).toBeNull();
    expect(await crudo('@crecemos/cierres')).toBeNull();
  });
});
