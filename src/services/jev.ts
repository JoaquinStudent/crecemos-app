// src/services/jev.ts
// La SEGUNDA y última llamada de red de la app: fetch() hacia el servidor intermedio del chat
// "Preguntarle a mis datos" (sdd/AGENTS.md, regla 8; la primera es la semilla, en seed.ts). La app
// nunca habla con el proveedor de IA ni lleva ninguna clave: el Worker de `servidor/` la guarda y
// reenvía. Cada petición es un POST con UN solo encabezado (Content-Type), un cuerpo de tipo fijo y
// NADA del usuario más que lo que él mismo escribió o la cifra ya calculada. Un intento, 8 s de
// límite, nunca lanza y ningún código técnico llega a un texto que lea Freddy.
import { interpretarRespuesta, responderConsulta } from '@analisis/intenciones';
import { validarRedaccion } from '@analisis/validarRedaccion';
import type { Consulta, ContextoAnalisis, Hecho } from '@dominio/tipos';
import { bytesUtf8 } from './seed';

export type ErrorJev = 'SIN_RED' | 'TIEMPO_AGOTADO' | 'RESPUESTA_INVALIDA';

export type ResultadoJev = { ok: true; consulta: Consulta } | { ok: false; error: ErrorJev };

export type ResultadoRedactar =
  | { ok: true; texto: string }
  | { ok: false; error: ErrorJev | 'REDACCION_DESCARTADA' };

/** Lo que el chat pone en pantalla; `texto` es siempre lo que lee Freddy. */
export type RespuestaChat =
  | { tipo: 'respuesta'; texto: string; frase: string; redactada: boolean; hecho: Hecho }
  | { tipo: 'noEntendi'; texto: string }
  | { tipo: 'sinInternet'; texto: string };

/** Pasado este tiempo sin respuesta se corta y se trata como sin red. */
export const TIEMPO_LIMITE_MS = 8000;
/** Más que esto no es una respuesta del servidor: es el presupuesto de datos del usuario prepago. */
export const TAMANO_MAXIMO_BYTES = 4096;
/** La pregunta más larga que sale del teléfono; el servidor pone el mismo tope. */
export const MAX_CARACTERES_PREGUNTA = 200;

export const TEXTO_SIN_INTERNET =
  'Necesitas internet para esto. Revisa tu conexión e inténtalo otra vez.';
export const TEXTO_NO_ENTENDI = 'No entendí tu pregunta. Prueba con una de estas:';

type Publicacion = { ok: true; json: unknown } | { ok: false; error: ErrorJev };

/** Un POST con un solo intento y 8 s de límite. Devuelve el JSON ya leído, o por qué no se pudo. */
const publicar = async (
  fetchFn: typeof fetch,
  url: string,
  cuerpo: unknown,
): Promise<Publicacion> => {
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
      const respuesta = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: senal,
      });
      if (!respuesta.ok) return { ok: false, error: 'SIN_RED' };
      texto = await respuesta.text();
    } catch {
      return { ok: false, error: agotado ? 'TIEMPO_AGOTADO' : 'SIN_RED' };
    }

    if (bytesUtf8(texto) > TAMANO_MAXIMO_BYTES) return { ok: false, error: 'RESPUESTA_INVALIDA' };
    try {
      return { ok: true, json: JSON.parse(texto) };
    } catch {
      return { ok: false, error: 'RESPUESTA_INVALIDA' };
    }
  } finally {
    clearTimeout(temporizador);
  }
};

/**
 * Le pregunta al servidor qué quiso decir Freddy. Viaja SOLO `{ tipo: 'interpretar', texto }`: el
 * texto que él escribió, recortado. Un texto vacío o de más de 200 caracteres no se envía. La
 * respuesta pasa por `interpretarRespuesta`: con poca confianza vuelve la consulta "no entendí".
 */
export const preguntarAJev = async (
  fetchFn: typeof fetch,
  url: string,
  texto: string,
): Promise<ResultadoJev> => {
  const pregunta = typeof texto === 'string' ? texto.trim() : '';
  if (pregunta === '' || pregunta.length > MAX_CARACTERES_PREGUNTA) {
    return { ok: false, error: 'RESPUESTA_INVALIDA' };
  }
  const publicada = await publicar(fetchFn, url, { tipo: 'interpretar', texto: pregunta });
  if (!publicada.ok) return publicada;
  const consulta = interpretarRespuesta(publicada.json);
  return consulta === null ? { ok: false, error: 'RESPUESTA_INVALIDA' } : { ok: true, consulta };
};

/**
 * Le pide al servidor que diga con otras palabras una respuesta YA calculada. Viaja SOLO
 * `{ tipo: 'redactar', hecho: { intencion, frase, cifras } }`. La redacción se acepta únicamente si
 * `validarRedaccion` confirma que trae las mismas cifras; si no, `REDACCION_DESCARTADA`.
 */
export const redactarRespuesta = async (
  fetchFn: typeof fetch,
  url: string,
  hecho: Hecho,
): Promise<ResultadoRedactar> => {
  const publicada = await publicar(fetchFn, url, {
    tipo: 'redactar',
    hecho: { intencion: hecho.intencion, frase: hecho.frase, cifras: hecho.cifras },
  });
  if (!publicada.ok) return publicada;
  const texto = (publicada.json as { texto?: unknown } | null)?.texto;
  if (typeof texto !== 'string') return { ok: false, error: 'RESPUESTA_INVALIDA' };
  const validada = validarRedaccion(texto, hecho);
  return validada.ok
    ? { ok: true, texto: validada.texto }
    : { ok: false, error: 'REDACCION_DESCARTADA' };
};

const noEntendi = (): RespuestaChat => ({ tipo: 'noEntendi', texto: TEXTO_NO_ENTENDI });

/**
 * El camino completo de una pregunta: 1 petición para interpretar y, solo si hay una respuesta con
 * cifras, 1 para redactar. La cifra sale SIEMPRE del código (`responderConsulta`); la redacción solo
 * se muestra si conserva todas las cifras. Si redactar falla por lo que sea (sin red, 8 s, cifra
 * cambiada) se muestra la frase fija, sin ningún mensaje técnico. Nunca lanza ni guarda estado.
 */
export const consultar = async (
  fetchFn: typeof fetch,
  url: string,
  texto: string,
  ctx: ContextoAnalisis,
): Promise<RespuestaChat> => {
  try {
    const interpretada = await preguntarAJev(fetchFn, url, texto);
    if (!interpretada.ok) {
      return interpretada.error === 'RESPUESTA_INVALIDA'
        ? noEntendi()
        : { tipo: 'sinInternet', texto: TEXTO_SIN_INTERNET };
    }
    if (interpretada.consulta.intencion === 'noEntendi') return noEntendi();

    const hecho = responderConsulta(interpretada.consulta, ctx);
    if (hecho.intencion === 'noEntendi') return noEntendi();
    const fija: RespuestaChat = {
      tipo: 'respuesta',
      texto: hecho.frase,
      frase: hecho.frase,
      redactada: false,
      hecho,
    };
    // Sin cifras no hay nada que vigilar: la frase fija ya es la respuesta.
    if (hecho.cifras.length === 0) return fija;

    const redaccion = await redactarRespuesta(fetchFn, url, hecho);
    return redaccion.ok ? { ...fija, texto: redaccion.texto, redactada: true } : fija;
  } catch {
    return noEntendi();
  }
};
