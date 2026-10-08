// src/services/seed.ts
// EL ÚNICO fetch() del proyecto (sdd/AGENTS.md, regla 8). Descarga la semilla de ejemplo
// con un solo GET, sin cuerpo, sin encabezados y sin datos del usuario. Nunca lanza.
import { validarSemilla } from '@dominio/semilla';
import type { SemillaJSON } from '@dominio/tipos';

export type ResultadoSemilla =
  | { ok: true; semilla: SemillaJSON }
  | { ok: false; error: 'SIN_RED' | 'TIEMPO_AGOTADO' | 'SEMILLA_INVALIDA' };

/** Pasado este tiempo sin respuesta se corta y se trata como sin red. */
export const TIEMPO_LIMITE_MS = 8000;
/** Más que esto no es la semilla: es el presupuesto de datos del usuario prepago. */
export const TAMANO_MAXIMO_BYTES = 51200;

/** Bytes del texto en UTF-8, sin depender de TextEncoder (que no siempre existe en Hermes). */
const bytesUtf8 = (texto: string): number => {
  let bytes = 0;
  for (let i = 0; i < texto.length; i += 1) {
    const codigo = texto.charCodeAt(i);
    if (codigo < 0x80) bytes += 1;
    else if (codigo < 0x800) bytes += 2;
    else if (codigo >= 0xd800 && codigo <= 0xdbff) {
      bytes += 4; // un par sustituto son 4 bytes
      i += 1;
    } else bytes += 3;
  }
  return bytes;
};

export const cargarSemilla = async (
  fetchFn: typeof fetch,
  url: string,
): Promise<ResultadoSemilla> => {
  const controlador = new AbortController();
  let agotado = false;
  const temporizador = setTimeout(() => {
    agotado = true;
    controlador.abort();
  }, TIEMPO_LIMITE_MS);

  try {
    let texto: string;
    try {
      // Los tipos de AbortSignal de DOM y de React Native no coinciden; en ejecución es el mismo objeto.
      const senal = controlador.signal as unknown as NonNullable<RequestInit['signal']>;
      const respuesta = await fetchFn(url, { method: 'GET', signal: senal });
      if (!respuesta.ok) return { ok: false, error: 'SIN_RED' };
      texto = await respuesta.text();
    } catch {
      return { ok: false, error: agotado ? 'TIEMPO_AGOTADO' : 'SIN_RED' };
    }

    if (bytesUtf8(texto) > TAMANO_MAXIMO_BYTES) return { ok: false, error: 'SEMILLA_INVALIDA' };
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      return { ok: false, error: 'SEMILLA_INVALIDA' };
    }
    const validada = validarSemilla(json);
    return validada.ok
      ? { ok: true, semilla: validada.semilla }
      : { ok: false, error: 'SEMILLA_INVALIDA' };
  } finally {
    clearTimeout(temporizador);
  }
};
