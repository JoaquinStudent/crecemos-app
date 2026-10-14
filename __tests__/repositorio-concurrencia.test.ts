/**
 * Cola de escrituras y versión del esquema del repositorio.
 */
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, Producto } from '@dominio/tipos';
import {
  borrarMeta,
  guardarCierre,
  guardarMeta,
  guardarPerfil,
  guardarProducto,
  guardarYapes,
  listarCierres,
  listarProductos,
  marcarCobrado,
  migrarEsquema,
  obtenerPerfil,
  VERSION_ESQUEMA,
} from '@storage/repositorio';

const cierreDe = (fecha: string): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [],
  montoYape: 10,
  yapePendiente: true,
  gastos: [],
  abreCiclo: false,
  creadoEn: '2026-10-07T12:00:00.000Z',
  actualizadoEn: '2026-10-07T12:00:00.000Z',
});

const dia = (n: number) => `2026-09-${String(n).padStart(2, '0')}`;
const crudo = () => createAsyncStorage('crecemos');

describe('Repositorio: cola de escrituras', () => {
  beforeEach(() => clearAllMockStorages());

  it('30 guardarCierre simultáneos no pierden ninguno', async () => {
    const dias = Array.from({ length: 28 }, (_, i) => dia(i + 1));
    await Promise.all(dias.map(f => guardarCierre(cierreDe(f))));
    expect((await listarCierres()).map(c => c.fecha).sort()).toEqual(dias);
  });

  it('guardarCierre y marcarCobrado a la vez conservan los dos efectos', async () => {
    await guardarCierre(cierreDe(dia(1)));
    await Promise.all([
      guardarCierre(cierreDe(dia(2))),
      marcarCobrado([`c-${dia(1)}`], dia(3)),
      guardarCierre(cierreDe(dia(4))),
    ]);
    const cierres = await listarCierres();
    expect(cierres).toHaveLength(3);
    expect(cierres.find(c => c.id === `c-${dia(1)}`)?.cobradoEn).toBe(dia(3));
  });

  it('guardarProducto simultáneos conservan todos los productos', async () => {
    const nuevos: Producto[] = Array.from({ length: 10 }, (_, i) => ({
      ...PRODUCTOS_POR_DEFECTO[0],
      id: `p-nuevo-${i}`,
      nombre: `Nuevo ${i}`,
    }));
    await Promise.all(nuevos.map(p => guardarProducto(p)));
    const ids = (await listarProductos()).map(p => p.id);
    for (const p of nuevos) expect(ids).toContain(p.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('mezcla de perfil, meta, yapes y cierres en paralelo no se pisa', async () => {
    await Promise.all([
      guardarPerfil({
        nombre: 'A',
        negocio: 'B',
        aceptaYape: true,
        yapeAjeno: false,
        actualizadoEn: '2026-10-07T12:00:00.000Z',
      }),
      guardarYapes([{ id: 'y1', fecha: dia(1), hora: '10:00', monto: 5 }]),
      borrarMeta(),
      guardarCierre(cierreDe(dia(1))),
      guardarCierre(cierreDe(dia(2))),
    ]);
    expect((await obtenerPerfil())?.nombre).toBe('A');
    expect(await listarCierres()).toHaveLength(2);
  });

  it('un fallo de escritura no bloquea la cola y quien llamó recibe su error', async () => {
    const espia = jest.spyOn(crudo(), 'setItem');
    espia.mockRejectedValueOnce(new Error('disco lleno'));
    const [mal, bien] = await Promise.allSettled([
      guardarCierre(cierreDe(dia(1))),
      guardarCierre(cierreDe(dia(2))),
    ]);
    espia.mockRestore();
    expect(mal.status).toBe('rejected');
    expect(bien.status).toBe('fulfilled');
    expect((await listarCierres()).map(c => c.fecha)).toEqual([dia(2)]);
  });

  it('guardarMeta aguanta escrituras en ráfaga', async () => {
    await Promise.all(
      [1, 2, 3, 4, 5].map(n =>
        guardarMeta({ cuotaMensual: n * 100, creadaEn: '2026-10-01T00:00:00.000Z' } as never),
      ),
    );
    expect(JSON.parse((await crudo().getItem('@crecemos/meta')) as string).cuotaMensual).toBe(500);
  });
});

describe('Repositorio: versión del esquema', () => {
  beforeEach(() => clearAllMockStorages());

  it('sin versión guardada la sella en la actual', async () => {
    expect(await migrarEsquema()).toBe(VERSION_ESQUEMA);
    expect(await crudo().getItem('@crecemos/version')).toBe(String(VERSION_ESQUEMA));
  });

  it('es idempotente y no toca los datos', async () => {
    await guardarCierre(cierreDe(dia(1)));
    await migrarEsquema();
    await migrarEsquema();
    expect(await migrarEsquema()).toBe(VERSION_ESQUEMA);
    expect(await listarCierres()).toHaveLength(1);
  });

  it('una versión corrupta se trata como v0 y se vuelve a sellar', async () => {
    await crudo().setItem('@crecemos/version', '{no es json');
    expect(await migrarEsquema()).toBe(VERSION_ESQUEMA);
    expect(await crudo().getItem('@crecemos/version')).toBe(String(VERSION_ESQUEMA));
  });

  it('una versión de otro tipo se trata como v0', async () => {
    await crudo().setItem('@crecemos/version', '"uno"');
    expect(await migrarEsquema()).toBe(VERSION_ESQUEMA);
  });

  it('nunca lanza si el almacenamiento falla', async () => {
    const espia = jest.spyOn(crudo(), 'getItem');
    espia.mockRejectedValue(new Error('roto'));
    await expect(migrarEsquema()).resolves.toBe(0);
    espia.mockRestore();
    // y la cola sigue viva
    await expect(guardarCierre(cierreDe(dia(1)))).resolves.toBeUndefined();
  });
});
