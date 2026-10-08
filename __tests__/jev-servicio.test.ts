/**
 * Pruebas de apoyo del servicio del chat (no son escenarios del SPEC; el e7, el e8 y el e10 viven en
 * `sdd/sprint-08.test.ts`, y aquí están los caminos del servicio que respaldan al e5 y al e6).
 * `jev.ts` es la segunda y última llamada de red de la app: recibe el fetch por parámetro, así que
 * aquí se le pasa uno simulado y la red nunca se toca.
 */

import type { Cierre, ContextoAnalisis, Hecho, LineaCierre } from '@dominio/tipos';
import { extraerCifras } from '@analisis/validarRedaccion';
import {
  consultar,
  MAX_CARACTERES_PREGUNTA,
  preguntarAJev,
  redactarRespuesta,
  TAMANO_MAXIMO_BYTES,
  TEXTO_NO_ENTENDI,
  TEXTO_SIN_INTERNET,
  TIEMPO_LIMITE_MS,
} from '@services/jev';

const URL_PRUEBA = 'https://asistente.ejemplo.test';
const HOY = '2026-10-07';

// Ningún texto que lea Freddy puede traer un código ni un mensaje técnico.
const TECNICO =
  /SIN_RED|TIEMPO_AGOTADO|RESPUESTA_INVALIDA|REDACCION_DESCARTADA|Network|Abort|\b[45]\d\d\b|undefined|error/i;

const respuesta = (cuerpo: string, ok = true, status = 200) =>
  ({ ok, status, text: async () => cuerpo } as unknown as Response);
const json = (objeto: unknown, ok = true, status = 200) =>
  respuesta(JSON.stringify(objeto), ok, status);

type Init = { method?: string; headers?: Record<string, string>; body?: string; signal?: unknown };
const llamadas = (f: jest.Mock): [string, Init][] => f.mock.calls as unknown as [string, Init][];
const comoFetch = (f: unknown) => f as typeof fetch;

/** La clasificación que devuelve el servidor para "cuánto vendí ayer". */
const AYER = { intencion: 'ventaDelDia', producto: 'ninguno', dia: 'ayer', confianza: 0.95 };

/** Un fetch que no responde nunca, pero respeta la señal como el real. */
const colgado = () =>
  jest.fn(
    (_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise<Response>((_resolver, rechazar) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          rechazar(error);
        });
      }),
  );

const linea = (nombre: string, preparadas: number, precio: number, costo: number): LineaCierre => ({
  productoId: `p-${nombre.toLowerCase()}`,
  nombre,
  preparadas,
  sobrantes: 0,
  precioUnitario: precio,
  costoUnitario: costo,
});

const cierreDe = (fecha: string, lineas: LineaCierre[]): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas,
  montoYape: 0,
  yapePendiente: false,
  gastos: [],
  abreCiclo: false,
  creadoEn: '2026-10-07T12:00:00-05:00',
  actualizadoEn: '2026-10-07T12:00:00-05:00',
});

/** Ayer (6 de octubre) se vendió S/ 205.00: 7 anticuchos a 10 y 15 pancitas a 9. */
const CTX: ContextoAnalisis = {
  cierres: [cierreDe('2026-10-06', [linea('Anticucho', 7, 10, 8.2), linea('Pancita', 15, 9, 8)])],
  productos: [],
  hoy: HOY,
};
const FRASE_AYER = 'Ayer, martes 6 de octubre, vendiste S/ 205.00.';

const hechoDe = (frase: string): Hecho => ({
  intencion: 'ventaDelDia',
  frase,
  cifras: extraerCifras(frase),
});

afterEach(() => {
  jest.useRealTimers();
});

describe('preguntarAJev', () => {
  it('una clasificación válida da la consulta', async () => {
    const f = jest.fn(async () => json({ ...AYER, modelo: 'typesafe/jev-1.13-20260917' }));

    await expect(preguntarAJev(comoFetch(f), URL_PRUEBA, '¿cuánto vendí ayer?')).resolves.toEqual({
      ok: true,
      consulta: { intencion: 'ventaDelDia', dia: 'ayer', confianza: 0.95 },
    });
  });

  it('el producto que nombra el clasificador vuelve id del catálogo', async () => {
    const f = jest.fn(async () =>
      json({ intencion: 'cuantoPreparar', producto: 'rachi', dia: 'ninguno', confianza: 0.9 }),
    );

    const r = await preguntarAJev(comoFetch(f), URL_PRUEBA, '¿cuánto preparo de rachi?');

    expect(r).toEqual({
      ok: true,
      consulta: {
        intencion: 'cuantoPreparar',
        producto: 'p-rachi',
        dia: 'ninguno',
        confianza: 0.9,
      },
    });
  });

  it('es un POST con un solo encabezado, el cuerpo exacto y una sola llamada', async () => {
    const f = jest.fn(async () => json(AYER));

    await preguntarAJev(comoFetch(f), URL_PRUEBA, '¿cuánto vendí ayer?');

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = llamadas(f)[0];
    expect(url).toBe(URL_PRUEBA);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ tipo: 'interpretar', texto: '¿cuánto vendí ayer?' }));
    // Lo único más que lleva es la señal para poder cortar a los 8 segundos.
    expect(Object.keys(init).sort()).toEqual(['body', 'headers', 'method', 'signal']);
  });

  it('el texto viaja recortado', async () => {
    const f = jest.fn(async () => json(AYER));

    await preguntarAJev(comoFetch(f), URL_PRUEBA, '   ¿cuánto vendí ayer?  \n');

    expect(JSON.parse(llamadas(f)[0][1].body ?? '')).toEqual({
      tipo: 'interpretar',
      texto: '¿cuánto vendí ayer?',
    });
  });

  it('un texto vacío, de puros espacios o de más de 200 caracteres no se envía', async () => {
    const f = jest.fn(async () => json(AYER));
    const resultados = [
      await preguntarAJev(comoFetch(f), URL_PRUEBA, ''),
      await preguntarAJev(comoFetch(f), URL_PRUEBA, '   \n  '),
      await preguntarAJev(comoFetch(f), URL_PRUEBA, 'a'.repeat(MAX_CARACTERES_PREGUNTA + 1)),
      await preguntarAJev(comoFetch(f), URL_PRUEBA, 42 as unknown as string),
    ];

    for (const r of resultados) expect(r).toEqual({ ok: false, error: 'RESPUESTA_INVALIDA' });
    expect(f).not.toHaveBeenCalled();
  });

  it('un texto de exactamente 200 caracteres sí se envía', async () => {
    const f = jest.fn(async () => json(AYER));

    const r = await preguntarAJev(comoFetch(f), URL_PRUEBA, 'a'.repeat(MAX_CARACTERES_PREGUNTA));

    expect(r.ok).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('con poca confianza devuelve la consulta "no entendí", sin intención', async () => {
    const f = jest.fn(async () => json({ ...AYER, confianza: 0.4 }));

    const r = await preguntarAJev(comoFetch(f), URL_PRUEBA, 'algo raro');

    expect(r).toEqual({ ok: true, consulta: { intencion: 'noEntendi', confianza: 0.4 } });
  });

  it('si fetch rechaza (sin señal) responde SIN_RED y no lanza', async () => {
    const f = jest.fn(() => Promise.reject(new TypeError('Network request failed')));

    await expect(preguntarAJev(comoFetch(f), URL_PRUEBA, 'hola')).resolves.toEqual({
      ok: false,
      error: 'SIN_RED',
    });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('si fetch lanza al instante o el cuerpo no se puede leer, también es SIN_RED', async () => {
    const lanza = jest.fn(() => {
      throw new Error('boom');
    });
    const cuerpoRoto = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => {
        throw new Error('se cortó');
      },
    }));

    await expect(preguntarAJev(comoFetch(lanza), URL_PRUEBA, 'hola')).resolves.toEqual({
      ok: false,
      error: 'SIN_RED',
    });
    await expect(preguntarAJev(comoFetch(cuerpoRoto), URL_PRUEBA, 'hola')).resolves.toEqual({
      ok: false,
      error: 'SIN_RED',
    });
  });

  it('una respuesta HTTP que no es exitosa es SIN_RED', async () => {
    const f = jest.fn(async () => json({ error: 'NO_DISPONIBLE' }, false, 502));

    await expect(preguntarAJev(comoFetch(f), URL_PRUEBA, 'hola')).resolves.toEqual({
      ok: false,
      error: 'SIN_RED',
    });
  });

  it('a los 8 segundos sin respuesta aborta y responde TIEMPO_AGOTADO, sin reintentar', async () => {
    jest.useFakeTimers();
    const f = colgado();
    let resultado: unknown;
    const pendiente = preguntarAJev(comoFetch(f), URL_PRUEBA, 'hola').then(r => {
      resultado = r;
    });

    expect(TIEMPO_LIMITE_MS).toBe(8000);
    await jest.advanceTimersByTimeAsync(7999);
    expect(resultado).toBeUndefined();
    await jest.advanceTimersByTimeAsync(1);
    await pendiente;

    expect(resultado).toEqual({ ok: false, error: 'TIEMPO_AGOTADO' });
    expect(f).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('al responder a tiempo limpia el temporizador', async () => {
    jest.useFakeTimers();
    const f = jest.fn(async () => json(AYER));

    await preguntarAJev(comoFetch(f), URL_PRUEBA, 'hola');

    expect(jest.getTimerCount()).toBe(0);
  });

  it('un JSON roto es RESPUESTA_INVALIDA', async () => {
    const f = jest.fn(async () => respuesta('{ esto no es json'));

    await expect(preguntarAJev(comoFetch(f), URL_PRUEBA, 'hola')).resolves.toEqual({
      ok: false,
      error: 'RESPUESTA_INVALIDA',
    });
  });

  it('una respuesta que no pasa la validación es RESPUESTA_INVALIDA', async () => {
    const malas = [
      { ...AYER, intencion: 'hackear' },
      { ...AYER, dia: 'antier' },
      { ...AYER, producto: 'lomo' },
      { ...AYER, confianza: 1.5 },
      { ...AYER, confianza: '0.9' },
      { intencion: 'ventaDelDia' },
      [],
      null,
      'texto',
    ];
    for (const mala of malas) {
      const f = jest.fn(async () => json(mala));
      await expect(preguntarAJev(comoFetch(f), URL_PRUEBA, 'hola')).resolves.toEqual({
        ok: false,
        error: 'RESPUESTA_INVALIDA',
      });
    }
  });

  it('un cuerpo de más de 4 KB es RESPUESTA_INVALIDA aunque sea una clasificación válida', async () => {
    const grande = JSON.stringify({ ...AYER, relleno: 'ñ'.repeat(TAMANO_MAXIMO_BYTES) });
    const f = jest.fn(async () => respuesta(grande));

    await expect(preguntarAJev(comoFetch(f), URL_PRUEBA, 'hola')).resolves.toEqual({
      ok: false,
      error: 'RESPUESTA_INVALIDA',
    });
  });
});

describe('redactarRespuesta', () => {
  it('una redacción con las mismas cifras es ok', async () => {
    const f = jest.fn(async () =>
      json({ texto: 'Ayer, martes 6 de octubre, te entraron S/ 205.00.' }),
    );

    await expect(redactarRespuesta(comoFetch(f), URL_PRUEBA, hechoDe(FRASE_AYER))).resolves.toEqual(
      {
        ok: true,
        texto: 'Ayer, martes 6 de octubre, te entraron S/ 205.00.',
      },
    );
  });

  it('es un POST con un solo encabezado y el cuerpo exacto: el tipo y el hecho', async () => {
    const f = jest.fn(async () => json({ texto: FRASE_AYER }));

    await redactarRespuesta(comoFetch(f), URL_PRUEBA, hechoDe(FRASE_AYER));

    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = llamadas(f)[0];
    expect(url).toBe(URL_PRUEBA);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe(
      JSON.stringify({
        tipo: 'redactar',
        hecho: { intencion: 'ventaDelDia', frase: FRASE_AYER, cifras: ['6', '205.00'] },
      }),
    );
    expect(Object.keys(init).sort()).toEqual(['body', 'headers', 'method', 'signal']);
  });

  it('solo viajan la intención, la frase y las cifras aunque el hecho traiga algo más', async () => {
    const f = jest.fn(async () => json({ texto: FRASE_AYER }));
    const conExtra = { ...hechoDe(FRASE_AYER), nombre: 'Freddy', yape: '987654321' } as Hecho;

    await redactarRespuesta(comoFetch(f), URL_PRUEBA, conExtra);

    const cuerpo = llamadas(f)[0][1].body ?? '';
    expect(cuerpo).not.toContain('Freddy');
    expect(cuerpo).not.toContain('987654321');
    expect(Object.keys(JSON.parse(cuerpo).hecho).sort()).toEqual(['cifras', 'frase', 'intencion']);
  });

  it('una cifra distinta, una que falta, un enlace o un texto largo es REDACCION_DESCARTADA', async () => {
    const malas = [
      'Ayer vendiste S/ 250.00',
      'Ayer, martes 6 de octubre, vendiste mucho.',
      'Ayer, martes 6 de octubre, vendiste S/ 205.00 en https://ejemplo.pe',
      `Ayer, martes 6 de octubre, vendiste S/ 205.00. ${'bien '.repeat(60)}`,
      '',
    ];
    for (const mala of malas) {
      const f = jest.fn(async () => json({ texto: mala }));
      await expect(
        redactarRespuesta(comoFetch(f), URL_PRUEBA, hechoDe(FRASE_AYER)),
      ).resolves.toEqual({ ok: false, error: 'REDACCION_DESCARTADA' });
    }
  });

  it('SIN_RED, HTTP no exitoso y TIEMPO_AGOTADO, sin reintentar', async () => {
    const cae = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    const fallo = jest.fn(async () => json({ error: 'NO_DISPONIBLE' }, false, 502));

    await expect(
      redactarRespuesta(comoFetch(cae), URL_PRUEBA, hechoDe(FRASE_AYER)),
    ).resolves.toEqual({
      ok: false,
      error: 'SIN_RED',
    });
    await expect(
      redactarRespuesta(comoFetch(fallo), URL_PRUEBA, hechoDe(FRASE_AYER)),
    ).resolves.toEqual({ ok: false, error: 'SIN_RED' });

    jest.useFakeTimers();
    const f = colgado();
    let resultado: unknown;
    const pendiente = redactarRespuesta(comoFetch(f), URL_PRUEBA, hechoDe(FRASE_AYER)).then(r => {
      resultado = r;
    });
    await jest.advanceTimersByTimeAsync(8000);
    await pendiente;
    expect(resultado).toEqual({ ok: false, error: 'TIEMPO_AGOTADO' });
    expect(f).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('un JSON roto, sin texto, con texto que no es texto o de más de 4 KB es RESPUESTA_INVALIDA', async () => {
    const cuerpos = [
      '{ roto',
      JSON.stringify({}),
      JSON.stringify({ texto: 205 }),
      JSON.stringify([]),
      JSON.stringify({ texto: FRASE_AYER, relleno: 'ñ'.repeat(TAMANO_MAXIMO_BYTES) }),
    ];
    for (const cuerpo of cuerpos) {
      const f = jest.fn(async () => respuesta(cuerpo));
      await expect(
        redactarRespuesta(comoFetch(f), URL_PRUEBA, hechoDe(FRASE_AYER)),
      ).resolves.toEqual({ ok: false, error: 'RESPUESTA_INVALIDA' });
    }
  });
});

describe('consultar', () => {
  const REDACCION = 'Ayer, martes 6 de octubre, te entraron S/ 205.00.';

  /** Un servidor que primero clasifica y luego redacta. */
  const servidor = (clasificacion: unknown, redaccion: () => Promise<Response>) =>
    jest.fn().mockResolvedValueOnce(json(clasificacion)).mockImplementation(redaccion);

  it('con todo en orden muestra la redacción, con la frase fija a mano, en 2 peticiones', async () => {
    const f = servidor(AYER, async () => json({ texto: REDACCION }));

    const r = await consultar(comoFetch(f), URL_PRUEBA, '¿cuánto vendí ayer?', CTX);

    expect(r).toMatchObject({
      tipo: 'respuesta',
      texto: REDACCION,
      frase: FRASE_AYER,
      redactada: true,
    });
    expect(r.tipo === 'respuesta' && r.hecho).toEqual(hechoDe(FRASE_AYER));
    expect(f).toHaveBeenCalledTimes(2);
    expect(JSON.parse(llamadas(f)[0][1].body ?? '').tipo).toBe('interpretar');
    expect(JSON.parse(llamadas(f)[1][1].body ?? '').tipo).toBe('redactar');
  });

  it('una redacción que cambia una cifra se descarta y se muestra la frase fija', async () => {
    const f = servidor(AYER, async () => json({ texto: 'Ayer vendiste S/ 250.00' }));

    const r = await consultar(comoFetch(f), URL_PRUEBA, '¿cuánto vendí ayer?', CTX);

    expect(r).toMatchObject({ tipo: 'respuesta', texto: FRASE_AYER, redactada: false });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('si el redactor cae, falla o devuelve basura, se muestra la frase fija', async () => {
    const caminos: Array<() => Promise<Response>> = [
      () => Promise.reject(new TypeError('Network request failed')),
      async () => json({ error: 'NO_DISPONIBLE' }, false, 502),
      async () => respuesta('{ roto'),
      async () => json({ texto: 42 }),
    ];
    for (const camino of caminos) {
      const f = servidor(AYER, camino);
      const r = await consultar(comoFetch(f), URL_PRUEBA, '¿cuánto vendí ayer?', CTX);
      expect(r).toMatchObject({ tipo: 'respuesta', texto: FRASE_AYER, redactada: false });
      expect(f).toHaveBeenCalledTimes(2);
    }
  });

  it('si el redactor no responde en 8 segundos, se muestra la frase fija', async () => {
    jest.useFakeTimers();
    // El redactor se cuelga de verdad: un fetch que respeta la señal, como el real.
    const lento = colgado();
    const g = jest
      .fn()
      .mockResolvedValueOnce(json(AYER))
      .mockImplementationOnce((url: unknown, init?: { signal?: AbortSignal }) => lento(url, init));
    let resultado: unknown;
    const pendiente = consultar(comoFetch(g), URL_PRUEBA, '¿cuánto vendí ayer?', CTX).then(r => {
      resultado = r;
    });

    await jest.advanceTimersByTimeAsync(8000);
    await pendiente;

    expect(resultado).toMatchObject({ tipo: 'respuesta', texto: FRASE_AYER, redactada: false });
    expect(g).toHaveBeenCalledTimes(2);
  });

  it('sin internet (e6) dice que necesita internet, en una sola petición', async () => {
    const f = jest.fn(() => Promise.reject(new TypeError('Network request failed')));

    const r = await consultar(comoFetch(f), URL_PRUEBA, '¿cuánto vendí ayer?', CTX);

    expect(r).toEqual({ tipo: 'sinInternet', texto: TEXTO_SIN_INTERNET });
    expect(TEXTO_SIN_INTERNET).toBe(
      'Necesitas internet para esto. Revisa tu conexión e inténtalo otra vez.',
    );
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('si el servidor no contesta en 8 segundos también es "necesitas internet"', async () => {
    jest.useFakeTimers();
    const f = colgado();
    let resultado: unknown;
    const pendiente = consultar(comoFetch(f), URL_PRUEBA, '¿cuánto vendí ayer?', CTX).then(r => {
      resultado = r;
    });

    await jest.advanceTimersByTimeAsync(8000);
    await pendiente;

    expect(resultado).toEqual({ tipo: 'sinInternet', texto: TEXTO_SIN_INTERNET });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('con poca confianza (e5) dice "No entendí" y no pide redacción ni muestra cifras', async () => {
    const f = jest.fn(async () => json({ ...AYER, confianza: 0.4 }));

    const r = await consultar(comoFetch(f), URL_PRUEBA, '¿qué hace el clima?', CTX);

    expect(r).toEqual({ tipo: 'noEntendi', texto: TEXTO_NO_ENTENDI });
    expect(TEXTO_NO_ENTENDI).toBe('No entendí tu pregunta. Prueba con una de estas:');
    expect(f).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(r)).not.toMatch(/\d/);
  });

  it('una respuesta inválida del servidor es "No entendí"', async () => {
    const f = jest.fn(async () => json({ intencion: 'hackear' }));

    const r = await consultar(comoFetch(f), URL_PRUEBA, 'hola', CTX);

    expect(r).toEqual({ tipo: 'noEntendi', texto: TEXTO_NO_ENTENDI });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('una pregunta que el clasificador reconoce como no entendida no pide redacción', async () => {
    const f = jest.fn(async () =>
      json({ intencion: 'noEntendi', producto: 'ninguno', dia: 'ninguno', confianza: 0.99 }),
    );

    const r = await consultar(comoFetch(f), URL_PRUEBA, 'cuéntame un chiste', CTX);

    expect(r).toEqual({ tipo: 'noEntendi', texto: TEXTO_NO_ENTENDI });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('un texto vacío o larguísimo es "No entendí" y no sale ninguna petición', async () => {
    const f = jest.fn(async () => json(AYER));

    const vacio = await consultar(comoFetch(f), URL_PRUEBA, '   ', CTX);
    const largo = await consultar(comoFetch(f), URL_PRUEBA, 'a'.repeat(500), CTX);

    expect(vacio).toEqual({ tipo: 'noEntendi', texto: TEXTO_NO_ENTENDI });
    expect(largo).toEqual({ tipo: 'noEntendi', texto: TEXTO_NO_ENTENDI });
    expect(f).not.toHaveBeenCalled();
  });

  it('una frase sin cifras no se manda a redactar', async () => {
    const f = jest.fn(async () => json(AYER));
    const sinVentas: ContextoAnalisis = { cierres: [], productos: [], hoy: HOY };

    const r = await consultar(comoFetch(f), URL_PRUEBA, '¿cuánto vendí ayer?', sinVentas);

    expect(r).toMatchObject({
      tipo: 'respuesta',
      texto: 'Ayer no cerraste tu día.',
      redactada: false,
    });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('nunca lanza, aunque fetch lance al instante', async () => {
    const f = jest.fn(() => {
      throw new Error('boom');
    });

    await expect(consultar(comoFetch(f), URL_PRUEBA, 'hola', CTX)).resolves.toEqual({
      tipo: 'sinInternet',
      texto: TEXTO_SIN_INTERNET,
    });
  });

  it('cada consulta es independiente: una caída no contamina la siguiente', async () => {
    const cae = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    const bien = servidor(AYER, async () => json({ texto: REDACCION }));

    const primera = await consultar(comoFetch(cae), URL_PRUEBA, 'hola', CTX);
    const segunda = await consultar(comoFetch(bien), URL_PRUEBA, '¿cuánto vendí ayer?', CTX);

    expect(primera.tipo).toBe('sinInternet');
    expect(segunda).toMatchObject({ tipo: 'respuesta', redactada: true });
  });

  it('ningún código ni mensaje técnico llega al texto de Freddy, por ningún camino', async () => {
    const fallos: Array<() => Promise<Response>> = [
      () => Promise.reject(new TypeError('Network request failed')),
      async () => json({ error: 'NO_DISPONIBLE' }, false, 502),
      async () => respuesta('{ roto'),
      async () => json({ texto: 'Ayer vendiste S/ 250.00' }),
    ];
    const textos: string[] = [];
    for (const fallo of fallos) {
      const r = await consultar(comoFetch(servidor(AYER, fallo)), URL_PRUEBA, 'hola', CTX);
      textos.push(r.texto);
    }
    const sinRed = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    textos.push((await consultar(comoFetch(sinRed), URL_PRUEBA, 'hola', CTX)).texto);
    const dudosa = jest.fn(async () => json({ ...AYER, confianza: 0.1 }));
    textos.push((await consultar(comoFetch(dudosa), URL_PRUEBA, 'hola', CTX)).texto);
    const invalida = jest.fn(async () => respuesta('{ roto'));
    textos.push((await consultar(comoFetch(invalida), URL_PRUEBA, 'hola', CTX)).texto);

    expect(textos.length).toBe(7);
    for (const texto of textos) expect(texto).not.toMatch(TECNICO);
  });
});
