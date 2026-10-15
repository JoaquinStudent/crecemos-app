/**
 * Tests del Sprint-15 con la app (o el componente) montada. Generados desde
 * sdd/spec/Sprint-15-graficos/SPEC.md. Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'.
 *
 * El reloj se fija en el 15 de octubre de 2026. La hoja nativa de compartir y el generador de PDF
 * están simulados (jest.setup.js): solo se mira qué reciben.
 */
import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { generatePDF } from 'react-native-html-to-pdf';
import { colors } from '@theme';
import { SIN_CUOTA_MES } from '@analisis/pasaporte';
import { porcionesTorta, textoPorcion, type ProductoPeriodo } from '@analisis/graficos';
import { formatoSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, Origen, Perfil } from '@dominio/tipos';
import { GraficoTorta } from '@components/molecules/GraficoTorta';
import { compartirReporte } from '@services/compartir';
import { guardarCierre, guardarPerfil } from '@storage/repositorio';
import { desmontarApp, montarApp as montar } from '../../testutils/app';
import { montar as montarComponente, desmontar, texto } from '../../testutils/componente';

jest.mock('@services/compartir');

const INSTANTE = '2026-10-15T12:00:00-05:00';

// Solo el reloj es falso; los temporizadores siguen reales (la app espera promesas de verdad).
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

const CATALOGO = {
  anticucho: { id: 'p-anticucho', nombre: 'Anticucho', precio: 10, costo: 8 },
  pancita: { id: 'p-pancita', nombre: 'Pancita', precio: 9, costo: 7 },
  rachi: { id: 'p-rachi', nombre: 'Rachi', precio: 9, costo: 7.6 },
} as const;
type Clave = keyof typeof CATALOGO;

const dia = (
  fecha: FechaNegocio,
  unidades: Partial<Record<Clave, number>>,
  gasto = 0,
  origen?: Origen,
): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: (Object.keys(unidades) as Clave[]).map(clave => ({
    productoId: CATALOGO[clave].id,
    nombre: CATALOGO[clave].nombre,
    preparadas: unidades[clave] ?? 0,
    sobrantes: 0,
    precioUnitario: CATALOGO[clave].precio,
    costoUnitario: CATALOGO[clave].costo,
  })),
  montoYape: 0,
  yapePendiente: false,
  gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
  abreCiclo: false,
  creadoEn: INSTANTE,
  actualizadoEn: INSTANTE,
  ...(origen ? { origen } : {}),
});

/** Agosto (solo Rachi), septiembre (Pancita y Anticucho) y octubre (hasta hoy). */
const historial = (): Cierre[] => [
  dia('2026-08-10', { rachi: 30 }, 60),
  dia('2026-09-05', { pancita: 20, anticucho: 10 }, 80),
  dia('2026-09-12', { pancita: 10 }, 30),
  dia('2026-10-05', { pancita: 10 }, 40),
  dia('2026-10-14', { anticucho: 10 }, 20),
];

const FREDDY: Perfil = {
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  aceptaYape: true,
  yapeAjeno: false,
  actualizadoEn: INSTANTE,
};

const sembrar = async (cierres: Cierre[], perfil: Perfil = FREDDY) => {
  for (const c of cierres) await guardarCierre(c);
  await guardarPerfil(perfil);
};

const montarApp = async () => {
  const app = await montar();
  // El arranque (leer el almacenamiento) termina en segundo plano.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
  return app;
};

type App = Awaited<ReturnType<typeof montarApp>>;

const abrirResumen = async (app: App) => {
  await app.tocar('tab-resumen');
};
const abrirReporte = async (app: App) => {
  await app.tocar('tab-resumen');
  await app.tocar('resumen-mi-reporte');
};
/** Abre la hoja del periodo, elige la opción y cierra con "Listo". */
const elegirPeriodo = async (app: App, prefijo: string, opcion: string, mes?: string) => {
  await app.tocar(`${prefijo}-boton`);
  await app.tocar(`${prefijo}-opcion-${opcion}`);
  if (mes) await app.tocar(`${prefijo}-mes-${mes}`);
  await app.tocar(`${prefijo}-listo`);
};
const leyenda = (app: App): string[] =>
  app.buscar(n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith('grafico-torta-leyenda-texto-')).map(n => texto(n));

const desactivado = (app: App, testID: string): boolean => {
  const boton = app.botonDe(testID);
  return boton.props.disabled === true || boton.props.accessibilityState?.disabled === true;
};

const generar = jest.mocked(generatePDF);
const compartir = compartirReporte as jest.MockedFunction<typeof compartirReporte>;

describe('Sprint-15 · pantallas', () => {
  beforeEach(() => {
    clearAllMockStorages();
    compartir.mockReset();
    compartir.mockResolvedValue({ ok: true });
    generar.mockClear();
    jest.useFakeTimers({ doNotFake: [...SIN_FALSEAR], now: new Date('2026-10-15T12:00:00-05:00') });
  });
  afterEach(async () => {
    jest.useRealTimers();
    await desmontarApp();
  });

  // @spec15_e15 — La torta se puede leer sin ver colores
  it('spec15_e15 la torta se puede leer sin ver colores', async () => {
    const prod = (nombre: string, soles: number): ProductoPeriodo => ({
      productoId: `p-${nombre}`,
      nombre,
      porciones: 3,
      venta: soles,
    });
    const porciones = porcionesTorta([
      prod('Pancita', 440),
      prod('Anticucho', 300),
      prod('Rachi', 150),
      prod('Chicha', 80),
      prod('Gaseosa', 30),
    ]);
    const r = await montarComponente(<GraficoTorta porciones={porciones} testID="torta" />);

    // Etiqueta del lector de pantalla con la lista completa.
    const contenedor = r.root.findAll(n => n.props.testID === 'torta' && n.props.accessibilityLabel)[0];
    expect(contenedor).toBeDefined();
    const etiqueta: string = contenedor.props.accessibilityLabel;
    expect(etiqueta.startsWith('Torta de ventas por producto')).toBe(true);
    expect(etiqueta).toContain(`Pancita, 44 por ciento de lo que vendiste, ${formatoSoles(440)}`);
    for (const p of porciones) expect(etiqueta).toContain(p.nombre);

    // Leyenda: una fila por porción con nombre, porcentaje en palabras y monto.
    const textos = r.root
      .findAll(n => (n.type as unknown) === 'Text')
      .map(n => ({ id: String(n.props.testID ?? ''), t: texto(n) }));
    porciones.forEach((p, i) => {
      expect(textos.find(x => x.id === `torta-leyenda-texto-${i}`)?.t).toBe(textoPorcion(p));
      expect(textos.find(x => x.id === `torta-monto-${i}`)?.t).toBe(formatoSoles(p.venta));
    });

    // Cada porción tiene un patrón distinto además del color, y la leyenda usa el mismo.
    const rellenos = porciones.map(
      (_, i) => r.root.findAll(n => n.props.testID === `torta-porcion-${i}`)[0].props.fill as string,
    );
    expect(new Set(rellenos).size).toBe(5);
    expect(rellenos.every(f => f.startsWith('url(#'))).toBe(true);
    const marcas = porciones.map(
      (_, i) => r.root.findAll(n => n.props.testID === `torta-marca-${i}`)[0].props.accessibilityLabel,
    );
    expect(new Set(marcas).size).toBe(5);

    // Nada en naranja ni por debajo de 14 px.
    const hosts = r.root.findAll(n => (n.type as unknown) === 'Text');
    for (const t of hosts) {
      const estilo = StyleSheet.flatten(t.props.style) ?? {};
      expect(estilo.color).not.toBe(colors.accent);
      expect(estilo.fontSize).toBeGreaterThanOrEqual(14);
    }
    await desmontar(r);

    // Sin ventas, un estado vacío amable y no el gráfico.
    const vacia = await montarComponente(<GraficoTorta porciones={[]} testID="torta" />);
    const textosVacia = vacia.root.findAll(n => (n.type as unknown) === 'Text').map(n => texto(n));
    expect(textosVacia).toContain('Aún no hay ventas en este periodo');
    expect(vacia.root.findAll(n => n.props.testID === 'torta-porcion-0')).toHaveLength(0);
    await desmontar(vacia);
  });

  // @spec15_e16 — Resumen: el selector y los gráficos cambian con el filtro
  it('spec15_e16 e2e resumen muestra el selector y los graficos cambian con el filtro', async () => {
    await sembrar(historial());
    const app = await montarApp();
    await abrirResumen(app);

    // Lo de siempre sigue: el ciclo y los tres botones.
    expect(app.existe('resumen-te-queda')).toBe(true);
    for (const id of ['resumen-que-me-deja', 'resumen-mi-reporte', 'resumen-preguntar']) {
      expect(app.existe(id)).toBe(true);
    }
    // El selector y los cuatro gráficos.
    expect(app.textoDe('resumen-filtro-etiqueta')).toBe('Periodo: Todo tu historial');
    for (const id of ['grafico-torta', 'grafico-meses', 'grafico-productos', 'grafico-dias']) {
      expect(app.existe(id)).toBe(true);
    }
    expect(leyenda(app).some(t => t.startsWith('Rachi'))).toBe(true);
    expect(app.existe('grafico-meses-fila-2026-08')).toBe(true);
    expect(app.existe('grafico-meses-fila-2026-10')).toBe(true);
    expect(app.textoDe('grafico-meses-mes-2026-10')).toBe('Octubre 2026 (en curso)');

    // Mes pasado: septiembre, sin el producto que solo se vendió en agosto.
    await elegirPeriodo(app, 'resumen-filtro', 'mesPasado');
    expect(app.textoDe('resumen-filtro-etiqueta')).toBe('Periodo: Septiembre 2026');
    expect(leyenda(app).some(t => t.startsWith('Rachi'))).toBe(false);
    expect(leyenda(app).some(t => t.startsWith('Pancita'))).toBe(true);
    expect(app.existe('grafico-meses-fila-2026-09')).toBe(true);
    expect(app.existe('grafico-meses-fila-2026-08')).toBe(false);
    expect(app.existe('grafico-productos-fila-p-rachi')).toBe(false);
    expect(app.existe('grafico-productos-fila-p-pancita')).toBe(true);

    // Elegir un mes: agosto.
    await elegirPeriodo(app, 'resumen-filtro', 'mes', '2026-08');
    expect(app.textoDe('resumen-filtro-etiqueta')).toBe('Periodo: Agosto 2026');
    expect(leyenda(app)).toHaveLength(1);
    expect(leyenda(app)[0].startsWith('Rachi')).toBe(true);

    // Un rango de meses.
    await app.tocar('resumen-filtro-boton');
    await app.tocar('resumen-filtro-opcion-rango');
    await app.tocar('resumen-filtro-desde-2026-09');
    await app.tocar('resumen-filtro-hasta-2026-10');
    await app.tocar('resumen-filtro-listo');
    expect(app.textoDe('resumen-filtro-etiqueta')).toBe('Periodo: Del 1 de septiembre al 15 de octubre');
    expect(app.existe('grafico-meses-fila-2026-08')).toBe(false);
    expect(app.existe('grafico-meses-fila-2026-10')).toBe(true);

    // Los últimos 7, 14 y 30 días.
    await elegirPeriodo(app, 'resumen-filtro', 'todo');
    const columnas = () =>
      app.buscar(
        n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith('grafico-dias-columna-'),
      ).length;
    await app.tocar('grafico-dias-tramo-7');
    expect(columnas()).toBe(7);
    expect(app.existe('grafico-dias-hueco-2026-10-13')).toBe(true);
    expect(app.existe('grafico-dias-barra-2026-10-14')).toBe(true);
    await app.tocar('grafico-dias-tramo-14');
    expect(columnas()).toBe(14);
    await app.tocar('grafico-dias-tramo-30');
    expect(columnas()).toBe(30);
    expect(app.existe('grafico-dias-mejor')).toBe(true);
    expect(app.existe('grafico-dias-peor')).toBe(true);
  });

  it('spec15_e16 e2e un periodo sin cierres lo dice con amabilidad', async () => {
    await sembrar([dia('2026-08-10', { rachi: 30 }, 60)]);
    const app = await montarApp();
    await abrirResumen(app);

    await elegirPeriodo(app, 'resumen-filtro', 'esteMes');
    expect(app.textoDe('resumen-filtro-etiqueta')).toBe('Periodo: Octubre 2026 (en curso)');
    expect(app.textoDe('grafico-dias-vacio')).toBe('Aún no hay días cerrados en este periodo');
    expect(app.textoDe('grafico-meses-vacio')).toBe('Aún no hay días cerrados en este periodo');
    expect(app.textoDe('grafico-productos-vacio')).toBe('Aún no hay días cerrados en este periodo');
    expect(app.textoDe('grafico-torta-vacio')).toBe('Aún no hay ventas en este periodo');
    expect(app.existe('grafico-torta-porcion-0')).toBe(false);
  });

  it('spec15_e16 e2e sin ningún día cerrado no hay gráficos, solo el estado vacío de siempre', async () => {
    const app = await montarApp();
    await abrirResumen(app);
    expect(app.existe('resumen-vacio')).toBe(true);
    expect(app.existe('resumen-filtro-boton')).toBe(false);
    expect(app.existe('grafico-torta')).toBe(false);
  });

  // @spec15_e17 — Mi reporte: se comparte con el mes en curso y respeta el filtro
  it('spec15_e17 e2e mi reporte se comparte con el mes en curso y respeta el filtro', async () => {
    // Un solo mes en curso y menos de 30 días: antes el reporte esperaba al fin de mes.
    await sembrar([dia('2026-10-05', { pancita: 20 }, 40), dia('2026-10-14', { anticucho: 10 }, 20)]);
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.existe('reporte-en-construccion')).toBe(true);
    expect(app.textoDe('reporte-filtro-etiqueta')).toBe('Periodo: Todo tu historial');
    await app.tocar('reporte-compartir-pdf');
    expect(generar).toHaveBeenCalledTimes(1);
    const html: string = generar.mock.calls[0][0].html;
    expect(html).toContain('Ventas, gastos y resultado registrado por mes');
    expect(html).toContain(SIN_CUOTA_MES);
    expect(html).toContain('Octubre 2026 (en curso)');
    expect(html).toContain('S/ 280.00');

    await app.tocar('reporte-compartir');
    expect(compartir).toHaveBeenCalledTimes(1);
    const textoCompartido: string = compartir.mock.calls[0][0];
    expect(textoCompartido).toContain(SIN_CUOTA_MES);
    expect(textoCompartido).toContain('Periodo: Todo tu historial');
  });

  it('spec15_e17 e2e el periodo de Resumen llega a Mi reporte y se puede cambiar', async () => {
    await sembrar(historial());
    const app = await montarApp();
    await abrirResumen(app);
    await elegirPeriodo(app, 'resumen-filtro', 'mesPasado');
    await app.tocar('resumen-mi-reporte');

    expect(app.textoDe('reporte-filtro-etiqueta')).toBe('Periodo: Septiembre 2026');
    await app.tocar('reporte-compartir-pdf');
    const septiembre: string = generar.mock.calls[0][0].html;
    expect(septiembre).toContain('Septiembre 2026');
    expect(septiembre).not.toContain('Rachi');
    expect(septiembre).not.toContain('Agosto');

    await elegirPeriodo(app, 'reporte-filtro', 'mes', '2026-08');
    expect(app.textoDe('reporte-filtro-etiqueta')).toBe('Periodo: Agosto 2026');
    await app.tocar('reporte-compartir');
    const delTexto: string = compartir.mock.calls[0][0];
    expect(delTexto).toContain('Periodo: Agosto 2026');
    expect(delTexto).toContain('Rachi');
    expect(delTexto).not.toContain('Pancita');
  });

  it('spec15_e17 e2e con un periodo sin cierres los botones se desactivan y la ayuda dice por qué', async () => {
    await sembrar([dia('2026-08-10', { rachi: 30 }, 60)]);
    const app = await montarApp();
    await abrirReporte(app);
    expect(desactivado(app, 'reporte-compartir-pdf')).toBe(false);

    await elegirPeriodo(app, 'reporte-filtro', 'esteMes');
    expect(desactivado(app, 'reporte-compartir-pdf')).toBe(true);
    expect(desactivado(app, 'reporte-compartir')).toBe(true);
    expect(app.textoDe('reporte-ayuda-vacio')).toBe(
      'No hay días cerrados en este periodo. Elige otro periodo.',
    );
    await app.tocar('reporte-compartir-pdf');
    await app.tocar('reporte-compartir');
    expect(compartir).not.toHaveBeenCalled();
    expect(generar).not.toHaveBeenCalled();
  });

  // @spec15_e18 — Datos de ejemplo
  it('spec15_e18 los datos de ejemplo resumen los avisa y el reporte los deja fuera', async () => {
    await sembrar([
      dia('2026-09-05', { pancita: 20 }, 40), // propio: S/ 180
      dia('2026-10-05', { anticucho: 10 }, 20), // propio: S/ 100
      dia('2026-08-10', { rachi: 100 }, 0, 'ejemplo'), // ejemplo: S/ 900
    ]);
    const app = await montarApp();
    await abrirResumen(app);

    // Resumen los cuenta, como antes, y lo dice.
    expect(app.textoDe('resumen-aviso-ejemplo-texto')).toContain('Incluye datos de ejemplo');
    expect(leyenda(app).some(t => t.startsWith('Rachi'))).toBe(true);
    // Un periodo sin días de ejemplo no lleva el aviso.
    await elegirPeriodo(app, 'resumen-filtro', 'mesPasado');
    expect(app.existe('resumen-aviso-ejemplo')).toBe(false);

    // El reporte los deja fuera.
    await app.tocar('resumen-mi-reporte');
    await elegirPeriodo(app, 'reporte-filtro', 'todo');
    await app.tocar('reporte-compartir-pdf');
    const html: string = generar.mock.calls[0][0].html;
    expect(html).not.toContain('Rachi');
    expect(html).not.toContain('Agosto');
    expect(html).not.toContain('S/ 900.00');
    expect(app.existe('reporte-aviso-ejemplo')).toBe(false);
  });

  it('spec15_e18 con solo datos de ejemplo el reporte los usa y lo avisa', async () => {
    await sembrar([dia('2026-08-10', { rachi: 100 }, 0, 'ejemplo')]);
    const app = await montarApp();
    await abrirReporte(app);
    expect(app.existe('reporte-aviso-ejemplo')).toBe(true);
    await app.tocar('reporte-compartir-pdf');
    const html: string = generar.mock.calls[0][0].html;
    expect(html).toContain('Datos de ejemplo');
    expect(html).toContain('S/ 900.00');
  });
});
