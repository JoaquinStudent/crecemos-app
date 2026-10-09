/**
 * Pruebas de apoyo del chat "Preguntarle a mis datos" (no son escenarios del SPEC; los escenarios
 * 5, 6, 11, 12, 13, 14 y 18 viven en sprint-08.test.ts): lo que la pantalla promete además de lo
 * que fija el SPEC. Nada se envía al abrir ni al escribir, una petición por toque, "Pensando…" sin
 * segundo envío, las sugeridas, el aviso de privacidad, el pie fijo, los accesos y las reglas de UX.
 * La app real, por testID, como lo haría una persona.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { colors } from '@theme';
import { PREGUNTAS_SUGERIDAS } from '@analisis/intenciones';
import { JEV_URL, SEED_URL } from '../src/config';

const TEXTO_PRIVACIDAD =
  'Tu pregunta y unos totales se envían a un servicio de inteligencia artificial para entenderla y escribirte la respuesta. Nunca va tu nombre, tu Yape ni tus movimientos.';
const RUTA_SEMILLA = join(__dirname, '..', 'seed', 'semilla.json');
const SEMILLA = readFileSync(RUTA_SEMILLA, 'utf8');

type Tipo = 'interpretar' | 'redactar' | 'juzgar';
interface Cuerpo {
  tipo: Tipo;
  texto?: string;
  hecho?: { frase: string };
}

const respuestaJson = (cuerpo: unknown) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(cuerpo) } as unknown as Response);
const interpretacion = (intencion: string, dia = 'ninguno') => ({
  intencion,
  producto: 'ninguno',
  dia,
  confianza: 0.95,
});

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');
const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const fetchPorDefecto = global.fetch;

/** La red de la app: la semilla (o nada) y un servidor del chat que contesta según el tipo. */
const ponerRed = (
  chat: Partial<Record<Tipo, (cuerpo: Cuerpo) => Response | Promise<Response>>>,
  semilla: string | null = SEMILLA,
) => {
  const f = jest.fn(async (url: string, init?: { body?: string }) => {
    if (url === SEED_URL) {
      if (semilla === null) throw new TypeError('Network request failed');
      return { ok: true, status: 200, text: async () => semilla } as unknown as Response;
    }
    if (url === JEV_URL) {
      const cuerpo = JSON.parse(init?.body ?? '{}') as Cuerpo;
      const responder = chat[cuerpo.tipo];
      if (!responder) throw new TypeError('Network request failed');
      return responder(cuerpo);
    }
    throw new TypeError('Network request failed');
  });
  global.fetch = f as unknown as typeof fetch;
  const cuerpos = (): Cuerpo[] =>
    (f.mock.calls as unknown as Array<[string, { body?: string }]>)
      .filter(([url]) => url === JEV_URL)
      .map(([, init]) => JSON.parse(init.body ?? '{}') as Cuerpo);
  return { cuerpos, tipos: () => cuerpos().map(c => c.tipo) };
};

const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
  montada = app;

  const nodo = (testID: string, evento: 'onPress' | 'onChangeText') => {
    const encontrado = app.root.findAll(
      n => n.props.testID === testID && typeof n.props[evento] === 'function',
    )[0];
    if (!encontrado) throw new Error(`No hay nada con testID "${testID}" que responda a ${evento}`);
    return encontrado;
  };
  const tocar = (testID: string) =>
    act(async () => {
      await nodo(testID, 'onPress').props.onPress();
    });
  /** Toca sin esperar a que termine lo que el toque dispara; devuelve lo que falta por esperar. */
  const tocarSinEsperar = async (testID: string) => {
    let pendiente: unknown;
    await act(async () => {
      pendiente = nodo(testID, 'onPress').props.onPress();
    });
    // En una caja: devolver la promesa tal cual haría que el `await` de quien llama la esperara.
    return { pendiente: pendiente as Promise<void> };
  };
  const escribir = (testID: string, texto: string) =>
    act(async () => {
      nodo(testID, 'onChangeText').props.onChangeText(texto);
    });
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const textosEn = (testID: string): string[] => {
    const dentro = app.root.findAll(n => n.props.testID === testID)[0];
    if (!dentro) throw new Error(`No hay nada con testID "${testID}"`);
    return dentro.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  };
  const textoNodo = (testID: string) => {
    const encontrado = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!encontrado) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return encontrado;
  };
  const textoDe = (testID: string) => textoCompleto(textoNodo(testID));
  const estadoDe = (testID: string) =>
    app.root.findAll(n => n.props.testID === testID && n.props.accessibilityState)[0]?.props
      .accessibilityState;
  const valorDe = (testID: string) => nodo(testID, 'onChangeText').props.value;
  const estiloDe = (testID: string) => {
    const vista = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!vista) throw new Error(`No hay ninguna vista con testID "${testID}"`);
    return StyleSheet.flatten(vista.props.style);
  };
  /** Los textos que pinta la pantalla del chat, con su tamaño y su color. */
  const letrasDelChat = () =>
    app.root
      .findAll(n => n.props.testID === 'preguntar-pantalla')[0]
      .findAll(n => esHost(n, 'Text'))
      .map(n => ({
        texto: textoCompleto(n),
        testID: n.props.testID as string | undefined,
        ...StyleSheet.flatten(n.props.style),
      }));
  const abrirDesdeInicio = () => tocar('inicio-preguntar');
  const preguntar = async (texto: string) => {
    await escribir('preguntar-campo', texto);
    await tocar('preguntar-enviar');
  };
  return {
    app,
    tocar,
    tocarSinEsperar,
    escribir,
    existe,
    textosEn,
    textoDe,
    estadoDe,
    valorDe,
    estiloDe,
    letrasDelChat,
    abrirDesdeInicio,
    preguntar,
  };
};

describe('Chat "Preguntarle a mis datos": lo que se envía y cuándo', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  it('abrir la pantalla y escribir no envían nada; solo "Preguntar" envía', async () => {
    const red = ponerRed({
      interpretar: () => respuestaJson(interpretacion('ventaDelDia', 'ayer')),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.escribir('preguntar-campo', '¿cuánto vendí ayer?');
    await p.escribir('preguntar-campo', '¿cuánto vendí ayer');
    await p.escribir('preguntar-campo', '¿cuánto vendí ayer?');
    expect(red.tipos()).toEqual([]);

    await p.tocar('preguntar-enviar');
    expect(red.tipos()[0]).toBe('interpretar');
    expect(red.tipos().filter(t => t === 'interpretar')).toHaveLength(1);
  });

  it('una intención que se juzga hace 1 petición para interpretar, 1 para redactar y 1 para juzgar', async () => {
    const red = ponerRed({
      interpretar: () => respuestaJson(interpretacion('peorDia')),
      redactar: () => respuestaJson({ texto: 'No sale.' }),
      juzgar: () => respuestaJson({ semaforo: 'ojo', confianza: 0.9 }),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿qué día me va peor?');

    expect([...red.tipos()].sort()).toEqual(['interpretar', 'juzgar', 'redactar']);
  });

  it('tocar "Preguntar" con el campo vacío o con solo espacios no envía nada', async () => {
    const red = ponerRed({ interpretar: () => respuestaJson(interpretacion('ventaDelDia')) });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.tocar('preguntar-enviar');
    await p.escribir('preguntar-campo', '    ');
    await p.tocar('preguntar-enviar');

    expect(red.tipos()).toEqual([]);
    expect(p.estadoDe('preguntar-enviar')?.disabled).toBe(true);
  });

  it('mientras espera dice "Pensando…" y un segundo toque no envía otra pregunta', async () => {
    let soltar!: (r: Response) => void;
    const espera = new Promise<Response>(resolver => {
      soltar = resolver;
    });
    const red = ponerRed({ interpretar: () => espera });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.escribir('preguntar-campo', '¿cuánto vendí ayer?');
    expect(p.textosEn('preguntar-pantalla')).toContain('Preguntar');
    const { pendiente } = await p.tocarSinEsperar('preguntar-enviar');

    // Pensando: el botón lo dice, está apagado y los toques de más no hacen nada.
    expect(p.textosEn('preguntar-enviar')).toEqual(['Pensando…']);
    expect(p.estadoDe('preguntar-enviar')?.disabled).toBe(true);
    await p.tocar('preguntar-enviar');
    // Las sugeridas ya están plegadas en su panel; abierto, también están apagadas.
    await p.tocar('preguntar-panel-alternar');
    await p.tocar('preguntar-panel-sugerida-0');
    expect(p.estadoDe('preguntar-panel-sugerida-0')?.disabled).toBe(true);
    expect(red.tipos()).toEqual(['interpretar']);

    // Llega la respuesta: el botón vuelve a decir "Preguntar".
    await act(async () => {
      soltar(respuestaJson(interpretacion('ventaDelDia', 'ayer')));
      await pendiente;
    });
    expect(p.textosEn('preguntar-enviar')).toEqual(['Preguntar']);
    expect(p.estadoDe('preguntar-panel-sugerida-0')?.disabled).toBe(false);
  });

  it('tocar una pregunta sugerida equivale a escribirla y preguntar: una sola petición', async () => {
    const red = ponerRed({
      interpretar: () => respuestaJson(interpretacion('ventaDelDia', 'ayer')),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.tocar('preguntar-sugerida-0');

    // La pregunta aparece como burbuja de Freddy, igual que si la hubiera escrito.
    expect(p.textoDe('chat-burbuja-0-texto')).toBe(PREGUNTAS_SUGERIDAS[0]);
    expect(p.textoDe('chat-burbuja-1-texto')).toMatch(/vendiste S\/ [\d,]+\.\d{2}|cerraste/);
    expect(red.cuerpos()[0]).toEqual({ tipo: 'interpretar', texto: PREGUNTAS_SUGERIDAS[0] });
    expect(red.tipos().filter(t => t === 'interpretar')).toHaveLength(1);
    expect(p.valorDe('preguntar-campo')).toBe('');
  });

  it('las seis sugeridas salen de PREGUNTAS_SUGERIDAS y se ven antes de preguntar nada', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();

    expect(PREGUNTAS_SUGERIDAS).toHaveLength(6);
    PREGUNTAS_SUGERIDAS.forEach((pregunta, i) => {
      expect(p.textosEn(`preguntar-sugerida-${i}`)).toEqual([pregunta]);
    });
    // Sin burbujas todavía.
    expect(p.existe('chat-burbuja-0')).toBe(false);
  });

  it('el campo se vacía al enviar, y también tras un fallo de red', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.escribir('preguntar-campo', '¿cuánto vendí ayer?');
    expect(p.valorDe('preguntar-campo')).toBe('¿cuánto vendí ayer?');
    await p.tocar('preguntar-enviar');

    expect(p.valorDe('preguntar-campo')).toBe('');
    expect(p.textoDe('chat-burbuja-1-texto')).toBe(
      'Necesitas internet para esto. Revisa tu conexión e inténtalo otra vez.',
    );
  });

  it('el historial es solo de la sesión: nada de la conversación se guarda en el teléfono', async () => {
    ponerRed({ interpretar: () => respuestaJson(interpretacion('ventaDelDia', 'ayer')) });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('una pregunta que no debe quedar guardada');

    const almacen = createAsyncStorage('crecemos');
    const claves = await almacen.getAllKeys();
    for (const clave of claves) {
      expect(clave).not.toMatch(/chat|pregunta|conversaci/i);
      expect(String((await almacen.getItem(clave)) ?? '')).not.toContain(
        'una pregunta que no debe quedar guardada',
      );
    }
    // Al salir y volver a entrar, el chat empieza de cero.
    await p.tocar('preguntar-atras');
    await p.abrirDesdeInicio();
    expect(p.existe('chat-burbuja-0')).toBe(false);
  });
});

describe('Chat "Preguntarle a mis datos": lo que se ve', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  it('el aviso de privacidad dice exactamente lo del SPEC y está fuera del scroll', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();

    expect(p.textoDe('preguntar-aviso-privacidad-texto')).toBe(TEXTO_PRIVACIDAD);
    // Está arriba, en la cabecera: no dentro de lo que se desplaza.
    expect(p.textosEn('preguntar-chat')).not.toContain(TEXTO_PRIVACIDAD);
    // Y no depende de haber preguntado algo.
    expect(p.existe('chat-burbuja-0')).toBe(false);
  });

  it('una sola forma de volver: "Atrás", y regresa a la pantalla de donde se abrió', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();
    expect(p.textosEn('preguntar-pantalla').filter(t => t === 'Atrás')).toHaveLength(1);
    await p.tocar('preguntar-atras');

    expect(p.existe('preguntar-pantalla')).toBe(false);
    expect(p.existe('inicio-preguntar')).toBe(true);
  });

  it('el campo y "Preguntar" van fuera del scroll, dentro de un KeyboardAvoidingView', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();

    const pantalla = p.app.root.findAll(n => n.props.testID === 'preguntar-pantalla')[0];
    const scroll = pantalla.findAll(n => esHost(n, 'RCTScrollView'))[0];
    expect(scroll).toBeDefined();
    // Ni el campo ni el botón están dentro del scroll…
    expect(scroll.findAll(n => n.props.testID === 'preguntar-campo')).toHaveLength(0);
    expect(scroll.findAll(n => n.props.testID === 'preguntar-enviar')).toHaveLength(0);
    // …y sí dentro de un KeyboardAvoidingView que sube con el teclado.
    const teclado = pantalla.findAll(n => (n.type as unknown) === KeyboardAvoidingView)[0];
    expect(teclado).toBeDefined();
    expect(teclado.findAll(n => n.props.testID === 'preguntar-campo').length).toBeGreaterThan(0);
    expect(teclado.findAll(n => n.props.testID === 'preguntar-enviar').length).toBeGreaterThan(0);
    // Con el teclado abierto, tocar una pregunta sugerida no se pierde en el primer toque.
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  });

  it('sin semáforo, la burbuja sale normal: sin palabra, sin símbolo y con la letra oscura', async () => {
    ponerRed({
      interpretar: () => respuestaJson(interpretacion('ventaDelDia', 'ayer')),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿cuánto vendí ayer?');

    expect(p.existe('chat-burbuja-1')).toBe(true);
    expect(p.existe('chat-burbuja-1-semaforo')).toBe(false);
    expect(p.existe('chat-burbuja-1-semaforo-palabra')).toBe(false);
    expect(p.existe('chat-burbuja-1-semaforo-simbolo')).toBe(false);
  });

  it('si Jev no juzga con confianza, la respuesta sale igual y sin semáforo', async () => {
    ponerRed({
      interpretar: () => respuestaJson(interpretacion('peorDia')),
      juzgar: () => respuestaJson({ semaforo: 'urgente', confianza: 0.3 }),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿qué día me va peor?');

    expect(p.textoDe('chat-burbuja-1-texto')).toMatch(/son tu día más flojo/);
    expect(p.existe('chat-burbuja-1-semaforo')).toBe(false);
  });

  it('con el semáforo, la burbuja lleva el borde fuerte de su color y el ícono lleva su etiqueta al lado', async () => {
    ponerRed({
      interpretar: () => respuestaJson(interpretacion('peorDia')),
      juzgar: () => respuestaJson({ semaforo: 'urgente', confianza: 0.9 }),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿qué día me va peor?');

    expect(p.textoDe('chat-burbuja-1-semaforo-palabra')).toBe('Urgente');
    expect(p.estiloDe('chat-burbuja-1').backgroundColor).toBe(colors.dangerSoft);
    expect(p.estiloDe('chat-burbuja-1').borderLeftColor).toBe(colors.danger);
    // El lector de pantalla oye la palabra junto a la respuesta.
    const burbuja = p.app.root.findAll(
      n => esHost(n, 'View') && n.props.testID === 'chat-burbuja-1',
    )[0];
    expect(burbuja.props.accessibilityLabel).toMatch(/^Respuesta, Urgente: /);
  });

  it('todas las letras del chat miden 14 o más y ninguna es naranja', async () => {
    ponerRed({
      interpretar: () => respuestaJson(interpretacion('peorDia')),
      juzgar: () => respuestaJson({ semaforo: 'ojo', confianza: 0.9 }),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿qué día me va peor?');
    // Con el aviso y el panel de sugeridas abiertos, para medir también sus letras.
    await p.tocar('preguntar-aviso-alternar');
    await p.tocar('preguntar-panel-alternar');

    const letras = p.letrasDelChat();
    expect(letras.length).toBeGreaterThan(10);
    for (const letra of letras) {
      expect(letra.fontSize).toBeGreaterThanOrEqual(14);
      expect(letra.color).not.toBe(colors.accent);
    }
    // El texto base del chat (las burbujas) es de 18.
    expect(letras.find(l => l.testID === 'chat-burbuja-0-texto')?.fontSize).toBe(18);
    expect(letras.find(l => l.testID === 'chat-burbuja-1-texto')?.fontSize).toBe(18);
  });

  it('los textos del chat no dicen palabras técnicas ni de contabilidad', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿cuánto vendí ayer?');

    const todo = p.textosEn('preguntar-pantalla').join(' | ');
    expect(todo).not.toMatch(
      /\b(balance|margen neto|transacci[oó]n|conciliar|SKU|API|token|JSON)\b/i,
    );
  });

  it('los toques miden 48 o más: Atrás, las sugeridas y "Preguntar"', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();

    const alto = (testID: string) => {
      const nodo = p.app.root.findAll(n => n.props.testID === testID && esHost(n, 'View'))[0];
      const estilo = StyleSheet.flatten(
        typeof nodo.props.style === 'function'
          ? nodo.props.style({ pressed: false })
          : nodo.props.style,
      );
      return estilo.minHeight ?? estilo.height;
    };
    expect(alto('preguntar-atras')).toBeGreaterThanOrEqual(48);
    expect(alto('preguntar-sugerida-0')).toBeGreaterThanOrEqual(48);
    expect(alto('preguntar-enviar')).toBeGreaterThanOrEqual(48);
  });
});

describe('Chat "Preguntarle a mis datos": el aviso y las sugeridas se pliegan', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  const ventaDeAyer = { interpretar: () => respuestaJson(interpretacion('ventaDelDia', 'ayer')) };

  it('al abrir, el aviso sale completo y sin botón para plegarlo', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();

    expect(p.textoDe('preguntar-aviso-privacidad-texto')).toBe(TEXTO_PRIVACIDAD);
    expect(p.existe('preguntar-aviso-compacto')).toBe(false);
    expect(p.existe('preguntar-aviso-alternar')).toBe(false);
  });

  it('tras la primera pregunta el aviso queda en una línea con "Ver aviso", y se abre y se oculta', async () => {
    ponerRed(ventaDeAyer);
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿cuánto vendí ayer?');

    // Una línea con candado y su texto, y un botón de 48 o más.
    expect(p.existe('preguntar-aviso-privacidad')).toBe(false);
    expect(p.textosEn('preguntar-aviso-compacto')).toEqual([
      'Tu pregunta se envía a una IA',
      'Ver aviso',
    ]);
    const boton = p.app.root.findAll(
      n => n.props.testID === 'preguntar-aviso-alternar' && esHost(n, 'View'),
    )[0];
    expect(StyleSheet.flatten(boton.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(boton.props.accessibilityLabel).toBe('Ver aviso');

    // "Ver aviso" lo despliega completo y el botón pasa a "Ocultar".
    await p.tocar('preguntar-aviso-alternar');
    expect(p.textoDe('preguntar-aviso-privacidad-texto')).toBe(TEXTO_PRIVACIDAD);
    expect(p.textosEn('preguntar-aviso-alternar')).toEqual(['Ocultar']);

    // "Ocultar" lo vuelve a plegar.
    await p.tocar('preguntar-aviso-alternar');
    expect(p.existe('preguntar-aviso-privacidad')).toBe(false);
    expect(p.textosEn('preguntar-aviso-alternar')).toEqual(['Ver aviso']);
  });

  it('tras la primera pregunta las sugeridas salen del scroll y quedan tras "Preguntas sugeridas"', async () => {
    ponerRed(ventaDeAyer);
    const p = await montarApp();

    await p.abrirDesdeInicio();
    expect(p.existe('preguntar-panel-alternar')).toBe(false);
    await p.preguntar('¿cuánto vendí ayer?');

    // Fuera del scroll de la conversación…
    expect(p.existe('preguntar-sugeridas')).toBe(false);
    expect(p.existe('preguntar-sugerida-0')).toBe(false);
    expect(p.textosEn('preguntar-chat')).not.toContain(PREGUNTAS_SUGERIDAS[0]);
    // …y un botón con texto justo encima del campo, con el panel cerrado.
    expect(p.textosEn('preguntar-panel-alternar')).toEqual(['Preguntas sugeridas']);
    expect(p.existe('preguntar-panel')).toBe(false);
    const boton = p.app.root.findAll(
      n => n.props.testID === 'preguntar-panel-alternar' && esHost(n, 'View'),
    )[0];
    expect(StyleSheet.flatten(boton.props.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(boton.props.accessibilityState.expanded).toBe(false);
  });

  it('el panel de sugeridas se abre encima del campo, fijo al pie y con altura máxima', async () => {
    ponerRed(ventaDeAyer);
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿cuánto vendí ayer?');
    await p.tocar('preguntar-panel-alternar');

    const pantalla = p.app.root.findAll(n => n.props.testID === 'preguntar-pantalla')[0];
    const panel = pantalla.findAll(
      n => n.props.testID === 'preguntar-panel' && esHost(n, 'RCTScrollView'),
    )[0];
    expect(panel).toBeDefined();
    PREGUNTAS_SUGERIDAS.forEach((pregunta, i) => {
      expect(p.textosEn(`preguntar-panel-sugerida-${i}`)).toEqual([pregunta]);
    });
    // Dentro del pie fijo (con el campo), no dentro del scroll de la conversación.
    const chat = pantalla.findAll(
      n => n.props.testID === 'preguntar-chat' && esHost(n, 'RCTScrollView'),
    )[0];
    expect(chat.findAll(n => n.props.testID === 'preguntar-panel')).toHaveLength(0);
    const teclado = pantalla.findAll(n => (n.type as unknown) === KeyboardAvoidingView)[0];
    expect(teclado.findAll(n => n.props.testID === 'preguntar-panel').length).toBeGreaterThan(0);
    // Altura máxima y desplazamiento por dentro.
    expect(StyleSheet.flatten(panel.props.style).maxHeight).toBeLessThanOrEqual(220);
    expect(
      p.app.root.findAll(n => n.props.testID === 'preguntar-panel-alternar')[0].props
        .accessibilityState.expanded,
    ).toBe(true);
    // El mismo botón lo cierra.
    await p.tocar('preguntar-panel-alternar');
    expect(p.existe('preguntar-panel')).toBe(false);
  });

  it('tocar una sugerida del panel envía esa pregunta una sola vez y cierra el panel', async () => {
    const red = ponerRed(ventaDeAyer);
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿cuánto vendí ayer?');
    await p.tocar('preguntar-panel-alternar');
    await p.tocar('preguntar-panel-sugerida-2');

    const interpretadas = red.cuerpos().filter(c => c.tipo === 'interpretar');
    expect(interpretadas).toHaveLength(2);
    expect(interpretadas[1]).toEqual({ tipo: 'interpretar', texto: PREGUNTAS_SUGERIDAS[2] });
    // La pregunta aparece como burbuja de Freddy y el panel se cerró.
    expect(p.textoDe('chat-burbuja-2-texto')).toBe(PREGUNTAS_SUGERIDAS[2]);
    expect(p.existe('preguntar-panel')).toBe(false);
    expect(p.valorDe('preguntar-campo')).toBe('');
  });

  it('enviar desde el campo también cierra el panel abierto', async () => {
    ponerRed(ventaDeAyer);
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿cuánto vendí ayer?');
    await p.tocar('preguntar-panel-alternar');
    expect(p.existe('preguntar-panel')).toBe(true);
    await p.preguntar('¿cuánto vendí hoy?');

    expect(p.existe('preguntar-panel')).toBe(false);
  });

  it('tras un "No entendí" las sugeridas siguen saliendo bajo esa burbuja', async () => {
    ponerRed({
      interpretar: () => respuestaJson({ ...interpretacion('compararCiclo'), confianza: 0.3 }),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('algo raro');

    PREGUNTAS_SUGERIDAS.forEach((pregunta, i) => {
      expect(p.textosEn(`preguntar-sugerida-${i}`)).toEqual([pregunta]);
    });
    // Y el botón del pie sigue ahí para quien prefiera el panel.
    expect(p.existe('preguntar-panel-alternar')).toBe(true);
  });

  it('el scroll deja la pregunta a la vista: al final mientras espera, y en la pregunta al responder', async () => {
    let soltar!: (r: Response) => void;
    const espera = new Promise<Response>(resolver => {
      soltar = resolver;
    });
    ponerRed({ interpretar: () => espera });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.escribir('preguntar-campo', '¿cuánto vendí ayer?');
    const { pendiente } = await p.tocarSinEsperar('preguntar-enviar');

    const nodoScroll = () =>
      p.app.root.findAll(
        n => (n.type as unknown) === ScrollView && n.props.testID === 'preguntar-chat',
      )[0];
    const instancia = nodoScroll().instance as { scrollTo: jest.Mock; scrollToEnd: jest.Mock };
    const alCambiarElTamano = () =>
      act(async () => {
        nodoScroll().props.onContentSizeChange(320, 900);
      });

    // Esperando: la última burbuja es la pregunta, así que baja hasta el final.
    instancia.scrollTo.mockClear();
    instancia.scrollToEnd.mockClear();
    await alCambiarElTamano();
    expect(instancia.scrollToEnd).toHaveBeenCalledTimes(1);
    expect(instancia.scrollTo).not.toHaveBeenCalled();

    // La pregunta mide su posición en la conversación (la fija el diseño nativo).
    // El envoltorio de la burbuja es el más interno de los que miden su posición.
    const medidores = p.app.root.findAll(
      n =>
        typeof n.props.onLayout === 'function' &&
        n.findAll(m => m.props.testID === 'chat-burbuja-0').length > 0 &&
        esHost(n, 'View'),
    );
    const envoltorio = medidores[medidores.length - 1];
    await act(async () => {
      envoltorio.props.onLayout({
        nativeEvent: { layout: { x: 0, y: 300, width: 300, height: 60 } },
      });
    });

    // Llega la respuesta: el scroll deja arriba la pregunta (y debajo su respuesta), no el final.
    await act(async () => {
      soltar(respuestaJson(interpretacion('ventaDelDia', 'ayer')));
      await pendiente;
    });
    instancia.scrollTo.mockClear();
    instancia.scrollToEnd.mockClear();
    await alCambiarElTamano();
    expect(instancia.scrollToEnd).not.toHaveBeenCalled();
    expect(instancia.scrollTo).toHaveBeenCalledTimes(1);
    const { y } = instancia.scrollTo.mock.calls[0][0];
    expect(y).toBeGreaterThan(250);
    expect(y).toBeLessThanOrEqual(300);
  });
});

describe('Chat "Preguntarle a mis datos": los accesos', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  it('el botón flotante de Inicio es solo un robot con etiqueta, mide 48 o más y queda abajo a la derecha', async () => {
    ponerRed({});
    const p = await montarApp();

    const boton = p.app.root.findAll(
      n => n.props.testID === 'inicio-preguntar' && esHost(n, 'View'),
    )[0];
    const estilo = StyleSheet.flatten(boton.props.style);
    expect(estilo.position).toBe('absolute');
    expect(estilo.right).toBeGreaterThan(0);
    expect(estilo.bottom).toBeGreaterThan(0);
    expect(estilo.width).toBeGreaterThanOrEqual(48);
    expect(estilo.height).toBeGreaterThanOrEqual(48);
    // Sin texto: lo dice la etiqueta accesible, para el lector de pantalla.
    expect(boton.findAll(n => esHost(n, 'Text'))).toHaveLength(0);
    expect(boton.props.accessibilityLabel).toBe('Preguntar');
    expect(boton.props.accessibilityRole).toBe('button');
    expect(boton.findAll(n => (n.type as unknown) === 'RNSVGSvgView').length).toBeGreaterThan(0);
  });

  it('el botón flotante no tapa "Cerrar mi día": el scroll le deja su espacio al final', async () => {
    ponerRed({});
    const p = await montarApp();

    const scroll = p.app.root.findAll(n => esHost(n, 'RCTScrollView'))[0];
    const relleno = StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom;
    expect(relleno).toBeGreaterThanOrEqual(56 + 16);
    expect(p.existe('inicio-cerrar-dia-rapido')).toBe(true);
  });

  it('tocar el botón de Inicio y volver con "Atrás" no envía ninguna petición', async () => {
    const red = ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.tocar('preguntar-atras');

    expect(red.tipos()).toEqual([]);
  });

  it('Resumen tiene "Preguntarle a mis datos", que abre el mismo chat, y "Atrás" vuelve a Resumen', async () => {
    const red = ponerRed({});
    const p = await montarApp();

    await p.tocar('tab-resumen');
    expect(p.textosEn('resumen-preguntar')).toEqual(['Preguntarle a mis datos']);
    await p.tocar('resumen-preguntar');

    expect(p.existe('preguntar-pantalla')).toBe(true);
    expect(p.textosEn('preguntar-pantalla')).toContain('Preguntarle a mis datos');
    for (const pregunta of PREGUNTAS_SUGERIDAS) {
      expect(p.textosEn('preguntar-pantalla')).toContain(pregunta);
    }
    await p.tocar('preguntar-atras');

    expect(p.existe('preguntar-pantalla')).toBe(false);
    expect(p.existe('resumen-preguntar')).toBe(true);
    expect(red.tipos()).toEqual([]);
  });
});
