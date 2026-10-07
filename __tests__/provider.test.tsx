/**
 * Pruebas de apoyo del Provider (no son escenarios del SPEC):
 * las acciones guardarPerfil y cambiarPrecioProducto.
 */

import { createElement } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { listarProductos, obtenerPerfil } from '@storage/repositorio';

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarProvider = async () => {
  let contexto!: ReturnType<typeof useCrecemos>;
  const Sonda = () => {
    contexto = useCrecemos();
    return null;
  };
  await act(async () => {
    montada = ReactTestRenderer.create(createElement(CrecemosProvider, null, createElement(Sonda)));
  });
  return () => contexto;
};

describe('CrecemosProvider: perfil y precios', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('sin perfil guardado ofrece el perfil por defecto, nunca null', async () => {
    const contexto = await montarProvider();

    expect(contexto().perfil).toEqual(PERFIL_POR_DEFECTO);
  });

  it('guardar el perfil mezcla con el actual, fecha el cambio y lo persiste', async () => {
    const contexto = await montarProvider();

    await act(async () => {
      await contexto().guardarPerfil({ nombre: 'Persona de prueba' });
    });
    await act(async () => {
      await contexto().guardarPerfil({ yapeAjeno: true });
    });

    expect(contexto().perfil.nombre).toBe('Persona de prueba');
    expect(contexto().perfil.yapeAjeno).toBe(true);
    expect(contexto().perfil.actualizadoEn).not.toBe('');
    expect(await obtenerPerfil()).toEqual(contexto().perfil);
  });

  it('cambiar el precio guarda el producto sin perder los demas ni su orden', async () => {
    const contexto = await montarProvider();

    let resultado;
    await act(async () => {
      resultado = await contexto().cambiarPrecioProducto('p-anticucho', 11, 8.2);
    });

    expect(resultado).toEqual({ ok: true });
    const ids = PRODUCTOS_POR_DEFECTO.map(p => p.id);
    expect(contexto().productos.map(p => p.id)).toEqual(ids);
    expect(contexto().productos.find(p => p.id === 'p-anticucho')?.precioVenta).toBe(11);
    const guardados = await listarProductos();
    expect(guardados.map(p => p.id)).toEqual(ids);
    expect(guardados.find(p => p.id === 'p-anticucho')?.precioVenta).toBe(11);
  });

  it('un precio invalido devuelve el error y no guarda nada', async () => {
    const contexto = await montarProvider();

    let resultado;
    await act(async () => {
      resultado = await contexto().cambiarPrecioProducto('p-anticucho', 0, 8.2);
    });

    expect(resultado).toEqual({
      ok: false,
      errores: { precioVenta: 'El precio tiene que ser mayor a cero' },
    });
    expect(contexto().productos.find(p => p.id === 'p-anticucho')?.precioVenta).toBe(10);
    expect(await listarProductos()).toEqual(PRODUCTOS_POR_DEFECTO);
  });
});
