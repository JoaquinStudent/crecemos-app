// servidor/worker.js
// Servidor intermedio del chat "Preguntarle a mis datos" (Cloudflare Worker). Es lo ÚNICO con lo que
// habla la app: guarda la clave de OpenRouter como secreto (`OPENROUTER_API_KEY`) y reenvía tres
// tipos de petición, siempre con el mínimo de datos:
//   { tipo: 'interpretar', texto }            -> { intencion, dia, confianza, modelo }
//   { tipo: 'redactar', hecho: {...} }        -> { texto } (ruta heredada)
//   { tipo: 'juzgar', hecho: {..., senales} } -> { semaforo, confianza, modelo }   (solo Jev, sin respaldo)
// Primero clasifica Jev por la API tipada de OpenRouter (/api/v1/systemone, preguntas "choice"); si falla
// o responde algo inválido, clasifica DeepSeek por chat/completions. La app actual usa frases fijas;
// el endpoint de redacción sirve a clientes antiguos.
// Sin dependencias, sin CORS (es una app nativa) y SIN ningún log: lo que escribe Freddy no se escribe
// en ninguna parte. No hay ninguna clave en este archivo: llega por `env`.

/* global Response, TextDecoder */

const URL_OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const URL_SYSTEMONE = 'https://openrouter.ai/api/v1/systemone';
const REFERER = 'https://github.com/JoaquinStudent/crecemos-app';
const TITULO = 'Crecemos';

// Límites de entrada (la app ya manda menos que esto).
const MAX_CUERPO_BYTES = 2048;
const MAX_TEXTO = 200;
const MAX_FRASE = 300;
const MAX_CIFRAS = 12;
const MAX_CIFRA = 24;
const MAX_REDACCION = 280;

// Tiempos. La app corta a los 8 s, así que el Worker reparte 7,5 s entre los dos intentos: Jev tiene
// 4 s como mucho y DeepSeek lo que quede (nunca más de 7 s en una llamada).
const TIEMPO_LLAMADA_MS = 7000;
const TIEMPO_JEV_MS = 4000;
const PRESUPUESTO_MS = 7500;
const TIEMPO_MINIMO_MS = 500;

// `jev-latest` es el alias de la API tipada: OpenRouter lo enruta al Jev más nuevo (`~typesafe/jev-latest`).
const MODELO_JEV_POR_DEFECTO = 'jev-latest';
// Un juicio con menos confianza que esta se descarta (es el mismo mínimo de la app).
const CONFIANZA_MINIMA_JUICIO = 0.6;
const MAX_HECHO_JUICIO = 600;
const MAX_SENALES = 6;
// Día con menos confianza que esto se devuelve como "ninguno".
const CONFIANZA_MINIMA_DETALLE = 0.5;
const MODELO_DEEPSEEK_POR_DEFECTO = 'deepseek/deepseek-v4-flash';

/**
 * Proveedores de DeepSeek permitidos si la variable `DEEPSEEK_PROVEEDORES` no existe. Son los
 * nombres base de OpenRouter (`tag` de `/api/v1/models/deepseek/deepseek-v4-flash/endpoints`) de
 * empresas de EE. UU. que aceptan salidas estructuradas.
 */
export const PROVEEDORES_POR_DEFECTO = ['deepinfra', 'parasail', 'cloudflare', 'digitalocean'];

// Copia de `src/analisis/intenciones.ts` (el Worker no importa de `src/`): una prueba verifica que
// los ids, los días y las descripciones son exactamente los de la app.
export const INTENCIONES = [
  {
    id: 'ventaDelDia',
    descripcion: 'Cuánto vendió en un día en concreto: hoy, ayer o un día de la semana.',
  },
  {
    id: 'mejorDia',
    descripcion: 'Qué día de la semana le va mejor: el día que más gana.',
  },
  {
    id: 'peorDia',
    descripcion: 'Qué día de la semana le va peor: el día más flojo, el que menos gana.',
  },
  {
    id: 'productoQueMasDeja',
    descripcion: 'Qué producto le deja más ganancia por porción.',
  },
  {
    id: 'productoQueMasSeVende',
    descripcion: 'Qué producto se vende más: el de más porciones vendidas.',
  },
  {
    id: 'cuantoPorCobrar',
    descripcion: 'Cuánta plata le deben todavía: el Yape que aún no cobró.',
  },
  {
    id: 'cuantoSacarParaLaCasa',
    descripcion: 'Cuánta plata puede sacar del negocio para la casa sin tocar su capital.',
  },
  {
    id: 'cuantoPreparar',
    descripcion:
      'Cuánto preparar o qué comprar para mañana, de un producto o de todos: recomendación de compra.',
  },
  {
    id: 'compararCiclo',
    descripcion: 'Cómo le fue en este ciclo de compra comparado con el ciclo pasado.',
  },
  {
    id: 'revisarPrecio',
    descripcion: 'Si debe revisar el precio de un producto porque ahora le deja menos.',
  },
  {
    id: 'cuandoRecupereCapital',
    descripcion: 'Cuándo recuperó la plata que invirtió en mercadería en el ciclo actual.',
  },
  {
    id: 'noEntendi',
    descripcion: 'La pregunta no habla del negocio o no encaja en ninguna de las demás.',
  },
];
// Las intenciones cuya respuesta se juzga (copia de `INTENCIONES_JUZGABLES` en `src/analisis/semaforo.ts`).
export const INTENCIONES_JUZGABLES = [
  'compararCiclo',
  'cuantoPorCobrar',
  'cuantoSacarParaLaCasa',
  'cuantoPreparar',
  'revisarPrecio',
  'peorDia',
];
export const DIAS = [
  'hoy',
  'ayer',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
  'ninguno',
];

const IDS = INTENCIONES.map(i => i.id);
const SEMAFOROS = ['bien', 'ojo', 'urgente'];

// --- Lo que se le pide a los modelos --------------------------------------------------------

const PROMPT_INTERPRETAR = [
  'Eres el clasificador de una app para pequeños negocios en Perú.',
  'Lee su pregunta y elige UNA intención de esta lista (devuelve su id):',
  ...INTENCIONES.map(i => `- ${i.id}: ${i.descripcion}`),
  '',
  'Reglas:',
  '- Si la pregunta no es sobre ventas, gastos, productos, cobros o ciclos de compra del negocio, o es ambigua, elige noEntendi.',
  '- No identifiques productos: sus nombres se resuelven en el teléfono.',
  '- dia: hoy, ayer o el día de la semana solo si la pregunta lo nombra; si no, ninguno.',
  '- confianza: un número de 0 a 1, honesto. Baja si dudas.',
  'Responde solo el JSON pedido.',
].join('\n');

const ESQUEMA_INTERPRETAR = {
  type: 'object',
  properties: {
    intencion: { type: 'string', enum: IDS },
    dia: { type: 'string', enum: DIAS },
    confianza: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['intencion', 'dia', 'confianza'],
  additionalProperties: false,
};

// Las tres preguntas "choice" para Jev. Cada opción lleva su descripción: el modelo ve los nombres
// y las descripciones (no el id de la pregunta). Una "choice" siempre elige una opción, por eso hay
// `noEntendi` y `ninguno`.
const DESCRIPCION_DIA = {
  hoy: 'La pregunta habla de hoy.',
  ayer: 'La pregunta habla de ayer.',
  lunes: 'La pregunta nombra el lunes.',
  martes: 'La pregunta nombra el martes.',
  miercoles: 'La pregunta nombra el miércoles.',
  jueves: 'La pregunta nombra el jueves.',
  viernes: 'La pregunta nombra el viernes.',
  sabado: 'La pregunta nombra el sábado.',
  domingo: 'La pregunta nombra el domingo.',
  ninguno: 'La pregunta no nombra ningún día en concreto.',
};

const PREGUNTAS_JEV = {
  intencion: {
    type: 'choice',
    instructions:
      '¿Qué quiso preguntar la persona sobre su negocio? Elige noEntendi si no habla de su negocio o si es ambigua.',
    criteria: Object.fromEntries(INTENCIONES.map(i => [i.id, i.descripcion])),
  },
  dia: {
    type: 'choice',
    instructions: '¿De cuál día habla la pregunta? Elige ninguno si no nombra ningún día.',
    criteria: Object.fromEntries(DIAS.map(d => [d, DESCRIPCION_DIA[d]])),
  },
};

// La pregunta del semáforo: Jev JUZGA la respuesta ya calculada leyendo señales con nombre; no calcula.
const PREGUNTA_SEMAFORO = {
  semaforo: {
    type: 'choice',
    instructions:
      'Según las señales con nombre, ¿cómo va esto para el negocio? Juzga con las señales; no hagas cuentas con las cifras.',
    criteria: {
      bien: 'Va bien o mejor que antes: no hace falta hacer nada.',
      ojo: 'Conviene prestar atención o revisarlo pronto, pero todavía no es una emergencia.',
      urgente: 'Es un problema serio que el vendedor debería atender hoy mismo.',
    },
  },
};

const PROMPT_REDACTAR =
  'Reescribe la frase con otras palabras, en español de Perú, tuteando, corta (máximo 200 caracteres) y cálida, como si hablaras con un vendedor ambulante. Conserva EXACTAMENTE todas las cifras, los montos y las fechas, tal cual; no agregues ninguna cifra ni dato nuevo; no uses emojis ni enlaces.';

const ESQUEMA_REDACTAR = {
  type: 'object',
  properties: { texto: { type: 'string', maxLength: MAX_REDACCION } },
  required: ['texto'],
  additionalProperties: false,
};

// --- Respuestas -----------------------------------------------------------------------------

const responder = (cuerpo, status = 200, extra = {}) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extra,
    },
  });

const error = (codigo, status, extra) => responder({ error: codigo }, status, extra);

// --- Validación (de lo que llega y de lo que vuelve) ----------------------------------------

const esObjeto = x => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Un texto de 1 a `max` caracteres, recortado; `null` si no cumple. */
const textoValido = (x, max) => {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t.length >= 1 && t.length <= max ? t : null;
};

const hechoValido = x => {
  if (!esObjeto(x)) return null;
  const frase = textoValido(x.frase, MAX_FRASE);
  if (!IDS.includes(x.intencion) || frase === null) return null;
  if (!Array.isArray(x.cifras) || x.cifras.length > MAX_CIFRAS) return null;
  if (!x.cifras.every(c => typeof c === 'string' && c.length <= MAX_CIFRA)) return null;
  return { intencion: x.intencion, frase, cifras: [...x.cifras] };
};

/**
 * El hecho que se juzga: intención juzgable, frase, cifras y señales con nombre (llaves y valores de
 * una sola palabra en minúsculas). Todo junto, 600 caracteres como mucho.
 */
const hechoParaJuzgarValido = x => {
  if (!esObjeto(x) || !INTENCIONES_JUZGABLES.includes(x.intencion)) return null;
  const hecho = hechoValido(x);
  if (hecho === null || !esObjeto(x.senales)) return null;
  const llaves = Object.keys(x.senales);
  const palabra = /^[a-z0-9]{1,24}$/;
  if (llaves.length > MAX_SENALES) return null;
  if (
    !llaves.every(
      k => palabra.test(k) && typeof x.senales[k] === 'string' && palabra.test(x.senales[k]),
    )
  )
    return null;
  const completo = { ...hecho, senales: { ...x.senales } };
  return JSON.stringify(completo).length <= MAX_HECHO_JUICIO ? completo : null;
};

/** Lo que dijo el clasificador: enum, rango y tipos. Solo salen estos cuatro campos. */
const interpretacionValida = x => {
  if (!esObjeto(x)) return null;
  const { intencion, dia, confianza } = x;
  if (!IDS.includes(intencion) || !DIAS.includes(dia)) return null;
  if (typeof confianza !== 'number' || !Number.isFinite(confianza)) return null;
  if (confianza < 0 || confianza > 1) return null;
  return { intencion, dia, confianza };
};

const redaccionValida = x => {
  if (!esObjeto(x)) return null;
  const texto = textoValido(x.texto, MAX_REDACCION);
  return texto === null ? null : { texto };
};

// --- Entrada --------------------------------------------------------------------------------

/** El cuerpo como texto, o `null` si pasa de 2 KB (se deja de leer apenas se pasa). */
const leerCuerpo = async request => {
  const declarado = Number(request.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > MAX_CUERPO_BYTES) return null;
  if (!request.body) return '';
  const lector = request.body.getReader();
  const trozos = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CUERPO_BYTES) {
      await lector.cancel().catch(() => undefined);
      return null;
    }
    trozos.push(value);
  }
  const bytes = new Uint8Array(total);
  let desplazamiento = 0;
  for (const trozo of trozos) {
    bytes.set(trozo, desplazamiento);
    desplazamiento += trozo.byteLength;
  }
  return new TextDecoder().decode(bytes);
};

const proveedoresDe = env => {
  const lista = String(env.DEEPSEEK_PROVEEDORES ?? '')
    .split(',')
    .map(p => p.trim())
    .filter(p => p !== '');
  return lista.length > 0 ? lista : [...PROVEEDORES_POR_DEFECTO];
};

const variable = (valor, porDefecto) =>
  typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : porDefecto;

// --- OpenRouter -----------------------------------------------------------------------------

/** Los encabezados de toda llamada a OpenRouter. La clave viaja solo en `Authorization`. */
const cabecerasOpenRouter = env => ({
  Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': REFERER,
  'X-Title': TITULO,
});

/**
 * Una llamada a /chat/completions con salida estructurada. Devuelve el JSON que el modelo escribió,
 * o `null` ante cualquier falla (HTTP no exitoso, "no endpoints", tiempo, cuerpo o JSON ilegible).
 * La clave viaja solo en `Authorization`. No registra nada.
 */
const llamarModelo = async (
  env,
  { modelo, mensajes, nombre, esquema, temperatura, maxTokens, proveedor, tiempoMs },
) => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), tiempoMs);
  try {
    const respuesta = await fetch(URL_OPENROUTER, {
      method: 'POST',
      headers: cabecerasOpenRouter(env),
      body: JSON.stringify({
        model: modelo,
        messages: mensajes,
        temperature: temperatura,
        max_tokens: maxTokens,
        // Una clasificación corta no necesita razonar: así el límite de tokens alcanza para el JSON.
        reasoning: { enabled: false },
        response_format: {
          type: 'json_schema',
          json_schema: { name: nombre, strict: true, schema: esquema },
        },
        provider: proveedor,
      }),
      signal: controlador.signal,
    });
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    if (!esObjeto(datos) || datos.error) return null;
    const contenido = datos.choices?.[0]?.message?.content;
    if (typeof contenido !== 'string' || contenido.trim() === '') return null;
    return JSON.parse(contenido);
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
};

/** Un id de modelo que informa la API: solo letras, números y . _ ~ : / - (hasta 64). */
const modeloInformado = (x, configurado) =>
  typeof x === 'string' && /^[A-Za-z0-9._~:/-]{1,64}$/.test(x) ? x : configurado;

/** Una respuesta "choice" de Jev: la opción (de `opciones`) y su confianza de 0 a 1; `null` si no sirve. */
const leerChoice = (respuesta, opciones) => {
  if (!esObjeto(respuesta) || respuesta.type !== 'choice') return null;
  if (typeof respuesta.choice !== 'string' || !opciones.includes(respuesta.choice)) return null;
  // `confidence` es opcional en la API: si falta, vale la probabilidad de la opción elegida.
  const confianza =
    respuesta.confidence !== undefined
      ? respuesta.confidence
      : esObjeto(respuesta.probabilities)
      ? respuesta.probabilities[respuesta.choice]
      : undefined;
  if (typeof confianza !== 'number' || !Number.isFinite(confianza)) return null;
  if (confianza < 0 || confianza > 1) return null;
  return { opcion: respuesta.choice, confianza };
};

/**
 * Una llamada a la API tipada /systemone. Devuelve las respuestas (`answers`) y el modelo que informa
 * la API, o `null` ante cualquier falla (HTTP no exitoso, error en el cuerpo, tiempo, forma inválida).
 * Solo `data_collection` entre las preferencias de proveedor: es lo único que la API admite.
 */
const llamarJev = async (env, { modelo, state, questions, tiempoMs }) => {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), tiempoMs);
  try {
    const respuesta = await fetch(URL_SYSTEMONE, {
      method: 'POST',
      headers: cabecerasOpenRouter(env),
      body: JSON.stringify({
        model: modelo,
        state,
        questions,
        provider: { data_collection: 'deny' },
      }),
      signal: controlador.signal,
    });
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    if (!esObjeto(datos) || datos.error || !esObjeto(datos.answers)) return null;
    return { answers: datos.answers, modelo: modeloInformado(datos.model, modelo) };
  } catch {
    return null;
  } finally {
    clearTimeout(temporizador);
  }
};

/**
 * Clasifica la pregunta con Jev: `state` es el texto tal cual y van las tres preguntas. Devuelve
 * `{ interpretacion, modelo }` ya validada o `null`. El día con poca confianza vale "ninguno".
 */
const clasificarConJev = async (env, texto, modelo, tiempoMs) => {
  const jev = await llamarJev(env, { modelo, state: texto, questions: PREGUNTAS_JEV, tiempoMs });
  if (jev === null) return null;
  const intencion = leerChoice(jev.answers.intencion, IDS);
  const dia = leerChoice(jev.answers.dia, DIAS);
  if (intencion === null || dia === null) return null;
  const interpretacion = interpretacionValida({
    intencion: intencion.opcion,
    dia: dia.confianza < CONFIANZA_MINIMA_DETALLE ? 'ninguno' : dia.opcion,
    confianza: intencion.confianza,
  });
  return interpretacion === null ? null : { interpretacion, modelo: jev.modelo };
};

/**
 * Juzga con Jev una respuesta ya calculada. `state` lleva la frase, las cifras y las señales con
 * nombre (y el tema, que es texto fijo de este archivo). Devuelve `{ semaforo, confianza, modelo }`
 * validado, o `null`. Con menos de `CONFIANZA_MINIMA_JUICIO` el semáforo es `null` (sin juicio).
 */
const juzgarConJev = async (env, hecho, modelo, tiempoMs) => {
  const jev = await llamarJev(env, {
    modelo,
    state: {
      tema: INTENCIONES.find(i => i.id === hecho.intencion).descripcion,
      frase: hecho.frase,
      cifras: hecho.cifras,
      senales: hecho.senales,
    },
    questions: PREGUNTA_SEMAFORO,
    tiempoMs,
  });
  if (jev === null) return null;
  const juicio = leerChoice(jev.answers.semaforo, SEMAFOROS);
  if (juicio === null) return null;
  return {
    semaforo: juicio.confianza >= CONFIANZA_MINIMA_JUICIO ? juicio.opcion : null,
    confianza: juicio.confianza,
    modelo: jev.modelo,
  };
};

// --- Los tres tipos de petición --------------------------------------------------------------

const interpretar = async (env, solicitud) => {
  const texto = textoValido(solicitud.texto, MAX_TEXTO);
  if (texto === null) return error('SOLICITUD_INVALIDA', 400);

  const comun = {
    mensajes: [
      { role: 'system', content: PROMPT_INTERPRETAR },
      { role: 'user', content: texto },
    ],
    nombre: 'interpretacion',
    esquema: ESQUEMA_INTERPRETAR,
    temperatura: 0,
    maxTokens: 120,
  };
  const inicio = Date.now();
  const restante = () => PRESUPUESTO_MS - (Date.now() - inicio);

  // 1) Jev, por la API tipada. Cuatro segundos como mucho: la app corta a los ocho.
  const modeloJev = variable(env.JEV_MODELO, MODELO_JEV_POR_DEFECTO);
  const deJev = await clasificarConJev(env, texto, modeloJev, Math.min(TIEMPO_JEV_MS, restante()));
  if (deJev !== null) return responder({ ...deJev.interpretacion, modelo: deJev.modelo });

  // 2) Respaldo: DeepSeek por chat con JSON-schema estricto, solo en proveedores de EE. UU.
  const modeloDeepseek = variable(env.DEEPSEEK_MODELO, MODELO_DEEPSEEK_POR_DEFECTO);
  const tiempoMs = Math.min(TIEMPO_LLAMADA_MS, restante());
  if (tiempoMs >= TIEMPO_MINIMO_MS) {
    const deDeepseek = interpretacionValida(
      await llamarModelo(env, {
        ...comun,
        modelo: modeloDeepseek,
        proveedor: {
          only: proveedoresDe(env),
          data_collection: 'deny',
          require_parameters: true,
        },
        tiempoMs,
      }),
    );
    if (deDeepseek !== null) return responder({ ...deDeepseek, modelo: modeloDeepseek });
  }
  return error('NO_DISPONIBLE', 502);
};

const juzgar = async (env, solicitud) => {
  const hecho = hechoParaJuzgarValido(solicitud.hecho);
  if (hecho === null) return error('SOLICITUD_INVALIDA', 400);

  // Solo Jev y sin respaldo: si falla o duda, la respuesta sale sin semáforo.
  const modelo = variable(env.JEV_MODELO, MODELO_JEV_POR_DEFECTO);
  const juicio = await juzgarConJev(env, hecho, modelo, TIEMPO_LLAMADA_MS);
  return responder(juicio ?? { semaforo: null, confianza: 0, modelo });
};

const redactar = async (env, solicitud) => {
  const hecho = hechoValido(solicitud.hecho);
  if (hecho === null) return error('SOLICITUD_INVALIDA', 400);

  const redaccion = redaccionValida(
    await llamarModelo(env, {
      modelo: variable(env.DEEPSEEK_MODELO, MODELO_DEEPSEEK_POR_DEFECTO),
      mensajes: [
        { role: 'system', content: PROMPT_REDACTAR },
        {
          role: 'user',
          content: `Frase: ${hecho.frase}\nCifras que debes conservar: ${
            hecho.cifras.length > 0 ? hecho.cifras.join(', ') : 'ninguna'
          }`,
        },
      ],
      nombre: 'redaccion',
      esquema: ESQUEMA_REDACTAR,
      temperatura: 0.4,
      maxTokens: 200,
      proveedor: {
        only: proveedoresDe(env),
        data_collection: 'deny',
        require_parameters: true,
      },
      tiempoMs: TIEMPO_LLAMADA_MS,
    }),
  );
  return redaccion === null ? error('NO_DISPONIBLE', 502) : responder(redaccion);
};

// --- Entrada principal ----------------------------------------------------------------------

const manejar = async (request, env) => {
  if (new URL(request.url).pathname !== '/') return error('NO_ENCONTRADO', 404);
  if (request.method !== 'POST') return error('NO_ENCONTRADO', 405, { Allow: 'POST' });

  const clave = env.OPENROUTER_API_KEY;
  if (typeof clave !== 'string' || clave.trim() === '') return error('NO_CONFIGURADO', 500);

  // Límite por IP, solo si el binding `LIMITE` existe (en `wrangler.toml`). Si falla, no bloquea.
  if (env.LIMITE && typeof env.LIMITE.limit === 'function') {
    let permitido = true;
    try {
      const ip = request.headers.get('cf-connecting-ip') || 'desconocida';
      permitido = (await env.LIMITE.limit({ key: ip })).success !== false;
    } catch {
      permitido = true;
    }
    if (!permitido) return error('DEMASIADAS_PETICIONES', 429);
  }

  const tipoContenido = (request.headers.get('content-type') || '').toLowerCase();
  if (!tipoContenido.includes('application/json')) return error('TIPO_NO_SOPORTADO', 415);

  const cuerpo = await leerCuerpo(request);
  if (cuerpo === null) return error('CUERPO_GRANDE', 413);

  let solicitud;
  try {
    solicitud = JSON.parse(cuerpo);
  } catch {
    return error('SOLICITUD_INVALIDA', 400);
  }
  if (!esObjeto(solicitud)) return error('SOLICITUD_INVALIDA', 400);

  if (solicitud.tipo === 'interpretar') return interpretar(env, solicitud);
  if (solicitud.tipo === 'redactar') return redactar(env, solicitud);
  if (solicitud.tipo === 'juzgar') return juzgar(env, solicitud);
  return error('SOLICITUD_INVALIDA', 400);
};

export default {
  async fetch(request, env) {
    try {
      return await manejar(request, env ?? {});
    } catch {
      return error('ERROR_INTERNO', 500);
    }
  },
};
