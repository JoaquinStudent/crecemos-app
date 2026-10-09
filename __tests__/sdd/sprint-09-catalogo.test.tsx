import { createElement } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre } from '@dominio/tipos';
import { guardarCierre, guardarProducto, listarCierres, listarProductos } from '@storage/repositorio';
import App from '../../App';

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montar = async () => {
  let actual!: ReturnType<typeof useCrecemos>;
  const Sonda = () => {
    actual = useCrecemos();
    return null;
  };
  await act(async () => {
    montada = ReactTestRenderer.create(createElement(CrecemosProvider, null, createElement(Sonda)));
  });
  return () => actual;
};
const legado: Cierre = {
  id: 'c-legado', fecha: '2026-10-06',
  lineas: [{ productoId: 'p-anticucho', nombre: 'Anticucho', preparadas: 10, sobrantes: 2, precioUnitario: 10, costoUnitario: 8.2 }],
  montoYape: 0, yapePendiente: false, gastos: [], abreCiclo: false,
  creadoEn: '2026-10-06T12:00:00Z', actualizadoEn: '2026-10-06T12:00:00Z',
};

describe('SPEC-09 catálogo configurable', () => {
  beforeEach(() => clearAllMockStorages());
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('spec09_e1: instalación nueva inicia sin productos y no descarga semilla', async () => {
    const fetchAnterior = global.fetch;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    try {
      const contexto = await montar();
      expect(contexto().productos).toEqual([]);
      expect(await listarProductos()).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(contexto().cargando).toBe(false);
    } finally {
      global.fetch = fetchAnterior;
    }
  });

  it('spec09_e1 interfaz: Inicio ofrece demostración solo con catálogo y cierres vacíos', async () => {
    await act(async () => { montada = ReactTestRenderer.create(createElement(App)); });
    const hay = (id: string) => montada!.root.findAll(n => n.props.testID === id).length > 0;
    expect(hay('inicio-cargar-ejemplo')).toBe(true);
    expect(hay('inicio-semilla-mensaje')).toBe(true);
    const primera = montada;
    montada = null;
    await act(async () => primera?.unmount());

    await guardarProducto({ id: 'p-propio', nombre: 'Tamal', unidad: 'unidad', precioVenta: 5, costoUnitario: 2, actualizadoEn: '2026-10-09', activo: true });
    await act(async () => { montada = ReactTestRenderer.create(createElement(App)); });
    expect(hay('inicio-cargar-ejemplo')).toBe(false);
  });

  it('spec09_e2: instalación con cierre legado conserva cuatro productos e importes', async () => {
    await guardarCierre(legado);
    const contexto = await montar();
    expect(contexto().productos).toEqual(PRODUCTOS_POR_DEFECTO);
    expect(await listarCierres()).toEqual([legado]);
    expect((await listarProductos()).map(p => p.id)).toEqual(PRODUCTOS_POR_DEFECTO.map(p => p.id));
  });

  it('spec09_e3: crear producto da id estable y lo añade sin borrar otros', async () => {
    const contexto = await montar();
    let resultado: any;
    await act(async () => {
      resultado = await contexto().crearProducto({ nombre: 'Tamales', unidad: 'porcion', precioVenta: 5, costoUnitario: 2 });
    });
    expect(resultado.ok).toBe(true);
    expect(contexto().productos).toHaveLength(1);
    expect(contexto().productos[0]).toMatchObject({ nombre: 'Tamales', activo: true });
    expect(contexto().productos[0].id).toBeTruthy();
    expect(await listarProductos()).toEqual(contexto().productos);
  });

  it('spec09_e4: rechaza nombre vacío, duplicado sin tildes y costo inválido sin escritura parcial', async () => {
    const contexto = await montar();
    await act(async () => { await contexto().crearProducto({ nombre: 'Café', unidad: 'vaso', precioVenta: 4, costoUnitario: 1 }); });
    const antes = await listarProductos();
    let resultado: any;
    await act(async () => {
      resultado = await contexto().crearProducto({ nombre: 'CAFE', unidad: 'vaso', precioVenta: 0, costoUnitario: -1 });
    });
    expect(resultado).toMatchObject({ ok: false, errores: { nombre: expect.any(String), precioVenta: expect.any(String), costoUnitario: expect.any(String) } });
    expect(await listarProductos()).toEqual(antes);
    await act(async () => {
      resultado = await contexto().crearProducto({ nombre: '   ', unidad: 'vaso', precioVenta: 4, costoUnitario: 1 });
    });
    expect(resultado).toMatchObject({ ok: false, errores: { nombre: expect.any(String) } });
    expect(await listarProductos()).toEqual(antes);
  });

  it('spec09_e5: renombrar no altera datos originales de cierres', async () => {
    await guardarCierre(legado);
    const contexto = await montar();
    await act(async () => {
      await contexto().editarProducto('p-anticucho', { nombre: 'Plato especial', unidad: 'porcion', precioVenta: 12, costoUnitario: 9 });
    });
    expect(contexto().productos.find(p => p.id === 'p-anticucho')?.nombre).toBe('Plato especial');
    expect(await listarCierres()).toEqual([legado]);
  });

  it('spec09_e6: desactivar y reactivar mantiene historia y controla el cierre nuevo', async () => {
    await guardarCierre(legado);
    const contexto = await montar();
    await act(async () => { await contexto().establecerProductoActivo('p-anticucho', false); });
    expect(contexto().productos.find(p => p.id === 'p-anticucho')?.activo).toBe(false);
    expect((await listarCierres())[0]).toEqual(legado);
    await act(async () => { await contexto().establecerProductoActivo('p-anticucho', true); });
    expect(contexto().productos.find(p => p.id === 'p-anticucho')?.activo).toBe(true);
  });

  it('spec09_e10: la demostración no reemplaza un producto propio', async () => {
    const contexto = await montar();
    await act(async () => { await contexto().crearProducto({ nombre: 'Tamal', unidad: 'porcion', precioVenta: 5, costoUnitario: 2 }); });
    const antes = await listarProductos();
    const fetchAnterior = global.fetch;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    try {
      await act(async () => { await contexto().cargarDatosDeEjemplo(); });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(await listarProductos()).toEqual(antes);
    } finally {
      global.fetch = fetchAnterior;
    }
  });

  it('spec09_e3 e2e: crea producto en Perfil y lo registra en un cierre nuevo', async () => {
    await act(async () => { montada = ReactTestRenderer.create(createElement(App)); });
    const app = montada!;
    const nodo = (id: string, prop: string) => app.root.findAll(n => n.props.testID === id && typeof n.props[prop] === 'function')[0];
    const tocar = async (id: string) => { await act(async () => { await nodo(id, 'onPress').props.onPress(); }); };
    const escribir = async (id: string, valor: string) => { await act(async () => { nodo(id, 'onChangeText').props.onChangeText(valor); }); };
    await tocar('abrir-perfil');
    await tocar('agregar-producto');
    await escribir('producto-nombre', 'Pan con queso');
    await escribir('producto-unidad', 'sándwich');
    await escribir('producto-precio', '5');
    await escribir('producto-costo', '2');
    await tocar('guardar-producto');
    const producto = (await listarProductos())[0];
    expect(producto).toMatchObject({ nombre: 'Pan con queso', unidad: 'sándwich', precioVenta: 5, costoUnitario: 2 });
    await tocar('perfil-atras');
    await tocar('tab-cerrar-dia');
    expect(app.root.findAll(n => n.props.testID === `preparadas-${producto.id}`).length).toBeGreaterThan(0);
    await escribir(`preparadas-${producto.id}`, '4');
    await escribir(`sobrantes-${producto.id}`, '1');
    await tocar('guardar-dia');
    expect((await listarCierres())[0].lineas[0]).toMatchObject({ productoId: producto.id, nombre: 'Pan con queso', precioUnitario: 5, costoUnitario: 2 });
  });

  it('spec09_e4 interfaz: conserva la entrada decimal hasta guardar precio y costo', async () => {
    await act(async () => { montada = ReactTestRenderer.create(createElement(App)); });
    const app = montada!;
    const nodo = (id: string, prop: string) => app.root.findAll(n => n.props.testID === id && typeof n.props[prop] === 'function')[0];
    const tocar = async (id: string) => { await act(async () => { await nodo(id, 'onPress').props.onPress(); }); };
    const escribir = async (id: string, valor: string) => { await act(async () => { nodo(id, 'onChangeText').props.onChangeText(valor); }); };
    const valor = (id: string) => app.root.findAll(n => n.props.testID === id && typeof n.props.value === 'string')[0].props.value;
    await tocar('abrir-perfil');
    await tocar('agregar-producto');
    await escribir('producto-nombre', 'Café');
    await escribir('producto-precio', '0.');
    expect(valor('producto-precio')).toBe('0.');
    await escribir('producto-precio', '0.5');
    expect(valor('producto-precio')).toBe('0.5');
    await escribir('producto-costo', '0.');
    expect(valor('producto-costo')).toBe('0.');
    await escribir('producto-costo', '0.25');
    expect(valor('producto-costo')).toBe('0.25');
    await escribir('producto-precio', '10.50');
    expect(valor('producto-precio')).toBe('10.50');
    await tocar('guardar-producto');
    expect((await listarProductos())[0]).toMatchObject({ precioVenta: 10.5, costoUnitario: 0.25 });
  });
});
