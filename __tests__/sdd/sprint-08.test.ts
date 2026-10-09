/**
 * Tests del Sprint-08. Generados desde sdd/spec/Sprint-08-jev/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../../App';
import { colors } from '@theme';
import { JEV_URL, SEED_URL } from '../../src/config';
import { fechaLocal } from '@dominio/fecha';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type {
  Cierre,
  Consulta,
  ContextoAnalisis,
  FechaNegocio,
  Gasto,
  Hecho,
  LineaCierre,
  Perfil,
  Producto,
} from '@dominio/tipos';
import {
  interpretarRespuesta,
  PREGUNTAS_SUGERIDAS,
  responderConsulta,
} from '@analisis/intenciones';
import {
  armarHechoParaJuicio,
  ETIQUETA_SEMAFORO,
  interpretarJuicio,
  senalesDeJuicio,
  SIMBOLO_SEMAFORO,
} from '@analisis/semaforo';
import { extraerCifras, validarRedaccion } from '@analisis/validarRedaccion';
import { consultar, redactarRespuesta } from '@services/jev';
import { PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarCierre, guardarPerfil } from '@storage/repositorio';

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

const ctxDe = (cierres: Cierre[], productos: Producto[] = [], hoy: FechaNegocio = HOY): ContextoAnalisis => ({
  cierres,
  productos,
  hoy,
});

// "Jev interpreta la pregunta como la intención X": la respuesta ya parseada del clasificador.
const jevInterpreta = (respuesta: unknown): Consulta => {
  const consulta = interpretarRespuesta(respuesta);
  if (consulta === null) throw new Error('El clasificador no devolvió una consulta válida');
  return consulta;
};

// --- Apoyo de e7, e8 y e10: un servidor intermedio simulado -------------------------------------

const URL_JEV = 'https://asistente.ejemplo.test';
const RUTA_SEMILLA = join(__dirname, '..', '..', 'seed', 'semilla.json');

const respuestaJson = (cuerpo: unknown, ok = true, status = 200) =>
  ({ ok, status, text: async () => JSON.stringify(cuerpo) } as unknown as Response);

/** Lo que responde el servidor a "interpretar": la intención ya clasificada. */
const interpretacion = (intencion: string, dia = 'ninguno') => ({
  intencion,
  producto: 'ninguno',
  dia,
  confianza: 0.95,
  modelo: 'typesafe/jev-1.13-20260917',
});

type Llamada = [string, { method?: string; headers?: Record<string, string>; body?: string }];

/** Las peticiones que recibió el fetch simulado, tal como salieron de la app. */
const llamadasDe = (fetchSim: jest.Mock): Llamada[] => fetchSim.mock.calls as unknown as Llamada[];

/** La app de Freddy con los datos de ejemplo: el perfil, los productos y los 75 cierres. */
const datosDeFreddy = () => {
  const validada = validarSemilla(JSON.parse(readFileSync(RUTA_SEMILLA, 'utf8')));
  if (!validada.ok) throw new Error('La semilla del repositorio no valida');
  const { cierres, productos } = materializarSemilla(validada.semilla, ahora);
  const perfil: Perfil = {
    nombre: 'Freddy',
    negocio: 'Anticuchos El Buen Sabor',
    ubicacion: 'Mercado de Surquillo',
    aceptaYape: true,
    yapeAjeno: true,
    yapeNumero: '987654321',
    yapeTitular: 'Rosa',
    yapeParentesco: 'esposa',
    actualizadoEn: ahora.toISOString(),
  };
  return { cierres, productos, perfil, hoy: fechaLocal(ahora) };
};

/** Nada de lo que es de Freddy (perfil y cierres) aparece en lo que salió por la red. */
const noFiltraNadaDeFreddy = (salida: string, cierres: Cierre[], perfil: Perfil) => {
  for (const privado of [
    perfil.nombre,
    perfil.negocio,
    perfil.ubicacion,
    perfil.yapeNumero,
    perfil.yapeTitular,
    perfil.yapeParentesco,
    'montoYape',
    'yapePendiente',
    'lineas',
    'gastos',
    'Authorization',
  ]) {
    expect(salida).not.toContain(privado);
  }
  for (const cierre of cierres) {
    expect(salida).not.toContain(cierre.id);
    expect(salida).not.toContain(cierre.fecha);
  }
};

/** Una venta de ayer de S/ 205.00 y la frase fija que el código arma con ella. */
const FRASE_AYER = 'Ayer, martes 6 de octubre, vendiste S/ 205.00.';
const ventaDeAyer = (): ContextoAnalisis =>
  ctxDe([
    cierreDe('2026-10-06', {
      lineas: [linea('Anticucho', 7, 0, 10, 8.2), linea('Pancita', 15, 0, 9, 8)],
    }),
  ]);

const CODIGOS_TECNICOS = /SIN_RED|TIEMPO_AGOTADO|RESPUESTA_INVALIDA|REDACCION_DESCARTADA|NO_DISPONIBLE|Network|Abort|HTTP|\b5\d\d\b|undefined|error/i;


// --- Apoyo de e11 y e17: un servidor intermedio que contesta según el tipo de petición ------------

/** Lo que contesta el servidor a "juzgar": el semáforo y su confianza. */
const juicioDe = (semaforo: string | null, confianza: number) => ({
  semaforo,
  confianza,
  modelo: 'typesafe/jev-1.13-20260917',
});

/** El ciclo anterior le dejó S/ 269 y el actual S/ 191: "Ganaste S/ 78.00 menos que el ciclo pasado." */
const ctxCompararCiclo = (): ContextoAnalisis =>
  ctxDe([
    cierreDe('2026-09-14', {
      abreCiclo: true,
      lineas: [linea('Anticucho', 40, 0, 10, 8)],
      gastos: [{ categoria: 'mercaderia', monto: 131 }],
    }),
    cierreDe('2026-09-28', {
      abreCiclo: true,
      lineas: [linea('Anticucho', 30, 0, 10, 8)],
      gastos: [{ categoria: 'mercaderia', monto: 109 }],
    }),
  ]);
const FRASE_CICLO = 'Ganaste S/ 78.00 menos que el ciclo pasado.';
const REDACCION_CICLO = 'Este ciclo te quedaron S/ 78.00 menos que en el pasado.';

interface ServidorSimulado {
  fetch: jest.Mock;
  /** Los tipos de petición que llegaron, en orden. */
  tipos: () => string[];
  /** Cuántas peticiones estuvieron en vuelo a la vez, como máximo. */
  simultaneas: () => number;
}

/** Un servidor que contesta a `interpretar`, `redactar` y `juzgar`; cada respuesta tarda un instante. */
const servidorSimulado = (
  contesta: Record<'interpretar' | 'redactar' | 'juzgar', () => Promise<Response>>,
): ServidorSimulado => {
  let enVuelo = 0;
  let maximo = 0;
  const f = jest.fn(async (_url: string, init: { body?: string }) => {
    const tipo = JSON.parse(init.body ?? '{}').tipo as 'interpretar' | 'redactar' | 'juzgar';
    enVuelo += 1;
    maximo = Math.max(maximo, enVuelo);
    try {
      await new Promise(resolver => setTimeout(resolver, 0));
      return await contesta[tipo]();
    } finally {
      enVuelo -= 1;
    }
  });
  return {
    fetch: f,
    tipos: () => llamadasDe(f).map(([, init]) => JSON.parse(init.body ?? '{}').tipo),
    simultaneas: () => maximo,
  };
};
const responde = (cuerpo: unknown) => () => Promise.resolve(respuestaJson(cuerpo));

// --- Apoyo de e5, e6, e12, e13, e14 y e18: la app real, montada como en el teléfono ---------------

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarApp = async () => {
  await act(async () => {
    montada = ReactTestRenderer.create(createElement(App));
  });
  // El arranque (leer el almacenamiento, pedir la semilla) termina en segundo plano.
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
const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
const tocar = (testID: string) =>
  act(async () => {
    const nodo = raiz().findAll(
      n => n.props.testID === testID && typeof n.props.onPress === 'function',
    )[0];
    if (!nodo) throw new Error(`No hay nada con testID "${testID}" que responda a onPress`);
    await nodo.props.onPress();
  });
const escribir = (testID: string, texto: string) =>
  act(async () => {
    const nodo = raiz().findAll(
      n => n.props.testID === testID && typeof n.props.onChangeText === 'function',
    )[0];
    if (!nodo) throw new Error(`No hay ningún campo con testID "${testID}"`);
    nodo.props.onChangeText(texto);
  });
const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');
const hayNodo = (testID: string): boolean => raiz().findAll(n => n.props.testID === testID).length > 0;
/** Los textos de lo que hay dentro del nodo con ese testID, de arriba hacia abajo. */
const textosEn = (testID: string): string[] => {
  const dentro = raiz().findAll(n => n.props.testID === testID)[0];
  if (!dentro) throw new Error(`No hay nada con testID "${testID}"`);
  return dentro.findAll(n => esHost(n, 'Text')).map(textoCompleto);
};
const textoNodo = (testID: string): ReactTestInstance => {
  const nodo = raiz().findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
  if (!nodo) throw new Error(`No hay ningún texto con testID "${testID}"`);
  return nodo;
};
const textoDe = (testID: string): string => textoCompleto(textoNodo(testID));
const estiloDeTexto = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style);
const estiloDeVista = (testID: string) => {
  const vista = raiz().findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
  if (!vista) throw new Error(`No hay ninguna vista con testID "${testID}"`);
  return StyleSheet.flatten(vista.props.style);
};
/** Los testID que empiezan así (vistas), en el orden en que están en pantalla. */
const vistasCon = (patron: RegExp): string[] =>
  raiz()
    .findAll(n => esHost(n, 'View') && patron.test(String(n.props.testID ?? '')))
    .map(n => String(n.props.testID));
/** Posición de un testID entre todos los nodos, de arriba hacia abajo (para comparar el orden). */
const posicionDe = (testID: string): number =>
  raiz()
    .findAll(() => true)
    .findIndex(n => n.props.testID === testID);

// Todos los temporizadores quedan reales (la app y el almacenamiento esperan promesas de verdad);
// solo el reloj se fija, como en spec06_e6.
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

type TipoChat = 'interpretar' | 'redactar' | 'juzgar';
interface CuerpoChat {
  tipo: TipoChat;
  texto?: string;
  hecho?: { frase: string; cifras: string[] };
}
interface RedDeLaApp {
  fetch: jest.Mock;
  /** Los tipos de petición que llegaron al servidor del chat, en orden. */
  tiposDelChat: () => string[];
}

/** La red de la app: la semilla en SEED_URL y el servidor del chat en JEV_URL. Lo demás, sin red. */
const redDeLaApp = (
  semilla: string | null,
  chat: Partial<Record<TipoChat, (cuerpo: CuerpoChat) => Response>> = {},
): RedDeLaApp => {
  const sinRed = () => new TypeError('Network request failed');
  const f = jest.fn(async (url: string, init?: { body?: string }) => {
    if (url === SEED_URL) {
      if (semilla === null) throw sinRed();
      return { ok: true, status: 200, text: async () => semilla } as unknown as Response;
    }
    if (url === JEV_URL) {
      const cuerpo = JSON.parse(init?.body ?? '{}') as CuerpoChat;
      const responder = chat[cuerpo.tipo];
      if (!responder) throw sinRed();
      return responder(cuerpo);
    }
    throw sinRed();
  });
  return {
    fetch: f,
    tiposDelChat: () =>
      (f.mock.calls as unknown as Array<[string, { body?: string }]>)
        .filter(([url]) => url === JEV_URL)
        .map(([, init]) => (JSON.parse(init.body ?? '{}') as CuerpoChat).tipo),
  };
};

/** Monta la app con esa red, corre la prueba y la deja como estaba. */
const conApp = async (
  red: RedDeLaApp,
  prueba: () => Promise<void>,
  antes: () => Promise<void> = async () => undefined,
) => {
  clearAllMockStorages();
  const fetchPorDefecto = global.fetch;
  global.fetch = red.fetch as unknown as typeof fetch;
  try {
    await antes();
    await montarApp();
    await prueba();
  } finally {
    global.fetch = fetchPorDefecto;
    await desmontarApp();
  }
};

const textoSemilla = () => readFileSync(RUTA_SEMILLA, 'utf8');
/** Abre el chat desde el botón flotante de Inicio y escribe + toca "Preguntar". */
const abrirElChat = () => tocar('inicio-preguntar');
const preguntar = async (texto: string) => {
  await escribir('preguntar-campo', texto);
  await tocar('preguntar-enviar');
};

describe('SPEC-08: Chat "Preguntarle a mis datos" con Jev', () => {
  // @spec08_e1 — Una pregunta sobre un día se responde con la cifra del dominio
  it('spec08_e1 una pregunta sobre un dia se responde con la cifra del dominio', () => {
    // Given: hoy 2026-10-07, un cierre del 2026-10-06 con venta de S/ 205.00, y que Jev interpreta "¿cuánto vendí ayer?" como la intención "venta de un día" con el día "ayer"
    // When: se calcula la respuesta
    // Then: la respuesta es "Ayer, martes 6 de octubre, vendiste S/ 205.00."
    // Venta del 6 de octubre: 7 anticuchos × S/ 10 + 15 pancitas × S/ 9 = 70 + 135 = S/ 205.00
    const cierres = [
      cierreDe('2026-10-06', { lineas: [linea('Anticucho', 7, 0, 10, 8.2), linea('Pancita', 15, 0, 9, 8)] }),
    ];
    const consulta = jevInterpreta({
      intencion: 'ventaDelDia',
      producto: 'ninguno',
      dia: 'ayer',
      confianza: 0.95,
    });

    const hecho = responderConsulta(consulta, ctxDe(cierres));

    expect(hecho.frase).toBe('Ayer, martes 6 de octubre, vendiste S/ 205.00.');
    expect(hecho.intencion).toBe('ventaDelDia');
  });

  // @spec08_e2 — El peor día sale del día flojo
  it('spec08_e2 el peor dia sale del dia flojo', () => {
    // Given: 4 semanas de cierres donde los miércoles ganan en promedio S/ 40.00 y el promedio de todos los días es S/ 85.00, y que Jev interpreta "¿qué día me va peor?" como la intención "peor día"
    // When: se calcula la respuesta
    // Then: la respuesta es "Los miércoles son tu día más flojo: ganas S/ 45.00 menos que tu promedio."
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
          abreCiclo: (semana === 0 && i === 0) || (semana === 3 && i === 0),
          lineas: [linea('Anticucho', i === 0 ? 4 : 10, 0, 10, 0)],
        }),
      ),
    );
    const consulta = jevInterpreta({
      intencion: 'peorDia',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.9,
    });

    const hecho = responderConsulta(consulta, ctxDe(cierres));

    expect(hecho.frase).toBe(
      'Los miércoles son tu día más flojo: ganas S/ 45.00 menos que tu promedio.',
    );
    expect(hecho.intencion).toBe('peorDia');
  });

  // @spec08_e3 — El producto que más deja sale de la ganancia por producto
  it('spec08_e3 el producto que mas deja sale de la ganancia por producto', () => {
    // Given: 410 porciones de pancita que dejan S/ 1.00 cada una y 270 de anticucho que dejan S/ 1.80 cada una, y que Jev interpreta "¿cuál me deja más?" como la intención "producto que más deja"
    // When: se calcula la respuesta
    // Then: la respuesta es "El anticucho es el que más te deja: S/ 1.80 por porción, S/ 486.00 en total."
    // Octubre: pancita 220 − 20 + 150 + 60 = 410 porciones que dejan S/ 1.00; anticucho 150 − 10 + 130 = 270 que dejan S/ 1.80.
    const cierres = [
      cierreDe('2026-10-01', {
        lineas: [linea('Pancita', 220, 20, 9, 8), linea('Anticucho', 150, 10, 10, 8.2)],
      }),
      cierreDe('2026-10-02', {
        lineas: [linea('Pancita', 150, 0, 9, 8), linea('Anticucho', 130, 0, 10, 8.2)],
      }),
      cierreDe('2026-10-03', { lineas: [linea('Pancita', 60, 0, 9, 8)] }),
    ];
    const consulta = jevInterpreta({
      intencion: 'productoQueMasDeja',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.88,
    });

    const hecho = responderConsulta(consulta, ctxDe(cierres));

    expect(hecho.frase).toBe(
      'El anticucho es el que más te deja: S/ 1.80 por porción, S/ 486.00 en total.',
    );
    expect(hecho.intencion).toBe('productoQueMasDeja');
  });

  // @spec08_e4 — Lo que tiene por cobrar sale de los cobros
  it('spec08_e4 lo que tiene por cobrar sale de los cobros', () => {
    // Given: hoy 2026-10-07 y S/ 120.00 por cobrar con el pago más antiguo del 2026-09-29, y que Jev interpreta "¿cuánto me deben?" como la intención "cuánto por cobrar"
    // When: se calcula la respuesta
    // Then: la respuesta es "Tienes S/ 120.00 por cobrar desde el 29 de septiembre."
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
    const consulta = jevInterpreta({
      intencion: 'cuantoPorCobrar',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.97,
    });

    const hecho = responderConsulta(consulta, ctxDe(cierres));

    expect(hecho.frase).toBe('Tienes S/ 120.00 por cobrar desde el 29 de septiembre.');
    expect(hecho.intencion).toBe('cuantoPorCobrar');
  });

  // @spec08_e5 — Con poca confianza, no inventa
  it('spec08_e5 con poca confianza no inventa', () => {
    // Given: que Jev responde la intención con una confianza de 0.4 (el mínimo es 0.6)
    // When: se interpreta la pregunta
    // Then: la pantalla dice "No te entendí bien. Puedo ayudarte con tus ventas, lo que te deben y qué producto te deja más. Prueba con una de estas:", muestra las preguntas sugeridas y no muestra ninguna cifra
    return (async () => {
      const dudosa = redDeLaApp(textoSemilla(), {
        interpretar: () => respuestaJson({ ...interpretacion('compararCiclo'), confianza: 0.4 }),
        // Si la app los pidiera igual, estos darían una cifra: no debe llegar a pedirlos.
        redactar: () => respuestaJson({ texto: REDACCION_CICLO }),
        juzgar: () => respuestaJson(juicioDe('ojo', 0.8)),
      });
      await conApp(dudosa, async () => {
        await abrirElChat();
        await preguntar('algo raro que no entiendo');

        // La pantalla dice que no entendió y ofrece las preguntas sugeridas, después de la respuesta.
        const pantalla = textosEn('preguntar-pantalla');
        expect(pantalla).toContain(
          'No te entendí bien. Puedo ayudarte con tus ventas, lo que te deben y qué producto te deja más. Prueba con una de estas:',
        );
        for (const sugerida of PREGUNTAS_SUGERIDAS) expect(pantalla).toContain(sugerida);
        expect(posicionDe('preguntar-sugerida-0')).toBeGreaterThan(posicionDe('chat-burbuja-1'));

        // Ninguna cifra: ni en la respuesta ni en ningún otro lugar del chat.
        expect(textoDe('chat-burbuja-1-texto')).toBe(
          'No te entendí bien. Puedo ayudarte con tus ventas, lo que te deben y qué producto te deja más. Prueba con una de estas:',
        );
        expect(pantalla.some(t => /\d|S\//.test(t))).toBe(false);
        // Con duda, solo se pidió interpretar: ni redacción ni juicio.
        expect(dudosa.tiposDelChat()).toEqual(['interpretar']);
      });
    })();
  });

  // @spec08_e6 — Sin internet, el apartado lo dice sin error técnico
  it('spec08_e6 sin internet el apartado lo dice sin error tecnico', () => {
    // Given: la red caída
    // When: se abre "Preguntarle a mis datos" y se toca "Preguntar"
    // Then: la pantalla dice "Necesitas internet para esto" y no muestra ningún código ni mensaje técnico
    return (async () => {
      // La red caída: ni la semilla ni el servidor del chat responden.
      const caida = redDeLaApp(null);
      await conApp(caida, async () => {
        await abrirElChat();
        await preguntar('¿cuánto vendí ayer?');

        const pantalla = textosEn('preguntar-pantalla');
        expect(pantalla).toContain(
          'Necesitas internet para esto. Revisa tu conexión e inténtalo otra vez.',
        );
        // Ningún código ni mensaje técnico, en ninguna parte de la pantalla.
        expect(pantalla.join(' | ')).not.toMatch(CODIGOS_TECNICOS);
        // Y la pantalla sigue ahí, lista para otro intento.
        expect(hayNodo('preguntar-enviar')).toBe(true);
      });
    })();
  });

  // @spec08_e7 — A Jev solo viaja el texto de la pregunta
  it('spec08_e7 a jev solo viaja el texto de la pregunta', () => {
    // Given: un perfil con nombre, número de Yape y 75 cierres
    // When: se pregunta "¿cuánto vendí ayer?"
    // Then: la petición para interpretar es exactamente el tipo "interpretar" con ese texto, y no contiene el nombre, el Yape ni ningún monto de un cierre
    return (async () => {
      const { cierres, productos, perfil, hoy } = datosDeFreddy();
      expect(cierres).toHaveLength(75);
      const fetchSim = jest
        .fn()
        .mockResolvedValueOnce(respuestaJson(interpretacion('ventaDelDia', 'ayer')))
        .mockResolvedValue(respuestaJson({ texto: 'Ayer vendiste lo de siempre.' }));

      await consultar(fetchSim as unknown as typeof fetch, URL_JEV, '¿cuánto vendí ayer?', {
        cierres,
        productos,
        hoy,
      });

      // La primera petición es la de interpretar: solo el tipo y el texto de la pregunta.
      const [url, init] = llamadasDe(fetchSim)[0];
      expect(url).toBe(URL_JEV);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body ?? '')).toEqual({
        tipo: 'interpretar',
        texto: '¿cuánto vendí ayer?',
      });
      // El único encabezado es el tipo de contenido: ni Authorization ni cookies ni datos de Freddy.
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      // Ni el nombre, ni el Yape, ni ningún dato de un cierre salen del teléfono.
      noFiltraNadaDeFreddy(JSON.stringify(llamadasDe(fetchSim)[0]), cierres, perfil);
    })();
  });

  // @spec08_e8 — Al redactor solo viaja el hecho ya calculado
  it('spec08_e8 al redactor solo viaja el hecho ya calculado', () => {
    // Given: la respuesta calculada "Ayer, martes 6 de octubre, vendiste S/ 205.00."
    // When: se pide la redacción
    // Then: la petición es exactamente el tipo "redactar" con la intención y las cifras de ese hecho, y no contiene el perfil, el Yape ni ningún cierre
    return (async () => {
      const { cierres, perfil } = datosDeFreddy();
      const hecho = responderConsulta(
        jevInterpreta({ intencion: 'ventaDelDia', producto: 'ninguno', dia: 'ayer', confianza: 0.9 }),
        ventaDeAyer(),
      );
      expect(hecho.frase).toBe(FRASE_AYER);
      const fetchSim = jest
        .fn()
        .mockResolvedValue(respuestaJson({ texto: 'Ayer, martes 6 de octubre, te entraron S/ 205.00.' }));

      const resultado = await redactarRespuesta(fetchSim as unknown as typeof fetch, URL_JEV, hecho);

      expect(resultado.ok).toBe(true);
      expect(fetchSim).toHaveBeenCalledTimes(1);
      const [url, init] = llamadasDe(fetchSim)[0];
      expect(url).toBe(URL_JEV);
      // Exactamente el tipo "redactar" y el hecho ya calculado: la intención, la frase y las cifras.
      expect(JSON.parse(init.body ?? '')).toEqual({
        tipo: 'redactar',
        hecho: { intencion: 'ventaDelDia', frase: FRASE_AYER, cifras: ['6', '205.00'] },
      });
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      // El perfil, el Yape y los cierres no viajan.
      noFiltraNadaDeFreddy(JSON.stringify(llamadasDe(fetchSim)[0]), cierres, perfil);
    })();
  });

  // @spec08_e9 — Una redacción con una cifra distinta se descarta
  it('spec08_e9 una redaccion con una cifra distinta se descarta', () => {
    // Given: el hecho "vendiste S/ 205.00" y un redactor que responde "Ayer vendiste S/ 250.00"
    // When: se valida la redacción
    // Then: se descarta y la pantalla muestra la frase fija con "S/ 205.00"
    const frase = 'vendiste S/ 205.00';
    const hecho: Hecho = { intencion: 'ventaDelDia', frase, cifras: extraerCifras(frase) };

    const resultado = validarRedaccion('Ayer vendiste S/ 250.00', hecho);

    // Se descarta: no hay texto que mostrar, y lo que se muestra es la frase fija del código.
    expect(resultado).toEqual({ ok: false, motivo: 'CIFRA_NUEVA' });
    expect(hecho.frase).toContain('S/ 205.00');
    // Con la cifra correcta, en cambio, la redacción sí pasa.
    expect(validarRedaccion('Ayer vendiste S/ 205.00', hecho)).toEqual({
      ok: true,
      texto: 'Ayer vendiste S/ 205.00',
    });
  });

  // @spec08_e10 — Si el redactor falla o tarda, se muestra la frase fija
  it('spec08_e10 si el redactor falla o tarda se muestra la frase fija', () => {
    // Given: un redactor que no responde en 8 segundos o devuelve un error
    // When: se pide la redacción
    // Then: la pantalla muestra la frase fija con la cifra calculada, sin ningún mensaje técnico
    return (async () => {
      const ctx = ventaDeAyer();
      const pregunta = '¿cuánto vendí ayer?';
      const comoLaVeFreddy = (r: unknown) => {
        expect(r).toMatchObject({ tipo: 'respuesta', texto: FRASE_AYER, redactada: false });
        expect(JSON.stringify(r)).not.toMatch(CODIGOS_TECNICOS);
        expect((r as { texto: string }).texto).toContain('S/ 205.00');
      };

      // (a) El redactor devuelve un error: se muestra la frase fija.
      const conError = jest
        .fn()
        .mockResolvedValueOnce(respuestaJson(interpretacion('ventaDelDia', 'ayer')))
        .mockResolvedValueOnce(respuestaJson({ error: 'NO_DISPONIBLE' }, false, 502));
      comoLaVeFreddy(await consultar(conError as unknown as typeof fetch, URL_JEV, pregunta, ctx));
      expect(conError).toHaveBeenCalledTimes(2);

      // (b) El redactor no responde en 8 segundos: se corta y se muestra la frase fija.
      jest.useFakeTimers();
      try {
        const colgado = jest
          .fn()
          .mockResolvedValueOnce(respuestaJson(interpretacion('ventaDelDia', 'ayer')))
          .mockImplementationOnce(
            (_url: unknown, init?: { signal?: AbortSignal }) =>
              new Promise<Response>((_resolver, rechazar) => {
                init?.signal?.addEventListener('abort', () => {
                  const aborto = new Error('Aborted');
                  aborto.name = 'AbortError';
                  rechazar(aborto);
                });
              }),
          );
        let resultado: unknown;
        const pendiente = consultar(colgado as unknown as typeof fetch, URL_JEV, pregunta, ctx).then(
          r => {
            resultado = r;
          },
        );

        await jest.advanceTimersByTimeAsync(7999);
        expect(resultado).toBeUndefined();
        await jest.advanceTimersByTimeAsync(1);
        await pendiente;

        comoLaVeFreddy(resultado);
        expect(colgado).toHaveBeenCalledTimes(2);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    })();
  });

  // @spec08_e11 — Nada se envía sin tocar el botón
  it('spec08_e11 nada se envia sin tocar el boton', () => {
    // Given: la pantalla "Preguntarle a mis datos" con una pregunta escrita
    // When: se abre la pantalla y luego se toca "Preguntar"
    // Then: no hay ninguna petición de red al abrir ni al escribir, y al tocar el botón se hace 1 petición para interpretar y, si hay respuesta, 1 para redactar y, solo en las intenciones que se pueden juzgar, 1 para juzgar (las dos últimas se piden a la vez)
    // (La parte de la pantalla —abrir y escribir sin enviar— la prueba la oleada C; aquí se prueba el
    // servicio que el botón dispara: no hace nada hasta que se lo llama y luego pide exactamente esto.)
    return (async () => {
      const pregunta = '¿cómo voy contra el ciclo pasado?';
      const juzgable = servidorSimulado({
        interpretar: responde(interpretacion('compararCiclo')),
        redactar: responde({ texto: REDACCION_CICLO }),
        juzgar: responde(juicioDe('ojo', 0.8)),
      });
      // Antes de tocar "Preguntar" no hay ninguna petición.
      expect(juzgable.fetch).not.toHaveBeenCalled();

      const r = await consultar(
        juzgable.fetch as unknown as typeof fetch,
        URL_JEV,
        pregunta,
        ctxCompararCiclo(),
      );

      // Intención juzgable: 1 para interpretar y, después, 1 para redactar y 1 para juzgar a la vez.
      expect(r).toMatchObject({ tipo: 'respuesta', redactada: true, semaforo: 'ojo' });
      expect(juzgable.fetch).toHaveBeenCalledTimes(3);
      const tipos = juzgable.tipos();
      expect(tipos[0]).toBe('interpretar');
      expect([...tipos.slice(1)].sort()).toEqual(['juzgar', 'redactar']);
      expect(juzgable.simultaneas()).toBe(2);

      // Intención que no se juzga: 1 para interpretar y 1 para redactar, ninguna para juzgar.
      const simple = servidorSimulado({
        interpretar: responde(interpretacion('ventaDelDia', 'ayer')),
        redactar: responde({ texto: 'Ayer, martes 6 de octubre, te entraron S/ 205.00.' }),
        juzgar: responde(juicioDe('bien', 0.9)),
      });
      await consultar(
        simple.fetch as unknown as typeof fetch,
        URL_JEV,
        '¿cuánto vendí ayer?',
        ventaDeAyer(),
      );
      expect(simple.tipos()).toEqual(['interpretar', 'redactar']);

      // Sin respuesta que mostrar (no la entendió): solo la de interpretar.
      const dudosa = servidorSimulado({
        interpretar: responde({ ...interpretacion('compararCiclo'), confianza: 0.3 }),
        redactar: responde({ texto: REDACCION_CICLO }),
        juzgar: responde(juicioDe('ojo', 0.8)),
      });
      await consultar(
        dudosa.fetch as unknown as typeof fetch,
        URL_JEV,
        'algo raro',
        ctxCompararCiclo(),
      );
      expect(dudosa.tipos()).toEqual(['interpretar']);
    })();
  });

  // @spec08_e12 — e2e: preguntar con los datos de ejemplo
  it('spec08_e12 e2e preguntar con los datos de ejemplo', () => {
    // Given: la app con la semilla cargada y servidores simulados de Jev y del redactor
    // When: se abre "Preguntarle a mis datos" y se pregunta "¿qué día me va peor?"
    // Then: la pantalla muestra una respuesta que nombra "miércoles" y una cifra en soles que coincide con la calculada por el código
    return (async () => {
      const texto = textoSemilla();
      const validada = validarSemilla(JSON.parse(texto));
      if (!validada.ok) throw new Error('La semilla del repositorio no valida');
      // Lo esperado sale del dominio, con la misma semilla y el mismo "hoy" que usa la app.
      const { cierres, productos } = materializarSemilla(validada.semilla, new Date());
      const esperado = responderConsulta(
        jevInterpreta({ intencion: 'peorDia', producto: 'ninguno', dia: 'ninguno', confianza: 0.9 }),
        { cierres, productos, hoy: fechaLocal(new Date()) },
      );
      expect(esperado.frase).toContain('miércoles');
      const montoEsperado = (esperado.frase.match(/S\/ [\d,]+\.\d{2}/) ?? [])[0];
      expect(montoEsperado).toBeDefined();

      // Servidores simulados: Jev entiende "peor día"; el redactor dice el hecho que recibe con otras palabras.
      const red = redDeLaApp(texto, {
        interpretar: () => respuestaJson(interpretacion('peorDia')),
        redactar: cuerpo =>
          respuestaJson({
            texto: `Tu día más flojo es el miércoles: ganas ${
              (cuerpo.hecho?.frase.match(/S\/ [\d,]+\.\d{2}/) ?? [])[0]
            } menos que tu promedio.`,
          }),
        juzgar: () => respuestaJson(juicioDe('ojo', 0.8)),
      });
      await conApp(red, async () => {
        await abrirElChat();
        await preguntar('¿qué día me va peor?');

        // La respuesta nombra el miércoles y trae la cifra en soles que calculó el código.
        const respuesta = textoDe('chat-burbuja-1-texto');
        expect(respuesta).toContain('miércoles');
        expect((respuesta.match(/S\/ [\d,]+\.\d{2}/) ?? [])[0]).toBe(montoEsperado);
        expect(red.tiposDelChat()[0]).toBe('interpretar');
      });
    })();
  });

  // @spec08_e13 — El chat muestra la pregunta y la respuesta, en orden
  it('spec08_e13 el chat muestra la pregunta y la respuesta en orden', () => {
    // Given: el chat abierto y la respuesta calculada "Ayer, martes 6 de octubre, vendiste S/ 205.00."
    // When: se escribe "¿cuánto vendí ayer?" y se toca "Preguntar"
    // Then: aparecen dos burbujas en orden, primero la pregunta y debajo la respuesta, y el campo de texto queda vacío y listo para otra pregunta
    return (async () => {
      // La red del chat: Jev entiende "ayer" y el redactor no responde, así que sale la frase fija.
      const red = redDeLaApp(null, {
        interpretar: () => respuestaJson(interpretacion('ventaDelDia', 'ayer')),
      });
      jest.useFakeTimers({ doNotFake: [...SIN_FALSEAR], now: ahora });
      try {
        await conApp(
          red,
          async () => {
            await abrirElChat();
            await preguntar('¿cuánto vendí ayer?');

            // Dos burbujas, en orden: primero la pregunta y debajo la respuesta.
            expect(vistasCon(/^chat-burbuja-\d+$/)).toEqual(['chat-burbuja-0', 'chat-burbuja-1']);
            expect(textoDe('chat-burbuja-0-texto')).toBe('¿cuánto vendí ayer?');
            expect(textoDe('chat-burbuja-1-texto')).toBe(FRASE_AYER);
            expect(posicionDe('chat-burbuja-1')).toBeGreaterThan(posicionDe('chat-burbuja-0'));
            // La pregunta a la derecha y la respuesta a la izquierda.
            expect(estiloDeVista('chat-burbuja-0').alignSelf).toBe('flex-end');
            expect(estiloDeVista('chat-burbuja-1').alignSelf).toBe('flex-start');

            // El campo queda vacío y listo para otra pregunta.
            const campo = raiz().findAll(
              n => n.props.testID === 'preguntar-campo' && typeof n.props.onChangeText === 'function',
            )[0];
            expect(campo.props.value).toBe('');
          },
          // Un solo día cerrado: ayer, 7 anticuchos y 15 pancitas = S/ 205.00.
          async () => {
            await guardarCierre(ventaDeAyer().cierres[0]);
          },
        );
      } finally {
        jest.useRealTimers();
      }
    })();
  });

  // @spec08_e14 — El botón flotante de Inicio abre el chat
  it('spec08_e14 el boton flotante de inicio abre el chat', () => {
    // Given: la app con la semilla cargada, en Inicio
    // When: se toca el botón flotante "Preguntar"
    // Then: se abre el chat con las preguntas sugeridas visibles, y "Atrás" vuelve a Inicio sin haber enviado ninguna petición
    return (async () => {
      const red = redDeLaApp(textoSemilla(), {
        interpretar: () => respuestaJson(interpretacion('ventaDelDia', 'ayer')),
      });
      await conApp(red, async () => {
        // En Inicio, con la semilla cargada: el botón flotante dice "Preguntar" y no abre nada solo.
        expect(hayNodo('inicio-saludo')).toBe(true);
        expect(hayNodo('preguntar-pantalla')).toBe(false);

        await tocar('inicio-preguntar');

        // Se abre el chat con las preguntas sugeridas visibles.
        expect(hayNodo('preguntar-pantalla')).toBe(true);
        const pantalla = textosEn('preguntar-pantalla');
        for (const sugerida of PREGUNTAS_SUGERIDAS) expect(pantalla).toContain(sugerida);
        expect(red.tiposDelChat()).toEqual([]);

        // "Atrás" vuelve a Inicio, y todavía no se envió ninguna petición.
        await tocar('preguntar-atras');
        expect(hayNodo('preguntar-pantalla')).toBe(false);
        expect(hayNodo('inicio-saludo')).toBe(true);
        expect(red.tiposDelChat()).toEqual([]);
      });
    })();
  });

  // @spec08_e15 — Jev juzga el resultado ya calculado
  it('spec08_e15 jev juzga el resultado ya calculado', () => {
    // Given: la respuesta calculada "Ganaste S/ 78.00 menos que el ciclo pasado." de la intención "comparar ciclo" y un Jev que juzga "ojo" con confianza de 0.8
    // When: se pide el juicio
    // Then: la respuesta lleva el semáforo "Ojo" junto a la frase calculada
    // Ciclo anterior: venta 400 − gastos 131 = te queda 269. Ciclo actual: 300 − 109 = 191 (−29 %).
    const cierres = [
      cierreDe('2026-09-14', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 40, 0, 10, 8)],
        gastos: [{ categoria: 'mercaderia', monto: 131 }],
      }),
      cierreDe('2026-09-28', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 30, 0, 10, 8)],
        gastos: [{ categoria: 'mercaderia', monto: 109 }],
      }),
    ];
    const ctx = ctxDe(cierres);
    const consulta = jevInterpreta({
      intencion: 'compararCiclo',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.9,
    });
    const hecho = responderConsulta(consulta, ctx);
    expect(hecho.frase).toBe('Ganaste S/ 78.00 menos que el ciclo pasado.');
    const senales = senalesDeJuicio(consulta, ctx);
    expect(senales).toEqual({ tendencia: 'baja', magnitud: 'grande' });

    // Un Jev simulado juzga "ojo" con confianza de 0.8
    const juicio = interpretarJuicio({ semaforo: 'ojo', confianza: 0.8 });

    expect(juicio).toEqual({ semaforo: 'ojo', confianza: 0.8 });
    // La respuesta lleva la palabra "Ojo" junto a la frase calculada (que no cambia)
    expect(ETIQUETA_SEMAFORO[juicio?.semaforo ?? 'bien']).toBe('Ojo');
    expect(ETIQUETA_SEMAFORO.ojo).toBe('Ojo');
    expect(hecho.frase).toBe('Ganaste S/ 78.00 menos que el ciclo pasado.');
  });

  // @spec08_e16 — A Jev solo viaja el hecho calculado y señales con nombre
  it('spec08_e16 a jev solo viaja el hecho calculado y señales con nombre', () => {
    // Given: un perfil con nombre, número de Yape y 75 cierres, y la respuesta calculada "Ganaste S/ 78.00 menos que el ciclo pasado."
    // When: se pide el juicio
    // Then: la petición es exactamente el tipo "juzgar" con la intención, la frase, las cifras y las señales con nombre (tendencia y magnitud), y no contiene el perfil, el Yape ni ningún cierre
    // (La petición de red la arma el servicio en la oleada B3; aquí se prueba su cuerpo: lo único que puede viajar.)
    const { cierres, productos, perfil, hoy } = datosDeFreddy();
    const ctx = ctxDe(cierres, productos, hoy);
    const consulta = jevInterpreta({
      intencion: 'compararCiclo',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.9,
    });
    const hecho = responderConsulta(consulta, ctx);
    expect(hecho.frase).toBe('Ganaste S/ 78.00 menos que el ciclo pasado.');
    const senales = senalesDeJuicio(consulta, ctx);
    expect(senales).not.toBeNull();

    const cuerpo = armarHechoParaJuicio(hecho, senales ?? {});

    expect(cuerpo).toEqual({
      intencion: 'compararCiclo',
      frase: 'Ganaste S/ 78.00 menos que el ciclo pasado.',
      cifras: ['78.00'],
      senales: { tendencia: 'baja', magnitud: 'grande' },
    });
    // Exactamente estas cuatro llaves y ninguna más
    expect(Object.keys(cuerpo).sort()).toEqual(['cifras', 'frase', 'intencion', 'senales']);
    // El perfil, el Yape y los cierres no viajan
    noFiltraNadaDeFreddy(JSON.stringify(cuerpo), cierres, perfil);
  });

  // @spec08_e17 — Sin juicio posible o con falla, la respuesta sale igual
  it('spec08_e17 sin juicio posible o con falla la respuesta sale igual', () => {
    // Given: la intención "venta de un día" (que no se puede juzgar) y, por otro lado, una intención juzgable con un Jev que falla, tarda más de 8 segundos o responde con confianza de 0.3
    // When: se arma la respuesta
    // Then: en el primer caso no se hace ninguna petición de juicio, y en el segundo la respuesta se muestra sin semáforo y sin ningún mensaje técnico
    return (async () => {
      const interpreta = responde(interpretacion('compararCiclo'));
      const redacta = responde({ texto: REDACCION_CICLO });
      const sinSemaforo = (r: unknown) => {
        expect(r).toMatchObject({ tipo: 'respuesta', texto: REDACCION_CICLO, frase: FRASE_CICLO });
        expect(r).not.toHaveProperty('semaforo');
        expect(JSON.stringify(r)).not.toMatch(CODIGOS_TECNICOS);
      };

      // Primer caso: "venta de un día" no se juzga, así que no hay ninguna petición de juicio.
      const noJuzgable = servidorSimulado({
        interpretar: responde(interpretacion('ventaDelDia', 'ayer')),
        redactar: responde({ texto: 'Ayer, martes 6 de octubre, te entraron S/ 205.00.' }),
        juzgar: responde(juicioDe('urgente', 0.99)),
      });
      const venta = await consultar(
        noJuzgable.fetch as unknown as typeof fetch,
        URL_JEV,
        '¿cuánto vendí ayer?',
        ventaDeAyer(),
      );
      expect(noJuzgable.tipos()).not.toContain('juzgar');
      expect(venta).toMatchObject({ tipo: 'respuesta', texto: expect.stringContaining('S/ 205.00') });
      expect(venta).not.toHaveProperty('semaforo');

      // Control: con un Jev que sí juzga con confianza, una intención juzgable lleva el semáforo.
      const bien = servidorSimulado({
        interpretar: interpreta,
        redactar: redacta,
        juzgar: responde(juicioDe('ojo', 0.8)),
      });
      const conJuicio = await consultar(
        bien.fetch as unknown as typeof fetch,
        URL_JEV,
        '¿cómo voy contra el ciclo pasado?',
        ctxCompararCiclo(),
      );
      expect(conJuicio).toMatchObject({ tipo: 'respuesta', texto: REDACCION_CICLO, semaforo: 'ojo' });

      // Segundo caso (a): Jev falla (error del servidor) y (b) responde con confianza de 0.3.
      const fallas: Array<() => Promise<Response>> = [
        () => Promise.resolve(respuestaJson({ error: 'NO_DISPONIBLE' }, false, 502)),
        () => Promise.reject(new TypeError('Network request failed')),
        responde(juicioDe('urgente', 0.3)),
        responde(juicioDe(null, 0)),
        responde({ semaforo: 'rojo', confianza: 0.9 }),
      ];
      for (const falla of fallas) {
        const servidor = servidorSimulado({ interpretar: interpreta, redactar: redacta, juzgar: falla });
        const r = await consultar(
          servidor.fetch as unknown as typeof fetch,
          URL_JEV,
          '¿cómo voy contra el ciclo pasado?',
          ctxCompararCiclo(),
        );
        sinSemaforo(r);
        expect(servidor.tipos()).toContain('juzgar');
      }

      // Segundo caso (c): Jev tarda más de 8 segundos; se corta y la respuesta sale igual.
      jest.useFakeTimers();
      try {
        const lento = (_url: string, init: { signal?: AbortSignal }) =>
          new Promise<Response>((_resolver, rechazar) => {
            init.signal?.addEventListener('abort', () => {
              const aborto = new Error('Aborted');
              aborto.name = 'AbortError';
              rechazar(aborto);
            });
          });
        const f = jest
          .fn()
          .mockResolvedValueOnce(respuestaJson(interpretacion('compararCiclo')))
          .mockResolvedValueOnce(respuestaJson({ texto: REDACCION_CICLO }))
          .mockImplementationOnce(lento);
        let resultado: unknown;
        const pendiente = consultar(
          f as unknown as typeof fetch,
          URL_JEV,
          '¿cómo voy contra el ciclo pasado?',
          ctxCompararCiclo(),
        ).then(r => {
          resultado = r;
        });

        await jest.advanceTimersByTimeAsync(7999);
        expect(resultado).toBeUndefined();
        await jest.advanceTimersByTimeAsync(1);
        await pendiente;

        sinSemaforo(resultado);
        expect(f).toHaveBeenCalledTimes(3);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    })();
  });

  // @spec08_e18 — El semáforo se distingue por palabra, símbolo y color
  it('spec08_e18 el semaforo se distingue por palabra simbolo y color', () => {
    // Given: respuestas con el semáforo "bien", "ojo" y "urgente"
    // When: se muestran en el chat
    // Then: cada una dice su palabra ("Bien", "Ojo", "Urgente"), lleva un símbolo distinto y un color distinto, con la letra siempre oscura sobre el fondo suave (el naranja nunca es el color del texto)
    return (async () => {
      // Tres preguntas seguidas a un Jev que juzga "bien", "ojo" y "urgente", una por respuesta.
      const juicios: Array<'bien' | 'ojo' | 'urgente'> = ['bien', 'ojo', 'urgente'];
      let siguiente = 0;
      const red = redDeLaApp(textoSemilla(), {
        interpretar: () => respuestaJson(interpretacion('compararCiclo')),
        // El redactor no responde: cada burbuja muestra la frase fija que calculó el código.
        juzgar: () => respuestaJson(juicioDe(juicios[siguiente++ % 3], 0.9)),
      });
      await conApp(red, async () => {
        await abrirElChat();
        for (let i = 0; i < 3; i += 1) await preguntar('¿cómo voy contra el ciclo pasado?');

        const fondos: string[] = [];
        const simbolos: string[] = [];
        juicios.forEach((semaforo, i) => {
          const burbuja = i * 2 + 1; // 0 pregunta, 1 respuesta, 2 pregunta, 3 respuesta…
          const id = `chat-burbuja-${burbuja}`;

          // La palabra, escrita.
          expect(textoDe(`${id}-semaforo-palabra`)).toBe(ETIQUETA_SEMAFORO[semaforo]);
          expect(SIMBOLO_SEMAFORO[semaforo]).toBeTruthy();

          // El símbolo: un ícono propio de ese semáforo (tras la vista que lo envuelve, el primer
          // componente con nombre es el ícono; los siguientes son las piezas de su dibujo).
          const iconos = raiz()
            .findAll(n => n.props.testID === `${id}-semaforo-simbolo`)[0]
            .findAll(n => typeof (n.type as { displayName?: string }).displayName === 'string')
            .map(n => (n.type as { displayName: string }).displayName)
            .filter(nombre => nombre !== 'View');
          expect(iconos.length).toBeGreaterThan(0);
          simbolos.push(iconos[0]);

          // El color de fondo, suave, y la letra siempre oscura (el naranja nunca es texto).
          fondos.push(String(estiloDeVista(id).backgroundColor));
          for (const parte of [`${id}-texto`, `${id}-semaforo-palabra`]) {
            const letra = estiloDeTexto(parte);
            expect(letra.color).toBe(colors.text);
            expect(letra.color).not.toBe(colors.accent);
            expect(letra.fontSize).toBeGreaterThanOrEqual(14);
          }
        });

        // Tres símbolos distintos y tres colores distintos, todos fondos suaves.
        expect(new Set(simbolos).size).toBe(3);
        expect(new Set(fondos).size).toBe(3);
        for (const fondo of fondos) {
          expect([colors.successSoft, colors.warningSoft, colors.dangerSoft]).toContain(fondo);
        }
      });
    })();
  });

  // @spec08_e19 — Un saludo se responde al instante, sin red
  it('spec08_e19 un saludo se responde al instante sin red', () => {
    // Given: el chat abierto y la red caída
    // When: se escribe "hola" y se toca "Preguntar"
    // Then: aparece la pregunta y debajo una respuesta amable de charla sin ninguna cifra, sin semáforo y sin ningún mensaje técnico, y no se hace ninguna petición de red. Lo mismo vale para el agradecimiento, la despedida y "qué puedes hacer"; este último ofrece las preguntas sugeridas. Si el perfil tiene nombre, el saludo puede usarlo, y el nombre nunca sale del teléfono
    return (async () => {
      const caida = redDeLaApp(null);
      await conApp(caida, async () => {
        await abrirElChat();
        const llamadasAntes = caida.fetch.mock.calls.length;
        let burbujas = 0;
        for (const charla of ['hola', 'gracias', 'chau']) {
          await preguntar(charla);
          burbujas += 2;
          expect(textoDe(`chat-burbuja-${burbujas - 2}-texto`)).toBe(charla);
          const respuesta = textoDe(`chat-burbuja-${burbujas - 1}-texto`);
          expect(respuesta.length).toBeGreaterThan(10);
          expect(respuesta).not.toMatch(/\d|S\/|No te entendí|Necesitas internet/);
          expect(respuesta).not.toMatch(CODIGOS_TECNICOS);
          expect(hayNodo(`chat-burbuja-${burbujas - 1}-semaforo`)).toBe(false);
        }
        // "Qué puedes hacer" explica y ofrece las preguntas sugeridas bajo la burbuja.
        await preguntar('¿qué puedes hacer?');
        expect(textoDe('chat-burbuja-7-texto')).toMatch(/Prueba con una de estas:$/);
        for (const sugerida of PREGUNTAS_SUGERIDAS) {
          expect(textosEn('preguntar-pantalla')).toContain(sugerida);
        }
        // Ni una sola petición de red, ni a Jev ni a nadie.
        expect(caida.tiposDelChat()).toEqual([]);
        expect(caida.fetch.mock.calls.length).toBe(llamadasAntes);
      });

      // Con nombre en el perfil, el saludo lo usa; y sigue sin viajar nada.
      const otra = redDeLaApp(null);
      await conApp(
        otra,
        async () => {
          await abrirElChat();
          const antes = otra.fetch.mock.calls.length;
          await preguntar('hola');
          expect(textoDe('chat-burbuja-1-texto')).toContain('Freddy');
          expect(otra.fetch.mock.calls.length).toBe(antes);
        },
        async () => {
          await guardarPerfil({ ...PERFIL_POR_DEFECTO, nombre: 'Freddy', actualizadoEn: ahora.toISOString() });
        },
      );
    })();
  });

  // @spec08_e20 — Una pregunta mezclada con un saludo sí va a Jev
  it('spec08_e20 una pregunta mezclada con un saludo si va a jev', () => {
    // Given: el chat abierto con datos de ejemplo y un Jev que interpreta "venta de un día"
    // When: se escribe "hola, ¿cuánto vendí ayer?" y se toca "Preguntar"
    // Then: no se trata como charla: se hace la petición para interpretar y la respuesta lleva la cifra calculada por el código
    return (async () => {
      const texto = textoSemilla();
      const validada = validarSemilla(JSON.parse(texto));
      if (!validada.ok) throw new Error('La semilla del repositorio no valida');
      const { cierres, productos } = materializarSemilla(validada.semilla, new Date());
      const esperado = responderConsulta(
        jevInterpreta({ intencion: 'ventaDelDia', producto: 'ninguno', dia: 'ayer', confianza: 0.9 }),
        { cierres, productos, hoy: fechaLocal(new Date()) },
      );
      const red = redDeLaApp(texto, {
        interpretar: () => respuestaJson(interpretacion('ventaDelDia', 'ayer')),
      });
      await conApp(red, async () => {
        await abrirElChat();
        await preguntar('hola, ¿cuánto vendí ayer?');

        expect(red.tiposDelChat()[0]).toBe('interpretar');
        const enviada = red.fetch.mock.calls
          .map(([, init]) => JSON.parse(init?.body ?? '{}'))
          .find(c => c.tipo === 'interpretar');
        expect(enviada).toEqual({ tipo: 'interpretar', texto: 'hola, ¿cuánto vendí ayer?' });
        // La respuesta es la frase calculada por el código (el redactor no responde).
        expect(textoDe('chat-burbuja-1-texto')).toBe(esperado.frase);
      });
    })();
  });

  // @spec08_e21 — El botón flotante es solo el robot, con etiqueta accesible
  it('spec08_e21 el boton flotante es solo el robot con etiqueta accesible', () => {
    // Given: la app en Inicio
    // When: se mira el botón flotante que abre el chat
    // Then: es un botón redondo de al menos 48 dp que muestra solo el ícono de un robot, sin texto, y su etiqueta accesible es "Preguntar"
    return (async () => {
      await conApp(redDeLaApp(null), async () => {
        const boton = raiz().findAll(n => n.props.testID === 'inicio-preguntar' && esHost(n, 'View'))[0];
        expect(boton).toBeDefined();
        // Solo el ícono: ningún texto dentro del botón; la etiqueta es solo para el lector de pantalla.
        expect(boton.findAll(n => esHost(n, 'Text'))).toHaveLength(0);
        expect(boton.props.accessibilityRole).toBe('button');
        expect(boton.props.accessibilityLabel).toBe('Preguntar');
        const iconos = boton
          .findAll(n => typeof (n.type as { displayName?: string }).displayName === 'string')
          .map(n => (n.type as { displayName: string }).displayName);
        expect(iconos).toContain('Bot');
        // Redondo y de 48 dp o más.
        const estilo = StyleSheet.flatten(boton.props.style);
        expect(estilo.width).toBeGreaterThanOrEqual(48);
        expect(estilo.height).toBeGreaterThanOrEqual(48);
        expect(estilo.borderRadius).toBeGreaterThanOrEqual((estilo.height as number) / 2);
        expect(estilo.backgroundColor).toBe(colors.primary);
      });
    })();
  });

  // @spec08_e22 — "Qué comprar mañana" sin producto responde para todos los productos
  it('spec08_e22 que comprar manana sin producto responde para todos', () => {
    // Given: dos ciclos cerrados donde, en cada uno, sobraron 6 y 4 porciones de anticucho y nada de pancita, y que Jev interpreta "recomiéndame qué comprar más mañana" como la intención "cuánto preparar" sin producto
    // When: se calcula la respuesta
    // Then: la respuesta es "Para mañana, según lo que te sobró: anticucho, prepara 4 porciones menos; pancita, te alcanza lo que preparas." con las mismas cifras y reglas que para un solo producto, y las cifras van a la redacción como siempre; con menos de dos ciclos sale la frase fija de siempre
    return (async () => {
      const dosProductos = PRODUCTOS_POR_DEFECTO.slice(0, 2);
      const cierres = [
        cierreDe('2026-09-14', {
          abreCiclo: true,
          lineas: [linea('Anticucho', 20, 6, 10, 8.2), linea('Pancita', 30, 0, 9, 8)],
        }),
        cierreDe('2026-09-28', {
          abreCiclo: true,
          lineas: [linea('Anticucho', 20, 4, 10, 8.2), linea('Pancita', 30, 0, 9, 8)],
        }),
      ];
      const ctx = ctxDe(cierres, dosProductos);
      const consulta = jevInterpreta({
        intencion: 'cuantoPreparar',
        producto: 'ninguno',
        dia: 'ninguno',
        confianza: 0.72,
      });
      const hecho = responderConsulta(consulta, ctx);
      expect(hecho.frase).toBe(
        'Para mañana, según lo que te sobró: anticucho, prepara 4 porciones menos; pancita, te alcanza lo que preparas.',
      );
      // Las mismas cifras que para un solo producto: la del anticucho es la que sale de cuantoPreparar.
      const solo = responderConsulta(
        jevInterpreta({ intencion: 'cuantoPreparar', producto: 'anticucho', dia: 'ninguno', confianza: 0.9 }),
        ctx,
      );
      expect(solo.frase).toContain('Prepara 4 porciones menos');
      // Las cifras van a la redacción como siempre.
      expect(hecho.cifras).toEqual(['4']);
      const servidor = servidorSimulado({
        interpretar: responde({ ...interpretacion('cuantoPreparar'), confianza: 0.72 }),
        redactar: responde({ texto: 'Para mañana, anticucho: prepara 4 porciones menos. De pancita, igual.' }),
        juzgar: responde(juicioDe('ojo', 0.8)),
      });
      const r = await consultar(
        servidor.fetch as unknown as typeof fetch,
        URL_JEV,
        'recomiéndame qué comprar más mañana',
        ctx,
      );
      expect(r).toMatchObject({ tipo: 'respuesta', redactada: true });
      expect(servidor.tipos()).toContain('redactar');
      // Con menos de dos ciclos, la frase fija de siempre.
      expect(responderConsulta(consulta, ctxDe([cierres[0]], dosProductos)).frase).toBe(
        'Todavía no cierras un ciclo completo. Cuando compres mercadería otra vez, te lo calculo.',
      );
    })();
  });

  // @spec08_e23 — Un seguimiento reutiliza la intención anterior
  it('spec08_e23 un seguimiento reutiliza la intencion anterior', () => {
    // Given: el chat con datos de ejemplo, la pregunta "¿cuánto debo preparar de anticucho?" ya respondida y un Jev que a "¿y de la pancita?" responde que no entendió pero detecta el producto "pancita"
    // When: se escribe "¿y de la pancita?" y se toca "Preguntar"
    // Then: la respuesta es la de "cuánto preparar" para la pancita, calculada por el código, y a Jev solo viajó el texto de la pregunta actual: ni la pregunta anterior, ni su intención, ni su producto
    return (async () => {
      const texto = textoSemilla();
      const validada = validarSemilla(JSON.parse(texto));
      if (!validada.ok) throw new Error('La semilla del repositorio no valida');
      const { cierres, productos } = materializarSemilla(validada.semilla, new Date());
      const ctx = { cierres, productos, hoy: fechaLocal(new Date()) };
      const esperada = responderConsulta(
        jevInterpreta({ intencion: 'cuantoPreparar', producto: 'pancita', dia: 'ninguno', confianza: 0.9 }),
        ctx,
      );
      const red = redDeLaApp(texto, {
        interpretar: cuerpo =>
          respuestaJson(
            cuerpo.texto === '¿y de la pancita?'
              ? { intencion: 'noEntendi', producto: 'pancita', dia: 'ninguno', confianza: 0.77 }
              : { ...interpretacion('cuantoPreparar'), producto: 'anticucho' },
          ),
      });
      await conApp(red, async () => {
        await abrirElChat();
        await preguntar('¿cuánto debo preparar de anticucho?');
        await preguntar('¿y de la pancita?');

        expect(textoDe('chat-burbuja-3-texto')).toBe(esperada.frase);
        // A Jev solo viaja el texto de la pregunta actual.
        const enviadas = red.fetch.mock.calls
          .map(([, init]) => init?.body ?? '{}')
          .filter(cuerpo => JSON.parse(cuerpo).tipo === 'interpretar');
        expect(enviadas).toHaveLength(2);
        expect(JSON.parse(enviadas[1])).toEqual({ tipo: 'interpretar', texto: '¿y de la pancita?' });
        expect(enviadas[1]).not.toMatch(/anticucho|cuantoPreparar|preparar/i);
      });
    })();
  });

  // @spec08_e24 — Una pregunta completa nueva no hereda nada
  it('spec08_e24 una pregunta completa nueva no hereda nada', () => {
    // Given: el chat con datos de ejemplo, la pregunta "¿cuánto debo preparar de anticucho?" ya respondida y un Jev que a "¿cuánto debo preparar mañana?" responde "cuánto preparar" sin producto
    // When: se escribe "¿cuánto debo preparar mañana?" y se toca "Preguntar"
    // Then: la respuesta es la de todos los productos, sin heredar el anticucho de la pregunta anterior
    return (async () => {
      const texto = textoSemilla();
      const validada = validarSemilla(JSON.parse(texto));
      if (!validada.ok) throw new Error('La semilla del repositorio no valida');
      const { cierres, productos } = materializarSemilla(validada.semilla, new Date());
      const ctx = { cierres, productos, hoy: fechaLocal(new Date()) };
      const paraTodos = responderConsulta(
        jevInterpreta({ intencion: 'cuantoPreparar', producto: 'ninguno', dia: 'ninguno', confianza: 0.9 }),
        ctx,
      );
      const soloAnticucho = responderConsulta(
        jevInterpreta({ intencion: 'cuantoPreparar', producto: 'anticucho', dia: 'ninguno', confianza: 0.9 }),
        ctx,
      );
      expect(paraTodos.frase).toMatch(/^Para mañana/);
      expect(paraTodos.frase).not.toBe(soloAnticucho.frase);
      const red = redDeLaApp(texto, {
        interpretar: cuerpo =>
          respuestaJson(
            cuerpo.texto === '¿cuánto debo preparar mañana?'
              ? interpretacion('cuantoPreparar')
              : { ...interpretacion('cuantoPreparar'), producto: 'anticucho' },
          ),
      });
      await conApp(red, async () => {
        await abrirElChat();
        await preguntar('¿cuánto debo preparar de anticucho?');
        expect(textoDe('chat-burbuja-1-texto')).toBe(soloAnticucho.frase);
        await preguntar('¿cuánto debo preparar mañana?');

        expect(textoDe('chat-burbuja-3-texto')).toBe(paraTodos.frase);
      });
    })();
  });
});
