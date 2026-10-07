/**
 * Tests del Sprint-03. Generados desde sdd/spec/Sprint-03/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../../App';
import { calcularCierre, nuevoCierre } from '@dominio/cierre';
import { agruparCiclos, resumirCiclo, textoCapital } from '@dominio/ciclo';
import { formatoFecha, formatoSoles, sobranteSoles, textoSobrante } from '@dominio/formato';
import { armarHistorial, mensajeBorrar } from '@dominio/historial';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Ciclo, Cierre, FechaNegocio, Gasto, LineaCierre } from '@dominio/tipos';
import { listarCierres } from '@storage/repositorio';

// Mediodía del 2026-10-07 en Lima: solo alimenta el instante de creación; la fecha de cada cierre es explícita.
const ahora = new Date('2026-10-07T12:00:00-05:00');

const linea = (nombre: string, vendidas: number, precioUnitario: number): LineaCierre => ({
  productoId: `p-${nombre.toLowerCase()}`,
  nombre,
  preparadas: vendidas,
  sobrantes: 0,
  precioUnitario,
  costoUnitario: 0,
});

interface Opciones {
  lineas?: LineaCierre[];
  gastos?: Gasto[];
  abreCiclo?: boolean;
}

// Cierre armado a mano: la fecha es explícita y el reloj no decide nada.
const cierreDe = (fecha: FechaNegocio, { lineas = [], gastos = [], abreCiclo = false }: Opciones = {}): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas,
  montoYape: 0,
  yapePendiente: false,
  gastos,
  abreCiclo,
  creadoEn: ahora.toISOString(),
  actualizadoEn: ahora.toISOString(),
});

const cicloDe = (cierres: Cierre[]): Ciclo => ({
  inicio: cierres[0].fecha,
  fin: cierres[cierres.length - 1].fecha,
  cierres,
});


// La app real, manejada por testID como lo haría una persona (e10). Copia mínima del
// montarApp de sprint-01.test.ts: los tests no se importan entre sí. Si el testID no
// existe, el error lo dice (sin esto sería un "undefined.props" que no explica nada).
// Se desmonta en el `finally` del propio test.
const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });

  // Componente nativo ('Text', 'View', 'TextInput') y no el componente de React que lo envuelve.
  const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
  const nodo = (testID: string, prop: 'onPress' | 'onChangeText' | 'onValueChange') => {
    const encontrado = app.root.findAll(
      n => n.props.testID === testID && typeof n.props[prop] === 'function',
    )[0];
    if (!encontrado) throw new Error(`No hay nada con testID "${testID}" que responda a ${prop}`);
    return encontrado;
  };
  const tocar = (testID: string) =>
    act(async () => {
      await nodo(testID, 'onPress').props.onPress();
    });
  const escribir = (testID: string, texto: string) =>
    act(async () => {
      nodo(testID, 'onChangeText').props.onChangeText(texto);
    });
  const cambiarInterruptor = (testID: string, valor: boolean) =>
    act(async () => {
      await nodo(testID, 'onValueChange').props.onValueChange(valor);
    });
  const textoCompleto = (n: ReactTestInstance | string): string =>
    typeof n === 'string' ? n : n.children.map(textoCompleto).join('');
  const textos = () => app.root.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  const textoDe = (testID: string) => {
    const encontrado = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!encontrado) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return textoCompleto(encontrado);
  };
  const cuantos = (prefijo: string) =>
    app.root.findAll(n => esHost(n, 'View') && String(n.props.testID ?? '').startsWith(prefijo))
      .length;

  return { app, tocar, escribir, cambiarInterruptor, textos, textoDe, cuantos };
};

// Solo el reloj es falso. Sin esto los dos cierres caerían en la misma fecha (hoy) y el
// segundo reemplazaría al primero (D9). Se dejan reales todos los demás temporizadores:
// la app y el almacenamiento esperan promesas y timers de verdad.
const SIN_FALSEAR = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

describe('SPEC-03: Historial y ciclos de compra', () => {
  // @spec03_e1 — Agrupa cierres en ciclos de compra
  it('spec03_e1 agrupa cierres en ciclos de compra', () => {
    // Given: cierres del 1, 2, 3 y 4 de octubre de 2026, con "hoy compré mercadería" marcado el 1 y el 3
    // When: se agrupan en ciclos
    // Then: resultan 2 ciclos, el primero con los cierres del 1 y 2, y el segundo con los del 3 y 4
    const c1 = cierreDe('2026-10-01', { abreCiclo: true });
    const c2 = cierreDe('2026-10-02');
    const c3 = cierreDe('2026-10-03', { abreCiclo: true });
    const c4 = cierreDe('2026-10-04');

    const ciclos = agruparCiclos([c1, c2, c3, c4]);

    expect(ciclos).toHaveLength(2);
    expect(ciclos[0].cierres.map(c => c.fecha)).toEqual(['2026-10-01', '2026-10-02']);
    expect(ciclos[1].cierres.map(c => c.fecha)).toEqual(['2026-10-03', '2026-10-04']);
    expect([ciclos[0].inicio, ciclos[0].fin]).toEqual(['2026-10-01', '2026-10-02']);
    expect([ciclos[1].inicio, ciclos[1].fin]).toEqual(['2026-10-03', '2026-10-04']);
  });

  // @spec03_e2 — Capital y te queda del ciclo
  it('spec03_e2 capital y te queda del ciclo', () => {
    // Given: un ciclo con gastos de mercadería por S/ 220.00, otros gastos por S/ 24.00 y venta total de S/ 412.00
    // When: se resume el ciclo
    // Then: el capital es S/ 244.00 y "te queda" es S/ 168.00
    // 40 anticuchos a S/ 10.00 + 6 chichas a S/ 2.00 = S/ 412.00
    const dia = cierreDe('2026-10-05', {
      abreCiclo: true,
      lineas: [linea('Anticucho', 40, 10), linea('Chicha', 6, 2)],
      gastos: [
        { categoria: 'mercaderia', monto: 220 },
        { categoria: 'carbon', monto: 14 },
        { categoria: 'movilidad', monto: 10 },
      ],
    });

    const resumen = resumirCiclo(cicloDe([dia]));

    expect(resumen.venta).toBe(412);
    expect(resumen.capital).toBe(244);
    expect(resumen.teQueda).toBe(168);
  });

  // @spec03_e3 — Cuándo recuperó su capital
  it('spec03_e3 cuando recupero su capital', () => {
    // Given: un ciclo con capital de S/ 244.00, venta de S/ 180.00 el 2026-10-05 y de S/ 232.00 el 2026-10-06
    // When: se calcula la recuperación del capital
    // Then: el capital se recuperó el 2026-10-06
    // Capital S/ 244.00 (todo el día 5); venta S/ 180.00 el 5 y S/ 232.00 el 6.
    const dia5 = cierreDe('2026-10-05', {
      abreCiclo: true,
      lineas: [linea('Anticucho', 18, 10)],
      gastos: [{ categoria: 'mercaderia', monto: 244 }],
    });
    const dia6 = cierreDe('2026-10-06', { lineas: [linea('Rachi', 29, 8)] });

    const resumen = resumirCiclo(cicloDe([dia5, dia6]));

    expect(resumen.capital).toBe(244);
    expect(resumen.capitalRecuperadoEn).toBe('2026-10-06');
    expect(resumen.faltaParaCapital).toBe(0);
    expect(textoCapital(resumen)).toBe('Recuperaste tu capital el martes 6 de octubre');
  });

  // @spec03_e4 — Todavía no recupera su capital
  it('spec03_e4 todavia no recupera su capital', () => {
    // Given: un ciclo en curso con capital de S/ 244.00 y venta de S/ 180.00 en su único día
    // When: se calcula la recuperación del capital
    // Then: falta S/ 64.00 y el texto es "Te falta S/ 64.00 para recuperar tu capital"
    const unico = cierreDe('2026-10-06', {
      abreCiclo: true,
      lineas: [linea('Anticucho', 18, 10)],
      gastos: [{ categoria: 'mercaderia', monto: 244 }],
    });

    const resumen = resumirCiclo(cicloDe([unico]));

    expect(resumen.capital).toBe(244);
    expect(resumen.venta).toBe(180);
    expect(resumen.capitalRecuperadoEn).toBeUndefined();
    expect(resumen.faltaParaCapital).toBe(64);
    expect(textoCapital(resumen)).toBe('Te falta S/ 64.00 para recuperar tu capital');
  });

  // @spec03_e5 — Historial por día, del más reciente al más antiguo
  it('spec03_e5 historial por dia del mas reciente al mas antiguo', () => {
    // Given: cierres del 4, 5 y 6 de octubre de 2026
    // When: se arma el historial sin filtro
    // Then: el primer grupo se titula "Martes 6 de octubre", el último "Domingo 4 de octubre", y cada grupo muestra su neto en soles
    // Neto del 4: 10 × S/ 10.00 − S/ 60.00 = S/ 40.00 · del 5: 20 × S/ 10.00 − S/ 14.00 = S/ 186.00 · del 6: S/ 412.00 − S/ 244.00 = S/ 168.00
    const dia4 = cierreDe('2026-10-04', {
      lineas: [linea('Anticucho', 10, 10)],
      gastos: [{ categoria: 'mercaderia', monto: 60 }],
    });
    const dia5 = cierreDe('2026-10-05', {
      lineas: [linea('Anticucho', 20, 10)],
      gastos: [{ categoria: 'carbon', monto: 14 }],
    });
    const dia6 = cierreDe('2026-10-06', {
      lineas: [linea('Anticucho', 40, 10), linea('Chicha', 6, 2)],
      gastos: [
        { categoria: 'mercaderia', monto: 220 },
        { categoria: 'otro', monto: 24 },
      ],
    });

    // Desordenados a propósito: el orden lo pone el historial.
    const historial = armarHistorial([dia5, dia6, dia4], 'todo');

    expect(historial).toHaveLength(3);
    expect(historial[0].titulo).toBe('Martes 6 de octubre');
    expect(historial[historial.length - 1].titulo).toBe('Domingo 4 de octubre');
    expect(historial.map(g => g.fecha)).toEqual(['2026-10-06', '2026-10-05', '2026-10-04']);
    expect(historial.map(g => g.neto)).toEqual([168, 186, 40]);
    expect(historial.map(g => formatoSoles(g.neto))).toEqual(['S/ 168.00', 'S/ 186.00', 'S/ 40.00']);
  });

  // @spec03_e6 — Filtra lo que está por cobrar
  it('spec03_e6 filtra lo que esta por cobrar', () => {
    // Given: 3 cierres, de los cuales solo el del 2026-10-05 tiene Yape por cobrar
    // When: se arma el historial con el filtro "Por cobrar"
    // Then: el historial tiene 1 grupo, titulado "Lunes 5 de octubre"
    const lineas = [linea('Anticucho', 20, 10)];
    const dia4 = cierreDe('2026-10-04', { lineas });
    const dia5 = {
      ...cierreDe('2026-10-05', { lineas }),
      montoYape: 46,
      yapePendiente: true, // sin cobradoEn: sigue por cobrar
    };
    const dia6 = cierreDe('2026-10-06', { lineas });

    const historial = armarHistorial([dia4, dia5, dia6], 'porCobrar');

    expect(historial).toHaveLength(1);
    expect(historial[0].titulo).toBe('Lunes 5 de octubre');
  });

  // @spec03_e7 — Borrar dice la consecuencia en soles
  it('spec03_e7 borrar dice la consecuencia en soles', () => {
    // Given: el cierre del martes 6 de octubre con "te queda" de S/ 168.00
    // When: se pide la confirmación para borrarlo
    // Then: el mensaje es "¿Borrar el cierre del martes 6 de octubre? Se van a restar S/ 168.00 de tu ciclo."
    // 40 anticuchos a S/ 10.00 + 6 chichas a S/ 2.00 = S/ 412.00, menos S/ 244.00 de gastos = S/ 168.00
    const martes = cierreDe('2026-10-06', {
      lineas: [linea('Anticucho', 40, 10), linea('Chicha', 6, 2)],
      gastos: [
        { categoria: 'mercaderia', monto: 220 },
        { categoria: 'otro', monto: 24 },
      ],
    });
    expect(calcularCierre(martes).teQueda).toBe(168);

    expect(mensajeBorrar(martes)).toBe(
      '¿Borrar el cierre del martes 6 de octubre? Se van a restar S/ 168.00 de tu ciclo.',
    );
  });

  // @spec03_e8 — Lo que sobró, en soles
  it('spec03_e8 lo que sobro en soles', () => {
    // Given: una línea de "Rachi" con 16 preparadas, 5 sobrantes y costo de S/ 7.60 por porción
    // When: se calcula el sobrante en soles
    // Then: el sobrante es S/ 38.00 y el texto es "Te sobró S/ 38.00 en rachi"
    const rachi = PRODUCTOS_POR_DEFECTO.find(p => p.id === 'p-rachi');
    expect(rachi?.costoUnitario).toBe(7.6);
    const cierre = nuevoCierre(
      { fecha: '2026-10-06', lineas: [{ productoId: 'p-rachi', preparadas: 16, sobrantes: 5 }], montoYape: 0, gastos: [] },
      PRODUCTOS_POR_DEFECTO,
      null,
      ahora,
    );
    const lineaRachi = cierre.lineas[0];
    expect(lineaRachi).toMatchObject({ nombre: 'Rachi', preparadas: 16, sobrantes: 5, costoUnitario: 7.6 });

    expect(sobranteSoles(lineaRachi)).toBe(38);
    expect(textoSobrante(lineaRachi)).toBe('Te sobró S/ 38.00 en rachi');
  });

  // @spec03_e9 — Fechas y montos en palabras de Freddy
  it('spec03_e9 fechas y montos en palabras de freddy', () => {
    // Given: la fecha 2026-10-06 y el monto 1240
    // When: se formatean para la pantalla
    // Then: la fecha se muestra como "Martes 6 de octubre" y el monto como "S/ 1,240.00"
    expect(formatoFecha('2026-10-06')).toBe('Martes 6 de octubre');
    expect(formatoSoles(1240)).toBe('S/ 1,240.00');
  });

  // @spec03_e10 — e2e: ver el ciclo después de dos cierres
  it('spec03_e10 e2e ver el ciclo despues de dos cierres', async () => {
    // Given: la app sin datos, con el anticucho a S/ 10.00
    // When: se registra un cierre marcado "hoy compré mercadería" con S/ 150.00 de gasto y 20 anticuchos vendidos, luego otro al día siguiente con 15 vendidos, y se abre Resumen
    // Then: Resumen muestra el ciclo con capital "S/ 150.00" y "te queda" "S/ 200.00", e Historial muestra 2 grupos
    clearAllMockStorages();
    // El martes 6 de octubre de 2026 a las 8 p.m. en Lima; el día siguiente se mueve el reloj.
    jest.useFakeTimers({ doNotFake: [...SIN_FALSEAR], now: new Date('2026-10-06T20:00:00-05:00') });
    let app: ReactTestRenderer.ReactTestRenderer | null = null;
    try {
      const montada = await montarApp();
      app = montada.app;
      const { tocar, escribir, cambiarInterruptor, textos, textoDe, cuantos } = montada;

      // Día 1: compró mercadería (S/ 150.00) y vendió 20 anticuchos a S/ 10.00.
      await tocar('tab-cerrar-dia');
      await cambiarInterruptor('hoy-compre-mercaderia', true);
      await escribir('preparadas-p-anticucho', '20');
      await escribir('sobrantes-p-anticucho', '0');
      await escribir('monto-gasto', '150');
      await tocar('agregar-gasto'); // la categoría Mercadería viene marcada
      await tocar('guardar-dia');
      expect(textoDe('inicio-te-queda')).toBe('S/ 50.00');

      // Día 2: otro día, 15 anticuchos vendidos y nada de compra.
      jest.setSystemTime(new Date('2026-10-07T20:00:00-05:00'));
      await tocar('tab-cerrar-dia');
      await escribir('preparadas-p-anticucho', '15');
      await escribir('sobrantes-p-anticucho', '0');
      await tocar('guardar-dia');
      expect(textoDe('inicio-te-queda')).toBe('S/ 150.00');

      // Resumen: un ciclo de 2 días. Venta 350.00 − capital 150.00 = te queda 200.00.
      await tocar('tab-resumen');
      expect(textoDe('resumen-capital')).toBe('Capital S/ 150.00');
      expect(textoDe('resumen-te-queda')).toBe('S/ 200.00');
      expect(textos()).toContain('Te queda');

      // Historial: un grupo por cada día.
      await tocar('tab-historial');
      expect(cuantos('dia-')).toBe(2);
      expect(textos()).toContain('Miércoles 7 de octubre');
      expect(textos()).toContain('Martes 6 de octubre');

      const cierres = await listarCierres();
      expect(cierres.map(c => [c.fecha, c.abreCiclo]).sort()).toEqual([
        ['2026-10-06', true],
        ['2026-10-07', false],
      ]);
    } finally {
      const abierta = app;
      if (abierta) await act(async () => abierta.unmount());
      jest.useRealTimers();
    }
  });
});
