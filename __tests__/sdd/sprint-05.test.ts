/**
 * Tests del Sprint-05. Generados desde sdd/spec/Sprint-05/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../../App';
import { resumirCiclo, agruparCiclos } from '@dominio/ciclo';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type {
  Cierre,
  FechaNegocio,
  Gasto,
  GananciaProducto,
  LineaCierre,
  Producto,
} from '@dominio/tipos';
import { gananciaPorProducto, insight, compararCiclos } from '@analisis/metricas';
import { evaluarReglas, REGLAS } from '@analisis/reglas';

// Mediodía del 2026-10-07 en Lima: solo alimenta el instante de creación; "hoy" y la fecha de cada cierre son explícitas.
const ahora = new Date('2026-10-07T12:00:00-05:00');
const HOY: FechaNegocio = '2026-10-07';

const linea = (
  nombre: string,
  preparadas: number,
  sobrantes: number,
  precioUnitario: number,
  costoUnitario: number,
): LineaCierre => ({
  productoId: `p-${nombre.toLowerCase()}`,
  nombre,
  preparadas,
  sobrantes,
  precioUnitario,
  costoUnitario,
});

interface Opciones {
  lineas?: LineaCierre[];
  gastos?: Gasto[];
  abreCiclo?: boolean;
  montoYape?: number;
  yapePendiente?: boolean;
}

// Cierre armado a mano: la fecha es explícita y el reloj no decide nada.
const cierreDe = (
  fecha: FechaNegocio,
  { lineas = [], gastos = [], abreCiclo = false, montoYape = 0, yapePendiente = false }: Opciones = {},
): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas,
  montoYape,
  yapePendiente,
  gastos,
  abreCiclo,
  creadoEn: ahora.toISOString(),
  actualizadoEn: ahora.toISOString(),
});

const producto = (nombre: string, precioVenta: number, costoUnitario: number): Producto => ({
  id: `p-${nombre.toLowerCase()}`,
  nombre,
  unidad: 'porcion',
  precioVenta,
  costoUnitario,
  actualizadoEn: '2026-09-01',
  activo: true,
});

// Un día de venta S/ `venta` (10 porciones por S/ 10 el vendido) y gastos `gasto`: para ciclos de te queda conocido.
const diaDe = (fecha: FechaNegocio, venta: number, gasto: number, abreCiclo = false): Cierre =>
  cierreDe(fecha, {
    lineas: [linea('Anticucho', venta / 10, 0, 10, 8)],
    gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
    abreCiclo,
  });

// Las ventas de octubre del escenario 1: pancita 410 porciones a S/ 1.00 y anticucho 270 a S/ 1.80.
// El 30 de septiembre queda fuera del periodo y no debe contar.
const cierresDeOctubre = (): Cierre[] => [
  cierreDe('2026-09-30', { lineas: [linea('Anticucho', 500, 0, 10, 8.2)] }),
  cierreDe('2026-10-01', {
    lineas: [linea('Pancita', 220, 20, 9, 8), linea('Anticucho', 150, 10, 10, 8.2)],
  }),
  cierreDe('2026-10-02', {
    lineas: [linea('Pancita', 150, 0, 9, 8), linea('Anticucho', 130, 0, 10, 8.2)],
  }),
  cierreDe('2026-10-03', { lineas: [linea('Pancita', 60, 0, 9, 8)] }),
];

const porVendido = (g: GananciaProducto[]) => [...g].sort((a, b) => b.seVende - a.seVende);
const porPorcion = (g: GananciaProducto[]) => [...g].sort((a, b) => b.teDeja - a.teDeja);

// La app real, montada como en el teléfono (como en spec04_e10): con el almacenamiento vacío pide la
// semilla, la guarda y queda lista. Se deja correr el arranque antes de devolverla.
const RUTA_SEMILLA = join(__dirname, '..', '..', 'seed', 'semilla.json');
let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarApp = async () => {
  await act(async () => {
    montada = ReactTestRenderer.create(createElement(App));
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
};
const desmontarApp = async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
};
const raiz = (): ReactTestInstance => {
  if (!montada) throw new Error('La app no está montada');
  return (montada as ReactTestRenderer.ReactTestRenderer).root;
};
const tocar = (testID: string) =>
  act(async () => {
    const nodo = raiz().findAll(
      n => n.props.testID === testID && typeof n.props.onPress === 'function',
    )[0];
    if (!nodo) throw new Error(`No hay nada con testID "${testID}" que responda a onPress`);
    await nodo.props.onPress();
  });
const hayTexto = (testID: string): boolean =>
  raiz().findAll(n => (n.type as unknown) === 'Text' && n.props.testID === testID).length > 0;
// Las tarjetas de producto, en el orden en que están en pantalla.
const idsDeTarjetas = (): string[] =>
  raiz()
    .findAll(
      n => (n.type as unknown) === 'View' && String(n.props.testID ?? '').startsWith('queme-tarjeta-'),
    )
    .map(n => String(n.props.testID).replace('queme-tarjeta-', ''));
// ¿Esa etiqueta está dentro de la tarjeta de ese producto?
const etiquetaEnTarjeta = (etiqueta: 'vendes' | 'deja', productoId: string): boolean => {
  const tarjeta = raiz().findAll(
    n => (n.type as unknown) === 'View' && n.props.testID === `queme-tarjeta-${productoId}`,
  )[0];
  if (!tarjeta) throw new Error(`No hay ninguna tarjeta con testID "queme-tarjeta-${productoId}"`);
  return (
    tarjeta.findAll(
      n => (n.type as unknown) === 'Text' && n.props.testID === `queme-etiqueta-${etiqueta}-${productoId}`,
    ).length > 0
  );
};

describe('SPEC-05: Motor de decisiones', () => {
  afterEach(async () => {
    await desmontarApp();
  });

  // @spec05_e1 — Separa lo que se vende de lo que deja
  it('spec05_e1 separa lo que se vende de lo que deja', () => {
    // Given: en octubre, 410 porciones de pancita vendidas que dejan S/ 1.00 cada una y 270 de anticucho que dejan S/ 1.80 cada una
    // When: se calcula la ganancia por producto
    // Then: el que más se vende es "Pancita", el que más deja por porción es "Anticucho", y la ganancia del anticucho es S/ 486.00 contra S/ 410.00 de la pancita
    const g = gananciaPorProducto(cierresDeOctubre(), '2026-10-01');

    expect(porVendido(g)[0].nombre).toBe('Pancita');
    expect(porPorcion(g)[0].nombre).toBe('Anticucho');
    const pancita = g.find(x => x.nombre === 'Pancita');
    const anticucho = g.find(x => x.nombre === 'Anticucho');
    expect(pancita).toMatchObject({ seVende: 410, teDeja: 1, ganancia: 410 });
    expect(anticucho).toMatchObject({ seVende: 270, teDeja: 1.8, ganancia: 486 });
    // Ordenado por ganancia: el anticucho (486.00) va antes que la pancita (410.00)
    expect(g.map(x => x.nombre)).toEqual(['Anticucho', 'Pancita']);
  });

  // @spec05_e2 — El insight dice la diferencia correcta
  it('spec05_e2 el insight dice la diferencia correcta', () => {
    // Given: los datos del escenario 1
    // When: se genera el insight
    // Then: el texto es "La pancita se vende más, pero el anticucho te deja S/ 0.80 más por porción."
    const g = gananciaPorProducto(cierresDeOctubre(), '2026-10-01');

    expect(insight(g)).toBe(
      'La pancita se vende más, pero el anticucho te deja S/ 0.80 más por porción.',
    );
  });

  // @spec05_e3 — Regla de cuánto preparar
  it('spec05_e3 regla de cuanto preparar', () => {
    // Given: el rachi tuvo 5 sobrantes en el penúltimo ciclo y 6 en el último
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Te sobró rachi dos ciclos seguidos. Prepara 5 porciones menos."
    // Rachi: 2 + 3 = 5 sobrantes en el penúltimo ciclo y 4 + 2 = 6 en el último
    const cierres = [
      cierreDe('2026-09-14', { abreCiclo: true, lineas: [linea('Rachi', 30, 2, 9, 7.6)] }),
      cierreDe('2026-09-15', { lineas: [linea('Rachi', 30, 3, 9, 7.6)] }),
      cierreDe('2026-09-28', { abreCiclo: true, lineas: [linea('Rachi', 30, 4, 9, 7.6)] }),
      cierreDe('2026-09-29', { lineas: [linea('Rachi', 30, 2, 9, 7.6)] }),
    ];

    const r = evaluarReglas({ cierres, productos: [producto('Rachi', 9, 7.6)], hoy: HOY });

    expect(r).toContainEqual({
      reglaId: 'preparar',
      prioridad: 3,
      mensaje: 'Te sobró rachi dos ciclos seguidos. Prepara 5 porciones menos.',
    });
  
  });

  // @spec05_e4 — Regla de precio
  it('spec05_e4 regla de precio', () => {
    // Given: hoy 2026-10-07, el anticucho dejaba S/ 1.80 por porción en los cierres del 2026-07-09 y hoy deja S/ 1.20
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Tu anticucho te deja S/ 0.60 menos que en julio. ¿Revisas el precio?"
    // Anticucho: precio 10 y costo 8.20 el 2026-07-09 (deja 1.80); hoy costo 8.80 (deja 1.20)
    const cierres = [
      cierreDe('2026-07-09', { abreCiclo: true, lineas: [linea('Anticucho', 20, 0, 10, 8.2)] }),
      cierreDe('2026-09-20', { abreCiclo: true, lineas: [linea('Anticucho', 20, 0, 10, 8.8)] }),
    ];

    const r = evaluarReglas({ cierres, productos: [producto('Anticucho', 10, 8.8)], hoy: HOY });

    expect(r).toContainEqual({
      reglaId: 'precio',
      prioridad: 2,
      mensaje: 'Tu anticucho te deja S/ 0.60 menos que en julio. ¿Revisas el precio?',
    });
  
  });

  // @spec05_e5 — Regla de retiro con ganancia
  it('spec05_e5 regla de retiro con ganancia', () => {
    // Given: un ciclo cerrado con venta de S/ 412.00 y gastos de S/ 244.00
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Puedes sacar S/ 168.00 para la casa sin tocar tu capital."
    // Ciclo cerrado: venta 400 + 12 = 412, gastos 200 + 44 = 244. Después abre el ciclo actual.
    const cierres = [
      cierreDe('2026-09-20', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 40, 0, 10, 8.2), linea('Chicha', 6, 0, 2, 1.6)],
        gastos: [
          { categoria: 'mercaderia', monto: 200 },
          { categoria: 'carbon', monto: 44 },
        ],
      }),
      diaDe('2026-10-01', 100, 80, true),
    ];

    const r = evaluarReglas({ cierres, productos: [], hoy: HOY });

    expect(r).toContainEqual({
      reglaId: 'retiro',
      prioridad: 4,
      mensaje: 'Puedes sacar S/ 168.00 para la casa sin tocar tu capital.',
    });
  
  });

  // @spec05_e6 — Regla de retiro con pérdida
  it('spec05_e6 regla de retiro con perdida', () => {
    // Given: un ciclo cerrado con venta de S/ 200.00 y gastos de S/ 244.00
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Este ciclo no te dejó ganancia. Mejor no saques plata del negocio todavía."
    // Ciclo cerrado: venta 200, gastos 200 + 44 = 244. Después abre el ciclo actual.
    const cierres = [
      cierreDe('2026-09-20', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 20, 0, 10, 8.2)],
        gastos: [
          { categoria: 'mercaderia', monto: 200 },
          { categoria: 'carbon', monto: 44 },
        ],
      }),
      diaDe('2026-10-01', 100, 80, true),
    ];

    const r = evaluarReglas({ cierres, productos: [], hoy: HOY });

    expect(r).toContainEqual({
      reglaId: 'retiro',
      prioridad: 4,
      mensaje: 'Este ciclo no te dejó ganancia. Mejor no saques plata del negocio todavía.',
    });
  
  });

  // @spec05_e7 — Regla de cobro
  it('spec05_e7 regla de cobro', () => {
    // Given: hoy 2026-10-07 y S/ 120.00 por cobrar, con el pago más antiguo del 2026-09-29
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Tienes S/ 120.00 por cobrar desde el 29 de septiembre."
    // S/ 70 del 2026-09-29 + S/ 50 del 2026-10-02 = S/ 120 por cobrar; el más antiguo es del 29 de septiembre
    const cierres = [
      cierreDe('2026-09-29', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 20, 0, 10, 8.2)],
        montoYape: 70,
        yapePendiente: true,
      }),
      cierreDe('2026-10-02', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 20, 0, 10, 8.2)],
        montoYape: 50,
        yapePendiente: true,
      }),
    ];

    const r = evaluarReglas({ cierres, productos: [], hoy: HOY });

    expect(r).toContainEqual({
      reglaId: 'cobro',
      prioridad: 1,
      mensaje: 'Tienes S/ 120.00 por cobrar desde el 29 de septiembre.',
    });
  
  });

  // @spec05_e8 — Regla del día flojo
  it('spec05_e8 regla del dia flojo', () => {
    // Given: 4 semanas de cierres donde los miércoles ganan en promedio S/ 40.00 y el promedio de todos los días es S/ 85.00
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Los miércoles ganas S/ 45.00 menos que tu promedio."
    // 5 semanas, de miércoles a sábado: los 5 miércoles ganan S/ 40.00 (4 × 10) y los otros 15 días
    // S/ 100.00 (10 × 10), así que el promedio de todos los días es (5 × 40 + 15 × 100) / 20 = S/ 85.00.
    const semanas = [
      ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
      ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'],
      ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'],
      ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'],
      ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'],
    ];
    const cierres = semanas.flatMap((dias, semana) =>
      dias.map((fecha, i) =>
        cierreDe(fecha, {
          // dos ciclos: el segundo abre el miércoles 23
          abreCiclo: (semana === 0 && i === 0) || (semana === 3 && i === 0),
          lineas: [linea('Anticucho', i === 0 ? 4 : 10, 0, 10, 0)],
        }),
      ),
    );

    const r = evaluarReglas({ cierres, productos: [], hoy: HOY });

    expect(r).toContainEqual({
      reglaId: 'diaFlojo',
      prioridad: 5,
      mensaje: 'Los miércoles ganas S/ 45.00 menos que tu promedio.',
    });
  
  });

  // @spec05_e9 — Comparación con el ciclo anterior
  it('spec05_e9 comparacion con el ciclo anterior', () => {
    // Given: el ciclo actual con "te queda" de S/ 262.00 y el anterior con S/ 214.00
    // When: se comparan los ciclos
    // Then: el texto es "Ganaste S/ 48.00 más que el ciclo pasado"
    // Ciclo anterior: venta 300, gastos 86 → te queda 214. Actual: venta 400, gastos 138 → te queda 262.
    const anterior = resumirCiclo(agruparCiclos([diaDe('2026-09-14', 300, 86, true)])[0]);
    const actual = resumirCiclo(agruparCiclos([diaDe('2026-09-28', 400, 138, true)])[0]);
    expect(anterior.teQueda).toBe(214);
    expect(actual.teQueda).toBe(262);

    expect(compararCiclos(actual, anterior)).toBe('Ganaste S/ 48.00 más que el ciclo pasado');
  
  });

  // @spec05_e10 — Como máximo dos recomendaciones, por prioridad
  it('spec05_e10 como maximo dos recomendaciones por prioridad', () => {
    // Given: datos donde se activan las reglas cobro, precio, preparar, retiro y comparacion
    // When: se evalúan las reglas
    // Then: el motor devuelve exactamente 2 recomendaciones, la de cobro y la de precio, en ese orden
    // Los cinco casos a la vez:
    //  cobro     S/ 120.00 por cobrar desde el 2026-09-29 (hoy 2026-10-07: 8 días)
    //  precio    el anticucho dejaba 1.80 el 2026-07-09 y hoy deja 1.20
    //  preparar  sobró rachi 6 en el penúltimo ciclo y 4 en el último
    //  retiro    hay un ciclo cerrado con ganancia
    //  comparacion hay un ciclo anterior al actual
    const cierres = [
      cierreDe('2026-07-09', { abreCiclo: true, lineas: [linea('Anticucho', 20, 0, 10, 8.2)] }),
      cierreDe('2026-09-20', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 40, 0, 10, 8.8), linea('Rachi', 30, 6, 9, 7.6)],
        gastos: [{ categoria: 'mercaderia', monto: 100 }],
      }),
      cierreDe('2026-09-29', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 20, 0, 10, 8.8), linea('Rachi', 30, 4, 9, 7.6)],
        montoYape: 120,
        yapePendiente: true,
        gastos: [{ categoria: 'mercaderia', monto: 100 }],
      }),
    ];
    const ctx = {
      cierres,
      productos: [producto('Anticucho', 10, 8.8), producto('Rachi', 9, 7.6)],
      hoy: HOY,
    };

    // Las cinco reglas se activan...
    expect(REGLAS.filter(regla => regla.aplica(ctx)).map(regla => regla.id)).toEqual([
      'cobro',
      'precio',
      'preparar',
      'retiro',
      'comparacion',
    ]);

    // ...pero el motor devuelve solo las dos de más prioridad, en orden
    const r = evaluarReglas(ctx);
    expect(r).toHaveLength(2);
    expect(r.map(x => x.reglaId)).toEqual(['cobro', 'precio']);
    expect(r.map(x => x.prioridad)).toEqual([1, 2]);
  
  });

  // @spec05_e11 — Sin datos suficientes, no inventa
  it('spec05_e11 sin datos suficientes no inventa', () => {
    // Given: un solo ciclo registrado
    // When: se evalúan las reglas
    // Then: el motor devuelve 0 recomendaciones y la pantalla muestra "Cierra 2 ciclos para ver recomendaciones"
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e12 — e2e: el insight aparece con los datos de ejemplo
  it('spec05_e12 e2e el insight aparece con los datos de ejemplo', () => {
    // Given: la app con la semilla cargada
    // When: se abre "Qué me deja cada uno"
    // Then: la etiqueta "El que más vendes" está en la tarjeta de Pancita, "El que más te deja" en la de Anticucho, y las 4 tarjetas están ordenadas por ganancia
    return (async () => {
      clearAllMockStorages();
      const texto = readFileSync(RUTA_SEMILLA, 'utf8');
      const validada = validarSemilla(JSON.parse(texto));
      if (!validada.ok) throw new Error('La semilla del repositorio no valida');
      const fetchPorDefecto = global.fetch;
      global.fetch = jest.fn(
        async () => ({ ok: true, status: 200, text: async () => texto } as unknown as Response),
      ) as unknown as typeof fetch;
      try {
        await montarApp();

        // Resumen → "Qué me deja cada uno".
        await tocar('tab-resumen');
        await tocar('resumen-que-me-deja');

        // Lo esperado sale del dominio, con la misma semilla y el mismo "hoy" que usa la app.
        const hoy = fechaLocal(new Date());
        const { cierres } = materializarSemilla(validada.semilla, new Date());
        const g = gananciaPorProducto(cierres, restarDias(hoy, 30));
        expect(g).toHaveLength(4);
        const masVendido = porVendido(g)[0];
        const masDeja = porPorcion(g)[0];
        expect(masVendido.nombre).toBe('Pancita');
        expect(masDeja.nombre).toBe('Anticucho');

        // Las 4 tarjetas, ordenadas por ganancia (de mayor a menor).
        const ids = idsDeTarjetas();
        expect(ids).toEqual(g.map(x => x.productoId));
        expect(g.map(x => x.ganancia)).toEqual(g.map(x => x.ganancia).sort((a, b) => b - a));

        // "El que más vendes" en Pancita y "El que más te deja" en Anticucho, y en ninguna otra.
        expect(etiquetaEnTarjeta('vendes', 'p-pancita')).toBe(true);
        expect(etiquetaEnTarjeta('deja', 'p-anticucho')).toBe(true);
        for (const id of ids) {
          expect(etiquetaEnTarjeta('vendes', id)).toBe(id === 'p-pancita');
          expect(etiquetaEnTarjeta('deja', id)).toBe(id === 'p-anticucho');
        }
        expect(hayTexto('queme-insight-texto')).toBe(true);
      } finally {
        global.fetch = fetchPorDefecto;
      }
    })();
  });
});
