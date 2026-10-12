/**
 * "Anotar un yape" de punta a punta: la hoja de Inicio, el Provider, el relleno al cerrar el día,
 * el consumo de los apuntes y que nunca se cuente dos veces. La app real, por testID.
 */
import { createElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { YapeAnotado } from '@dominio/yape';
import { guardarProducto, guardarYapes, listarCierres, listarYapes } from '@storage/repositorio';
import { desmontarApp, montarApp } from '../testutils/app';

const base = () => createAsyncStorage('crecemos');
const HOY = () => fechaLocal(new Date());
const AYER = () => restarDias(HOY(), 1);

const yape = (id: string, fecha: string, hora: string, monto: number): YapeAnotado => ({
  id,
  fecha,
  hora,
  monto,
});

beforeEach(async () => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  clearAllMockStorages();
  await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  await desmontarApp();
});

describe('Anotar un yape: la hoja de Inicio', () => {
  it('se abre desde un botón con texto, muestra la hora de ahora y guarda el yape', async () => {
    const app = await montarApp();
    expect(app.textos()).toContain('Anotar un yape');
    await app.tocar('inicio-accion-anotar-yape');

    expect(app.textoDe('yape-hora')).toMatch(/^Ahora · \d{1,2}:\d{2} (a|p)\. m\.$/);
    expect(app.textoDe('yape-total')).toBe('Hoy llevas S/ 0.00 en Yape');
    expect(app.existe('yape-vacio')).toBe(true);

    await app.escribir('yape-monto', '12.5');
    await app.tocar('yape-guardar');

    expect(app.textoDe('yape-fila-0-monto')).toBe('S/ 12.50');
    expect(app.textoDe('yape-total')).toBe('Hoy llevas S/ 12.50 en Yape');
    expect(app.valorDe('yape-monto')).toBe(''); // listo para anotar otro
    const guardados = await listarYapes();
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).toMatchObject({ fecha: HOY(), monto: 12.5 });
    expect(guardados[0].hora).toMatch(/^\d{2}:\d{2}$/);
  });

  it('suma varios y "Quitar" saca uno; solo muestra los de hoy', async () => {
    await guardarYapes([yape('v', AYER(), '20:00', 99)]);
    const app = await montarApp();
    await app.tocar('inicio-accion-anotar-yape');
    expect(app.existe('yape-fila-0')).toBe(false);

    await app.escribir('yape-monto', '10');
    await app.tocar('yape-guardar');
    await app.escribir('yape-monto', '5.5');
    await app.tocar('yape-guardar');
    expect(app.textoDe('yape-total')).toBe('Hoy llevas S/ 15.50 en Yape');

    await app.tocar('yape-quitar-0');

    expect(app.textoDe('yape-total')).toBe('Hoy llevas S/ 5.50 en Yape');
    const quedan = await listarYapes();
    expect(quedan.map(y => y.monto).sort()).toEqual([5.5, 99]);
  });

  it('un monto vacío o en cero lo dice y no guarda', async () => {
    const app = await montarApp();
    await app.tocar('inicio-accion-anotar-yape');

    await app.tocar('yape-guardar');

    expect(app.textos()).toContain('Escribe cuánto fue el yape');
    expect(await listarYapes()).toEqual([]);
  });

  it('si el guardado falla lo dice y el yape no aparece', async () => {
    const app = await montarApp();
    await app.tocar('inicio-accion-anotar-yape');
    await app.escribir('yape-monto', '8');
    jest.spyOn(base(), 'setItem').mockRejectedValue(new Error('disco lleno'));

    await app.tocar('yape-guardar');

    expect(app.textoDe('yape-error-guardar')).toBe('No pudimos guardar. Inténtalo otra vez.');
    expect(app.existe('yape-fila-0')).toBe(false);
  });

  it('"Cerrar" cierra la hoja', async () => {
    const app = await montarApp();
    await app.tocar('inicio-accion-anotar-yape');
    await app.tocar('yape-cerrar');

    expect(app.existe('yape-guardar')).toBe(false);
  });

  it('lo guardado dañado se ignora y la app abre', async () => {
    await base().setItem('@crecemos/yapes', '{no es json');
    const app = await montarApp();
    await app.tocar('inicio-accion-anotar-yape');

    expect(app.textoDe('yape-total')).toBe('Hoy llevas S/ 0.00 en Yape');
  });

  it('si no se pueden leer los yapes, la app abre igual', async () => {
    const original = base().getItem.bind(base());
    jest.spyOn(base(), 'getItem').mockImplementation(async (clave: string) => {
      if (clave === '@crecemos/yapes') throw new Error('no se pudo leer');
      return original(clave);
    });
    const app = await montarApp();

    expect(app.existe('inicio-saludo')).toBe(true);
  });
});

describe('Anotar un yape: al cerrar el día', () => {
  it('con yapes anotados de hoy, rellena el Yape con su suma y lo dice', async () => {
    await guardarYapes([yape('1', HOY(), '10:15', 12), yape('2', HOY(), '11:00', 8.5)]);
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');

    expect(app.valorDe('monto-yape')).toBe('20.5');
    expect(app.textos()).toContain('Sumamos tus 2 yapes anotados · S/ 20.50');
  });

  it('sin yapes anotados no hay nota y el campo queda vacío', async () => {
    await guardarYapes([yape('v', AYER(), '10:15', 12)]);
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');

    expect(app.valorDe('monto-yape')).toBe('');
    expect(app.existe('cerrar-yapes-nota')).toBe(false);
    expect(app.existe('cerrar-yapes-pendientes')).toBe(false);
  });

  it('guardar el día consume los yapes de esa fecha (los de otro día quedan)', async () => {
    await guardarYapes([
      yape('1', HOY(), '10:15', 12),
      yape('2', HOY(), '11:00', 8.5),
      yape('v', AYER(), '20:00', 30),
    ]);
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');

    await app.tocar('guardar-dia');

    const [cierre] = await listarCierres();
    expect(cierre.montoYape).toBe(20.5);
    expect((await listarYapes()).map(y => y.id)).toEqual(['v']);
  });

  it('se puede cambiar el monto antes de guardar y igual se consumen', async () => {
    await guardarYapes([yape('1', HOY(), '10:15', 12)]);
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    await app.escribir('monto-yape', '9');

    await app.tocar('guardar-dia');

    expect((await listarCierres())[0].montoYape).toBe(9);
    expect(await listarYapes()).toEqual([]);
  });

  it('si el guardado del día falla, los yapes siguen anotados', async () => {
    await guardarYapes([yape('1', HOY(), '10:15', 12)]);
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    const espia = jest.spyOn(base(), 'setItem').mockRejectedValue(new Error('disco lleno'));

    await app.tocar('guardar-dia');
    espia.mockRestore();

    expect(app.textos()).toContain('No pudimos guardar. Inténtalo otra vez.');
    expect((await listarYapes()).map(y => y.id)).toEqual(['1']);
  });

  it('un día ya cerrado NO suma en silencio: lo ofrece y solo suma al tocarlo, una vez', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    await app.escribir('monto-yape', '20.5');
    await app.tocar('guardar-dia');
    await app.tocar('cierre-listo');

    // Después de cerrar entra otro Yape.
    await app.tocar('inicio-accion-anotar-yape');
    await app.escribir('yape-monto', '7');
    await app.tocar('yape-guardar');
    await app.tocar('yape-cerrar');

    await app.tocar('tab-cerrar-dia');
    expect(app.valorDe('monto-yape')).toBe('20.5');
    expect(app.existe('cerrar-yapes-nota')).toBe(false);
    expect(app.textos()).toContain('Tienes 1 yape anotado · S/ 7.00');

    // Guardar sin tocar nada: el monto no cambia y el apunte sigue ahí.
    await app.tocar('guardar-dia');
    expect((await listarCierres())[0].montoYape).toBe(20.5);
    expect(await listarYapes()).toHaveLength(1);
  });

  it('al tocar "Sumar mis yapes anotados" se agregan una sola vez y se consumen', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    await app.escribir('monto-yape', '20.5');
    await app.tocar('guardar-dia');
    await app.tocar('cierre-listo');
    await app.tocar('inicio-accion-anotar-yape');
    await app.escribir('yape-monto', '7');
    await app.tocar('yape-guardar');
    await app.tocar('yape-cerrar');

    await app.tocar('tab-cerrar-dia');
    await app.tocar('cerrar-sumar-yapes');
    expect(app.valorDe('monto-yape')).toBe('27.5');
    expect(app.textos()).toContain('Sumamos tu yape anotado · S/ 7.00');
    expect(app.existe('cerrar-sumar-yapes')).toBe(false); // no se puede tocar dos veces

    await app.tocar('guardar-dia');

    expect((await listarCierres())[0].montoYape).toBe(27.5);
    expect(await listarYapes()).toEqual([]);
  });
});

describe('Anotar un yape: acciones del Provider', () => {
  it('dos apuntes seguidos se guardan los dos y uno fallido no deja rastro', async () => {
    let contexto!: ReturnType<typeof useCrecemos>;
    const Sonda = () => {
      contexto = useCrecemos();
      return null;
    };
    let r!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      r = ReactTestRenderer.create(createElement(CrecemosProvider, null, createElement(Sonda)));
    });

    await act(async () => {
      await Promise.all([contexto.anotarYape(3), contexto.anotarYape(4)]);
    });
    expect(contexto.yapes.map(y => y.monto)).toEqual([3, 4]);

    const espia = jest.spyOn(base(), 'setItem').mockRejectedValue(new Error('disco lleno'));
    await act(async () => {
      await expect(contexto.anotarYape(9)).rejects.toThrow();
    });
    espia.mockRestore();
    expect(contexto.yapes).toHaveLength(2);

    await act(async () => {
      await contexto.quitarYape(contexto.yapes[0].id);
    });
    expect((await listarYapes()).map(y => y.monto)).toEqual([4]);
    await act(async () => r.unmount());
  });
});
