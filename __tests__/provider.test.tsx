/**
 * Pruebas de apoyo del Provider (no son escenarios del SPEC):
 * las acciones guardarPerfil, cambiarPrecioProducto, guardarDia y eliminarDia.
 */

import { createElement } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { fechaLocal } from '@dominio/fecha';
import { normalizarPerfil, PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { calcularCierre } from '@dominio/cierre';
import type { Cierre, DatosCierre, Perfil, SemillaJSON } from '@dominio/tipos';
import {
  guardarCierre,
  guardarProducto,
  listarCierres,
  listarProductos,
  obtenerPerfil,
  semillaCargada,
} from '@storage/repositorio';

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
  beforeEach(async () => {
    clearAllMockStorages();
    for (const producto of PRODUCTOS_POR_DEFECTO) await guardarProducto(producto);
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

  beforeEach(async () => {
    clearAllMockStorages();
    for (const producto of PRODUCTOS_POR_DEFECTO) await guardarProducto(producto);
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

// ---------------------------------------------------------------------------------------------
// Semilla de ejemplo, cobros y regla del Yape ajeno (Sprint-04)
// ---------------------------------------------------------------------------------------------

const SEMILLA: SemillaJSON = {
  version: 1,
  semilla: 'prueba',
  diaSemanaBase: 3,
  productos: [
    {
      id: 'p-anticucho',
      nombre: 'Anticucho',
      unidad: 'porcion',
      precioVenta: 10,
      costoUnitario: 8.2,
      actualizadoDiasAtras: 84,
    },
  ],
  cierres: [1, 2].map(diasAtras => ({
    diasAtras,
    lineas: [
      { productoId: 'p-anticucho', preparadas: 20, sobrantes: 2, precioUnitario: 10, costoUnitario: 8.2 },
    ],
    montoYape: 46,
    yapePendiente: true,
    gastos: [{ categoria: 'movilidad' as const, monto: 12 }],
    abreCiclo: diasAtras === 2,
  })),
};

const respuestaOk = (cuerpo: unknown) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(cuerpo) } as unknown as Response);

const fetchPorDefecto = global.fetch;
const ponerFetch = (f: unknown) => {
  global.fetch = f as typeof fetch;
  return f as jest.Mock;
};
// Un fetch que responde cuando la prueba lo decide.
const fetchControlado = () => {
  let responder!: (r: Response) => void;
  const fetchMock = ponerFetch(
    jest.fn(
      () =>
        new Promise<Response>(resolver => {
          responder = resolver;
        }),
    ),
  );
  return { fetchMock, responder: (r: Response) => responder(r) };
};

const crudo = (clave: string) => createAsyncStorage('crecemos').getItem(clave);
const dejarCorrer = () =>
  act(async () => {
    await new Promise(resolver => setTimeout(resolver, 0));
  });

const cierreConYape = (fecha: string, monto: number, cobradoEn?: string): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [],
  montoYape: monto,
  yapePendiente: true,
  ...(cobradoEn ? { cobradoEn } : {}),
  gastos: [],
  abreCiclo: false,
  creadoEn: '2026-10-07T12:00:00.000Z',
  actualizadoEn: '2026-10-07T12:00:00.000Z',
});

describe('CrecemosProvider: semilla de ejemplo', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    jest.useRealTimers();
    global.fetch = fetchPorDefecto;
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('con cierres guardados y sin marca no descarga nada y conserva los productos legados', async () => {
    await guardarCierre(cierreConYape('2026-10-06', 46));
    const fetchMock = ponerFetch(jest.fn());

    const contexto = await montarProvider();
    await dejarCorrer();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(contexto().cargando).toBe(false);
    expect(contexto().semilla).toBe('ninguna');
    expect(contexto().cierres).toHaveLength(1);
    expect(await semillaCargada()).toBe(false);
    expect(await listarProductos()).toEqual(PRODUCTOS_POR_DEFECTO);
  });

  it('la app queda lista de inmediato aunque la semilla no responda, y a los 8 s pasa a sinRed', async () => {
    jest.useFakeTimers();
    const fetchMock = ponerFetch(
      jest.fn(
        (_url: unknown, init?: { signal?: AbortSignal }) =>
          new Promise<Response>((_resolver, rechazar) => {
            init?.signal?.addEventListener('abort', () => rechazar(new Error('Aborted')));
          }),
      ),
    );

    const contexto = await montarProvider();
    const carga = contexto().cargarDatosDeEjemplo();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(contexto().cargando).toBe(false);
    expect(contexto().semilla).toBe('cargando');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(8000);
      await carga;
    });

    expect(contexto().semilla).toBe('sinRed');
    expect(contexto().cierres).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // un solo intento, sin reintentos
  });

  it('sin red queda en sinRed, con 0 cierres y sin guardar nada', async () => {
    const contexto = await montarProvider();
    await act(async () => { await contexto().cargarDatosDeEjemplo(); });
    await dejarCorrer();

    expect(contexto().cargando).toBe(false);
    expect(contexto().semilla).toBe('sinRed');
    expect(contexto().cierres).toEqual([]);
    expect(await semillaCargada()).toBe(false);
    expect(await listarProductos()).toEqual([]);
    expect(await crudo('@crecemos/cierres')).toBeNull();
  });

  it('un JSON sin cierres queda en invalida y no guarda nada', async () => {
    // JSON.stringify omite lo undefined: la respuesta llega sin el campo "cierres".
    ponerFetch(jest.fn(async () => respuestaOk({ ...SEMILLA, cierres: undefined })));

    const contexto = await montarProvider();
    await act(async () => { await contexto().cargarDatosDeEjemplo(); });
    await dejarCorrer();

    expect(contexto().semilla).toBe('invalida');
    expect(contexto().cierres).toEqual([]);
    expect(await semillaCargada()).toBe(false);
    expect(await listarProductos()).toEqual([]);
    expect(await crudo('@crecemos/cierres')).toBeNull();
  });

  it('cargarDatosDeEjemplo reintenta después de un fallo y deja los datos en lista', async () => {
    const contexto = await montarProvider();
    await dejarCorrer();
    await act(async () => { await contexto().cargarDatosDeEjemplo(); });
    expect(contexto().semilla).toBe('sinRed');
    const fetchMock = ponerFetch(jest.fn(async () => respuestaOk(SEMILLA)));

    await act(async () => {
      await contexto().cargarDatosDeEjemplo();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(contexto().semilla).toBe('lista');
    expect(contexto().cierres).toHaveLength(2);
    expect(contexto().productos).toHaveLength(1);
    expect(await listarCierres()).toHaveLength(2);
    expect(await listarProductos()).toEqual(contexto().productos);
    expect(await semillaCargada()).toBe(true);
    expect(contexto().cierres.every(c => /^\d{4}-\d{2}-\d{2}$/.test(c.fecha))).toBe(true);
  });

  it('cargarDatosDeEjemplo no hace nada si ya hay cierres', async () => {
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
    const contexto = await montarProvider();
    await dejarCorrer();
    await act(async () => {
      await contexto().guardarDia({
        fecha: '2026-10-06',
        lineas: [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 2 }],
        montoYape: 0,
        gastos: [],
      });
    });
    const fetchMock = ponerFetch(jest.fn(async () => respuestaOk(SEMILLA)));
    const antes = contexto().cierres;

    await act(async () => {
      await contexto().cargarDatosDeEjemplo();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(contexto().cierres).toEqual(antes);
    expect(await listarCierres()).toEqual(antes);
  });

  it('si el usuario crea un producto mientras la semilla se descarga, no se pisa', async () => {
    const { fetchMock, responder } = fetchControlado();
    const contexto = await montarProvider();
    contexto().cargarDatosDeEjemplo();
    await dejarCorrer();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(contexto().semilla).toBe('cargando');
    await act(async () => {
      await contexto().crearProducto({ nombre: 'Tamal', unidad: 'unidad', precioVenta: 5, costoUnitario: 2 });
    });

    responder(respuestaOk(SEMILLA));
    await dejarCorrer();

    expect(contexto().semilla).toBe('ninguna');
    expect(contexto().productos.map(p => p.nombre)).toEqual(['Tamal']);
    expect(await listarCierres()).toHaveLength(0);
    expect(await semillaCargada()).toBe(true);
  });

  it('un toque doble en cargar no hace dos descargas', async () => {
    const contexto = await montarProvider();
    await dejarCorrer();
    const { fetchMock, responder } = fetchControlado();

    let primera!: Promise<void>;
    let segunda!: Promise<void>;
    await act(async () => {
      primera = contexto().cargarDatosDeEjemplo();
      segunda = contexto().cargarDatosDeEjemplo();
      await new Promise(resolver => setTimeout(resolver, 0)); // las dos llegan hasta el fetch
      responder(respuestaOk(SEMILLA));
      await Promise.all([primera, segunda]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(contexto().cierres).toHaveLength(2);
  });

  it('si el Provider se desmonta antes de que responda, no falla ni avisa', async () => {
    const { responder } = fetchControlado();
    const errores = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const contexto = await montarProvider();
    contexto().cargarDatosDeEjemplo();
    await dejarCorrer();
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());

    responder(respuestaOk(SEMILLA));
    await new Promise(resolver => setTimeout(resolver, 0));
    await new Promise(resolver => setTimeout(resolver, 0));

    expect(errores).not.toHaveBeenCalled();
    errores.mockRestore();
  });
});

describe('CrecemosProvider: marcar cobrado', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('marca como cobrados solo los pendientes, con la fecha local de hoy, en el estado y en disco', async () => {
    await guardarCierre(cierreConYape('2026-10-03', 50));
    await guardarCierre(cierreConYape('2026-10-05', 46));
    await guardarCierre(cierreConYape('2026-10-04', 30, '2026-10-06'));
    const contexto = await montarProvider();
    await dejarCorrer();

    await act(async () => {
      await contexto().marcarCobrado();
    });

    const hoy = fechaLocal(new Date());
    const porFecha = (lista: Cierre[], fecha: string) => lista.find(c => c.fecha === fecha);
    const enDisco = await listarCierres();
    for (const lista of [contexto().cierres, enDisco]) {
      expect(porFecha(lista, '2026-10-03')?.cobradoEn).toBe(hoy);
      expect(porFecha(lista, '2026-10-05')?.cobradoEn).toBe(hoy);
      expect(porFecha(lista, '2026-10-04')?.cobradoEn).toBe('2026-10-06'); // el anterior no se pisa
    }
  });

  it('sin nada por cobrar no cambia nada', async () => {
    await guardarCierre(cierreConYape('2026-10-04', 30, '2026-10-06'));
    const contexto = await montarProvider();
    await dejarCorrer();
    const antes = contexto().cierres;

    await act(async () => {
      await contexto().marcarCobrado();
    });

    expect(contexto().cierres).toEqual(antes);
    expect(await listarCierres()).toEqual(antes);
  });
});

describe('Yape ajeno al apagar "Acepto Yape" (P17)', () => {
  const conYapeAjeno: Perfil = {
    ...PERFIL_POR_DEFECTO,
    nombre: 'Persona de prueba',
    aceptaYape: true,
    yapeAjeno: true,
    yapeNumero: '987654321',
    yapeTitular: 'Titular de prueba',
    yapeParentesco: 'hermana',
  };

  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('normalizarPerfil apaga yapeAjeno si no acepta Yape y conserva los datos del titular', () => {
    const resultado = normalizarPerfil({ ...conYapeAjeno, aceptaYape: false });

    expect(resultado).toEqual({ ...conYapeAjeno, aceptaYape: false, yapeAjeno: false });
    expect(resultado.yapeNumero).toBe('987654321');
    expect(resultado.yapeTitular).toBe('Titular de prueba');
    expect(resultado.yapeParentesco).toBe('hermana');
  });

  it('normalizarPerfil no toca un perfil que sí acepta Yape', () => {
    expect(normalizarPerfil(conYapeAjeno)).toEqual(conYapeAjeno);
    expect(normalizarPerfil({ ...conYapeAjeno, yapeAjeno: false })).toEqual({
      ...conYapeAjeno,
      yapeAjeno: false,
    });
  });

  it('normalizarPerfil no muta el perfil que recibe', () => {
    const original = { ...conYapeAjeno, aceptaYape: false };

    normalizarPerfil(original);

    expect(original.yapeAjeno).toBe(true);
  });

  it('guardarPerfil aplica la regla, la persiste y no toca los pendientes ya guardados', async () => {
    await guardarCierre(cierreConYape('2026-10-05', 46));
    const contexto = await montarProvider();
    await dejarCorrer();
    await act(async () => {
      await contexto().guardarPerfil(conYapeAjeno);
    });
    expect(contexto().perfil.yapeAjeno).toBe(true);

    await act(async () => {
      await contexto().guardarPerfil({ aceptaYape: false });
    });

    const perfil = contexto().perfil;
    expect(perfil.aceptaYape).toBe(false);
    expect(perfil.yapeAjeno).toBe(false);
    expect(perfil.yapeNumero).toBe('987654321');
    expect(perfil.yapeTitular).toBe('Titular de prueba');
    expect(perfil.yapeParentesco).toBe('hermana');
    expect(await obtenerPerfil()).toEqual(perfil);
    // El cobro que ya estaba pendiente sigue pendiente.
    expect(contexto().cierres[0].yapePendiente).toBe(true);
    expect((await listarCierres())[0].yapePendiente).toBe(true);
  });
});
