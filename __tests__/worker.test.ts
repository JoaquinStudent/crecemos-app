/**
 * @jest-environment node
 *
 * Pruebas de apoyo del servidor intermedio (`servidor/worker.js`, Cloudflare Worker). No son
 * escenarios del SPEC. Se llama al Worker como lo haría Cloudflare, con `worker.fetch(request, env)`,
 * y la llamada a OpenRouter es un `global.fetch` simulado: la red y la clave real nunca se tocan.
 */

/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import {
  DIAS_CONSULTA,
  INTENCIONES as INTENCIONES_APP,
  interpretarRespuesta,
} from '@analisis/intenciones';
import worker, {
  DIAS,
  INTENCIONES,
  PRODUCTOS,
  PROVEEDORES_POR_DEFECTO,
} from '../servidor/worker.js';

const RAIZ = join(__dirname, '..');
const URL_WORKER = 'https://asistente.ejemplo.test/';
const URL_OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const URL_SYSTEMONE = 'https://openrouter.ai/api/v1/systemone';
// Una clave inventada y reconocible: así se puede buscar en todo lo que sale del Worker.
const CLAVE = 'clave-de-prueba-que-no-existe-0123456789';
const ENV = {
  OPENROUTER_API_KEY: CLAVE,
  JEV_MODELO: 'jev-latest',
  DEEPSEEK_MODELO: 'deepseek/deepseek-v4-flash',
  DEEPSEEK_PROVEEDORES: 'deepinfra, parasail ,cloudflare',
};

type Env = Record<string, unknown>;
type Init = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

const peticion = (cuerpo: unknown, init: RequestInit = {}, url = URL_WORKER) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    ...init,
  });

const llamar = (cuerpo: unknown, env: Env = ENV, init: RequestInit = {}) =>
  worker.fetch(peticion(cuerpo, init), env);

// Con un argumento (aunque sea `undefined`) va ese valor; sin argumentos, la pregunta de siempre.
const interpretar = (...texto: unknown[]) => ({
  tipo: 'interpretar',
  texto: texto.length > 0 ? texto[0] : '¿cuánto vendí ayer?',
});
const HECHO = {
  intencion: 'ventaDelDia',
  frase: 'Ayer, martes 6 de octubre, vendiste S/ 205.00.',
  cifras: ['6', '205.00'],
};
const redactar = (...hecho: unknown[]) => ({
  tipo: 'redactar',
  hecho: hecho.length > 0 ? hecho[0] : HECHO,
});

/** Lo que clasifica el modelo para "cuánto vendí ayer". */
const AYER = { intencion: 'ventaDelDia', producto: 'ninguno', dia: 'ayer', confianza: 0.95 };

/** Una respuesta de OpenRouter (/chat/completions) cuyo mensaje es `contenido`. */
const chat = (contenido: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      id: 'gen-1',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: typeof contenido === 'string' ? contenido : JSON.stringify(contenido),
          },
        },
      ],
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );

/** Una opción elegida en una pregunta "choice" de la API tipada (Jev). */
const opcion = (choice: unknown, confidence?: unknown) => ({ type: 'choice', choice, confidence });
/** Las tres respuestas de Jev para "cuánto vendí ayer". */
const respuestasAyer = (): Record<string, unknown> => ({
  intencion: opcion('ventaDelDia', 0.95),
  producto: opcion('ninguno', 0.9),
  dia: opcion('ayer', 0.97),
});
const MODELO_REAL_DE_JEV = 'typesafe/jev-1.13-20260917';
/** Una respuesta de OpenRouter /systemone (la forma documentada en la referencia de la API). */
const respuestaSysone = (answers: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      id: 'gen-dec-1',
      model: MODELO_REAL_DE_JEV,
      provider: 'TypeSafe',
      answers,
      usage: { input_tokens: 900, output_tokens: 30, cost: 0.00003 },
      ...extra,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
const JEV_AYER = () => respuestaSysone(respuestasAyer());

const errorDeOpenRouter = (status: number, mensaje = 'No endpoints found') =>
  new Response(JSON.stringify({ error: { code: status, message: mensaje } }), { status });

let openrouter: jest.Mock;
const original = global.fetch;
const conOpenRouter = (...respuestas: Array<(() => Promise<Response>) | Response | Error>) => {
  openrouter = jest.fn();
  respuestas.forEach(r =>
    openrouter.mockImplementationOnce(() =>
      r instanceof Error
        ? Promise.reject(r)
        : typeof r === 'function'
        ? r()
        : Promise.resolve(r.clone()),
    ),
  );
  global.fetch = openrouter as unknown as typeof fetch;
  return openrouter;
};
const llamadasA = (): [string, Init][] => openrouter.mock.calls as unknown as [string, Init][];
const cuerpoDe = (n: number) => JSON.parse(llamadasA()[n][1].body ?? '{}');

const conConsola = () => {
  const metodos = ['log', 'info', 'warn', 'error', 'debug'] as const;
  return metodos.map(m => jest.spyOn(console, m).mockImplementation(() => undefined));
};

afterEach(() => {
  global.fetch = original;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const jsonDe = async (r: Response) => JSON.parse(await r.text());

describe('servidor: método, ruta y forma de las respuestas', () => {
  it('solo acepta POST a /: lo demás es NO_ENCONTRADO', async () => {
    conOpenRouter();
    for (const metodo of ['GET', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']) {
      const r = await worker.fetch(new Request(URL_WORKER, { method: metodo }), ENV);
      expect([404, 405]).toContain(r.status);
      if (metodo !== 'HEAD') expect(await jsonDe(r)).toEqual({ error: 'NO_ENCONTRADO' });
    }
    const otraRuta = await worker.fetch(
      peticion(interpretar(), {}, 'https://asistente.ejemplo.test/otra'),
      ENV,
    );
    expect(otraRuta.status).toBe(404);
    expect(await jsonDe(otraRuta)).toEqual({ error: 'NO_ENCONTRADO' });
    expect(openrouter).not.toHaveBeenCalled();
  });

  it('responde siempre JSON y sin CORS (es una app nativa, no un navegador)', async () => {
    conOpenRouter(JEV_AYER());
    const respuestas = [
      await llamar(interpretar()),
      await llamar('{ roto'),
      await worker.fetch(new Request(URL_WORKER), ENV),
      await llamar(interpretar(), {}),
    ];
    for (const r of respuestas) {
      expect(r.headers.get('content-type')).toContain('application/json');
      expect([...r.headers.keys()].some(h => h.startsWith('access-control-'))).toBe(false);
    }
  });
});

describe('servidor: validación de lo que llega', () => {
  it('sin la clave configurada responde NO_CONFIGURADO, sin ningún detalle ni llamada', async () => {
    conOpenRouter();
    for (const env of [{}, { OPENROUTER_API_KEY: '' }, { ...ENV, OPENROUTER_API_KEY: undefined }]) {
      const r = await llamar(interpretar(), env);
      expect(r.status).toBe(500);
      expect(await r.text()).toBe('{"error":"NO_CONFIGURADO"}');
    }
    expect(openrouter).not.toHaveBeenCalled();
  });

  it('un cuerpo de más de 2 KB se rechaza sin leerlo entero ni llamar a nadie', async () => {
    conOpenRouter();
    const grande = JSON.stringify(interpretar('a'.repeat(3000)));
    const porLargo = await llamar(grande);
    const porEncabezado = await llamar(interpretar(), ENV, {
      headers: { 'Content-Type': 'application/json', 'Content-Length': '5000' },
    });

    for (const r of [porLargo, porEncabezado]) {
      expect(r.status).toBe(413);
      expect(await jsonDe(r)).toEqual({ error: 'CUERPO_GRANDE' });
    }
    expect(openrouter).not.toHaveBeenCalled();
  });

  it('JSON roto, algo que no es un objeto o un tipo desconocido es una solicitud inválida', async () => {
    conOpenRouter();
    const malos = [
      '{ roto',
      '',
      '[]',
      '42',
      'null',
      '"texto"',
      '{}',
      '{"tipo":"borrar"}',
      '{"tipo":7}',
    ];
    for (const malo of malos) {
      const r = await llamar(malo);
      expect(r.status).toBe(400);
      expect(await jsonDe(r)).toEqual({ error: 'SOLICITUD_INVALIDA' });
    }
    expect(openrouter).not.toHaveBeenCalled();
  });

  it('exige Content-Type application/json', async () => {
    conOpenRouter();
    const r = await llamar(JSON.stringify(interpretar()), ENV, {
      headers: { 'Content-Type': 'text/plain' },
    });

    expect(r.status).toBe(415);
    expect(await jsonDe(r)).toEqual({ error: 'TIPO_NO_SOPORTADO' });
    expect(openrouter).not.toHaveBeenCalled();
  });

  it('interpretar: un texto vacío, de espacios, de más de 200 caracteres o que no es texto se rechaza', async () => {
    conOpenRouter();
    for (const texto of ['', '   ', 'a'.repeat(201), 42, null, undefined, ['a']]) {
      const r = await llamar(interpretar(texto));
      expect(r.status).toBe(400);
      expect(await jsonDe(r)).toEqual({ error: 'SOLICITUD_INVALIDA' });
    }
    expect(openrouter).not.toHaveBeenCalled();
  });

  it('interpretar: un texto de exactamente 200 caracteres pasa, y se recorta', async () => {
    conOpenRouter(JEV_AYER(), JEV_AYER());

    const r = await llamar(interpretar('a'.repeat(200)));
    const recortado = await llamar(interpretar('  ¿cuánto vendí ayer?  '));

    expect(r.status).toBe(200);
    expect(recortado.status).toBe(200);
    expect(cuerpoDe(1).state).toBe('¿cuánto vendí ayer?');
  });

  it('redactar: un hecho mal formado se rechaza antes de llamar a nadie', async () => {
    conOpenRouter();
    const malos: unknown[] = [
      undefined,
      null,
      'texto',
      [],
      { ...HECHO, intencion: 'hackear' },
      { ...HECHO, intencion: 7 },
      { ...HECHO, frase: '' },
      { ...HECHO, frase: '   ' },
      { ...HECHO, frase: 'a'.repeat(301) },
      { ...HECHO, frase: 42 },
      { ...HECHO, cifras: 'uno' },
      { ...HECHO, cifras: undefined },
      { ...HECHO, cifras: Array.from({ length: 13 }, (_, i) => String(i)) },
      { ...HECHO, cifras: ['1'.repeat(25)] },
      { ...HECHO, cifras: [205] },
    ];
    for (const malo of malos) {
      const r = await llamar(redactar(malo));
      expect(r.status).toBe(400);
      expect(await jsonDe(r)).toEqual({ error: 'SOLICITUD_INVALIDA' });
    }
    expect(openrouter).not.toHaveBeenCalled();
  });

  it('redactar: el límite exacto sí pasa (frase de 300, 12 cifras de 24)', async () => {
    conOpenRouter(chat({ texto: 'Listo.' }));
    const hecho = {
      intencion: 'noEntendi',
      frase: 'a'.repeat(300),
      cifras: Array.from({ length: 12 }, () => '1'.repeat(24)),
    };

    const r = await llamar(redactar(hecho));

    expect(r.status).toBe(200);
  });
});

describe('servidor: interpretar', () => {
  it('Jev responde por la API tipada: una sola llamada a /systemone, con las 3 preguntas y sin retención de datos', async () => {
    conOpenRouter(JEV_AYER());

    const r = await llamar(interpretar());

    expect(r.status).toBe(200);
    expect(await jsonDe(r)).toEqual({ ...AYER, modelo: MODELO_REAL_DE_JEV });
    expect(openrouter).toHaveBeenCalledTimes(1);
    const [url, init] = llamadasA()[0];
    expect(url).toBe(URL_SYSTEMONE);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      Authorization: `Bearer ${CLAVE}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': expect.any(String),
      'X-Title': 'Crecemos',
    });
    const cuerpo = cuerpoDe(0);
    expect(Object.keys(cuerpo).sort()).toEqual(['model', 'provider', 'questions', 'state']);
    expect(cuerpo.model).toBe('jev-latest');
    // A Jev viaja solo el texto de la pregunta, tal cual.
    expect(cuerpo.state).toBe('¿cuánto vendí ayer?');
    // La API tipada solo admite estas preferencias de proveedor: no se manda nada más.
    expect(cuerpo.provider).toEqual({ data_collection: 'deny' });
  });

  it('las tres preguntas son de tipo "choice" y sus opciones son exactamente las de la app', async () => {
    conOpenRouter(JEV_AYER());

    await llamar(interpretar());

    const { questions } = cuerpoDe(0);
    expect(Object.keys(questions).sort()).toEqual(['dia', 'intencion', 'producto']);
    for (const pregunta of Object.values(questions) as Array<{
      type: string;
      instructions: string;
    }>) {
      expect(pregunta.type).toBe('choice');
      expect(typeof pregunta.instructions).toBe('string');
      expect(pregunta.instructions.length).toBeGreaterThan(10);
    }
    expect(questions.intencion.instructions).toContain('¿Qué quiso preguntar el vendedor?');
    expect(Object.keys(questions.intencion.criteria)).toEqual(INTENCIONES_APP.map(i => i.id));
    expect(Object.keys(questions.intencion.criteria)).toHaveLength(12);
    expect(questions.intencion.criteria).toEqual(
      Object.fromEntries(INTENCIONES_APP.map(i => [i.id, i.descripcion])),
    );
    expect(Object.keys(questions.producto.criteria)).toEqual([
      'anticucho',
      'pancita',
      'rachi',
      'chicha',
      'ninguno',
    ]);
    expect(Object.keys(questions.dia.criteria)).toEqual([...DIAS_CONSULTA]);
    // Toda opción trae una descripción para que el modelo pueda separarlas.
    for (const { criteria } of Object.values(questions) as Array<{
      criteria: Record<string, string>;
    }>) {
      for (const descripcion of Object.values(criteria)) {
        expect(typeof descripcion).toBe('string');
        expect(descripcion.length).toBeGreaterThan(3);
      }
    }
  });

  it('la confianza es la "confidence" de la intención; producto y día se leen de su "choice"', async () => {
    conOpenRouter(
      respuestaSysone({
        intencion: opcion('cuantoPreparar', 0.81),
        producto: opcion('rachi', 0.9),
        dia: opcion('ninguno', 0.99),
      }),
    );

    const r = await llamar(interpretar('¿cuánto preparo de rachi?'));

    expect(await jsonDe(r)).toEqual({
      intencion: 'cuantoPreparar',
      producto: 'rachi',
      dia: 'ninguno',
      confianza: 0.81,
      modelo: MODELO_REAL_DE_JEV,
    });
  });

  it('un producto o un día con confianza menor a 0.5 se devuelve como "ninguno"', async () => {
    conOpenRouter(
      respuestaSysone({
        intencion: opcion('ventaDelDia', 0.9),
        producto: opcion('pancita', 0.49),
        dia: opcion('lunes', 0.2),
      }),
      respuestaSysone({
        intencion: opcion('ventaDelDia', 0.9),
        producto: opcion('pancita', 0.5),
        dia: opcion('lunes', 0.5),
      }),
    );

    const baja = await jsonDe(await llamar(interpretar()));
    const justa = await jsonDe(await llamar(interpretar()));

    expect(baja).toMatchObject({ intencion: 'ventaDelDia', producto: 'ninguno', dia: 'ninguno' });
    expect(justa).toMatchObject({ producto: 'pancita', dia: 'lunes' });
  });

  it('sin "confidence" se usa la probabilidad de la opción elegida; sin ninguna de las dos, es una falla', async () => {
    conOpenRouter(
      respuestaSysone({
        intencion: {
          type: 'choice',
          choice: 'peorDia',
          probabilities: { peorDia: 0.7, mejorDia: 0.3 },
        },
        producto: opcion('ninguno', 0.9),
        dia: opcion('ninguno', 0.9),
      }),
    );

    const r = await llamar(interpretar());

    expect(await jsonDe(r)).toMatchObject({ intencion: 'peorDia', confianza: 0.7 });

    conOpenRouter(
      respuestaSysone({
        intencion: { type: 'choice', choice: 'peorDia' },
        producto: opcion('ninguno', 0.9),
        dia: opcion('ninguno', 0.9),
      }),
      chat(AYER),
    );
    const respaldo = await llamar(interpretar());
    expect((await jsonDe(respaldo)).modelo).toBe('deepseek/deepseek-v4-flash');
  });

  it('"modelo" es el que informa la API; si no viene o no es un id razonable, el configurado', async () => {
    conOpenRouter(
      respuestaSysone(respuestasAyer(), { model: undefined }),
      respuestaSysone(respuestasAyer(), { model: '<b>raro</b> con espacios' }),
      respuestaSysone(respuestasAyer(), { model: 42 }),
    );

    const sinModelo = await jsonDe(await llamar(interpretar()));
    const raro = await jsonDe(await llamar(interpretar()));
    const numero = await jsonDe(await llamar(interpretar()));

    expect(sinModelo.modelo).toBe('jev-latest');
    expect(raro.modelo).toBe('jev-latest');
    expect(numero.modelo).toBe('jev-latest');
  });

  it('solo reenvía los cuatro campos validados más el modelo: nunca el cuerpo crudo de OpenRouter', async () => {
    conOpenRouter(
      respuestaSysone(
        {
          ...respuestasAyer(),
          intencion: {
            ...opcion('ventaDelDia', 0.95),
            secreto: 'x',
            probabilities: { ventaDelDia: 1 },
          },
          extra: opcion('hackear', 1),
        },
        { secreto: 'x' },
      ),
    );

    const r = await llamar(interpretar());

    const salida = await jsonDe(r);
    expect(Object.keys(salida).sort()).toEqual([
      'confianza',
      'dia',
      'intencion',
      'modelo',
      'producto',
    ]);
    expect(JSON.stringify(salida)).not.toContain('gen-dec-1');
    expect(JSON.stringify(salida)).not.toContain('secreto');
    expect(JSON.stringify(salida)).not.toContain('usage');
  });

  it('si la API tipada falla de cualquier forma, clasifica DeepSeek por chat con el esquema estricto y los proveedores de EE. UU.', async () => {
    const buena = respuestasAyer();
    const fallosDeJev: Array<() => Response | Error> = [
      () => errorDeOpenRouter(404),
      () => errorDeOpenRouter(502, 'Provider returned error'),
      () => errorDeOpenRouter(402, 'Insufficient credits'),
      () => errorDeOpenRouter(429, 'Rate limit exceeded'),
      () => errorDeOpenRouter(503, 'Service temporarily unavailable'),
      () => new Error('Network connection lost'),
      () => new Response('esto no es json', { status: 200 }),
      () => new Response('<html>Bad gateway</html>', { status: 200 }),
      () => new Response('', { status: 200 }),
      () =>
        new Response(JSON.stringify({ error: { code: 429, message: 'rate limited' } }), {
          status: 200,
        }),
      () => new Response(JSON.stringify({ model: 'x', usage: {} }), { status: 200 }),
      () => respuestaSysone({}),
      () => respuestaSysone({ ...buena, intencion: undefined }),
      () => respuestaSysone({ ...buena, producto: undefined }),
      () => respuestaSysone({ ...buena, dia: undefined }),
      () => respuestaSysone({ ...buena, intencion: opcion('hackear', 0.99) }),
      () => respuestaSysone({ ...buena, intencion: opcion(7, 0.99) }),
      () => respuestaSysone({ ...buena, producto: opcion('lomo', 0.99) }),
      () => respuestaSysone({ ...buena, dia: opcion('antier', 0.99) }),
      () => respuestaSysone({ ...buena, intencion: opcion('ventaDelDia', 7) }),
      () => respuestaSysone({ ...buena, intencion: opcion('ventaDelDia', -0.1) }),
      () => respuestaSysone({ ...buena, intencion: opcion('ventaDelDia', '0.9') }),
      () => respuestaSysone({ ...buena, intencion: { type: 'noul', noul: 0.9 } }),
      () => respuestaSysone({ ...buena, dia: { type: 'choice', choice: 'ayer' } }),
      () => respuestaSysone([] as unknown as Record<string, unknown>),
    ];
    for (const falla of fallosDeJev) {
      const dado = falla();
      conOpenRouter(dado, chat(AYER));

      const r = await llamar(interpretar());

      expect(r.status).toBe(200);
      expect(await jsonDe(r)).toEqual({ ...AYER, modelo: 'deepseek/deepseek-v4-flash' });
      expect(openrouter).toHaveBeenCalledTimes(2);
      expect(llamadasA()[0][0]).toBe(URL_SYSTEMONE);
      expect(llamadasA()[1][0]).toBe(URL_OPENROUTER);
      const deepseek = cuerpoDe(1);
      expect(deepseek.model).toBe('deepseek/deepseek-v4-flash');
      expect(deepseek.provider).toEqual({
        only: ['deepinfra', 'parasail', 'cloudflare'],
        data_collection: 'deny',
        require_parameters: true,
      });
      expect(deepseek.temperature).toBe(0);
      expect(deepseek.max_tokens).toBe(120);
      expect(deepseek.reasoning).toEqual({ enabled: false });
      expect(deepseek.messages[1]).toEqual({ role: 'user', content: '¿cuánto vendí ayer?' });
    }
  });

  it('el respaldo de DeepSeek pide un esquema estricto con las 12 intenciones, los productos y los días', async () => {
    conOpenRouter(errorDeOpenRouter(404), chat(AYER));

    await llamar(interpretar());

    const formato = cuerpoDe(1).response_format;
    expect(formato.type).toBe('json_schema');
    expect(formato.json_schema.strict).toBe(true);
    expect(typeof formato.json_schema.name).toBe('string');
    const esquema = formato.json_schema.schema;
    expect(esquema.type).toBe('object');
    expect(esquema.additionalProperties).toBe(false);
    expect(esquema.required.sort()).toEqual(['confianza', 'dia', 'intencion', 'producto']);
    expect(esquema.properties.intencion.enum).toHaveLength(12);
    expect(esquema.properties.intencion.enum).toEqual(INTENCIONES_APP.map(i => i.id));
    expect(esquema.properties.producto.enum).toEqual([
      'anticucho',
      'pancita',
      'rachi',
      'chicha',
      'ninguno',
    ]);
    expect(esquema.properties.dia.enum).toEqual([...DIAS_CONSULTA]);
    expect(esquema.properties.confianza.type).toBe('number');
  });

  it('el mensaje de sistema del respaldo explica las 12 intenciones y manda a "noEntendi" lo ambiguo', async () => {
    conOpenRouter(errorDeOpenRouter(404), chat(AYER));

    await llamar(interpretar());

    const sistema: string = cuerpoDe(1).messages[0].content;
    expect(cuerpoDe(1).messages[0].role).toBe('system');
    for (const { id, descripcion } of INTENCIONES_APP) {
      expect(sistema).toContain(id);
      expect(sistema).toContain(descripcion);
    }
    expect(sistema).toMatch(/ambigu/i);
    expect(sistema).toMatch(/confianza/i);
    // El texto de la pregunta nunca va en el mensaje de sistema: solo en el del usuario.
    expect(sistema).not.toContain('¿cuánto vendí ayer?');
  });

  it('si la API tipada no contesta a tiempo se corta y se sigue con DeepSeek dentro del límite de la app', async () => {
    jest.useFakeTimers();
    conOpenRouter(
      () =>
        new Promise<Response>((_resolver, rechazar) => {
          const senal = (openrouter.mock.calls[0][1] as Init).signal;
          senal?.addEventListener('abort', () => rechazar(new Error('abortado')));
        }),
      chat(AYER),
    );

    let respuesta: Response | undefined;
    const pendiente = llamar(interpretar()).then(r => {
      respuesta = r;
    });
    await jest.advanceTimersByTimeAsync(3999);
    expect(respuesta).toBeUndefined();
    expect(openrouter).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await pendiente;

    expect(openrouter).toHaveBeenCalledTimes(2);
    expect(respuesta?.status).toBe(200);
    expect(await jsonDe(respuesta as Response)).toMatchObject({
      modelo: 'deepseek/deepseek-v4-flash',
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('si ninguno de los dos contesta a tiempo, responde NO_DISPONIBLE antes de los 8 s de la app', async () => {
    jest.useFakeTimers();
    const colgada = () =>
      new Promise<Response>((_resolver, rechazar) => {
        const senal = (openrouter.mock.calls[openrouter.mock.calls.length - 1][1] as Init).signal;
        senal?.addEventListener('abort', () => rechazar(new Error('abortado')));
      });
    conOpenRouter(colgada, colgada);

    let respuesta: Response | undefined;
    const pendiente = llamar(interpretar()).then(r => {
      respuesta = r;
    });
    await jest.advanceTimersByTimeAsync(7499);
    expect(respuesta).toBeUndefined();
    await jest.advanceTimersByTimeAsync(1);
    await pendiente;

    expect(respuesta?.status).toBe(502);
    expect(await jsonDe(respuesta as Response)).toEqual({ error: 'NO_DISPONIBLE' });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('si los dos fallan responde 502 NO_DISPONIBLE, sin detalles', async () => {
    conOpenRouter(errorDeOpenRouter(404), errorDeOpenRouter(503, 'No available provider'));

    const r = await llamar(interpretar());

    expect(r.status).toBe(502);
    expect(await r.text()).toBe('{"error":"NO_DISPONIBLE"}');
    expect(openrouter).toHaveBeenCalledTimes(2);
  });

  it('si la API tipada falla y DeepSeek contesta fuera del enum, responde 502', async () => {
    conOpenRouter(errorDeOpenRouter(404), chat({ ...AYER, intencion: 'borrarTodo' }));

    const r = await llamar(interpretar());

    expect(r.status).toBe(502);
    expect(await jsonDe(r)).toEqual({ error: 'NO_DISPONIBLE' });
  });

  it('si DeepSeek responde algo que no es el JSON del esquema, se descarta', async () => {
    const malas: Response[] = [
      chat('esto no es json'),
      chat(''),
      chat({ ...AYER, dia: 'antier' }),
      chat({ ...AYER, producto: 'lomo' }),
      chat({ ...AYER, confianza: 7 }),
      chat({ ...AYER, confianza: '0.9' }),
      chat({ intencion: 'ventaDelDia' }),
      new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      new Response(JSON.stringify({ error: { code: 429, message: 'x' } }), { status: 200 }),
    ];
    for (const mala of malas) {
      conOpenRouter(errorDeOpenRouter(404), mala);
      const r = await llamar(interpretar());
      expect(r.status).toBe(502);
    }
  });

  it('usa los modelos y los proveedores por defecto cuando faltan las variables', async () => {
    conOpenRouter(errorDeOpenRouter(404), chat(AYER));

    await llamar(interpretar(), { OPENROUTER_API_KEY: CLAVE });

    expect(cuerpoDe(0).model).toBe('jev-latest');
    expect(cuerpoDe(1).model).toBe('deepseek/deepseek-v4-flash');
    expect(PROVEEDORES_POR_DEFECTO.length).toBeGreaterThan(0);
    expect(cuerpoDe(1).provider.only).toEqual(PROVEEDORES_POR_DEFECTO);

    conOpenRouter(errorDeOpenRouter(404), chat(AYER));
    await llamar(interpretar(), { OPENROUTER_API_KEY: CLAVE, DEEPSEEK_PROVEEDORES: ' , ' });
    expect(cuerpoDe(1).provider.only).toEqual(PROVEEDORES_POR_DEFECTO);
  });

  it('los modelos de las variables del Worker mandan sobre los de por defecto', async () => {
    conOpenRouter(errorDeOpenRouter(404), chat(AYER));

    const r = await llamar(interpretar(), {
      ...ENV,
      JEV_MODELO: 'jev-1.13',
      DEEPSEEK_MODELO: 'otro/modelo',
    });

    expect(cuerpoDe(0).model).toBe('jev-1.13');
    expect(cuerpoDe(1).model).toBe('otro/modelo');
    expect((await jsonDe(r)).modelo).toBe('otro/modelo');
  });
});

describe('servidor: redactar', () => {
  it('pide solo a DeepSeek, con proveedores de EE. UU., sin retención y con la frase como entrada', async () => {
    conOpenRouter(chat({ texto: 'Ayer, martes 6 de octubre, te entraron S/ 205.00.' }));

    const r = await llamar(redactar());

    expect(r.status).toBe(200);
    expect(await r.text()).toBe('{"texto":"Ayer, martes 6 de octubre, te entraron S/ 205.00."}');
    expect(openrouter).toHaveBeenCalledTimes(1);
    expect(llamadasA()[0][0]).toBe(URL_OPENROUTER);
    const cuerpo = cuerpoDe(0);
    // Redactar no cambió: sigue siendo una sola llamada de chat a DeepSeek, nunca a la API tipada de Jev.
    expect(llamadasA().every(([url]) => url !== URL_SYSTEMONE)).toBe(true);
    expect(cuerpo.questions).toBeUndefined();
    expect(cuerpo.model).toBe('deepseek/deepseek-v4-flash');
    expect(cuerpo.provider).toEqual({
      only: ['deepinfra', 'parasail', 'cloudflare'],
      data_collection: 'deny',
      require_parameters: true,
    });
    const formato = cuerpo.response_format;
    expect(formato.type).toBe('json_schema');
    expect(formato.json_schema.strict).toBe(true);
    expect(formato.json_schema.schema).toMatchObject({
      type: 'object',
      properties: { texto: { type: 'string', maxLength: 280 } },
      required: ['texto'],
      additionalProperties: false,
    });
    const [sistema, usuario] = cuerpo.messages;
    expect(sistema.role).toBe('system');
    expect(sistema.content).toContain('Reescribe la frase con otras palabras');
    expect(sistema.content).toContain('EXACTAMENTE');
    expect(sistema.content).toContain('no agregues ninguna cifra');
    expect(sistema.content).toContain('no uses emojis ni enlaces');
    expect(usuario.role).toBe('user');
    expect(usuario.content).toContain(HECHO.frase);
    for (const cifra of HECHO.cifras) expect(usuario.content).toContain(cifra);
  });

  it('el texto se devuelve recortado', async () => {
    conOpenRouter(chat({ texto: '  Hoy vendiste S/ 205.00.  ' }));

    const r = await llamar(redactar());

    expect(await jsonDe(r)).toEqual({ texto: 'Hoy vendiste S/ 205.00.' });
  });

  it('DeepSeek caído, vacío, largo o con la forma equivocada es 502 NO_DISPONIBLE', async () => {
    const malas: Array<Response | Error> = [
      errorDeOpenRouter(404),
      errorDeOpenRouter(502),
      new Error('Network connection lost'),
      chat('no es json'),
      chat({ texto: '' }),
      chat({ texto: '   ' }),
      chat({ texto: 'a'.repeat(281) }),
      chat({ texto: 205 }),
      chat({ otra: 'cosa' }),
      chat([]),
    ];
    for (const mala of malas) {
      conOpenRouter(mala);
      const r = await llamar(redactar());
      expect(r.status).toBe(502);
      expect(await jsonDe(r)).toEqual({ error: 'NO_DISPONIBLE' });
      expect(openrouter).toHaveBeenCalledTimes(1);
    }
  });

  it('un texto de exactamente 280 caracteres sí pasa', async () => {
    conOpenRouter(chat({ texto: 'a'.repeat(280) }));

    const r = await llamar(redactar());

    expect(r.status).toBe(200);
  });

  it('solo reenvía el texto: nada más del cuerpo de OpenRouter', async () => {
    conOpenRouter(chat({ texto: 'Listo.', secreto: 'x' }));

    const r = await llamar(redactar());

    expect(await jsonDe(r)).toEqual({ texto: 'Listo.' });
  });
});

describe('servidor: privacidad', () => {
  /** Todos los caminos del Worker, con sus llamadas a OpenRouter simuladas. */
  const camino = (
    nombre: string,
    respuestas: Array<Response | Error>,
    cuerpo: unknown,
  ): [string, () => Promise<Response>] => [
    nombre,
    async () => {
      conOpenRouter(...respuestas);
      return llamar(cuerpo);
    },
  ];
  const caminos: Array<[string, () => Promise<Response>]> = [
    camino('interpretar con Jev', [JEV_AYER()], interpretar()),
    camino('interpretar con el respaldo', [errorDeOpenRouter(404), chat(AYER)], interpretar()),
    camino('interpretar sin servicio', [errorDeOpenRouter(404), new Error('x')], interpretar()),
    camino('redactar', [chat({ texto: 'Vendiste S/ 205.00.' })], redactar()),
    camino('redactar con falla', [errorDeOpenRouter(500)], redactar()),
    camino('solicitud inválida', [], '{ roto'),
  ];

  it('en todas las llamadas a OpenRouter se pide data_collection "deny"', async () => {
    let llamadas = 0;
    for (const [, correr] of caminos) {
      await correr();
      for (let i = 0; i < openrouter.mock.calls.length; i += 1) {
        expect(cuerpoDe(i).provider.data_collection).toBe('deny');
        llamadas += 1;
      }
    }
    expect(llamadas).toBeGreaterThanOrEqual(7);
  });

  it('solo las llamadas a DeepSeek restringen los proveedores con "only"', async () => {
    conOpenRouter(errorDeOpenRouter(404), chat(AYER));
    await llamar(interpretar());
    expect(cuerpoDe(0).provider.only).toBeUndefined();
    expect(cuerpoDe(1).provider.only).toEqual(['deepinfra', 'parasail', 'cloudflare']);
  });

  it('la clave viaja solo en el encabezado Authorization: ni en el cuerpo ni en la respuesta', async () => {
    let llamadas = 0;
    for (const [, correr] of caminos) {
      const r = await correr();
      llamadas += openrouter.mock.calls.length;
      expect(await r.text()).not.toContain(CLAVE);
      expect([...r.headers.values()].join(' ')).not.toContain(CLAVE);
      for (const [, init] of llamadasA()) {
        expect(init.body).not.toContain(CLAVE);
        expect(init.headers?.Authorization).toBe(`Bearer ${CLAVE}`);
        const otros = Object.entries(init.headers ?? {}).filter(([k]) => k !== 'Authorization');
        expect(JSON.stringify(otros)).not.toContain(CLAVE);
      }
    }
    expect(llamadas).toBeGreaterThanOrEqual(7);
  });

  it('no escribe ningún log: ni la pregunta, ni la frase, ni nada', async () => {
    const espias = conConsola();
    for (const [, correr] of caminos) await correr();
    conOpenRouter(JEV_AYER());
    const r = await llamar(interpretar('mi pregunta privada sobre S/ 999.99'));
    expect(r.status).toBeGreaterThanOrEqual(200);

    for (const espia of espias) expect(espia).not.toHaveBeenCalled();
  });

  it('el código del Worker no usa console ni importa dependencias', () => {
    const codigo = readFileSync(join(RAIZ, 'servidor', 'worker.js'), 'utf8');
    expect(codigo).not.toMatch(/console\./);
    expect(codigo).not.toMatch(/^\s*import\s/m);
    expect(codigo).not.toMatch(/\brequire\(/);
  });

  it('a OpenRouter no le llegan datos del usuario más allá de la pregunta o del hecho', async () => {
    conOpenRouter(JEV_AYER());
    await llamar(interpretar(), ENV, {
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.7',
        Cookie: 'sesion=abc',
        'User-Agent': 'telefono-de-freddy',
      },
    });

    const salida = JSON.stringify(llamadasA()[0]);
    expect(salida).not.toContain('203.0.113.7');
    expect(salida).not.toContain('sesion=abc');
    expect(salida).not.toContain('telefono-de-freddy');
  });
});

describe('servidor: límite por IP', () => {
  it('sin el binding configurado (como en las pruebas) se omite sin fallar', async () => {
    conOpenRouter(JEV_AYER());

    const r = await llamar(interpretar(), { ...ENV, LIMITE: undefined });

    expect(r.status).toBe(200);
  });

  it('con el binding, cuenta por la IP de Cloudflare', async () => {
    conOpenRouter(JEV_AYER());
    const limit = jest.fn(async () => ({ success: true }));

    const r = await llamar(
      interpretar(),
      { ...ENV, LIMITE: { limit } },
      {
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
      },
    );

    expect(r.status).toBe(200);
    expect(limit).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
  });

  it('pasado el límite responde 429 y no llama a OpenRouter', async () => {
    conOpenRouter();
    const limit = jest.fn(async () => ({ success: false }));

    const r = await llamar(interpretar(), { ...ENV, LIMITE: { limit } });

    expect(r.status).toBe(429);
    expect(await jsonDe(r)).toEqual({ error: 'DEMASIADAS_PETICIONES' });
    expect(openrouter).not.toHaveBeenCalled();
  });

  it('si el binding mismo falla, no se bloquea a nadie por eso', async () => {
    conOpenRouter(JEV_AYER());
    const limit = jest.fn(async () => {
      throw new Error('límite caído');
    });

    const r = await llamar(interpretar(), { ...ENV, LIMITE: { limit } });

    expect(r.status).toBe(200);
  });
});

describe('servidor: consistencia con la app', () => {
  it('las 12 intenciones del Worker son exactamente las de la app, con la misma descripción', () => {
    expect(INTENCIONES).toHaveLength(12);
    expect(INTENCIONES.map((i: { id: string }) => i.id)).toEqual(INTENCIONES_APP.map(i => i.id));
    expect(INTENCIONES).toEqual(
      INTENCIONES_APP.map(i => ({ id: i.id, descripcion: i.descripcion })),
    );
  });

  it('los días del Worker son exactamente los de la app', () => {
    expect(DIAS).toEqual([...DIAS_CONSULTA]);
  });

  it('los productos del Worker son exactamente los que la app sabe leer', () => {
    expect(PRODUCTOS).toEqual(['anticucho', 'pancita', 'rachi', 'chicha', 'ninguno']);
    for (const producto of PRODUCTOS) {
      expect(
        interpretarRespuesta({ intencion: 'ventaDelDia', producto, dia: 'ninguno', confianza: 1 }),
      ).not.toBeNull();
    }
    expect(
      interpretarRespuesta({
        intencion: 'ventaDelDia',
        producto: 'lomo',
        dia: 'ninguno',
        confianza: 1,
      }),
    ).toBeNull();
  });

  it('cada intención y cada día del Worker los acepta la app', () => {
    expect(INTENCIONES).toHaveLength(12);
    expect(DIAS).toHaveLength(10);
    for (const { id } of INTENCIONES) {
      expect(
        interpretarRespuesta({ intencion: id, producto: 'ninguno', dia: 'ninguno', confianza: 1 }),
      ).not.toBeNull();
    }
    for (const dia of DIAS) {
      expect(
        interpretarRespuesta({ intencion: 'ventaDelDia', producto: 'ninguno', dia, confianza: 1 }),
      ).not.toBeNull();
    }
  });
});

describe('secretos en el repo', () => {
  /** Todos los archivos de texto bajo `carpeta`, sin node_modules ni carpetas de trabajo de wrangler. */
  const archivos = (carpeta: string): string[] =>
    readdirSync(carpeta).flatMap(nombre => {
      if (nombre === 'node_modules' || nombre === '.wrangler') return [];
      const ruta = join(carpeta, nombre);
      return statSync(ruta).isDirectory() ? archivos(ruta) : [ruta];
    });

  it('ningún archivo de servidor/ ni de src/ contiene una clave de OpenRouter', () => {
    const revisados = [...archivos(join(RAIZ, 'servidor')), ...archivos(join(RAIZ, 'src'))];
    expect(revisados.length).toBeGreaterThan(10);
    for (const ruta of revisados) {
      const texto = readFileSync(ruta, 'utf8');
      expect({ ruta, clave: texto.includes('sk-or-') }).toEqual({ ruta, clave: false });
      expect({ ruta, bearer: texto.includes('Bearer sk') }).toEqual({ ruta, bearer: false });
    }
  });

  it('servidor/ no trae variables locales con secretos (.dev.vars) ni la clave en wrangler.toml', () => {
    const nombres = archivos(join(RAIZ, 'servidor')).map(r => r.split('/').pop());
    expect(nombres).not.toContain('.dev.vars');
    const toml = readFileSync(join(RAIZ, 'servidor', 'wrangler.toml'), 'utf8');
    expect(toml).not.toMatch(/OPENROUTER_API_KEY\s*=/);
    expect(toml).toContain('name = "crecemos-asistente"');
    expect(toml).toContain('main = "worker.js"');
    expect(toml).toContain('workers_dev = true');
  });
});
