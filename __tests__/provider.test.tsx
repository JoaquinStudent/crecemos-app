/**
 * Pruebas de apoyo del Provider (no son escenarios del SPEC):
 * las acciones guardarPerfil, cambiarPrecioProducto, guardarDia y eliminarDia.
 */

import { createElement } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { calcularCierre } from '@dominio/cierre';
import type { DatosCierre } from '@dominio/tipos';
import { listarCierres, listarProductos, obtenerPerfil } from '@storage/repositorio';

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

describe('CrecemosProvider: guardar y eliminar dias', () => {
  const datos: DatosCierre = {
    fecha: '2026-10-06',
    lineas: [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 2 }],
    montoYape: 0,
    gastos: [{ categoria: 'mercaderia', monto: 100 }],
    abreCiclo: true,
  };

  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('guardar un dia nuevo lo agrega y lo persiste', async () => {
    const contexto = await montarProvider();

    let resultado;
    await act(async () => {
      resultado = await contexto().guardarDia(datos);
    });

    expect(resultado).toEqual({ ok: true });
    expect(contexto().cierres).toHaveLength(1);
    expect(await listarCierres()).toEqual(contexto().cierres);
  });

  it('guardar sobre una fecha existente conserva el id y los precios viejos', async () => {
    const contexto = await montarProvider();
    await act(async () => {
      await contexto().guardarDia(datos);
    });
    const primero = contexto().cierres[0];

    // El anticucho sube de precio; luego se edita el mismo dia.
    await act(async () => {
      await contexto().cambiarPrecioProducto('p-anticucho', 12, 9);
    });
    await act(async () => {
      await contexto().guardarDia({
        ...datos,
        lineas: [{ productoId: 'p-anticucho', preparadas: 25, sobrantes: 1 }],
      });
    });

    expect(contexto().cierres).toHaveLength(1);
    const editado = contexto().cierres[0];
    expect(editado.id).toBe(primero.id);
    expect(editado.creadoEn).toBe(primero.creadoEn);
    expect(editado.fecha).toBe('2026-10-06');
    expect(editado.lineas[0]).toMatchObject({ preparadas: 25, sobrantes: 1, precioUnitario: 10, costoUnitario: 8.2 });
    expect(calcularCierre(editado).venta).toBe(240);
    // Lo guardado coincide con el estado.
    expect(await listarCierres()).toEqual([editado]);
  });

  it('guardar un dia con fecha distinta usa los precios de hoy', async () => {
    const contexto = await montarProvider();
    await act(async () => {
      await contexto().guardarDia(datos);
    });
    await act(async () => {
      await contexto().cambiarPrecioProducto('p-anticucho', 12, 9);
    });
    await act(async () => {
      await contexto().guardarDia({ ...datos, fecha: '2026-10-07' });
    });

    expect(contexto().cierres).toHaveLength(2);
    const nuevo = contexto().cierres.find(c => c.fecha === '2026-10-07');
    expect(nuevo?.lineas[0].precioUnitario).toBe(12);
  });

  it('un cierre invalido devuelve los errores y no toca nada', async () => {
    const contexto = await montarProvider();

    let resultado;
    await act(async () => {
      resultado = await contexto().guardarDia({ ...datos, lineas: [], gastos: [] });
    });

    expect(resultado).toMatchObject({ ok: false });
    expect(contexto().cierres).toEqual([]);
    expect(await listarCierres()).toEqual([]);
  });

  it('eliminar un dia lo quita del estado y del almacenamiento y deja los demas', async () => {
    const contexto = await montarProvider();
    await act(async () => {
      await contexto().guardarDia(datos);
    });
    await act(async () => {
      await contexto().guardarDia({ ...datos, fecha: '2026-10-07' });
    });
    const aBorrar = contexto().cierres.find(c => c.fecha === '2026-10-06');
    if (!aBorrar) throw new Error('Falta el cierre del 6');

    await act(async () => {
      await contexto().eliminarDia(aBorrar.id);
    });

    expect(contexto().cierres.map(c => c.fecha)).toEqual(['2026-10-07']);
    expect((await listarCierres()).map(c => c.fecha)).toEqual(['2026-10-07']);
  });

  it('eliminar un id que no existe no cambia nada ni falla', async () => {
    const contexto = await montarProvider();
    await act(async () => {
      await contexto().guardarDia(datos);
    });

    await act(async () => {
      await contexto().eliminarDia('no-existe');
    });

    expect(contexto().cierres).toHaveLength(1);
    expect(await listarCierres()).toHaveLength(1);
  });
});
