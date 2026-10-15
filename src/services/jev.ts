// src/services/jev.ts
// La SEGUNDA y última llamada de red de la app: fetch() hacia el servidor intermedio del chat
// "Preguntarle a mis datos" (sdd/AGENTS.md, regla 8; la primera es la semilla, en seed.ts). La app
// nunca habla con el proveedor de IA ni lleva ninguna clave: el Worker de `servidor/` la guarda y
// reenvía. Cada petición es un POST con UN solo encabezado (Content-Type), un cuerpo de tipo fijo y
// NADA del usuario más que lo que él mismo escribió, el hecho ya calculado y, solo en la redacción y la
// conversación, el hilo reciente (texto) y un resumen agregado (totales por mes y producto). Un intento
// por llamada, 8 s de límite, nunca lanza y ningún código técnico llega a un texto que lea Freddy.
//
// Las capas de `consultar` (Sprint-14):
//  1. Jev clasifica la intención (`interpretar`; a él solo viaja el texto de la pregunta).
//  2. Intención clara: el CÓDIGO calcula el hecho y DeepSeek lo REDACTA (`redactar`); el código descarta
//     la redacción si cambia, pierde o inventa una cifra (`validarRedaccion`) y entonces sale la frase fija.
//  3. Jev no entiende o es charla: modo CONVERSACIÓN (`conversar`), acotado al negocio con un resumen
//     agregado; toda cifra de su texto debe estar en ese resumen (`validarConversacion`).
//  4. Sin internet solo se responden las preguntas predefinidas, con la frase fija y la marca "Sin internet".
import { responderCharla } from '@analisis/charla';
import { clasificarPredefinida } from '@analisis/clasificadorLocal';
import { recortarHilo, textoEnUnaLinea, type MensajeHilo } from '@analisis/hilo';
import {
  interpretarRespuesta,
  PREGUNTAS_SUGERIDAS,
  resolverProductoLocal,
  responderConsulta,
} from '@analisis/intenciones';
import {
  armarHechoParaJuicio,
  esJuzgable,
  esReservada,
  interpretarJuicio,
  senalesDeJuicio,
} from '@analisis/semaforo';
import {
  armarResumenNegocio,
  cifrasDelResumen,
  type ResumenNegocio,
} from '@analisis/resumenNegocio';
import { completarConsulta } from '@analisis/seguimiento';
import { validarConversacion, validarRedaccion } from '@analisis/validarRedaccion';
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

export type ResultadoRedactar =
  | { ok: true; texto: string }
  | { ok: false; error: ErrorJev | 'REDACCION_DESCARTADA' };

/** Lo que el chat pone en pantalla; `texto` es siempre lo que lee Freddy. */
export type RespuestaChat =
  | {
      tipo: 'respuesta';
      texto: string;
      frase: string;
      /** `true`: DeepSeek la escribió y el código confirmó sus cifras. `false`: es la frase fija del código. */
      redactada: boolean;
      hecho: Hecho;
      /** La consulta ya resuelta (con lo heredado del hilo): la pantalla la guarda como `previa`. */
      consulta: Consulta;
      /** El juicio de Jev, solo en las intenciones que se juzgan y si llegó con confianza suficiente. */
      semaforo?: Semaforo;
      /** Se reconoció en el teléfono porque no hubo red: frase fija, sin juicio, y la burbuja lo marca. */
      sinInternet?: boolean;
    }
  /** Conversación libre pero acotada al negocio: DeepSeek escribió el texto y todas sus cifras están en el resumen. */
  | { tipo: 'conversacion'; texto: string }
  /** No se entendió y no hubo con quién conversar; `texto` dice qué sí se puede preguntar. */
  | { tipo: 'noEntendi'; texto: string }
  /** Sin red y la pregunta no es una predefinida: `texto` es "Necesitas internet…" y `sugeridas` sí se responden sin red. */
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

export const TEXTO_SIN_INTERNET =
  'Necesitas internet para esto. Revisa tu conexión e inténtalo otra vez.';
export const TEXTO_LIMITE = 'Hay muchas preguntas ahora. Prueba en un minuto.';
export const TEXTO_SERVIDOR = 'El asistente no está disponible ahora.';
export const TEXTO_NO_ENTENDI =
  'No entendí la pregunta. Puedo ayudarte con tus ventas, cobros pendientes y productos. Prueba con una de estas:';
/** Cuando la conversación no pudo contestar (falló, tardó o su texto no pasó la revisión de cifras). */
export const TEXTO_CONVERSACION_NO_DISPONIBLE =
  'Ahora no puedo conversar contigo, pero sí puedo revisar tus ventas, tus cobros y tus productos. Prueba con una de estas:';

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

/**
 * Un POST con un solo intento y 8 s de límite. Devuelve el JSON ya leído, o por qué no se pudo.
 * `clasificando` es la llamada de `interpretar`: la única que acorta su espera tras una falla de red
 * reciente y la única que recuerda un tiempo agotado como falla de red (las demás, que esperan a un
 * modelo que escribe, pueden tardar sin que eso diga nada de la señal).
 */
const publicar = async (
  fetchFn: typeof fetch,
  url: string,
  cuerpo: unknown,
  clasificando = false,
): Promise<Publicacion> => {
  const controlador = new AbortController();
  let agotado = false;
  const temporizador = setTimeout(
    () => {
      agotado = true;
      controlador.abort();
    },
    clasificando ? tiempoLimiteActual() : TIEMPO_LIMITE_MS,
  );

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
      if (clasificando || !agotado) ultimaFallaDeRed = Date.now();
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
  const publicada = await publicar(fetchFn, url, { tipo: 'interpretar', texto: pregunta }, true);
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

/** Las tres preguntas que se ofrecen cuando, sin red, no se reconoce lo escrito. */
const SUGERIDAS_SIN_INTERNET: readonly string[] = PREGUNTAS_SUGERIDAS.slice(0, 3);

/**
 * El aviso cuando no hubo red y la pregunta no es una predefinida. `LIMITE` y `SERVIDOR` conservan su
 * causa; todo lo demás es "Necesitas internet" con tres preguntas que sí se responden sin él.
 */
const avisoSinRed = (error: ErrorJev): RespuestaChat => {
  if (error === 'LIMITE') return { tipo: 'error', causa: 'limite', texto: TEXTO_LIMITE };
  if (error === 'SERVIDOR') return { tipo: 'error', causa: 'servidor', texto: TEXTO_SERVIDOR };
  return { tipo: 'sinInternet', texto: TEXTO_SIN_INTERNET, sugeridas: [...SUGERIDAS_SIN_INTERNET] };
};

/** El hilo que viaja: las últimas 4 intervenciones, solo texto y recortadas (`recortarHilo`). */
const hiloQueViaja = (hilo?: readonly MensajeHilo[] | null): MensajeHilo[] => recortarHilo(hilo);

/** Lo que dijo el Worker en `{ texto }`, o `null`. */
const textoDe = (json: unknown): string | null => {
  const texto = (json as { texto?: unknown } | null)?.texto;
  return typeof texto === 'string' ? texto : null;
};

/**
 * Le pide a DeepSeek que diga con el tono de Freddy una respuesta YA calculada. Viaja SOLO
 * `{ tipo: 'redactar', pregunta, hilo, hecho: { intencion, frase, cifras } }`: la pregunta, el hilo
 * reciente (texto) y el hecho; nada del perfil, del Yape ni de los cierres. El texto se acepta
 * únicamente si `validarRedaccion` confirma que trae exactamente las cifras del hecho; si no,
 * `REDACCION_DESCARTADA`. Nunca lanza: ante cualquier falla `consultar` muestra la frase fija.
 */
export const redactarRespuesta = async (
  fetchFn: typeof fetch,
  url: string,
  pregunta: string,
  hilo: readonly MensajeHilo[] | null | undefined,
  hecho: Hecho,
): Promise<ResultadoRedactar> => {
  const publicada = await publicar(fetchFn, url, {
    tipo: 'redactar',
    pregunta: textoEnUnaLinea(pregunta),
    hilo: hiloQueViaja(hilo),
    hecho: { intencion: hecho.intencion, frase: hecho.frase, cifras: hecho.cifras },
  });
  if (!publicada.ok) return publicada;
  const texto = textoDe(publicada.json);
  if (texto === null) return { ok: false, error: 'RESPUESTA_INVALIDA' };
  const validada = validarRedaccion(texto, hecho);
  return validada.ok
    ? { ok: true, texto: validada.texto }
    : { ok: false, error: 'REDACCION_DESCARTADA' };
};

/** Cuántos caracteres puede tener la frase fija para que se mande a redactar (el servidor pone el mismo tope). */
export const MAX_FRASE_REDACTAR = 400;
/** Y cuántas cifras puede tener (el servidor pone el mismo tope). */
export const MAX_CIFRAS_REDACTAR = 12;

/**
 * El modo conversación: la pregunta no encajó en ninguna intención (o es charla). Viaja SOLO
 * `{ tipo: 'conversar', texto, hilo, resumen }`, con el resumen agregado de `armarResumenNegocio`
 * (totales por mes y producto; ni nombre, ni Yape, ni un cierre suelto). El texto se acepta solo si
 * toda cifra suya está en el resumen (`validarConversacion`). Si falla, tarda o inventa una cifra, el
 * mensaje es amable y fijo, con las preguntas sugeridas; sin señal, "Necesitas internet". Nunca lanza.
 */
const conversar = async (
  fetchFn: typeof fetch,
  url: string,
  pregunta: string,
  hilo: readonly MensajeHilo[] | null | undefined,
  ctx: ContextoAnalisis,
): Promise<RespuestaChat> => {
  const resumen: ResumenNegocio = armarResumenNegocio(ctx);
  const publicada = await publicar(fetchFn, url, {
    tipo: 'conversar',
    texto: textoEnUnaLinea(pregunta),
    hilo: hiloQueViaja(hilo),
    resumen,
  });
  if (!publicada.ok) {
    if (publicada.error === 'SIN_RED') return avisoSinRed('SIN_RED');
    if (publicada.error === 'LIMITE') return avisoSinRed('LIMITE');
    return { tipo: 'noEntendi', texto: TEXTO_CONVERSACION_NO_DISPONIBLE };
  }
  const texto = textoDe(publicada.json);
  const validada = texto === null ? null : validarConversacion(texto, cifrasDelResumen(resumen));
  return validada?.ok
    ? { tipo: 'conversacion', texto: validada.texto }
    : { tipo: 'noEntendi', texto: TEXTO_CONVERSACION_NO_DISPONIBLE };
};

/**
 * Sin internet solo se responden las preguntas predefinidas: las que el código sabe calcular y que el
 * teléfono reconoce con claridad (`clasificarPredefinida`). La respuesta es la frase fija, sin juicio y
 * marcada `sinInternet`; no se mira el hilo ni se hace otra petición. Todo lo demás es el aviso.
 */
const responderSinInternet = (
  texto: string,
  ctx: ContextoAnalisis,
  error: ErrorJev,
): RespuestaChat => {
  const local = clasificarPredefinida(texto, ctx.hoy);
  if (local.intencion === 'noEntendi') return avisoSinRed(error);
  const productoLocal = resolverProductoLocal(texto, ctx.productos);
  const consulta: Consulta = { ...local, ...(productoLocal ? { producto: productoLocal } : {}) };
  const hecho = responderConsulta(consulta, ctx);
  if (hecho.intencion === 'noEntendi') return avisoSinRed(error);
  return {
    tipo: 'respuesta',
    texto: hecho.frase,
    frase: hecho.frase,
    redactada: false,
    hecho,
    consulta,
    sinInternet: true,
  };
};

/**
 * El camino completo de una pregunta (ver las capas arriba). Con internet: una petición para
 * interpretar; si la intención es clara, el código calcula y se pide a la vez la redacción y, en las
 * intenciones que se juzgan, el semáforo (hasta 3 peticiones); si no se entiende, o es charla, 1
 * petición de conversación. Las cifras de una respuesta salen siempre del código (`responderConsulta`)
 * y todo texto del modelo pasa por su validación de cifras. El catálogo y el perfil quedan en el
 * teléfono. Sin internet, solo las preguntas predefinidas. Nunca lanza ni guarda estado.
 * `hilo` son las últimas intervenciones de la conversación (sin la pregunta actual): viajan solo a
 * `redactar` y `conversar`, nunca a `interpretar`.
 */
export const consultar = async (
  fetchFn: typeof fetch,
  url: string,
  texto: string,
  ctx: ContextoAnalisis,
  previa?: Consulta | null,
  hilo?: readonly MensajeHilo[] | null,
): Promise<RespuestaChat> => {
  try {
    const pregunta = typeof texto === 'string' ? texto.trim() : '';
    if (pregunta === '' || pregunta.length > MAX_CARACTERES_PREGUNTA) return noEntendi();

    // Un saludo o un gracias no tiene nada que clasificar: va directo a la conversación.
    if (responderCharla(pregunta) !== null)
      return await conversar(fetchFn, url, pregunta, hilo, ctx);

    const interpretada = await preguntarAJev(fetchFn, url, pregunta);
    if (!interpretada.ok) {
      if (interpretada.error === 'RESPUESTA_INVALIDA') {
        return await conversar(fetchFn, url, pregunta, hilo, ctx);
      }
      return responderSinInternet(pregunta, ctx, interpretada.error);
    }

    // El hilo de intenciones se completa aquí, en el teléfono: a Jev solo viajó el texto de esta pregunta.
    const base = interpretada.consulta;
    const productoLocal = resolverProductoLocal(pregunta, ctx.productos);
    const clasificada = {
      intencion: base.intencion,
      dia: base.dia,
      confianza: base.confianza,
      ...(productoLocal ? { producto: productoLocal } : {}),
    };
    const consulta = completarConsulta(clasificada, previa, pregunta);
    if (consulta.intencion === 'noEntendi')
      return await conversar(fetchFn, url, pregunta, hilo, ctx);

    const hecho = responderConsulta(consulta, ctx);
    if (hecho.intencion === 'noEntendi') return await conversar(fetchFn, url, pregunta, hilo, ctx);

    // La redacción y el juicio se piden a la vez. Sin cifras, con una frase muy larga o con datos que no
    // salen del teléfono (lo que te deben) no se redacta: la frase fija ya es la respuesta. Si algo falla, sale la frase fija.
    const senales = esJuzgable(hecho.intencion) ? senalesDeJuicio(consulta, ctx) : null;
    const redactable =
      hecho.cifras.length > 0 &&
      hecho.frase.length <= MAX_FRASE_REDACTAR &&
      hecho.cifras.length <= MAX_CIFRAS_REDACTAR &&
      !esReservada(hecho.intencion);
    const [redaccion, juicio] = await Promise.all([
      redactable
        ? redactarRespuesta(fetchFn, url, pregunta, hilo, hecho).then(r => (r.ok ? r.texto : null))
        : Promise.resolve(null),
      senales === null
        ? Promise.resolve(null)
        : juzgarRespuesta(fetchFn, url, armarHechoParaJuicio(hecho, senales)),
    ]);
    return {
      tipo: 'respuesta',
      texto: redaccion ?? hecho.frase,
      frase: hecho.frase,
      redactada: redaccion !== null,
      hecho,
      consulta,
      ...(juicio ? { semaforo: juicio.semaforo } : {}),
    };
  } catch {
    return noEntendi();
  }
};

// --- Subir el reporte (Sprint-16) ---------------------------------------------------------------
// OJO: este archivo se llama "jev" por historia; es la puerta de la app al Worker, y el Worker también
// guarda el PDF del reporte. Es una llamada más a la MISMA dirección (`JEV_URL`), no una nueva: un
// encabezado, un intento, 8 s, nunca lanza y ningún código técnico llega a un texto. Solo la dispara el
// botón "Crear enlace con QR", después de que la persona confirma que cualquiera con el enlace verá el PDF.

/** El PDF decodificado no puede pasar de esto (el Worker pone el mismo tope). */
export const MAX_PDF_BYTES_SUBIDA = 1048576;

/** Cuántos días dura el enlace (el Worker usa el mismo número: una prueba lo vigila). */
export const DIAS_ENLACE_REPORTE = 30;

export interface EnlaceReporte {
  id: string;
  /** La dirección pública del PDF: `<Worker>/r/<id>`. */
  url: string;
  /** Cuándo vence el enlace (ISO 8601). */
  caduca: string;
}

export type ErrorSubida = ErrorJev | 'PDF_GRANDE';
export type ResultadoSubida =
  | { ok: true; enlace: EnlaceReporte }
  | { ok: false; error: ErrorSubida };

/** Bytes que tendría el base64 una vez decodificado. */
const bytesDeBase64 = (b64: string): number =>
  Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

/**
 * Sube el PDF (en base64) al Worker. Viaja SOLO `{ tipo: 'subirReporte', pdf }`. La respuesta se acepta
 * únicamente si trae un id de 32 hexadecimales, una `url` que es exactamente `<Worker>/r/<id>` y una
 * fecha de caducidad legible: así un servidor raro no puede poner en el QR otra dirección.
 */
export const subirReporte = async (
  fetchFn: typeof fetch,
  url: string,
  pdfBase64: string,
): Promise<ResultadoSubida> => {
  try {
    if (typeof pdfBase64 !== 'string' || pdfBase64 === '')
      return { ok: false, error: 'RESPUESTA_INVALIDA' };
    if (bytesDeBase64(pdfBase64) > MAX_PDF_BYTES_SUBIDA) return { ok: false, error: 'PDF_GRANDE' };
    const publicada = await publicar(fetchFn, url, { tipo: 'subirReporte', pdf: pdfBase64 });
    if (!publicada.ok) return publicada;
    const json = publicada.json as { id?: unknown; url?: unknown; caduca?: unknown } | null;
    const id = typeof json?.id === 'string' ? json.id : '';
    const esperada = `${url.replace(/\/+$/, '')}/r/${id}`;
    if (
      !/^[0-9a-f]{32}$/.test(id) ||
      json?.url !== esperada ||
      typeof json.caduca !== 'string' ||
      Number.isNaN(Date.parse(json.caduca))
    ) {
      return { ok: false, error: 'RESPUESTA_INVALIDA' };
    }
    return { ok: true, enlace: { id, url: esperada, caduca: json.caduca } };
  } catch {
    return { ok: false, error: 'SIN_RED' };
  }
};
