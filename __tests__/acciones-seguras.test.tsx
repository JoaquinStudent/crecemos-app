/**
 * P0 #4 de la auditoría: un guardado que falla se dice, nunca se traga en silencio.
 * Y dos cambios seguidos del perfil se guardan los dos (sin closure viejo).
 */
import { createElement } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { guardarProducto, obtenerPerfil } from '@storage/repositorio';
import { desmontarApp, montarApp } from '../testutils/app';

const base = () => createAsyncStorage('crecemos');

describe('useAccionSegura', () => {
  const montarHook = async (accion: (...a: never[]) => Promise<unknown>, mensaje?: string) => {
    let hook!: ReturnType<typeof useAccionSegura>;
    const Sonda = () => {
      hook = useAccionSegura(accion as () => Promise<unknown>, mensaje);
      return null;
    };
    let r!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      r = ReactTestRenderer.create(createElement(Sonda));
    });
    return { actual: () => hook, desmontar: () => act(async () => r.unmount()) };
  };

  it('si la acción sale bien devuelve su resultado y no hay error', async () => {
    const { actual } = await montarHook(async () => 42);

    let resultado: unknown;
    await act(async () => {
      resultado = await actual().ejecutar();
    });

    expect(resultado).toBe(42);
    expect(actual().mensajeError).toBeNull();
    expect(actual().ejecutando).toBe(false);
  });

  it('si la promesa se rechaza no revienta: deja el mensaje en palabras claras', async () => {
    const { actual } = await montarHook(async () => {
      throw new Error('QuotaExceededError');
    });

    await act(async () => {
      await actual().ejecutar();
    });

    expect(actual().mensajeError).toBe('No pudimos guardar. Inténtalo otra vez.');
    expect(actual().mensajeError).not.toMatch(/Quota|Error/);
    expect(actual().ejecutando).toBe(false);
  });

  it('un nuevo intento limpia el error anterior', async () => {
    let falla = true;
    const { actual } = await montarHook(async () => {
      if (falla) throw new Error('x');
    });
    await act(async () => {
      await actual().ejecutar();
    });
    expect(actual().mensajeError).not.toBeNull();

    falla = false;
    await act(async () => {
      await actual().ejecutar();
    });
    expect(actual().mensajeError).toBeNull();
  });

  it('acepta un mensaje propio', async () => {
    const { actual } = await montarHook(() => Promise.reject(new Error('x')), 'No pudimos borrar.');
    await act(async () => {
      await actual().ejecutar();
    });
    expect(actual().mensajeError).toBe('No pudimos borrar.');
  });
});

describe('Guardados que fallan en pantalla', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await desmontarApp();
  });

  it('Cerrar mi día: si el guardado falla, lo dice y deja reintentar', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '10');
    const setItem = jest.spyOn(base(), 'setItem').mockRejectedValue(new Error('disco lleno'));

    await app.tocar('guardar-dia');

    expect(app.textos()).toContain('No pudimos guardar. Inténtalo otra vez.');

    setItem.mockRestore();
    await app.tocar('guardar-dia');
    expect(app.textos()).not.toContain('No pudimos guardar. Inténtalo otra vez.');
  });

  it('Perfil: un switch que no se pudo guardar muestra el aviso', async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-pagos');
    jest.spyOn(base(), 'setItem').mockRejectedValue(new Error('disco lleno'));

    await app.cambiarInterruptor('switch-acepta-yape', false);

    expect(app.textos()).toContain('No pudimos guardar. Inténtalo otra vez.');
  });

  it('Perfil: desactivar un producto que no se pudo guardar muestra el aviso', async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    jest.spyOn(base(), 'setItem').mockRejectedValue(new Error('disco lleno'));

    await app.tocar(`activo-producto-${PRODUCTOS_POR_DEFECTO[0].id}`);

    expect(app.textos()).toContain('No pudimos guardar. Inténtalo otra vez.');
  });
});

describe('guardarPerfil con dos cambios seguidos', () => {
  beforeEach(() => clearAllMockStorages());

  it('los dos cambios quedan guardados y en el estado', async () => {
    let contexto!: ReturnType<typeof useCrecemos>;
    const Sonda = () => {
      contexto = useCrecemos();
      return null;
    };
    let r!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      r = ReactTestRenderer.create(createElement(CrecemosProvider, null, createElement(Sonda)));
    });

    // Sin esperar entre uno y otro: el segundo parte del estado viejo si hay closure rancio.
    await act(async () => {
      const a = contexto.guardarPerfil({ aceptaYape: true });
      const b = contexto.guardarPerfil({ yapeAjeno: true });
      await Promise.all([a, b]);
    });

    expect(contexto.perfil).toMatchObject({ aceptaYape: true, yapeAjeno: true });
    expect(await obtenerPerfil()).toMatchObject({ aceptaYape: true, yapeAjeno: true });
    await act(async () => r.unmount());
  });
});
