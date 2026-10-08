/**
 * Pruebas de apoyo de la pantalla "Mi reporte" (no son escenarios del SPEC; los recorridos del
 * SPEC son spec06_e5 y spec06_e6). La app real, por testID, como lo haría una persona. La hoja
 * nativa de compartir nunca se abre: `compartirReporte` está simulado y solo se mira qué recibe.
 * El reloj se fija en el 7 de octubre de 2026: "hoy" no cambia ningún resultado.
 */

import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import App from '../App';
import { colors } from '@theme';
import { restarDias } from '@dominio/fecha';
import { formatoFechaCorta, formatoSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, Perfil } from '@dominio/tipos';
import { htmlReporte, NOMBRE_ARCHIVO_PDF } from '@analisis/htmlReporte';
import { senalesBanco, textoReporte } from '@analisis/senales';
import { compartirReporte } from '@services/compartir';
import { guardarCierre, guardarPerfil } from '@storage/repositorio';

jest.mock('@services/compartir');

const HOY: FechaNegocio = '2026-10-07';
const INSTANTE = '2026-10-07T12:00:00-05:00';
const MENSAJE_ERROR = 'No pudimos abrir la hoja para compartir. Inténtalo otra vez.';
const MENSAJE_ERROR_PDF = 'No pudimos preparar el PDF. Inténtalo otra vez.';
const FOTO = `data:image/jpeg;base64,${'A'.repeat(400)}`;

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

const compartir = compartirReporte as jest.MockedFunction<typeof compartirReporte>;
const generar = jest.mocked(generatePDF);
const abrirHoja = jest.mocked(Share.open);

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  // El arranque (leer el almacenamiento, decidir sobre la semilla) termina en segundo plano.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
  montada = app;

  const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
  const nodoTocable = (testID: string) => {
    const encontrado = app.root.findAll(
      n => n.props.testID === testID && typeof n.props.onPress === 'function',
    )[0];
    if (!encontrado) throw new Error(`No hay nada con testID "${testID}" que responda a onPress`);
    return encontrado;
  };
  const tocar = (testID: string) =>
    act(async () => {
      await nodoTocable(testID).props.onPress();
    });
  // Dos toques seguidos sin esperar el primero: un dedo nervioso.
  const tocarDosVeces = (testID: string) =>
    act(async () => {
      const nodo = nodoTocable(testID);
      const a = nodo.props.onPress();
      const b = nodo.props.onPress();
      await Promise.all([a, b]);
    });
  // Empieza un toque y no lo espera: deja la acción en curso para mirar el estado a medias.
  const empezarToque = (testID: string) =>
    act(async () => {
      nodoTocable(testID).props.onPress();
    });
  const imagen = (testID: string) =>
    app.root.findAll(n => n.props.testID === testID && n.props.source !== undefined)[0];
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const textos = () => app.root.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  // Solo lo que dice esta pantalla: Resumen sigue montado debajo, en el stack.
  const pantalla = () => {
    const encontrada = app.root.findAll(n => n.props.testID === 'reporte-pantalla')[0];
    if (!encontrada) throw new Error('No hay nada con testID "reporte-pantalla"');
    return encontrada;
  };
  const textosDeLaPantalla = () =>
    pantalla()
      .findAll(n => esHost(n, 'Text'))
      .map(textoCompleto);
  const textoNodo = (testID: string) => {
    const encontrado = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!encontrado) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return encontrado;
  };
  const textoDe = (testID: string) => textoCompleto(textoNodo(testID));
  const colorDe = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style).color;
  const tamanoDe = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style).fontSize;
  const vista = (testID: string) => {
    const encontrada = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!encontrada) throw new Error(`No hay ninguna vista con testID "${testID}"`);
    return encontrada;
  };
  const estiloDe = (testID: string) => StyleSheet.flatten(vista(testID).props.style);
  const vistasCon = (prefijo: string) =>
    app.root
      .findAll(n => esHost(n, 'View') && String(n.props.testID ?? '').startsWith(prefijo))
      .map(n => String(n.props.testID));
  // Los testID pedidos, en el orden en que están en pantalla (de arriba hacia abajo), sin repetir.
  const enOrden = (ids: string[]) => {
    const vistos: string[] = [];
    app.root
      .findAll(
        n =>
          (esHost(n, 'Text') || esHost(n, 'View') || esHost(n, 'Image')) &&
          ids.includes(n.props.testID),
      )
      .forEach(n => {
        if (!vistos.includes(n.props.testID)) vistos.push(n.props.testID);
      });
    return vistos;
  };
  const botonDesactivado = (testID: string) =>
    nodoTocable(testID).props.disabled === true ||
    nodoTocable(testID).props.accessibilityState?.disabled === true;

  return {
    tocar,
    tocarDosVeces,
    empezarToque,
    imagen,
    existe,
    textos,
    textosDeLaPantalla,
    textoDe,
    colorDe,
    tamanoDe,
    vista,
    estiloDe,
    vistasCon,
    enOrden,
    botonDesactivado,
  };
};

/** Un cierre de un solo producto a S/ 10.00 la porción y sin sobrantes: venta = vendidas × 10. */
const cierreDe = (fecha: FechaNegocio, vendidas: number, gasto = 0): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [
    {
      productoId: 'p-anticucho',
      nombre: 'Anticucho',
      preparadas: vendidas,
      sobrantes: 0,
      precioUnitario: 10,
      costoUnitario: 8,
    },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
  abreCiclo: false,
  creadoEn: INSTANTE,
  actualizadoEn: INSTANTE,
});

/** Tres meses completos (julio, agosto y septiembre): ventas de 4,900, 5,100 y 5,360. */
const tresMeses = (): Cierre[] => [
  cierreDe('2026-07-03', 245, 1000),
  cierreDe('2026-07-17', 245, 1800),
  cierreDe('2026-08-05', 310, 1500),
  cierreDe('2026-08-19', 200, 1400),
  cierreDe('2026-09-08', 286, 1500),
  cierreDe('2026-09-22', 250, 1620),
  cierreDe('2026-10-05', 120),
];

/** N días seguidos terminando ayer. */
const diasSeguidos = (n: number): Cierre[] =>
  Array.from({ length: n }, (_, i) => cierreDe(restarDias(HOY, i + 1), 20, 100));

const sembrar = async (cierres: Cierre[], perfil?: Perfil) => {
  for (const c of cierres) await guardarCierre(c);
  if (perfil) await guardarPerfil(perfil);
};

const FREDDY: Perfil = {
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  aceptaYape: true,
  yapeAjeno: false,
  actualizadoEn: INSTANTE,
};

const abrirReporte = async (app: Awaited<ReturnType<typeof montarApp>>) => {
  await app.tocar('tab-resumen');
  await app.tocar('resumen-mi-reporte');
};

describe('Mi reporte', () => {
  beforeEach(() => {
    clearAllMockStorages();
    compartir.mockReset();
    compartir.mockResolvedValue({ ok: true });
    jest.useFakeTimers({ doNotFake: [...SIN_FALSEAR], now: new Date('2026-10-07T12:00:00-05:00') });
  });
  afterEach(async () => {
    jest.useRealTimers();
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('el botón de Resumen abre la pantalla con su título y su subtítulo', async () => {
    await sembrar(tresMeses());
    const app = await montarApp();

    await app.tocar('tab-resumen');
    expect(app.existe('resumen-mi-reporte')).toBe(true);
    // Los botones que ya estaban siguen donde estaban.
    expect(app.existe('resumen-que-me-deja')).toBe(true);
    await app.tocar('resumen-mi-reporte');

    expect(app.textosDeLaPantalla()).toContain('Mi reporte');
    expect(app.textosDeLaPantalla()).toContain('Para mostrarle a tu banco');
  });

  it('el botón de Resumen dice "Mi reporte", incluso sin ningún día cerrado', async () => {
    const app = await montarApp();
    await app.tocar('tab-resumen');

    expect(app.existe('resumen-mi-reporte')).toBe(true);
    await app.tocar('resumen-mi-reporte');
    expect(app.existe('reporte-hoja')).toBe(true);
  });

  it('una sola forma de volver: "Atrás" regresa a Resumen', async () => {
    await sembrar(tresMeses());
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.textosDeLaPantalla().filter(t => t === 'Atrás')).toHaveLength(1);
    await app.tocar('reporte-atras');

    expect(app.existe('reporte-hoja')).toBe(false);
    expect(app.existe('resumen-que-me-deja')).toBe(true);
    expect(compartir).not.toHaveBeenCalled();
  });

  it('el aviso de privacidad dice el texto exacto y va antes de la hoja', async () => {
    await sembrar(tresMeses());
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.textoDe('reporte-aviso-privacidad-texto')).toBe(
      'Tú decides qué compartes. Este reporte muestra totales, no tus movimientos uno por uno. Nada se envía si no tocas el botón.',
    );
    // Visible sin scroll: está arriba, antes de la vista previa.
    expect(app.enOrden(['reporte-atras', 'reporte-aviso-privacidad', 'reporte-hoja'])).toEqual([
      'reporte-atras',
      'reporte-aviso-privacidad',
      'reporte-hoja',
    ]);
    expect(app.tamanoDe('reporte-aviso-privacidad-texto')).toBeGreaterThanOrEqual(14);
  });

  it('el aviso de privacidad también va antes de la hoja cuando el reporte está en construcción', async () => {
    await sembrar(diasSeguidos(9));
    const app = await montarApp();
    await abrirReporte(app);

    expect(
      app.enOrden(['reporte-en-construccion', 'reporte-aviso-privacidad', 'reporte-hoja']),
    ).toEqual(['reporte-en-construccion', 'reporte-aviso-privacidad', 'reporte-hoja']);
  });

  it('en construcción (9 días): avisa cuántos días faltan, muestra el progreso, atenúa la hoja y deja compartir', async () => {
    await sembrar(diasSeguidos(9), FREDDY);
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.existe('reporte-en-construccion')).toBe(true);
    expect(app.textoDe('reporte-faltan')).toBe(
      'Te faltan 21 días de registro para que tu reporte sea convincente',
    );
    // La letra del aviso es oscura: el naranja es solo el relleno de la barra.
    expect(app.colorDe('reporte-faltan')).toBe(colors.text);
    expect(app.tamanoDe('reporte-faltan')).toBeGreaterThanOrEqual(14);
    expect(app.existe('reporte-progreso')).toBe(true);
    expect(app.estiloDe('reporte-progreso-relleno').width).toBe('30%');
    expect(app.estiloDe('reporte-progreso-relleno').backgroundColor).toBe(colors.accent);
    // La hoja se ve atenuada, pero el botón sigue activo: él decide.
    expect(app.estiloDe('reporte-hoja').opacity).toBeLessThan(1);
    expect(app.botonDesactivado('reporte-compartir')).toBe(false);
    expect(app.existe('reporte-ayuda-vacio')).toBe(false);

    await app.tocar('reporte-compartir');
    expect(compartir).toHaveBeenCalledTimes(1);
    expect(compartir.mock.calls[0][0]).toContain(
      'Te faltan 21 días de registro para que tu reporte sea convincente',
    );
  });

  it('con un solo día que falta se dice en singular', async () => {
    await sembrar(diasSeguidos(29));
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.textoDe('reporte-faltan')).toBe(
      'Te falta 1 día de registro para que tu reporte sea convincente',
    );
  });

  it('con 30 días o más no hay aviso de construcción y la hoja se ve completa', async () => {
    await sembrar(diasSeguidos(30));
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.existe('reporte-en-construccion')).toBe(false);
    expect(app.existe('reporte-faltan')).toBe(false);
    expect(app.existe('reporte-progreso')).toBe(false);
    expect(app.estiloDe('reporte-hoja').opacity ?? 1).toBe(1);
  });

  it('con 0 días el botón está desactivado, hay una ayuda y no se comparte nada', async () => {
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.botonDesactivado('reporte-compartir')).toBe(true);
    expect(app.textoDe('reporte-ayuda-vacio')).toBe('Cierra tu primer día para armar tu reporte');
    expect(app.tamanoDe('reporte-ayuda-vacio')).toBeGreaterThanOrEqual(14);
    expect(app.textoDe('reporte-faltan')).toBe(
      'Te faltan 30 días de registro para que tu reporte sea convincente',
    );

    await app.tocar('reporte-compartir');
    expect(compartir).not.toHaveBeenCalled();
  });

  it('sin ningún mes completo, las dos cifras dicen "aún no hay un mes completo" y no hay barras', async () => {
    await sembrar(diasSeguidos(9));
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.textoDe('reporte-venta-promedio')).toBe('aún no hay un mes completo');
    expect(app.textoDe('reporte-ganancia-promedio')).toBe('aún no hay un mes completo');
    expect(app.existe('reporte-barras')).toBe(false);
    expect(app.vistasCon('reporte-barra-')).toEqual([]);
  });

  it('la hoja trae el nombre y el negocio del perfil, y omite lo que está vacío', async () => {
    await sembrar(tresMeses(), FREDDY);
    let app = await montarApp();
    await abrirReporte(app);
    expect(app.textos()).toContain('Crecemos');
    expect(app.textos()).toContain('Reporte de actividad del negocio');
    expect(app.textoDe('reporte-quien')).toBe('Freddy · Anticuchos Freddy');
    await act(async () => montada?.unmount());
    montada = null;

    await guardarPerfil({ ...FREDDY, negocio: '' });
    app = await montarApp();
    await abrirReporte(app);
    expect(app.textoDe('reporte-quien')).toBe('Freddy');
    await act(async () => montada?.unmount());
    montada = null;

    await guardarPerfil({ ...FREDDY, nombre: '', negocio: '  ' });
    app = await montarApp();
    await abrirReporte(app);
    expect(app.existe('reporte-quien')).toBe(false);
  });

  it('la hoja y el texto compartido no llevan el Yape, el titular, el parentesco ni la ubicación', async () => {
    const perfil: Perfil = {
      ...FREDDY,
      ubicacion: 'Av. Los Olivos 123',
      aceptaYape: true,
      yapeAjeno: true,
      yapeNumero: '987654321',
      yapeTitular: 'Rosa Quispe',
      yapeParentesco: 'hermana',
    };
    await sembrar(tresMeses(), perfil);
    const app = await montarApp();
    await abrirReporte(app);

    const prohibidos = ['987654321', 'Rosa', 'Quispe', 'hermana', 'Olivos'];
    const hoja = app.textosDeLaPantalla().join('\n');
    for (const dato of prohibidos) expect(hoja).not.toContain(dato);

    await app.tocar('reporte-compartir');
    const enviado = compartir.mock.calls[0][0];
    expect(enviado).toContain('Freddy · Anticuchos Freddy');
    for (const dato of prohibidos) expect(enviado).not.toContain(dato);
  });

  it('los tres datos de la hoja coinciden con las señales y con el texto compartido', async () => {
    const cierres = tresMeses();
    await sembrar(cierres, FREDDY);
    const app = await montarApp();
    await abrirReporte(app);

    const s = senalesBanco(cierres, HOY);
    expect(app.textoDe('reporte-venta-promedio')).toBe('S/ 5,120.00');
    expect(app.textoDe('reporte-venta-promedio')).toBe(formatoSoles(s.ventaPromedioMensual));
    expect(app.textoDe('reporte-ganancia-promedio')).toBe('S/ 2,180.00');
    expect(app.textoDe('reporte-ganancia-promedio')).toBe(formatoSoles(s.gananciaPromedioMensual));
    // La constancia siempre lleva su cifra de días al lado.
    expect(app.textoDe('reporte-constancia')).toBe(
      `${s.constancia} % · ${s.diasRegistrados} ${
        s.diasRegistrados === 1 ? 'día registrado' : 'días registrados'
      }`,
    );
    expect(app.textosDeLaPantalla()).toContain('Venta promedio mensual');
    expect(app.textosDeLaPantalla()).toContain('Ganancia promedio mensual');
    expect(app.textosDeLaPantalla()).toContain('Constancia de registro');

    await app.tocar('reporte-compartir');
    const enviado = compartir.mock.calls[0][0];
    expect(enviado).toBe(textoReporte(s, FREDDY));
    expect(enviado).toContain('Venta promedio mensual: S/ 5,120.00');
    expect(enviado).toContain('Ganancia promedio mensual: S/ 2,180.00');
  });

  it('el periodo y el pie dicen las fechas en palabras, con los días registrados', async () => {
    // Nueve días seguidos: del 28 de septiembre al 6 de octubre.
    await sembrar(diasSeguidos(9));
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.textoDe('reporte-periodo')).toBe(
      '28 de septiembre — 6 de octubre · 9 días registrados',
    );
    expect(app.textoDe('reporte-pie')).toBe(
      '9 cierres de día registrados entre el 28 de septiembre y el 6 de octubre',
    );
    expect(app.tamanoDe('reporte-pie')).toBeGreaterThanOrEqual(14);
  });

  it('el pie coincide con las señales cuando hay meses completos', async () => {
    const cierres = tresMeses();
    await sembrar(cierres);
    const app = await montarApp();
    await abrirReporte(app);

    const s = senalesBanco(cierres, HOY);
    expect(app.textoDe('reporte-pie')).toBe(
      `${s.diasRegistrados} cierres de día registrados entre el ${formatoFechaCorta(
        s.primerCierre as string,
      )} y el ${formatoFechaCorta(s.ultimoCierre as string)}`,
    );
  });

  it('con un solo día registrado, el pie y el periodo van en singular', async () => {
    await sembrar([cierreDe('2026-10-05', 20)]);
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.textoDe('reporte-periodo')).toBe('5 de octubre · 1 día registrado');
    expect(app.textoDe('reporte-pie')).toBe('1 cierre de día registrado el 5 de octubre');
  });

  it('sin ningún día registrado no hay pie con el check', async () => {
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.existe('reporte-pie')).toBe(false);
    expect(app.textoDe('reporte-periodo')).toBe('Todavía no hay días registrados');
  });

  it('el gráfico dibuja una barra por mes completo, con el monto encima y el mayor al 100 %', async () => {
    await sembrar(tresMeses());
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.existe('reporte-barras')).toBe(true);
    expect(app.vistasCon('reporte-barra-')).toEqual([
      'reporte-barra-2026-07',
      'reporte-barra-2026-08',
      'reporte-barra-2026-09',
    ]);
    // El mes en tres letras y el monto en soles de cada mes.
    expect(app.textoDe('reporte-mes-2026-07')).toBe('Jul');
    expect(app.textoDe('reporte-mes-2026-08')).toBe('Ago');
    expect(app.textoDe('reporte-mes-2026-09')).toBe('Sep');
    expect(app.textoDe('reporte-monto-2026-07')).toBe('S/ 4,900.00');
    expect(app.textoDe('reporte-monto-2026-08')).toBe('S/ 5,100.00');
    expect(app.textoDe('reporte-monto-2026-09')).toBe('S/ 5,360.00');
    // Proporcional al mayor (septiembre, 5,360).
    expect(app.estiloDe('reporte-barra-2026-09').height).toBe('100%');
    expect(app.estiloDe('reporte-barra-2026-08').height).toBe('95%');
    expect(app.estiloDe('reporte-barra-2026-07').height).toBe('91%');
    // El monto va encima de la barra, en el orden de la pantalla.
    expect(app.enOrden(['reporte-monto-2026-09', 'reporte-barra-2026-09'])).toEqual([
      'reporte-monto-2026-09',
      'reporte-barra-2026-09',
    ]);
  });

  it('con un solo mes completo, una sola barra al 100 %', async () => {
    await sembrar([
      cierreDe('2026-09-02', 100, 300),
      cierreDe('2026-09-20', 100, 300),
      cierreDe('2026-10-02', 50),
    ]);
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.vistasCon('reporte-barra-')).toEqual(['reporte-barra-2026-09']);
    expect(app.estiloDe('reporte-barra-2026-09').height).toBe('100%');
    expect(app.textoDe('reporte-monto-2026-09')).toBe('S/ 2,000.00');
  });

  it('ningún porcentaje aparece sin su cifra de días al lado', async () => {
    for (const cierres of [tresMeses(), diasSeguidos(9)]) {
      clearAllMockStorages();
      await sembrar(cierres);
      const app = await montarApp();
      await abrirReporte(app);

      const conPorcentaje = app.textosDeLaPantalla().filter(t => t.includes('%'));
      expect(conPorcentaje.length).toBeGreaterThan(0);
      for (const texto of conPorcentaje) expect(texto).toMatch(/\d+ días? registrados?/);
      await act(async () => montada?.unmount());
      montada = null;
    }
  });

  it('un solo botón principal, con su texto, de 56 dp, fijo fuera del scroll', async () => {
    await sembrar(tresMeses());
    const app = await montarApp();
    await abrirReporte(app);

    expect(app.textosDeLaPantalla().filter(t => t === 'Compartir reporte')).toHaveLength(1);
    expect(app.estiloDe('reporte-compartir').height).toBeGreaterThanOrEqual(48);
    // El pie con el botón no está dentro del ScrollView.
    const pantalla = montada?.root.findAll(n => n.props.testID === 'reporte-pantalla')[0];
    const scroll = pantalla?.findAll(n => (n.type as unknown) === 'RCTScrollView')[0];
    expect(scroll).toBeDefined();
    expect(scroll?.findAll(n => n.props.testID === 'reporte-compartir')).toHaveLength(0);
    expect(scroll?.findAll(n => n.props.testID === 'reporte-hoja').length).toBeGreaterThan(0);
  });

  it('el naranja nunca es el color de ningún texto y nada baja de 14 px', async () => {
    await sembrar(diasSeguidos(9), FREDDY);
    const app = await montarApp();
    await abrirReporte(app);

    const textosPantalla = montada?.root
      .findAll(n => n.props.testID === 'reporte-pantalla')[0]
      .findAll(n => (n.type as unknown) === 'Text');
    expect(textosPantalla?.length).toBeGreaterThan(5);
    for (const t of textosPantalla ?? []) {
      const estilo = StyleSheet.flatten(t.props.style);
      expect(estilo.color).not.toBe(colors.accent);
      expect(estilo.fontSize).toBeGreaterThanOrEqual(14);
    }
  });

  it('nada se comparte al abrir y un toque es una sola llamada', async () => {
    await sembrar(tresMeses(), FREDDY);
    const app = await montarApp();
    await abrirReporte(app);
    expect(compartir).not.toHaveBeenCalled();

    await app.tocar('reporte-compartir');
    expect(compartir).toHaveBeenCalledTimes(1);
    expect(compartir).toHaveBeenCalledWith(textoReporte(senalesBanco(tresMeses(), HOY), FREDDY));
    expect(app.existe('reporte-error-compartir')).toBe(false);
  });

  it('dos toques seguidos mientras la hoja se abre son una sola llamada', async () => {
    let abrir!: (r: { ok: true }) => void;
    compartir.mockImplementation(
      () =>
        new Promise(resolver => {
          abrir = resolver;
        }),
    );
    await sembrar(tresMeses());
    const app = await montarApp();
    await abrirReporte(app);

    await act(async () => {
      const nodo = montada?.root.findAll(
        n => n.props.testID === 'reporte-compartir' && typeof n.props.onPress === 'function',
      )[0] as ReactTestInstance;
      const a = nodo.props.onPress();
      const b = nodo.props.onPress();
      abrir({ ok: true });
      await Promise.all([a, b]);
    });

    expect(compartir).toHaveBeenCalledTimes(1);
    // Ya terminó: un toque nuevo vuelve a compartir.
    compartir.mockResolvedValue({ ok: true });
    await app.tocar('reporte-compartir');
    expect(compartir).toHaveBeenCalledTimes(2);
  });

  it('si la hoja no se puede abrir, dice un mensaje amable y ningún texto técnico', async () => {
    compartir.mockResolvedValue({ ok: false, error: 'NO_SE_PUDO_ABRIR' });
    await sembrar(tresMeses());
    const app = await montarApp();
    await abrirReporte(app);
    expect(app.existe('reporte-error-compartir')).toBe(false);

    await app.tocar('reporte-compartir');

    expect(app.textoDe('reporte-error-compartir')).toBe(MENSAJE_ERROR);
    expect(app.colorDe('reporte-error-compartir')).toBe(colors.danger);
    expect(app.tamanoDe('reporte-error-compartir')).toBeGreaterThanOrEqual(14);
    for (const texto of app.textosDeLaPantalla()) {
      expect(texto).not.toMatch(/NO_SE_PUDO_ABRIR|Error|Exception|undefined|\bnull\b/);
    }
    // Y el botón sigue ahí para intentarlo otra vez; al lograrlo, el mensaje se va.
    compartir.mockResolvedValue({ ok: true });
    await app.tocar('reporte-compartir');
    expect(compartir).toHaveBeenCalledTimes(2);
    expect(app.existe('reporte-error-compartir')).toBe(false);
  });

  it('si compartir lanza una excepción, tampoco llega un mensaje técnico a la pantalla', async () => {
    compartir.mockRejectedValue(new Error('boom: SHARE_FAILED'));
    await sembrar(tresMeses());
    const app = await montarApp();
    await abrirReporte(app);

    await app.tocar('reporte-compartir');

    expect(app.textoDe('reporte-error-compartir')).toBe(MENSAJE_ERROR);
    const todo = app.textosDeLaPantalla().join('\n');
    expect(todo).not.toContain('boom');
    expect(todo).not.toContain('SHARE_FAILED');
  });

  it('cerrar la hoja sin compartir no es un error', async () => {
    // El servicio devuelve ok también cuando la persona cierra la hoja: la pantalla no se queja.
    compartir.mockResolvedValue({ ok: true });
    await sembrar(tresMeses());
    const app = await montarApp();
    await abrirReporte(app);

    await app.tocar('reporte-compartir');

    expect(app.existe('reporte-error-compartir')).toBe(false);
  });

  it('abrir el reporte no hace ninguna petición de red', async () => {
    const fetchSimulado = global.fetch as jest.Mock;
    fetchSimulado.mockClear();
    await sembrar(tresMeses());
    const app = await montarApp();
    await abrirReporte(app);
    await app.tocar('reporte-compartir');

    expect(fetchSimulado).not.toHaveBeenCalled();
  });
  describe('el PDF', () => {
    const FILE = '/tmp/prueba.pdf';
    const senalesDeTresMeses = () => senalesBanco(tresMeses(), HOY);

    beforeEach(() => {
      generar.mockReset();
      generar.mockResolvedValue({ filePath: FILE });
      abrirHoja.mockReset();
      abrirHoja.mockResolvedValue({ success: true } as Awaited<ReturnType<typeof Share.open>>);
    });

    it('al abrir la pantalla no se genera ni se comparte nada', async () => {
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      expect(generar).not.toHaveBeenCalled();
      expect(abrirHoja).not.toHaveBeenCalled();
      expect(compartir).not.toHaveBeenCalled();
    });

    it('el botón principal dice "Compartir reporte" y prepara y comparte el PDF', async () => {
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      expect(app.textosDeLaPantalla().filter(t => t === 'Compartir reporte')).toHaveLength(1);
      await app.tocar('reporte-compartir-pdf');

      expect(generar).toHaveBeenCalledTimes(1);
      const opciones = generar.mock.calls[0][0];
      expect(opciones.html).toBe(htmlReporte(senalesDeTresMeses(), FREDDY, HOY));
      expect(opciones.fileName).toBe(NOMBRE_ARCHIVO_PDF(HOY));
      expect(opciones.fileName).toBe('Reporte-Crecemos-2026-10-07');
      expect(abrirHoja).toHaveBeenCalledTimes(1);
      expect(abrirHoja).toHaveBeenCalledWith({
        url: `file://${FILE}`,
        type: 'application/pdf',
        title: 'Reporte de actividad del negocio',
        failOnCancel: false,
      });
      // El PDF no es el texto: el flujo del Sprint-06 no se toca.
      expect(compartir).not.toHaveBeenCalled();
      expect(app.existe('reporte-error-compartir')).toBe(false);
    });

    it('el documento del PDF lleva solo totales: ni Yape, ni titular, ni ubicación', async () => {
      const perfil: Perfil = {
        ...FREDDY,
        ubicacion: 'Av. Los Olivos 123',
        yapeAjeno: true,
        yapeNumero: '987654321',
        yapeTitular: 'Rosa Quispe',
        yapeParentesco: 'hermana',
      };
      await sembrar(tresMeses(), perfil);
      const app = await montarApp();
      await abrirReporte(app);

      await app.tocar('reporte-compartir-pdf');

      const html = generar.mock.calls[0][0].html;
      for (const dato of ['987654321', 'Rosa', 'Quispe', 'hermana', 'Olivos']) {
        expect(html).not.toContain(dato);
      }
      expect(html).toContain('S/ 5,120.00');
    });

    it('mientras prepara, el botón dice "Preparando tu reporte…" y está desactivado', async () => {
      let terminar!: (r: { filePath: string }) => void;
      generar.mockImplementation(
        () =>
          new Promise(resolver => {
            terminar = resolver;
          }),
      );
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);
      expect(app.botonDesactivado('reporte-compartir-pdf')).toBe(false);

      await app.empezarToque('reporte-compartir-pdf');

      expect(app.textosDeLaPantalla()).toContain('Preparando tu reporte…');
      expect(app.textosDeLaPantalla()).not.toContain('Compartir reporte');
      expect(app.botonDesactivado('reporte-compartir-pdf')).toBe(true);
      expect(abrirHoja).not.toHaveBeenCalled();

      await act(async () => {
        terminar({ filePath: FILE });
        await new Promise(resolver => setTimeout(resolver, 0));
      });

      // Listo: el botón vuelve a su texto y se puede usar otra vez.
      expect(abrirHoja).toHaveBeenCalledTimes(1);
      expect(app.textosDeLaPantalla()).toContain('Compartir reporte');
      expect(app.textosDeLaPantalla()).not.toContain('Preparando tu reporte…');
      expect(app.botonDesactivado('reporte-compartir-pdf')).toBe(false);
    });

    it('un solo toque es una sola generación: dos toques seguidos no preparan dos PDF', async () => {
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      await app.tocarDosVeces('reporte-compartir-pdf');

      expect(generar).toHaveBeenCalledTimes(1);
      expect(abrirHoja).toHaveBeenCalledTimes(1);
      // Ya terminó: un toque nuevo vuelve a generar.
      await app.tocar('reporte-compartir-pdf');
      expect(generar).toHaveBeenCalledTimes(2);
    });

    it('un toque mientras prepara no hace nada', async () => {
      generar.mockImplementation(() => new Promise(() => undefined));
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      await app.empezarToque('reporte-compartir-pdf');
      await app.tocar('reporte-compartir-pdf');
      await app.tocar('reporte-compartir');

      expect(generar).toHaveBeenCalledTimes(1);
      expect(compartir).not.toHaveBeenCalled();
    });

    it('si no se puede preparar, dice un mensaje amable y ningún texto técnico', async () => {
      generar.mockRejectedValue(new Error('boom: PDF_FAILED NO_SE_PUDO_PREPARAR'));
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);
      expect(app.existe('reporte-error-compartir')).toBe(false);

      await app.tocar('reporte-compartir-pdf');

      expect(app.textoDe('reporte-error-compartir')).toBe(MENSAJE_ERROR_PDF);
      expect(app.colorDe('reporte-error-compartir')).toBe(colors.danger);
      expect(app.tamanoDe('reporte-error-compartir')).toBeGreaterThanOrEqual(14);
      expect(abrirHoja).not.toHaveBeenCalled();
      const todo = app.textosDeLaPantalla().join('\n');
      expect(todo).not.toMatch(/boom|PDF_FAILED|NO_SE_PUDO|Error|Exception|undefined|\bnull\b/);
      // El botón vuelve a estar a la mano; al lograrlo, el mensaje se va.
      expect(app.textosDeLaPantalla()).toContain('Compartir reporte');
      expect(app.botonDesactivado('reporte-compartir-pdf')).toBe(false);
      generar.mockResolvedValue({ filePath: FILE });
      await app.tocar('reporte-compartir-pdf');
      expect(abrirHoja).toHaveBeenCalledTimes(1);
      expect(app.existe('reporte-error-compartir')).toBe(false);
    });

    it('si la hoja no se puede abrir, dice el mensaje de la hoja y nada técnico', async () => {
      abrirHoja.mockRejectedValue(new Error('boom: SHARE_FAILED'));
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      await app.tocar('reporte-compartir-pdf');

      expect(app.textoDe('reporte-error-compartir')).toBe(MENSAJE_ERROR);
      const todo = app.textosDeLaPantalla().join('\n');
      expect(todo).not.toMatch(/boom|SHARE_FAILED|NO_SE_PUDO|Error|Exception/);
    });

    it('cerrar la hoja sin compartir no muestra nada', async () => {
      abrirHoja.mockResolvedValue({ success: false, dismissedAction: true } as Awaited<
        ReturnType<typeof Share.open>
      >);
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      await app.tocar('reporte-compartir-pdf');

      expect(app.existe('reporte-error-compartir')).toBe(false);
      expect(app.textosDeLaPantalla()).toContain('Compartir reporte');
    });

    it('debajo del principal hay un botón secundario "Compartir solo el texto" con el flujo del Sprint-06', async () => {
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      expect(app.textosDeLaPantalla()).toContain('Compartir solo el texto');
      expect(app.enOrden(['reporte-compartir-pdf', 'reporte-compartir'])).toEqual([
        'reporte-compartir-pdf',
        'reporte-compartir',
      ]);
      expect(app.estiloDe('reporte-compartir').height).toBeGreaterThanOrEqual(48);

      await app.tocar('reporte-compartir');

      expect(compartir).toHaveBeenCalledTimes(1);
      expect(compartir).toHaveBeenCalledWith(textoReporte(senalesDeTresMeses(), FREDDY));
      expect(generar).not.toHaveBeenCalled();
      expect(abrirHoja).not.toHaveBeenCalled();
    });

    it('los dos botones y el texto de ayuda van en el pie fijo, fuera del scroll', async () => {
      await sembrar(tresMeses());
      const app = await montarApp();
      await abrirReporte(app);

      const pantalla = montada?.root.findAll(n => n.props.testID === 'reporte-pantalla')[0];
      const scroll = pantalla?.findAll(n => (n.type as unknown) === 'RCTScrollView')[0];
      expect(scroll).toBeDefined();
      for (const id of ['reporte-compartir-pdf', 'reporte-compartir', 'reporte-ayuda-pdf']) {
        expect(app.existe(id)).toBe(true);
        expect(scroll?.findAll(n => n.props.testID === id)).toHaveLength(0);
      }
      expect(app.estiloDe('reporte-compartir-pdf').height).toBeGreaterThanOrEqual(48);
    });

    it('el texto de ayuda dice que el PDF lleva solo totales, atenuado y de 14 px o más', async () => {
      await sembrar(tresMeses());
      const app = await montarApp();
      await abrirReporte(app);

      expect(app.textoDe('reporte-ayuda-pdf')).toBe(
        'El PDF lleva solo totales. No lleva tu Yape ni tus movimientos.',
      );
      expect(app.colorDe('reporte-ayuda-pdf')).toBe(colors.textMuted);
      expect(app.tamanoDe('reporte-ayuda-pdf')).toBeGreaterThanOrEqual(14);
      expect(app.enOrden(['reporte-compartir', 'reporte-ayuda-pdf'])).toEqual([
        'reporte-compartir',
        'reporte-ayuda-pdf',
      ]);
    });

    it('el aviso de privacidad de arriba no cambia', async () => {
      await sembrar(tresMeses());
      const app = await montarApp();
      await abrirReporte(app);

      expect(app.textoDe('reporte-aviso-privacidad-texto')).toBe(
        'Tú decides qué compartes. Este reporte muestra totales, no tus movimientos uno por uno. Nada se envía si no tocas el botón.',
      );
    });

    it('con foto de perfil, la hoja de pantalla muestra la foto circular', async () => {
      await sembrar(tresMeses(), { ...FREDDY, fotoUri: FOTO });
      const app = await montarApp();
      await abrirReporte(app);

      expect(app.imagen('reporte-avatar-foto').props.source).toEqual({ uri: FOTO });
      // La foto va dentro de la hoja, junto al nombre, que sigue ahí.
      expect(app.enOrden(['reporte-hoja', 'reporte-avatar-foto', 'reporte-quien'])).toEqual([
        'reporte-hoja',
        'reporte-avatar-foto',
        'reporte-quien',
      ]);
      expect(app.textoDe('reporte-quien')).toBe('Freddy · Anticuchos Freddy');

      await app.tocar('reporte-compartir-pdf');
      expect(generar.mock.calls[0][0].html).toContain(`<img class="foto" src="${FOTO}" alt="">`);
    });

    it('sin foto, la hoja de pantalla no muestra ningún círculo', async () => {
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      expect(app.existe('reporte-avatar-foto')).toBe(false);
      expect(app.textoDe('reporte-quien')).toBe('Freddy · Anticuchos Freddy');
    });

    it('con 0 días los dos botones están desactivados y no se genera nada', async () => {
      const app = await montarApp();
      await abrirReporte(app);

      expect(app.botonDesactivado('reporte-compartir-pdf')).toBe(true);
      expect(app.botonDesactivado('reporte-compartir')).toBe(true);
      expect(app.textoDe('reporte-ayuda-vacio')).toBe('Cierra tu primer día para armar tu reporte');

      await app.tocar('reporte-compartir-pdf');
      await app.tocar('reporte-compartir');

      expect(generar).not.toHaveBeenCalled();
      expect(abrirHoja).not.toHaveBeenCalled();
      expect(compartir).not.toHaveBeenCalled();
    });

    it('en construcción el PDF sigue activo y avisa cuántos días faltan', async () => {
      await sembrar(diasSeguidos(9), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      expect(app.botonDesactivado('reporte-compartir-pdf')).toBe(false);
      await app.tocar('reporte-compartir-pdf');

      const html = generar.mock.calls[0][0].html;
      expect(html).toContain('Te faltan 21 días de registro para que tu reporte sea convincente');
      expect(html).toContain('opacity');
    });

    it('generar el PDF no hace ninguna petición de red', async () => {
      const fetchSimulado = global.fetch as jest.Mock;
      fetchSimulado.mockClear();
      await sembrar(tresMeses(), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      await app.tocar('reporte-compartir-pdf');

      expect(fetchSimulado).not.toHaveBeenCalled();
    });

    it('ningún texto del pie baja de 14 px ni usa el naranja', async () => {
      await sembrar(diasSeguidos(9), FREDDY);
      const app = await montarApp();
      await abrirReporte(app);

      const textos = montada?.root
        .findAll(n => n.props.testID === 'reporte-pantalla')[0]
        .findAll(n => (n.type as unknown) === 'Text');
      for (const t of textos ?? []) {
        const estilo = StyleSheet.flatten(t.props.style);
        expect(estilo.fontSize).toBeGreaterThanOrEqual(14);
        expect(estilo.color).not.toBe(colors.accent);
      }
    });
  });
});
