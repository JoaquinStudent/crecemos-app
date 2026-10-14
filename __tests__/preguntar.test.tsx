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
import { medidasBarra } from '@navigation/medidasBarra';
import { PREGUNTAS_SUGERIDAS } from '@analisis/intenciones';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import { importarSemilla } from '@storage/repositorio';
import { JEV_URL, SEED_URL } from '../src/config';

const TEXTO_PRIVACIDAD =
  'Tu pregunta se envía a un servicio de inteligencia artificial para entenderla. Algunas respuestas se envían ya calculadas (por ejemplo, cuánto te queda en el ciclo) para valorar cómo va el negocio. Nunca van tu nombre, tu Yape, lo que te deben por cobrar ni tus días uno por uno. Si no hay internet, la pregunta se entiende en tu teléfono y no se envía nada.';
const RUTA_SEMILLA = join(__dirname, '..', 'seed', 'semilla.json');
const SEMILLA = readFileSync(RUTA_SEMILLA, 'utf8');
const prepararDemostracion = async () => {
  const validada = validarSemilla(JSON.parse(SEMILLA));
  if (!validada.ok) throw new Error('La semilla no valida');
  await importarSemilla(
    materializarSemilla(validada.semilla, new Date()),
    new Date().toISOString(),
  );
};

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
  // Las props del primer nodo dibujado (host) con ese testID.
  const propsDe = (testID: string) => {
    const encontrado = app.root.findAll(n => n.props.testID === testID && typeof n.type === 'string')[0];
    if (!encontrado) throw new Error(`No hay nada con testID "${testID}"`);
    return encontrado.props;
  };
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
  const abrirDesdeInicio = () => tocar('tab-asistente');
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
    propsDe,
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

  it('una intención que se juzga pide clasificación y juicio, sin redacción', async () => {
    const red = ponerRed({
      interpretar: () => respuestaJson(interpretacion('peorDia')),
      juzgar: () => respuestaJson({ semaforo: 'ojo', confianza: 0.9 }),
    });
    await prepararDemostracion();
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿qué día me va peor?');

    expect(red.tipos()).toEqual(['interpretar', 'juzgar']);
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

  it('mientras espera el botón de enviar queda ocupado y un segundo toque no envía otra pregunta', async () => {
    let soltar!: (r: Response) => void;
    const espera = new Promise<Response>(resolver => {
      soltar = resolver;
    });
    const red = ponerRed({ interpretar: () => espera });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.escribir('preguntar-campo', '¿cuánto vendí ayer?');
    // Botón solo de ícono (excepción pedida): sin texto visible y con la etiqueta "Preguntar".
    expect(p.textosEn('preguntar-enviar')).toEqual([]);
    expect(p.propsDe('preguntar-enviar').accessibilityLabel).toBe('Preguntar');
    expect(p.propsDe('preguntar-enviar').accessibilityRole).toBe('button');
    const { pendiente } = await p.tocarSinEsperar('preguntar-enviar');

    // Pensando: el botón queda ocupado y apagado, y los toques de más no hacen nada.
    expect(p.estadoDe('preguntar-enviar')).toMatchObject({ disabled: true, busy: true });
    await p.tocar('preguntar-enviar');
    // Mientras espera, las sugeridas también están apagadas y se ve la burbuja de "pensando".
    expect(p.estadoDe('preguntar-sugerida-0')?.disabled).toBe(true);
    await p.tocar('preguntar-sugerida-0');
    expect(p.existe('chat-pensando')).toBe(true);
    expect(red.tipos()).toEqual(['interpretar']);

    // Llega la respuesta: el botón vuelve a su estado normal (sin texto escrito sigue apagado, no ocupado).
    await act(async () => {
      soltar(respuestaJson(interpretacion('ventaDelDia', 'ayer')));
      await pendiente;
    });
    expect(p.estadoDe('preguntar-enviar')).toMatchObject({ busy: false });
    expect(p.estadoDe('preguntar-sugerida-0')?.disabled).toBe(false);
    expect(p.existe('chat-pensando')).toBe(false);
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
    // Sin red igual se responde: la pregunta se entiende en el teléfono, con la nota visible.
    expect(p.textoDe('chat-burbuja-1-texto')).toBe('Ayer no cerraste tu día.');
    expect(p.textoDe('chat-burbuja-1-sin-internet')).toBe('Respondí sin internet');
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
    // Vive solo en la memoria de la pantalla (la pestaña): nada llegó al almacenamiento.
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
    await p.tocar('preguntar-aviso-alternar');

    expect(p.textoDe('preguntar-aviso-privacidad-texto')).toBe(TEXTO_PRIVACIDAD);
    // Está arriba, en la cabecera: no dentro de lo que se desplaza.
    expect(p.textosEn('preguntar-chat')).not.toContain(TEXTO_PRIVACIDAD);
    // Y no depende de haber preguntado algo.
    expect(p.existe('chat-burbuja-0')).toBe(false);
  });

  it('es una pestaña: no lleva "Atrás" y se sale tocando otra pestaña', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();
    expect(p.textosEn('preguntar-pantalla').filter(t => t === 'Atrás')).toHaveLength(0);
    expect(p.existe('preguntar-atras')).toBe(false);
    await p.tocar('tab-inicio');

    expect(p.existe('inicio-saludo')).toBe(true);
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
    await prepararDemostracion();
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
    await prepararDemostracion();
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
    // Con el aviso abierto, para medir también sus letras.
    await p.tocar('preguntar-aviso-alternar');

    const letras = p.letrasDelChat();
    expect(letras.length).toBeGreaterThan(10);
    for (const letra of letras) {
      expect(letra.fontSize).toBeGreaterThanOrEqual(14);
      expect(letra.color).not.toBe(colors.accent);
    }
    // El texto base del chat (las burbujas) es el cuerpo: 16 con la letra Normal por defecto.
    expect(letras.find(l => l.testID === 'chat-burbuja-0-texto')?.fontSize).toBe(16);
    expect(letras.find(l => l.testID === 'chat-burbuja-1-texto')?.fontSize).toBe(16);
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

  it('los toques miden 48 o más: las sugeridas y "Preguntar"', async () => {
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
    expect(alto('preguntar-sugerida-0')).toBeGreaterThanOrEqual(48);
    expect(alto('preguntar-enviar')).toBeGreaterThanOrEqual(48);
  });
});

describe('Chat "Preguntarle a mis datos": encabezado compacto, aviso plegado y sugeridas en fila', () => {
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

  it('el título es de una sola línea', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();

    const titulo = p.app.root.findAll(
      n => esHost(n, 'Text') && n.props.testID === 'preguntar-titulo',
    )[0];
    expect(textoCompleto(titulo)).toBe('Preguntarle a mis datos');
    expect(titulo.props.numberOfLines).toBe(1);
  });

  it('al abrir, el aviso va plegado en una línea con "Ver aviso", y se abre y se oculta', async () => {
    ponerRed(ventaDeAyer);
    const p = await montarApp();

    await p.abrirDesdeInicio();

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

    // Sigue plegado/abierto como lo dejó aunque se pregunte algo.
    await p.preguntar('¿cuánto vendí ayer?');
    expect(p.existe('preguntar-aviso-privacidad')).toBe(true);

    // "Ocultar" lo vuelve a plegar.
    await p.tocar('preguntar-aviso-alternar');
    expect(p.existe('preguntar-aviso-privacidad')).toBe(false);
    expect(p.textosEn('preguntar-aviso-alternar')).toEqual(['Ver aviso']);
  });

  it('las sugeridas son una fila horizontal que se desliza, fija al pie, antes y después de preguntar', async () => {
    ponerRed(ventaDeAyer);
    const p = await montarApp();

    await p.abrirDesdeInicio();
    const fila = () =>
      p.app.root.findAll(
        n => n.props.testID === 'preguntar-sugeridas' && esHost(n, 'RCTScrollView'),
      )[0];
    expect(fila().props.horizontal).toBe(true);
    expect(fila().props.showsHorizontalScrollIndicator).toBe(false);
    PREGUNTAS_SUGERIDAS.forEach((pregunta, i) => {
      expect(p.textosEn(`preguntar-sugerida-${i}`)).toEqual([pregunta]);
    });
    // Dentro del pie fijo (con el campo), no dentro del scroll de la conversación.
    const pantalla = p.app.root.findAll(n => n.props.testID === 'preguntar-pantalla')[0];
    const chat = pantalla.findAll(
      n => n.props.testID === 'preguntar-chat' && esHost(n, 'RCTScrollView'),
    )[0];
    expect(chat.findAll(n => n.props.testID === 'preguntar-sugeridas')).toHaveLength(0);
    const teclado = pantalla.findAll(n => (n.type as unknown) === KeyboardAvoidingView)[0];
    expect(teclado.findAll(n => n.props.testID === 'preguntar-sugeridas').length).toBeGreaterThan(0);
    // Ya no hay panel de 200 dp ni botón "Preguntas sugeridas".
    expect(p.existe('preguntar-panel')).toBe(false);
    expect(p.existe('preguntar-panel-alternar')).toBe(false);

    await p.preguntar('¿cuánto vendí ayer?');
    expect(fila()).toBeDefined();
  });

  it('tocar una sugerida envía esa pregunta una sola vez', async () => {
    const red = ponerRed(ventaDeAyer);
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿cuánto vendí ayer?');
    await p.tocar('preguntar-sugerida-2');

    const interpretadas = red.cuerpos().filter(c => c.tipo === 'interpretar');
    expect(interpretadas).toHaveLength(2);
    expect(interpretadas[1]).toEqual({ tipo: 'interpretar', texto: PREGUNTAS_SUGERIDAS[2] });
    expect(p.textoDe('chat-burbuja-2-texto')).toBe(PREGUNTAS_SUGERIDAS[2]);
    expect(p.valorDe('preguntar-campo')).toBe('');
  });

  it('tras un "No entendí" las sugeridas siguen a la mano en la fila', async () => {
    ponerRed({
      interpretar: () => respuestaJson({ ...interpretacion('compararCiclo'), confianza: 0.3 }),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('algo raro');

    expect(p.textoDe('chat-burbuja-1-texto')).toContain('No entendí la pregunta');
    PREGUNTAS_SUGERIDAS.forEach((pregunta, i) => {
      expect(p.textosEn(`preguntar-sugerida-${i}`)).toEqual([pregunta]);
    });
  });

  it('mientras espera hay una burbuja de "pensando" sin texto, y se va al responder', async () => {
    let soltar!: (r: Response) => void;
    const espera = new Promise<Response>(resolver => {
      soltar = resolver;
    });
    ponerRed({ interpretar: () => espera });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    expect(p.existe('chat-pensando')).toBe(false);
    await p.escribir('preguntar-campo', '¿cuánto vendí ayer?');
    const { pendiente } = await p.tocarSinEsperar('preguntar-enviar');

    const burbuja = p.app.root.findAll(
      n => n.props.testID === 'chat-pensando' && esHost(n, 'View'),
    )[0];
    expect(burbuja.props.accessibilityLabel).toBe('El asistente está pensando');
    expect(p.textosEn('chat-pensando')).toEqual([]);

    await act(async () => {
      soltar(respuestaJson(interpretacion('ventaDelDia', 'ayer')));
      await pendiente;
    });
    expect(p.existe('chat-pensando')).toBe(false);
  });

  it('el botón de enviar es un círculo de 48 dp que no cambia de tamaño mientras espera', async () => {
    let soltar!: (r: Response) => void;
    const espera = new Promise<Response>(resolver => {
      soltar = resolver;
    });
    ponerRed({ interpretar: () => espera });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    const medida = () => {
      const boton = p.app.root.findAll(
        n => n.props.testID === 'preguntar-enviar' && esHost(n, 'View'),
      )[0];
      const estilo = StyleSheet.flatten(
        typeof boton.props.style === 'function' ? boton.props.style({ pressed: false }) : boton.props.style,
      );
      return [estilo.width, estilo.height, estilo.borderRadius];
    };
    const antes = medida();
    expect(antes.slice(0, 2)).toEqual([48, 48]);
    expect(antes[2]).toBeGreaterThanOrEqual(24);
    await p.escribir('preguntar-campo', '¿cuánto vendí ayer?');
    const { pendiente } = await p.tocarSinEsperar('preguntar-enviar');
    expect(p.textosEn('preguntar-enviar')).toEqual([]);
    expect(medida()).toEqual(antes);

    await act(async () => {
      soltar(respuestaJson(interpretacion('ventaDelDia', 'ayer')));
      await pendiente;
    });
  });

  it('el campo toma el ancho que sobra, con un texto corto, y el aviso puede partirse', async () => {
    const p = await montarApp();
    await p.abrirDesdeInicio();

    const campo = p.app.root.findAll(n => esHost(n, 'TextInput') && n.props.testID === 'preguntar-campo')[0];
    expect(campo.props.placeholder).toBe('Tu pregunta');
    const contenedor = p.app.root.findAll(
      n => typeof n.type !== 'string' && StyleSheet.flatten(n.props.style)?.minWidth === 0,
    );
    expect(contenedor.length).toBeGreaterThan(0);
    const aviso = p.app.root.findAll(n => esHost(n, 'View') && n.props.testID === 'preguntar-aviso-compacto')[0];
    expect(StyleSheet.flatten(aviso.props.style)).toMatchObject({ flexWrap: 'wrap' });
  });

  it('un 429 muestra una burbuja de aviso: "Hay muchas preguntas ahora. Prueba en un minuto."', async () => {
    ponerRed({
      interpretar: () => ({ ok: false, status: 429, text: async () => '{}' } as unknown as Response),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('cuéntame un chiste');

    expect(p.textoDe('chat-burbuja-1-texto')).toBe('Hay muchas preguntas ahora. Prueba en un minuto.');
    expect(p.existe('chat-burbuja-1-aviso')).toBe(true);
    expect(p.textosEn('chat-burbuja-1-aviso')).toEqual(['Aviso']);
  });

  it('un 502 dice que el asistente no está disponible, con la burbuja de aviso', async () => {
    ponerRed({
      interpretar: () => ({ ok: false, status: 502, text: async () => '{}' } as unknown as Response),
    });
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('cuéntame un chiste');

    expect(p.textoDe('chat-burbuja-1-texto')).toBe('El asistente no está disponible ahora.');
    expect(p.existe('chat-burbuja-1-aviso')).toBe(true);
  });

  it('sin red y sin entender la pregunta, avisa y ofrece tres preguntas, como aviso', async () => {
    ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('cuéntame un chiste');

    const texto = p.textoDe('chat-burbuja-1-texto');
    expect(texto).toContain('Sin internet no pude entender tu pregunta. Prueba con una de estas:');
    for (const q of PREGUNTAS_SUGERIDAS.slice(0, 3)) expect(texto).toContain(q);
    expect(p.existe('chat-burbuja-1-aviso')).toBe(true);
  });

  it('sin red, una pregunta del negocio se responde en el teléfono con la nota "Respondí sin internet" y sin semáforo', async () => {
    const red = ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿cuánto me deben?');

    expect(p.textoDe('chat-burbuja-1-texto')).toMatch(/por cobrar/);
    expect(p.textoDe('chat-burbuja-1-sin-internet')).toBe('Respondí sin internet');
    expect(p.existe('chat-burbuja-1-semaforo')).toBe(false);
    expect(p.existe('chat-burbuja-1-aviso')).toBe(false);
    // Solo el intento que falló: nada más sale del teléfono.
    expect(red.tipos()).toEqual(['interpretar']);
  });

  it('el aviso de falla tiene otro tono que una respuesta normal; la respuesta no lleva "Aviso"', async () => {
    ponerRed(ventaDeAyer);
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.preguntar('¿cuánto vendí ayer?');

    expect(p.existe('chat-burbuja-1-aviso')).toBe(false);
    const burbuja = p.app.root.findAll(
      n => n.props.testID === 'chat-burbuja-1' && esHost(n, 'View'),
    )[0];
    expect(StyleSheet.flatten(burbuja.props.style).backgroundColor).not.toBe(colors.dangerSoft);
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

  it('Inicio ya no tiene botón flotante: el chat es la pestaña "Asistente"', async () => {
    ponerRed({});
    const p = await montarApp();

    expect(p.existe('inicio-preguntar')).toBe(false);
    expect(p.textosEn('tab-asistente')).toEqual(['Asistente']);
  });

  it('sin botón flotante, el scroll de Inicio deja solo el sitio de la barra al final', async () => {
    ponerRed({});
    await prepararDemostracion();
    const p = await montarApp();

    const scroll = p.app.root.findAll(n => esHost(n, 'RCTScrollView'))[0];
    const estilo = StyleSheet.flatten(scroll.props.contentContainerStyle);
    // La barra es una capa encima: el relleno es justo el de la barra (no un colchón de más).
    expect(estilo.paddingBottom).toBe(medidasBarra(0).rellenoContenido);
    expect(p.existe('inicio-cerrar-dia-rapido')).toBe(true);
  });

  it('abrir la pestaña Asistente y volver a Inicio no envía ninguna petición', async () => {
    const red = ponerRed({});
    const p = await montarApp();

    await p.abrirDesdeInicio();
    await p.tocar('tab-inicio');

    expect(red.tipos()).toEqual([]);
  });

  it('Resumen tiene "Preguntarle a mis datos", que abre el mismo chat (la pestaña Asistente)', async () => {
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
    expect(p.estadoDe('tab-asistente')).toMatchObject({ selected: true });
    await p.tocar('tab-resumen');

    expect(p.existe('resumen-preguntar')).toBe(true);
    expect(red.tipos()).toEqual([]);
  });
});
