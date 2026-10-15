/**
 * Tests del Sprint-14 que montan la app real: el aviso de privacidad (e13), el e2e del chat que piensa
 * (e14) y la espera larga (e15). Generados desde sdd/spec/Sprint-14-agente/SPEC.md. Los demás
 * escenarios (servicio, resumen, hilo y Worker) viven en `sprint-14.test.ts`.
 * La app, por testID, como lo haría una persona; la red es un `fetch` simulado.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../../App';
import { PREGUNTAS_SUGERIDAS } from '@analisis/intenciones';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import { reiniciarEstadoDeRed } from '@services/jev';
import { importarSemilla } from '@storage/repositorio';
import { JEV_URL, SEED_URL } from '../../src/config';

const TEXTO_PRIVACIDAD =
  'Tu pregunta y lo último que hablaron se envían a un servicio de inteligencia artificial para entenderla y escribirte la respuesta. Algunas respuestas se envían ya calculadas (por ejemplo, cuánto te queda en el ciclo), y si conversan, viajan unos totales por mes y por producto. Nunca van tu nombre, tu Yape, lo que te deben por cobrar ni la lista de tus días. Si no hay internet, solo respondo las preguntas sugeridas y no se envía nada.';
const SEMILLA = readFileSync(join(__dirname, '..', '..', 'seed', 'semilla.json'), 'utf8');
const AVISO_SIN_INTERNET = 'Necesitas internet para esto. Revisa tu conexión e inténtalo otra vez.';

const prepararDemostracion = async () => {
  const validada = validarSemilla(JSON.parse(SEMILLA));
  if (!validada.ok) throw new Error('La semilla no valida');
  await importarSemilla(
    materializarSemilla(validada.semilla, new Date()),
    new Date().toISOString(),
  );
};

// --- La red de la app: un servidor del chat que contesta según el tipo -----------------------------

interface Cuerpo {
  tipo: 'interpretar' | 'redactar' | 'juzgar' | 'conversar';
  texto?: string;
  pregunta?: string;
  hilo?: Array<{ rol: string; texto: string }>;
  hecho?: { frase: string };
  resumen?: { meses: Array<{ mes: string; ventas: number }> };
}
type Servidor = Partial<Record<Cuerpo['tipo'], (cuerpo: Cuerpo) => Response | Promise<Response>>>;

const respuestaJson = (cuerpo: unknown, ok = true, status = 200) =>
  ({ ok, status, text: async () => JSON.stringify(cuerpo) } as unknown as Response);
const clasificacion = (intencion: string, dia = 'ninguno') => ({
  intencion,
  producto: 'ninguno',
  dia,
  confianza: 0.95,
});

const fetchPorDefecto = global.fetch;
const ponerRed = (chat: Servidor, semilla: string | null = SEMILLA) => {
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

// --- La app montada --------------------------------------------------------------------------------

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');
const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
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
  const textoDe = (testID: string) => {
    const encontrado = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!encontrado) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return textoCompleto(encontrado);
  };
  const textosEn = (testID: string): string[] => {
    const dentro = app.root.findAll(n => n.props.testID === testID)[0];
    if (!dentro) throw new Error(`No hay nada con testID "${testID}"`);
    return dentro.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  };
  const etiquetaDe = (testID: string): string => {
    const vista = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!vista) throw new Error(`No hay ninguna vista con testID "${testID}"`);
    return String(vista.props.accessibilityLabel);
  };
  const preguntar = async (texto: string) => {
    await escribir('preguntar-campo', texto);
    await tocar('preguntar-enviar');
  };
  return { app, tocar, tocarSinEsperar, escribir, existe, textoDe, textosEn, etiquetaDe, preguntar };
};

beforeEach(() => {
  clearAllMockStorages();
  reiniciarEstadoDeRed();
});
afterEach(async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
  global.fetch = fetchPorDefecto;
});

describe('SPEC-14 (pantalla): el chat que piensa', () => {
  // @spec14_e13 — El aviso de privacidad sigue visible y correcto
  it('spec14_e13 el aviso de privacidad sigue visible y correcto', async () => {
    // Given: el chat abierto, antes y después de preguntar
    // When: se mira el aviso
    // Then: la línea del aviso siempre está a la vista; "Ver aviso" muestra el texto completo, que dice que viajan la pregunta, lo último que hablaron y totales por mes y por producto, y mantiene "Nunca van tu nombre, tu Yape…"
    ponerRed({ interpretar: () => respuestaJson(clasificacion('ventaDelDia', 'ayer')) });
    await prepararDemostracion();
    const p = await montarApp();
    await p.tocar('tab-asistente');

    expect(p.existe('preguntar-aviso-privacidad')).toBe(false);
    expect(p.textosEn('preguntar-aviso-compacto')).toEqual([
      'Tu pregunta se envía a una IA',
      'Ver aviso',
    ]);
    await p.tocar('preguntar-aviso-alternar');
    expect(p.textoDe('preguntar-aviso-privacidad-texto')).toBe(TEXTO_PRIVACIDAD);
    expect(TEXTO_PRIVACIDAD).toContain('totales por mes y por producto');
    expect(TEXTO_PRIVACIDAD).toContain('lo último que hablaron');
    expect(TEXTO_PRIVACIDAD).toContain('Nunca van tu nombre, tu Yape');
    // Sigue ahí después de preguntar.
    await p.preguntar('¿cuánto vendí ayer?');
    expect(p.textoDe('preguntar-aviso-privacidad-texto')).toBe(TEXTO_PRIVACIDAD);
    expect(p.existe('preguntar-aviso-compacto')).toBe(true);
  });

  // @spec14_e14 — e2e: el chat redacta, conversa, recuerda el hilo y funciona sin internet
  it('spec14_e14 e2e el chat redacta conversa recuerda el hilo y funciona sin internet', async () => {
    // Given: la app con los datos de ejemplo y un servidor que clasifica, redacta y conversa
    // When: se pregunta "¿cuánto vendí ayer?", "¿qué opinas de mi mes?", "¿cuánto me deben?" y "hola"; y luego se cae la red
    // Then: la primera sale redactada; la segunda es conversación con una cifra del resumen y lleva el hilo; lo que te deben no se redacta ni entra al hilo; sin internet una predefinida lleva la etiqueta "Sin internet" y "hola" pide internet con las sugeridas, que se pueden tocar
    const red = ponerRed({
      interpretar: c => {
        const t = c.texto ?? '';
        if (t.includes('deja más')) return respuestaJson(clasificacion('productoQueMasDeja'));
        if (t.includes('me deben')) return respuestaJson(clasificacion('cuantoPorCobrar'));
        return respuestaJson({ ...clasificacion('noEntendi'), confianza: 0.9 });
      },
      redactar: c => respuestaJson({ texto: `${c.hecho?.frase} ¡Sigue así!` }),
      juzgar: () => respuestaJson({ semaforo: 'ojo', confianza: 0.8 }),
      conversar: c => {
        const meses = c.resumen?.meses ?? [];
        const ultimo = meses[meses.length - 1];
        return respuestaJson({
          texto: ultimo ? `Este mes llevas vendidos S/ ${ultimo.ventas}. Vas bien.` : 'Hola.',
        });
      },
    });
    await prepararDemostracion();
    const p = await montarApp();
    await p.tocar('tab-asistente');

    // 1) Redactada.
    await p.preguntar('¿qué producto me deja más?');
    expect(p.textoDe('chat-burbuja-1-texto')).toMatch(/ ¡Sigue así!$/);
    expect(red.tipos()).toEqual(['interpretar', 'redactar']);

    // 2) Conversación, con el hilo de la primera pregunta y su respuesta.
    await p.preguntar('¿qué opinas de mi mes?');
    expect(p.textoDe('chat-burbuja-3-texto')).toMatch(/^Este mes llevas vendidos S\/ \d+/);
    const conversar = red.cuerpos().filter(c => c.tipo === 'conversar')[0];
    expect(conversar.hilo).toEqual([
      { rol: 'freddy', texto: '¿qué producto me deja más?' },
      { rol: 'asistente', texto: p.textoDe('chat-burbuja-1-texto') },
    ]);
    expect(red.cuerpos().filter(c => c.tipo === 'interpretar')[1]).toEqual({
      tipo: 'interpretar',
      texto: '¿qué opinas de mi mes?',
    });

    // 3) Lo que te deben: ni se redacta ni entra al hilo.
    await p.preguntar('¿cuánto me deben?');
    const cobro = p.textoDe('chat-burbuja-5-texto');
    expect(cobro).toMatch(/por cobrar|nada/i);
    expect(red.tipos().slice(-2)).toEqual(['interpretar', 'juzgar']);
    expect(red.tipos().filter(t => t === 'redactar')).toHaveLength(1);

    // 4) Una charla va a la conversación; el hilo trae las últimas 4 y nunca el monto por cobrar.
    await p.preguntar('hola');
    const saludo = red.cuerpos()[red.cuerpos().length - 1];
    expect(saludo.tipo).toBe('conversar');
    expect(saludo.hilo).toHaveLength(4);
    expect(saludo.hilo?.[3]).toEqual({ rol: 'freddy', texto: '¿cuánto me deben?' });
    expect(JSON.stringify(saludo.hilo)).not.toContain(cobro);
    expect(JSON.stringify(red.cuerpos())).not.toContain('Freddy');

    // 5) Sin internet: una predefinida lleva la etiqueta; una libre pide internet y ofrece las sugeridas.
    ponerRed({});
    await p.preguntar('¿cuál me deja más?');
    expect(p.textoDe('chat-burbuja-9-texto')).not.toMatch(/Sigue así/);
    expect(p.textoDe('chat-burbuja-9-sin-internet')).toBe('Sin internet');
    expect(p.etiquetaDe('chat-burbuja-9')).toMatch(/sin internet/i);
    expect(p.existe('chat-burbuja-9-semaforo')).toBe(false);

    await p.preguntar('hola');
    expect(p.textoDe('chat-burbuja-11-texto')).toBe(AVISO_SIN_INTERNET);
    expect(p.existe('chat-burbuja-11-aviso')).toBe(true);
    PREGUNTAS_SUGERIDAS.slice(0, 3).forEach((q, k) => {
      expect(p.textosEn(`chat-sugerida-11-${k}`)).toEqual([q]);
    });

    // Tocar una sugerida del aviso la pregunta: sin internet, se responde y lleva la etiqueta.
    await p.tocar('chat-sugerida-11-0');
    expect(p.textoDe('chat-burbuja-12-texto')).toBe(PREGUNTAS_SUGERIDAS[0]);
    expect(p.textoDe('chat-burbuja-13-sin-internet')).toBe('Sin internet');
    // Las sugeridas del aviso solo se ofrecen mientras sea lo último que se dijo.
    expect(p.existe('chat-sugeridas-11')).toBe(false);
  });

  // @spec14_e15 — Una espera larga no parece un cuelgue
  it('spec14_e15 una espera larga no parece un cuelgue', async () => {
    // Given: una conversación cuyo servidor tarda en contestar
    // When: pasan más de 3,5 segundos esperando
    // Then: la burbuja de "pensando" sigue ahí (con su etiqueta accesible) y dice "Sigo revisando tus datos, un momento…"; al llegar la respuesta se va
    let soltar!: (r: Response) => void;
    ponerRed({
      interpretar: () => respuestaJson({ ...clasificacion('noEntendi'), confianza: 0.9 }),
      conversar: () =>
        new Promise<Response>(resolver => {
          soltar = resolver;
        }),
    });
    await prepararDemostracion();
    const p = await montarApp();
    await p.tocar('tab-asistente');

    await p.escribir('preguntar-campo', '¿qué opinas de mi mes?');
    const { pendiente } = await p.tocarSinEsperar('preguntar-enviar');
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 50));
    });
    // Al principio, solo los puntos.
    expect(p.existe('chat-pensando')).toBe(true);
    expect(p.existe('chat-pensando-texto')).toBe(false);

    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 3600));
    });
    expect(p.existe('chat-pensando')).toBe(true);
    expect(p.textoDe('chat-pensando-texto')).toBe('Sigo revisando tus datos, un momento…');
    expect(p.etiquetaDe('chat-pensando')).toBe('El asistente está pensando');

    await act(async () => {
      soltar(respuestaJson({ texto: 'Vas bien este mes.' }));
      await pendiente;
    });
    expect(p.existe('chat-pensando')).toBe(false);
    expect(p.textoDe('chat-burbuja-1-texto')).toBe('Vas bien este mes.');
  }, 20000);
});
