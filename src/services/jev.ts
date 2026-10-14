// src/services/jev.ts
// La SEGUNDA y última llamada de red de la app: fetch() hacia el servidor intermedio del chat
// "Preguntarle a mis datos" (sdd/AGENTS.md, regla 8; la primera es la semilla, en seed.ts). La app
// nunca habla con el proveedor de IA ni lleva ninguna clave: el Worker de `servidor/` la guarda y
// reenvía. Cada petición es un POST con UN solo encabezado (Content-Type), un cuerpo de tipo fijo y
// NADA del usuario más que lo que él mismo escribió o el hecho ya calculado para el juicio. Un intento, 8 s de
// límite, nunca lanza y ningún código técnico llega a un texto que lea Freddy.
import { clasificarLocal } from '@analisis/clasificadorLocal';
import {
  interpretarRespuesta,
  PREGUNTAS_SUGERIDAS,
  resolverProductoLocal,
  responderConsulta,
} from '@analisis/intenciones';
import {
  armarHechoParaJuicio,
  esJuzgable,
  interpretarJuicio,
  senalesDeJuicio,
} from '@analisis/semaforo';
import { completarConsulta } from '@analisis/seguimiento';
import type {
  Consulta,
  ContextoAnalisis,
  Hecho,
  HechoJuicio,
  Juicio,
  Semaforo,
} from '@dominio/tipos';
import { bytesUtf8 } from './seed';

/**
 * Por qué no hubo respuesta. `LIMITE` (HTTP 429, demasiadas preguntas) y `SERVIDOR` (5xx, el
 * asistente no está disponible) se distinguen de `SIN_RED` (sin señal o HTTP raro) para que Freddy
 * lea el mensaje que de verdad corresponde.
 */
export type ErrorJev = 'SIN_RED' | 'TIEMPO_AGOTADO' | 'RESPUESTA_INVALIDA' | 'LIMITE' | 'SERVIDOR';

export type ResultadoJev = { ok: true; consulta: Consulta } | { ok: false; error: ErrorJev };

/** Lo que el chat pone en pantalla; `texto` es siempre lo que lee Freddy. */
export type RespuestaChat =
  | {
      tipo: 'respuesta';
      texto: string;
      frase: string;
      redactada: boolean;
      hecho: Hecho;
      /** La consulta ya resuelta (con lo heredado del hilo): la pantalla la guarda como `previa`. */
      consulta: Consulta;
      /** El juicio de Jev, solo en las intenciones que se juzgan y si llegó con confianza suficiente. */
      semaforo?: Semaforo;
      /** Se clasificó en el teléfono porque no hubo red: sin juicio, y la burbuja lo avisa. */
      sinInternet?: boolean;
    }
  | { tipo: 'noEntendi'; texto: string }
  /** Sin red y la pregunta no se pudo clasificar en el teléfono: `sugeridas` son 3 preguntas que sí. */
  | { tipo: 'sinInternet'; texto: string; sugeridas?: string[] }
  /** El servidor contestó, pero no con una respuesta: `causa` dice por qué y `texto` ya viene escrito. */
  | { tipo: 'error'; causa: 'limite' | 'servidor'; texto: string };

/** Pasado este tiempo sin respuesta se corta y se trata como sin red. */
export const TIEMPO_LIMITE_MS = 8000;
/** Tras una falla de red reciente, el teléfono claramente sin señal no hace esperar los 8 s completos. */
export const TIEMPO_TRAS_FALLA_MS = 2500;
/** Cuánto dura "reciente": un minuto desde la última falla de red. */
export const VENTANA_FALLA_MS = 60000;
/** Más que esto no es una respuesta del servidor: es el presupuesto de datos del usuario prepago. */
export const TAMANO_MAXIMO_BYTES = 4096;
/** La pregunta más larga que sale del teléfono; el servidor pone el mismo tope. */
export const MAX_CARACTERES_PREGUNTA = 200;

export const TEXTO_SIN_INTERNET = 'Necesitas internet para preguntarle al asistente.';
export const TEXTO_LIMITE = 'Hay muchas preguntas ahora. Prueba en un minuto.';
export const TEXTO_SERVIDOR = 'El asistente no está disponible ahora.';
export const TEXTO_NO_ENTENDI = 'No entendí tu pregunta. Prueba con una de estas:';

/** Cuándo falló por última vez la red (sin señal o tiempo agotado); `null` si no ha fallado o ya se recuperó. */
let ultimaFallaDeRed: number | null = null;

/** Para las pruebas: olvida la última falla de red. */
export const reiniciarEstadoDeRed = (): void => {
  ultimaFallaDeRed = null;
};

const tiempoLimiteActual = (): number =>
  ultimaFallaDeRed !== null && Date.now() - ultimaFallaDeRed < VENTANA_FALLA_MS
    ? TIEMPO_TRAS_FALLA_MS
    : TIEMPO_LIMITE_MS;

type Publicacion = { ok: true; json: unknown } | { ok: false; error: ErrorJev };

/** 429 es límite de preguntas, 5xx es servidor caído; cualquier otro código se trata como sin red. */
const errorDeEstado = (status: number): ErrorJev =>
  status === 429 ? 'LIMITE' : status >= 500 ? 'SERVIDOR' : 'SIN_RED';

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
  }, tiempoLimiteActual());

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
      // Hubo respuesta del servidor (buena o mala): la red funciona.
      ultimaFallaDeRed = null;
      if (!respuesta.ok) return { ok: false, error: errorDeEstado(respuesta.status) };
      texto = await respuesta.text();
    } catch {
      ultimaFallaDeRed = Date.now();
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
 * Le pide al servidor que juzgue una respuesta YA calculada (el semáforo). Viaja SOLO
 * `{ tipo: 'juzgar', hecho: { intencion, frase, cifras, senales } }`: la frase, las cifras y las
 * señales con nombre que armó el código; nada del perfil, del Yape ni de los cierres. En
 * `cuantoPorCobrar` ni siquiera la frase y las cifras (monto y fecha del Yape por cobrar): ver
 * `armarHechoParaJuicio`. Devuelve el
 * juicio si llegó con confianza suficiente (`interpretarJuicio`) y `null` en cualquier otro caso:
 * sin red, 8 s, respuesta inválida o duda. Nunca lanza.
 */
export const juzgarRespuesta = async (
  fetchFn: typeof fetch,
  url: string,
  hecho: HechoJuicio,
): Promise<Juicio | null> => {
  const publicada = await publicar(fetchFn, url, {
    tipo: 'juzgar',
    hecho: armarHechoParaJuicio(hecho, hecho.senales),
  });
  return publicada.ok ? interpretarJuicio(publicada.json) : null;
};

const noEntendi = (): RespuestaChat => ({ tipo: 'noEntendi', texto: TEXTO_NO_ENTENDI });

/** Las tres preguntas que se ofrecen cuando, sin red, no se entiende lo escrito. */
export const TEXTO_SIN_INTERNET_NO_ENTENDI =
  'Sin internet no pude entender tu pregunta. Prueba con una de estas:';
const SUGERIDAS_SIN_INTERNET: readonly string[] = PREGUNTAS_SUGERIDAS.slice(0, 3);

/** El aviso cuando la red falló y la pregunta tampoco se pudo clasificar en el teléfono. */
const sinRedYSinEntender = (error: ErrorJev): RespuestaChat => {
  if (error === 'LIMITE') return { tipo: 'error', causa: 'limite', texto: TEXTO_LIMITE };
  if (error === 'SERVIDOR') return { tipo: 'error', causa: 'servidor', texto: TEXTO_SERVIDOR };
  return {
    tipo: 'sinInternet',
    texto: TEXTO_SIN_INTERNET_NO_ENTENDI,
    sugeridas: [...SUGERIDAS_SIN_INTERNET],
  };
};

/**
 * El camino completo de una pregunta: una petición para interpretar y otra opcional para juzgar.
 * Las cifras y la frase visible salen siempre del código (`responderConsulta`). El catálogo y el
 * hilo quedan en el teléfono. Si el servidor no contesta (sin red, tiempo agotado, límite o servidor
 * caído), la pregunta se clasifica en el teléfono (`clasificarLocal`) y se responde con las mismas
 * frases, sin juicio y marcada `sinInternet`; esa respuesta no hace ninguna petición más.
 * Nunca lanza ni guarda estado.
 */
export const consultar = async (
  fetchFn: typeof fetch,
  url: string,
  texto: string,
  ctx: ContextoAnalisis,
  previa?: Consulta | null,
): Promise<RespuestaChat> => {
  try {
    const interpretada = await preguntarAJev(fetchFn, url, texto);
    if (!interpretada.ok && interpretada.error === 'RESPUESTA_INVALIDA') return noEntendi();
    const sinRed = !interpretada.ok;
    const errorDeRed: ErrorJev = interpretada.ok ? 'SIN_RED' : interpretada.error;
    const base: Consulta = interpretada.ok
      ? interpretada.consulta
      : clasificarLocal(texto.trim(), ctx.hoy);

    // El hilo se completa aquí, en el teléfono: a Jev solo viajó el texto de esta pregunta.
    const productoLocal = resolverProductoLocal(texto, ctx.productos);
    const clasificada = {
      intencion: base.intencion,
      dia: base.dia,
      confianza: base.confianza,
      ...(productoLocal ? { producto: productoLocal } : {}),
    };
    const consulta = completarConsulta(clasificada, previa, texto);
    if (consulta.intencion === 'noEntendi') return sinRed ? sinRedYSinEntender(errorDeRed) : noEntendi();

    const hecho = responderConsulta(consulta, ctx);
    if (hecho.intencion === 'noEntendi') return sinRed ? sinRedYSinEntender(errorDeRed) : noEntendi();
    const fija: RespuestaChat = {
      tipo: 'respuesta',
      texto: hecho.frase,
      frase: hecho.frase,
      redactada: false,
      hecho,
      consulta,
    };
    // Sin red no hay juicio: se dice el hecho tal cual, sin palabra de veredicto.
    if (sinRed) return { ...fija, sinInternet: true };
    // La frase fija revisada es la respuesta final. Solo el juicio opcional hace otra petición.
    const senales = esJuzgable(hecho.intencion) ? senalesDeJuicio(consulta, ctx) : null;
    const juicio =
      senales === null
        ? null
        : await juzgarRespuesta(fetchFn, url, armarHechoParaJuicio(hecho, senales));
    return {
      ...fija,
      ...(juicio ? { semaforo: juicio.semaforo } : {}),
    };
  } catch {
    return noEntendi();
  }
};
