/**
 * El asistente en modo avión: con la red caída, las 12 intenciones se clasifican en el teléfono y se
 * responden con las mismas frases de siempre, sin juicio y con la nota "Respondí sin internet".
 * Nada sale del teléfono más que el intento que falló, y nunca un monto del Yape.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fechaLocal } from '@dominio/fecha';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { ContextoAnalisis, IntencionId } from '@dominio/tipos';
import { clasificarLocal } from '@analisis/clasificadorLocal';
import { INTENCIONES, PREGUNTAS_SUGERIDAS, responderConsulta } from '@analisis/intenciones';
import { ETIQUETA_SEMAFORO } from '@analisis/semaforo';
import {
  consultar,
  reiniciarEstadoDeRed,
  TIEMPO_LIMITE_MS,
  TIEMPO_TRAS_FALLA_MS,
  VENTANA_FALLA_MS,
} from '@services/jev';

const URL_PRUEBA = 'https://asistente.ejemplo.test';

const semilla = () => {
  const r = validarSemilla(
    JSON.parse(readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8')),
  );
  if (!r.ok) throw new Error('La semilla real no valida');
  return r.semilla;
};
const hoy = new Date(2026, 9, 20, 12); // martes 20 de octubre
const { cierres, productos } = materializarSemilla(semilla(), hoy);
const CTX: ContextoAnalisis = { cierres, productos, hoy: fechaLocal(hoy) };

const comoFetch = (f: unknown) => f as typeof fetch;
const sinRed = () => jest.fn(() => Promise.reject(new TypeError('Network request failed')));
const cuerpos = (f: jest.Mock): unknown[] =>
  (f.mock.calls as unknown as Array<[string, { body?: string }]>).map(([, init]) =>
    JSON.parse(init.body ?? '{}'),
  );
const json = (objeto: unknown) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(objeto) } as unknown as Response);

/** Una pregunta por intención, escrita como la escribiría Freddy. */
const PREGUNTAS: Array<[IntencionId, string]> = [
  ['ventaDelDia', '¿Cuánto vendí ayer?'],
  ['mejorDia', '¿Qué día me va mejor?'],
  ['peorDia', 'cual es mi peor dia'],
  ['productoQueMasDeja', 'que producto me deja mas'],
  ['productoQueMasSeVende', '¿Cuál se vende más?'],
  ['cuantoPorCobrar', '¿Cuánto me deben?'],
  ['cuantoSacarParaLaCasa', 'cuanto puedo sacar para la casa'],
  ['cuantoPreparar', '¿Qué preparo mañana?'],
  ['compararCiclo', '¿Cómo voy contra el ciclo pasado?'],
  ['revisarPrecio', '¿Debo revisar el precio del anticucho?'],
  ['cuandoRecupereCapital', '¿Cuándo recuperé mi capital?'],
];

beforeEach(() => {
  reiniciarEstadoDeRed();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('modo avión: las 12 intenciones', () => {
  it('cubre las once intenciones reales y la de «no entendí»', () => {
    expect(PREGUNTAS.map(([id]) => id).sort()).toEqual(
      INTENCIONES.map(i => i.id)
        .filter(id => id !== 'noEntendi')
        .sort(),
    );
  });

  for (const [intencion, pregunta] of PREGUNTAS) {
    it(`${intencion}: responde sin internet con la misma frase que en línea`, async () => {
      const caida = sinRed();
      const offline = await consultar(comoFetch(caida), URL_PRUEBA, pregunta, CTX);

      expect(offline).toMatchObject({ tipo: 'respuesta', sinInternet: true, redactada: false });
      if (offline.tipo !== 'respuesta') throw new Error('se esperaba una respuesta');
      expect(offline.consulta.intencion).toBe(intencion);
      expect(offline.hecho.intencion).toBe(intencion);

      // En línea, con el servidor clasificando igual, sale exactamente la misma frase.
      const local = clasificarLocal(pregunta, CTX.hoy);
      const enLinea = jest.fn(async (_url: unknown, init?: { body?: string }) => {
        const tipo = JSON.parse(init?.body ?? '{}').tipo;
        return tipo === 'interpretar'
          ? json({
              intencion: local.intencion,
              producto: 'ninguno',
              dia: local.dia,
              confianza: 0.9,
            })
          : json({ error: 'NO_DISPONIBLE' });
      });
      const online = await consultar(comoFetch(enLinea), URL_PRUEBA, pregunta, CTX);
      if (online.tipo !== 'respuesta') throw new Error('se esperaba una respuesta en línea');
      expect(offline.texto).toBe(online.texto);
      expect(offline.hecho.cifras).toEqual(online.hecho.cifras);

      // Es la frase del código de siempre, sin nada agregado.
      expect(offline.texto).toBe(responderConsulta(offline.consulta, CTX).frase);
    });

    it(`${intencion}: sin internet no hay veredicto ni semáforo`, async () => {
      const r = await consultar(comoFetch(sinRed()), URL_PRUEBA, pregunta, CTX);
      if (r.tipo !== 'respuesta') throw new Error('se esperaba una respuesta');
      expect(r.semaforo).toBeUndefined();
      expect('semaforo' in r).toBe(false);
      for (const palabra of Object.values(ETIQUETA_SEMAFORO)) {
        expect(r.texto).not.toMatch(new RegExp(`^${palabra}\\b`));
      }
    });

    it(`${intencion}: la única petición es el intento que falló y solo lleva lo que Freddy escribió`, async () => {
      const caida = sinRed();
      await consultar(comoFetch(caida), URL_PRUEBA, pregunta, CTX);
      expect(caida).toHaveBeenCalledTimes(1);
      expect(cuerpos(caida)).toEqual([{ tipo: 'interpretar', texto: pregunta }]);
    });
  }

  it('la intención 12, noEntendi: sin red y sin entender, el mensaje de ayuda y tres sugeridas', async () => {
    const caida = sinRed();
    const r = await consultar(comoFetch(caida), URL_PRUEBA, 'cuéntame un chiste', CTX);
    expect(r).toEqual({
      tipo: 'sinInternet',
      texto: 'Sin internet no pude entender tu pregunta. Prueba con una de estas:',
      sugeridas: PREGUNTAS_SUGERIDAS.slice(0, 3),
    });
    expect((r as { sugeridas: string[] }).sugeridas).toHaveLength(3);
    expect(caida).toHaveBeenCalledTimes(1);
  });

  it('la respuesta sin internet sigue el hilo: «¿y ayer?» hereda la intención de la pregunta anterior', async () => {
    const primera = await consultar(comoFetch(sinRed()), URL_PRUEBA, '¿cuánto vendí hoy?', CTX);
    if (primera.tipo !== 'respuesta') throw new Error('se esperaba una respuesta');
    const segunda = await consultar(
      comoFetch(sinRed()),
      URL_PRUEBA,
      '¿y ayer?',
      CTX,
      primera.consulta,
    );
    expect(segunda).toMatchObject({
      tipo: 'respuesta',
      sinInternet: true,
      consulta: { intencion: 'ventaDelDia', dia: 'ayer' },
    });
  });

  it('un producto del catálogo se reconoce en el teléfono: «¿y de la pancita?» sigue «cuánto preparo»', async () => {
    const primera = await consultar(
      comoFetch(sinRed()),
      URL_PRUEBA,
      '¿cuánto debo preparar de anticucho?',
      CTX,
    );
    if (primera.tipo !== 'respuesta') throw new Error('se esperaba una respuesta');
    const segunda = await consultar(
      comoFetch(sinRed()),
      URL_PRUEBA,
      '¿y de la pancita?',
      CTX,
      primera.consulta,
    );
    expect(segunda).toMatchObject({
      tipo: 'respuesta',
      consulta: { intencion: 'cuantoPreparar', producto: 'p-pancita' },
    });
  });

  it('también responde en local si el servidor está caído o hay límite de preguntas', async () => {
    for (const status of [429, 502]) {
      const f = jest.fn(
        async () => ({ ok: false, status, text: async () => '{}' } as unknown as Response),
      );
      const r = await consultar(comoFetch(f), URL_PRUEBA, '¿cuánto me deben?', CTX);
      expect(r).toMatchObject({ tipo: 'respuesta', sinInternet: true });
      expect(f).toHaveBeenCalledTimes(1);
    }
  });

  it('una respuesta inválida del servidor sigue siendo «no entendí» (no es falta de red)', async () => {
    const f = jest.fn(async () => json({ intencion: 'hackear' }));
    const r = await consultar(comoFetch(f), URL_PRUEBA, '¿cuánto me deben?', CTX);
    expect(r.tipo).toBe('noEntendi');
  });

  it('con red, no usa el clasificador local ni lleva la nota', async () => {
    const f = jest.fn(async (_u: unknown, init?: { body?: string }) =>
      JSON.parse(init?.body ?? '{}').tipo === 'interpretar'
        ? json({ intencion: 'ventaDelDia', producto: 'ninguno', dia: 'ayer', confianza: 0.95 })
        : json({ error: 'X' }),
    );
    const r = await consultar(comoFetch(f), URL_PRUEBA, 'zzz', CTX);
    expect(r).toMatchObject({ tipo: 'respuesta' });
    expect((r as { sinInternet?: boolean }).sinInternet).toBeUndefined();
  });
});

describe('privacidad sin internet', () => {
  it('«cuánto me deben» responde con el monto en el teléfono y ese monto no sale en ninguna petición', async () => {
    const caida = sinRed();
    const r = await consultar(comoFetch(caida), URL_PRUEBA, '¿cuánto me deben?', CTX);
    if (r.tipo !== 'respuesta') throw new Error('se esperaba una respuesta');
    expect(r.texto).toMatch(/S\/ \d/);
    const enviado = JSON.stringify(cuerpos(caida));
    expect(enviado).toBe(JSON.stringify([{ tipo: 'interpretar', texto: '¿cuánto me deben?' }]));
    for (const cifra of r.hecho.cifras) expect(enviado).not.toContain(cifra);
  });

  it('el encabezado sigue siendo uno solo (Content-Type) y no hay más intentos que el que falló', async () => {
    const caida = sinRed();
    await consultar(comoFetch(caida), URL_PRUEBA, '¿cuánto me deben?', CTX);
    const init = (caida.mock.calls as unknown as Array<[string, { headers: object }]>)[0][1];
    expect(Object.keys(init.headers)).toEqual(['Content-Type']);
    expect(caida).toHaveBeenCalledTimes(1);
  });
});

describe('tiempo de espera tras una falla de red', () => {
  /** Un fetch que no responde, pero respeta la señal como el real. */
  const colgado = () =>
    jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_ok, rechazar) => {
          init?.signal?.addEventListener('abort', () => {
            const e = new Error('Aborted');
            e.name = 'AbortError';
            rechazar(e);
          });
        }),
    );

  const preguntarEn = (f: jest.Mock) => {
    const estado = { listo: false };
    const pendiente = consultar(comoFetch(f), URL_PRUEBA, '¿cuánto me deben?', CTX).then(r => {
      estado.listo = true;
      return r;
    });
    return { estado, pendiente };
  };

  it('la primera vez espera los 8 s completos', async () => {
    jest.useFakeTimers();
    const { estado, pendiente } = preguntarEn(colgado());
    await jest.advanceTimersByTimeAsync(TIEMPO_LIMITE_MS - 1);
    expect(estado.listo).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await pendiente).toMatchObject({ tipo: 'respuesta', sinInternet: true });
  });

  it('tras una falla de red reciente, la siguiente espera solo 2,5 s', async () => {
    jest.useFakeTimers();
    expect(TIEMPO_TRAS_FALLA_MS).toBe(2500);
    await consultar(comoFetch(sinRed()), URL_PRUEBA, '¿cuánto me deben?', CTX);

    const { estado, pendiente } = preguntarEn(colgado());
    await jest.advanceTimersByTimeAsync(TIEMPO_TRAS_FALLA_MS - 1);
    expect(estado.listo).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await pendiente).toMatchObject({ tipo: 'respuesta', sinInternet: true });
  });

  it('pasado un minuto desde la falla, vuelve a esperar los 8 s', async () => {
    jest.useFakeTimers();
    await consultar(comoFetch(sinRed()), URL_PRUEBA, '¿cuánto me deben?', CTX);
    await jest.advanceTimersByTimeAsync(VENTANA_FALLA_MS + 1);

    const { estado, pendiente } = preguntarEn(colgado());
    await jest.advanceTimersByTimeAsync(TIEMPO_TRAS_FALLA_MS + 1);
    expect(estado.listo).toBe(false);
    await jest.advanceTimersByTimeAsync(TIEMPO_LIMITE_MS);
    expect(await pendiente).toMatchObject({ sinInternet: true });
  });

  it('una respuesta del servidor borra la memoria de la falla', async () => {
    jest.useFakeTimers();
    await consultar(comoFetch(sinRed()), URL_PRUEBA, '¿cuánto me deben?', CTX);
    const bien = jest.fn(async (_u: unknown, init?: { body?: string }) =>
      JSON.parse(init?.body ?? '{}').tipo === 'interpretar'
        ? json({
            intencion: 'cuantoPorCobrar',
            producto: 'ninguno',
            dia: 'ninguno',
            confianza: 0.9,
          })
        : json({ error: 'X' }),
    );
    await consultar(comoFetch(bien), URL_PRUEBA, '¿cuánto me deben?', CTX);

    const { estado, pendiente } = preguntarEn(colgado());
    await jest.advanceTimersByTimeAsync(TIEMPO_TRAS_FALLA_MS + 1);
    expect(estado.listo).toBe(false);
    await jest.advanceTimersByTimeAsync(TIEMPO_LIMITE_MS);
    await pendiente;
  });
});
