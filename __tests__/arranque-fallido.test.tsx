/**
 * P0 #2 de la auditoría: si el almacenamiento falla o está corrupto al abrir, la app no se
 * queda en blanco: respalda lo corrupto, muestra "No pudimos abrir tus datos" y deja reintentar.
 */
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { listarCierres, listarProductos, obtenerPerfil } from '@storage/repositorio';
import { desmontarApp, montarApp } from '../testutils/app';

const base = () => createAsyncStorage('crecemos');

describe('JSON corrupto en el repositorio', () => {
  beforeEach(() => clearAllMockStorages());

  it('respalda el valor crudo y devuelve vacío en vez de lanzar', async () => {
    await base().setItem('@crecemos/cierres', '{esto no es json');

    await expect(listarCierres()).resolves.toEqual([]);
    expect(await base().getItem('@crecemos/respaldo-cierres')).toBe('{esto no es json');
  });

  it('un perfil corrupto se respalda y queda como "nunca guardado"', async () => {
    await base().setItem('@crecemos/perfil', '[[');

    await expect(obtenerPerfil()).resolves.toBeNull();
    expect(await base().getItem('@crecemos/respaldo-perfil')).toBe('[[');
  });

  it('productos corruptos se respaldan y no rompen la lectura', async () => {
    await base().setItem('@crecemos/productos', 'nope');

    await expect(listarProductos()).resolves.toEqual([]);
    expect(await base().getItem('@crecemos/respaldo-productos')).toBe('nope');
  });
});

describe('La app cuando el almacenamiento falla al abrir', () => {
  beforeEach(() => clearAllMockStorages());
  afterEach(async () => {
    jest.restoreAllMocks();
    await desmontarApp();
  });

  it('muestra "No pudimos abrir tus datos" con un botón Reintentar', async () => {
    jest.spyOn(base(), 'getItem').mockRejectedValue(new Error('disco lleno'));

    const { textos, existe } = await montarApp();

    expect(existe('error-de-carga')).toBe(true);
    expect(textos()).toContain('No pudimos abrir tus datos');
    expect(textos()).toContain('Reintentar');
  });

  it('Reintentar vuelve a leer y, si ahora anda, abre la app', async () => {
    const getItem = jest.spyOn(base(), 'getItem').mockRejectedValueOnce(new Error('falla única'));

    const { tocar, existe } = await montarApp();
    expect(existe('error-de-carga')).toBe(true);

    getItem.mockRestore();
    await tocar('reintentar-carga');

    expect(existe('error-de-carga')).toBe(false);
    expect(existe('tab-inicio')).toBe(true);
  });
});
