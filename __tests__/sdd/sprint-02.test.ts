/**
 * Tests del Sprint-02. Generados desde sdd/spec/Sprint-02/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../../App';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { calcularCierre, nuevoCierre } from '@dominio/cierre';
import { fechaLocal } from '@dominio/fecha';
import { inicialesAvatar } from '@dominio/perfil';
import { cambiarPrecio, requiereRevision } from '@dominio/producto';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Producto } from '@dominio/tipos';
import { validarProducto } from '@dominio/validacion';
import { guardarCierre, listarCierres, listarProductos } from '@storage/repositorio';

const producto = (id: string): Producto => {
  const p = PRODUCTOS_POR_DEFECTO.find(x => x.id === id);
  if (!p) throw new Error(`Producto de prueba desconocido: ${id}`);
  return p;
};

// Mediodía del 2026-10-07 en Lima: solo alimenta el instante de creación; la fecha del cierre es explícita.
const ahora = new Date('2026-10-07T12:00:00-05:00');

// El Provider real con una sonda que expone su contexto, sin pasar por la interfaz.
// Se desmonta en afterEach: si una aserción falla, no queda vivo tras el test.
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
  // Siempre el contexto vigente: cada acción re-renderiza el Provider.
  return () => contexto;
};

// La app real, manejada por testID como lo haría una persona (e9). Copia mínima del
// montarApp de sprint-01.test.ts: los tests no se importan entre sí.
// Se desmonta en afterEach junto con `montada`.
const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  montada = app;

  const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
  const nodo = (testID: string, prop: 'onPress' | 'onChangeText') =>
    app.root.findAll(n => n.props.testID === testID && typeof n.props[prop] === 'function')[0];
  const tocar = (testID: string) =>
    act(async () => {
      await nodo(testID, 'onPress').props.onPress();
    });
  const escribir = (testID: string, texto: string) =>
    act(async () => {
      nodo(testID, 'onChangeText').props.onChangeText(texto);
    });
  const textos = () =>
    app.root.findAll(n => esHost(n, 'Text')).map(n => [n.props.children].flat().join(''));

  return { app, esHost, tocar, escribir, textos };
};

describe('SPEC-02: Perfil y productos con precio vigente', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  // @spec02_e1 — Cambiar el precio registra desde cuándo rige
  it('spec02_e1 cambiar el precio registra desde cuando rige', () => {
    // Given: el producto "Anticucho" a S/ 10.00, actualizado el 2026-07-15
    // When: se cambia su precio a S/ 11.00 el 2026-10-07
    // Then: el producto queda con precio de venta 11 y fecha de actualización 2026-10-07
    const original = producto('p-anticucho');
    const nuevo = cambiarPrecio(original, 11, 8.2, '2026-10-07');
    expect(nuevo.precioVenta).toBe(11);
    expect(nuevo.costoUnitario).toBe(8.2);
    expect(nuevo.actualizadoEn).toBe('2026-10-07');
    // No muta el producto recibido.
    expect(original.precioVenta).toBe(10);
    expect(original.actualizadoEn).toBe('2026-07-15');
    expect(nuevo).not.toBe(original);
  });

  // @spec02_e2 — El historial no cambia al subir un precio
  it('spec02_e2 el historial no cambia al subir un precio', () => {
    // Given: un cierre del 2026-10-05 con 18 anticuchos vendidos a S/ 10.00
    // When: el precio del anticucho se cambia a S/ 11.00
    // Then: la venta de ese cierre sigue siendo S/ 180.00
    const datos = {
      fecha: '2026-10-05',
      lineas: [{ productoId: 'p-anticucho', preparadas: 18, sobrantes: 0 }],
      montoYape: 0,
      gastos: [],
    };
    const cierre = nuevoCierre(datos, PRODUCTOS_POR_DEFECTO, null, ahora);
    expect(calcularCierre(cierre).venta).toBe(180);

    cambiarPrecio(producto('p-anticucho'), 11, 8.2, '2026-10-07');

    expect(calcularCierre(cierre).venta).toBe(180);
    expect(cierre.lineas[0].precioUnitario).toBe(10);
  });

  // @spec02_e3 — Los cierres nuevos usan el precio vigente
  it('spec02_e3 los cierres nuevos usan el precio vigente', () => {
    // Given: el anticucho cambió a S/ 11.00 el 2026-10-07
    // When: se crea un cierre ese día con 10 anticuchos vendidos
    // Then: la línea del cierre guarda precio unitario 11 y la venta es S/ 110.00
    const anticucho11 = cambiarPrecio(producto('p-anticucho'), 11, 8.2, '2026-10-07');
    const productos = PRODUCTOS_POR_DEFECTO.map(p => (p.id === anticucho11.id ? anticucho11 : p));
    const datos = {
      fecha: '2026-10-07',
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      montoYape: 0,
      gastos: [],
    };
    const cierre = nuevoCierre(datos, productos, null, ahora);
    expect(cierre.lineas[0].precioUnitario).toBe(11);
    expect(calcularCierre(cierre).venta).toBe(110);
  });

  // @spec02_e4 — Avisa un precio sin revisar
  it('spec02_e4 avisa un precio sin revisar', () => {
    // Given: el producto "Rachi" actualizado el 2026-03-02 y hoy 2026-10-07
    // When: se evalúa si su precio requiere revisión
    // Then: el resultado indica revisar y el mensaje es "No cambias este precio desde hace 7 meses. ¿Sigue siendo correcto?"
    const rachi = { ...producto('p-rachi'), actualizadoEn: '2026-03-02' };
    const resultado = requiereRevision(rachi, '2026-10-07');
    expect(resultado.revisar).toBe(true);
    expect(resultado.mensaje).toBe(
      'No cambias este precio desde hace 7 meses. ¿Sigue siendo correcto?',
    );
  });

  // @spec02_e5 — No avisa un precio reciente
  it('spec02_e5 no avisa un precio reciente', () => {
    // Given: el producto "Anticucho" actualizado el 2026-09-07 y hoy 2026-10-07
    // When: se evalúa si su precio requiere revisión
    // Then: el resultado indica no revisar y no trae mensaje
    const anticucho = { ...producto('p-anticucho'), actualizadoEn: '2026-09-07' };
    const resultado = requiereRevision(anticucho, '2026-10-07');
    expect(resultado.revisar).toBe(false);
    expect(resultado.mensaje).toBeUndefined();
  });

  // @spec02_e6 — Sin foto, el avatar muestra la inicial
  it('spec02_e6 sin foto el avatar muestra la inicial', () => {
    // Given: un perfil con nombre "Freddy" y sin foto
    // When: se calcula el avatar
    // Then: el avatar muestra la letra "F"
    expect(inicialesAvatar('Freddy')).toBe('F');
    expect(inicialesAvatar('freddy')).toBe('F');
    expect(inicialesAvatar('  freddy mendoza')).toBe('F');
    expect(inicialesAvatar('')).toBe('?');
    expect(inicialesAvatar('   ')).toBe('?');
  });

  // @spec02_e7 — Con Yape ajeno, el Yape nace por cobrar
  it('spec02_e7 con yape ajeno el yape nace por cobrar', async () => {
    // Given: un perfil con la opción "El Yape no está a mi nombre" activada
    // When: se registra un cierre con S/ 50.00 por Yape
    // Then: el cierre queda guardado con el Yape marcado como por cobrar
    const contexto = await montarProvider();
    const cierreDelDia = (fecha: string) => ({
      fecha,
      lineas: [
        { productoId: 'p-anticucho', preparadas: 20, sobrantes: 2 },
      ],
      montoYape: 50,
      gastos: [],
    });

    await act(async () => {
      await contexto().guardarPerfil({ yapeAjeno: true });
    });
    await act(async () => {
      await contexto().guardarDia(cierreDelDia('2026-10-06'));
    });
    const [conYapeAjeno] = await listarCierres();
    expect(conYapeAjeno.fecha).toBe('2026-10-06');
    expect(conYapeAjeno.montoYape).toBe(50);
    expect(conYapeAjeno.yapePendiente).toBe(true);

    // Comprobación inversa: con el Yape a su nombre, el cierre no queda por cobrar.
    await act(async () => {
      await contexto().guardarPerfil({ yapeAjeno: false });
    });
    await act(async () => {
      await contexto().guardarDia(cierreDelDia('2026-10-07'));
    });
    const cierres = await listarCierres();
    const aSuNombre = cierres.find(c => c.fecha === '2026-10-07');
    expect(aSuNombre?.montoYape).toBe(50);
    expect(aSuNombre?.yapePendiente).toBe(false);
  });

  // @spec02_e8 — Rechaza un precio de venta de cero
  it('spec02_e8 rechaza un precio de venta de cero', () => {
    // Given: el formulario de "Cambiar precio" del anticucho
    // When: se intenta guardar un precio de S/ 0.00
    // Then: la validación falla con el mensaje "El precio tiene que ser mayor a cero"
    expect(validarProducto({ precioVenta: 0, costoUnitario: 8.2 })).toEqual({
      ok: false,
      errores: { precioVenta: 'El precio tiene que ser mayor a cero' },
    });
  });

  // @spec02_e9 — e2e: cambiar el precio no toca ayer
  it('spec02_e9 e2e cambiar el precio no toca ayer', async () => {
    // Given: la app con el anticucho a S/ 10.00 y un cierre de ayer con 18 anticuchos vendidos
    // When: se cambia el precio a S/ 11.00 desde Perfil y se registra hoy un cierre con 10 anticuchos vendidos
    // Then: el cierre de ayer muestra S/ 180.00 de venta y el de hoy muestra S/ 110.00
    const hoy = fechaLocal(new Date());
    const ayer = fechaLocal(new Date(Date.now() - 24 * 60 * 60 * 1000));
    expect(ayer).not.toBe(hoy);
    // El cierre de ayer se siembra ANTES de montar la app, con el anticucho a S/ 10.00.
    await guardarCierre(
      nuevoCierre(
        {
          fecha: ayer,
          lineas: [{ productoId: 'p-anticucho', preparadas: 18, sobrantes: 0 }],
          montoYape: 0,
          gastos: [],
        },
        PRODUCTOS_POR_DEFECTO,
        null,
        new Date(),
      ),
    );

    const { tocar, escribir, textos } = await montarApp();

    // Desde Inicio al Perfil, y ahí, el precio del anticucho a S/ 11.00.
    await tocar('abrir-perfil');
    await tocar('cambiar-precio-p-anticucho');
    await escribir('precio-input', '11');
    await tocar('guardar-precio');
    await tocar('perfil-atras');

    // Hoy: 10 anticuchos preparados, ninguno sobrante; la pantalla ya muestra el precio nuevo.
    await tocar('tab-cerrar-dia');
    expect(textos()).toContain('a S/ 11.00');
    await escribir('preparadas-p-anticucho', '10');
    await escribir('sobrantes-p-anticucho', '0');
    await tocar('guardar-dia');

    // Inicio muestra la venta de hoy.
    expect(textos()).toContain('+ S/ 110.00');

    // Ayer se verifica en los datos: el Historial llega en el Sprint-03.
    const cierres = await listarCierres();
    expect(cierres).toHaveLength(2);
    const cierreDeAyer = cierres.find(c => c.fecha === ayer)!;
    const cierreDeHoy = cierres.find(c => c.fecha === hoy)!;
    expect(calcularCierre(cierreDeAyer).venta).toBe(180);
    expect(cierreDeAyer.lineas[0].precioUnitario).toBe(10);
    expect(calcularCierre(cierreDeHoy).venta).toBe(110);
    expect(cierreDeHoy.lineas[0].precioUnitario).toBe(11);

    // Cambiar un precio no borra productos: siguen los cuatro.
    expect(await listarProductos()).toHaveLength(4);
  });
});
