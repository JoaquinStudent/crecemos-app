/**
 * Pruebas de apoyo del servicio de la semilla (no son escenarios del SPEC).
 * cargarSemilla es el único fetch del proyecto: recibe el fetch por parámetro, así que
 * aquí se le pasa uno simulado y la red nunca se toca.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { cargarSemilla } from '@services/seed';

const URL_PRUEBA = 'https://ejemplo.test/semilla.json';

const semillaReal = readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8');

// Lo mínimo de una Response que el servicio usa.
const respuesta = (cuerpo: string, ok = true, status = 200) =>
  ({ ok, status, text: async () => cuerpo } as unknown as Response);

const conRespuesta = (cuerpo: string, ok = true, status = 200) =>
  jest.fn(async (..._args: [url: string, init?: RequestInit]) => respuesta(cuerpo, ok, status));

// Los fetch simulados no cumplen todos los detalles de typeof fetch: se pasan como lo que hacen de cuenta.
const cargar = (fetchSimulado: unknown) => cargarSemilla(fetchSimulado as typeof fetch, URL_PRUEBA);

describe('cargarSemilla', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('con la semilla real responde ok y trae los 4 productos y los 40 cierres', async () => {
    const fetchFn = conRespuesta(semillaReal);

    const resultado = await cargar(fetchFn);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.semilla.productos).toHaveLength(4);
    expect(resultado.semilla.cierres).toHaveLength(40);
  });

  it('es un GET sin cuerpo ni encabezados, a la dirección pedida, y se llama una sola vez', async () => {
    const fetchFn = conRespuesta(semillaReal);

    await cargar(fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchFn.mock.calls[0];
    expect(url).toBe(URL_PRUEBA);
    expect(opciones?.method).toBe('GET');
    expect(opciones).not.toHaveProperty('body');
    expect(opciones).not.toHaveProperty('headers');
    // Lo único más que lleva es la señal para poder cortar a los 8 segundos.
    expect(Object.keys(opciones ?? {}).sort()).toEqual(['method', 'signal']);
  });

  it('si fetch rechaza (sin señal) responde SIN_RED y no lanza', async () => {
    const fetchFn = jest.fn(() => Promise.reject(new TypeError('Network request failed')));

    await expect(cargar(fetchFn)).resolves.toEqual({
      ok: false,
      error: 'SIN_RED',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('una respuesta HTTP 500 es SIN_RED', async () => {
    const fetchFn = conRespuesta('error del servidor', false, 500);

    await expect(cargar(fetchFn)).resolves.toEqual({
      ok: false,
      error: 'SIN_RED',
    });
  });

  it('a los 8 segundos sin respuesta aborta y responde TIEMPO_AGOTADO, sin reintentar', async () => {
    jest.useFakeTimers();
    // Un fetch que no responde nunca, pero respeta la señal como el real.
    const fetchFn = jest.fn(
      (_url: unknown, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolver, rechazar) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            rechazar(error);
          });
        }),
    );
    let resultado: unknown;
    const pendiente = cargar(fetchFn).then(r => {
      resultado = r;
    });

    await jest.advanceTimersByTimeAsync(7999);
    expect(resultado).toBeUndefined();

    await jest.advanceTimersByTimeAsync(1);
    await pendiente;

    expect(resultado).toEqual({ ok: false, error: 'TIEMPO_AGOTADO' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    // Ya no queda ningún temporizador vivo.
    expect(jest.getTimerCount()).toBe(0);
  });

  it('al responder a tiempo limpia el temporizador', async () => {
    jest.useFakeTimers();
    const fetchFn = conRespuesta(semillaReal);

    await cargar(fetchFn);

    expect(jest.getTimerCount()).toBe(0);
  });

  it('un JSON roto es SEMILLA_INVALIDA', async () => {
    const fetchFn = conRespuesta('{ esto no es json');

    await expect(cargar(fetchFn)).resolves.toEqual({
      ok: false,
      error: 'SEMILLA_INVALIDA',
    });
  });

  it('un JSON sin cierres es SEMILLA_INVALIDA', async () => {
    const sinCierres = JSON.parse(semillaReal);
    delete sinCierres.cierres;
    const fetchFn = conRespuesta(JSON.stringify(sinCierres));

    await expect(cargar(fetchFn)).resolves.toEqual({
      ok: false,
      error: 'SEMILLA_INVALIDA',
    });
  });

  it('un cuerpo de más de 50 KB es SEMILLA_INVALIDA aunque sea una semilla válida', async () => {
    const grande = JSON.parse(semillaReal);
    grande.relleno = 'x'.repeat(51200);
    const cuerpo = JSON.stringify(grande);
    expect(cuerpo.length).toBeGreaterThan(51200);
    const fetchFn = conRespuesta(cuerpo);

    await expect(cargar(fetchFn)).resolves.toEqual({
      ok: false,
      error: 'SEMILLA_INVALIDA',
    });
  });

  it('cuenta bytes y no letras: pocas letras con tilde pueden pasar de 50 KB', async () => {
    const grande = JSON.parse(semillaReal);
    // Letras de 2 bytes: el texto queda por debajo de 51,200 letras y por encima de 51,200 bytes.
    grande.relleno = 'ñ'.repeat(51200 - Buffer.byteLength(semillaReal, 'utf8') - 100);
    const cuerpo = JSON.stringify(grande);
    expect(cuerpo.length).toBeLessThan(51200);
    expect(Buffer.byteLength(cuerpo, 'utf8')).toBeGreaterThan(51200);
    const fetchFn = conRespuesta(cuerpo);

    await expect(cargar(fetchFn)).resolves.toEqual({
      ok: false,
      error: 'SEMILLA_INVALIDA',
    });
  });

  it('la semilla real cabe en el límite de 50 KB', () => {
    expect(Buffer.byteLength(semillaReal, 'utf8')).toBeLessThanOrEqual(51200);
  });
});
