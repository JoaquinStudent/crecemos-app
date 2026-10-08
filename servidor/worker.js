// servidor/worker.js
// Servidor intermedio del chat "Preguntarle a mis datos" (Cloudflare Worker). Es lo ÚNICO con lo que
// habla la app: guarda la clave de OpenRouter como secreto (`OPENROUTER_API_KEY`) y reenvía dos
// tipos de petición, siempre con el mínimo de datos:
//   { tipo: 'interpretar', texto }            -> { intencion, producto, dia, confianza, modelo }
//   { tipo: 'redactar', hecho: {...} }        -> { texto }
// Primero clasifica Jev; si falla o responde algo inválido, clasifica DeepSeek. Solo DeepSeek redacta.
// Sin dependencias, sin CORS (es una app nativa) y SIN ningún log: lo que escribe Freddy no se escribe
// en ninguna parte. No hay ninguna clave en este archivo: llega por `env`.

/* global Response, TextDecoder */

const URL_OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
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

const MODELO_JEV_POR_DEFECTO = 'typesafe/jev-router';
const MODELO_DEEPSEEK_POR_DEFECTO = 'deepseek/deepseek-v4-flash';

/**
 * Proveedores de DeepSeek permitidos si la variable `DEEPSEEK_PROVEEDORES` no existe. Son los
 * nombres base de OpenRouter (`tag` de `/api/v1/models/deepseek/deepseek-v4-flash/endpoints`) de
 * empresas de EE. UU. que aceptan salidas estructuradas.
 */
export const PROVEEDORES_POR_DEFECTO = ['deepinfra', 'parasail', 'cloudflare', 'digitalocean'];

// Copia de `src/analisis/intenciones.ts` (el Worker no importa de `src/`): una prueba verifica que
// los ids, los productos, los días y las descripciones son exactamente los de la app.
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
    descripcion: 'Cuántas porciones debe preparar de un producto, según lo que le ha sobrado.',
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
export const PRODUCTOS = ['anticucho', 'pancita', 'rachi', 'chicha', 'ninguno'];
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

// --- Lo que se le pide a los modelos --------------------------------------------------------

const PROMPT_INTERPRETAR = [
  'Eres el clasificador de una app para un vendedor ambulante de anticuchos en Perú.',
  'Lee su pregunta y elige UNA intención de esta lista (devuelve su id):',
  ...INTENCIONES.map(i => `- ${i.id}: ${i.descripcion}`),
  '',
  'Reglas:',
  '- Si la pregunta no es sobre el negocio de un vendedor de anticuchos (ventas, ganancias, productos, cobros, ciclos de compra) o es ambigua, elige noEntendi.',
  '- producto: anticucho, pancita, rachi o chicha solo si la pregunta lo nombra; si no, ninguno.',
  '- dia: hoy, ayer o el día de la semana solo si la pregunta lo nombra; si no, ninguno.',
  '- confianza: un número de 0 a 1, honesto. Baja si dudas.',
  'Responde solo el JSON pedido.',
].join('\n');

const ESQUEMA_INTERPRETAR = {
  type: 'object',
  properties: {
    intencion: { type: 'string', enum: IDS },
    producto: { type: 'string', enum: PRODUCTOS },
    dia: { type: 'string', enum: DIAS },
    confianza: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['intencion', 'producto', 'dia', 'confianza'],
  additionalProperties: false,
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

/** Lo que dijo el clasificador: enum, rango y tipos. Solo salen estos cuatro campos. */
const interpretacionValida = x => {
  if (!esObjeto(x)) return null;
  const { intencion, producto, dia, confianza } = x;
  if (!IDS.includes(intencion) || !PRODUCTOS.includes(producto) || !DIAS.includes(dia)) return null;
  if (typeof confianza !== 'number' || !Number.isFinite(confianza)) return null;
  if (confianza < 0 || confianza > 1) return null;
  return { intencion, producto, dia, confianza };
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
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': REFERER,
        'X-Title': TITULO,
      },
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

// --- Los dos tipos de petición --------------------------------------------------------------

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

  // 1) Jev, sin restringir proveedores.
  const modeloJev = variable(env.JEV_MODELO, MODELO_JEV_POR_DEFECTO);
  const deJev = interpretacionValida(
    await llamarModelo(env, {
      ...comun,
      modelo: modeloJev,
      proveedor: { data_collection: 'deny', require_parameters: true },
      tiempoMs: Math.min(TIEMPO_JEV_MS, restante()),
    }),
  );
  if (deJev !== null) return responder({ ...deJev, modelo: modeloJev });

  // 2) Respaldo: DeepSeek, solo en proveedores de EE. UU. y con el tiempo que quede.
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
