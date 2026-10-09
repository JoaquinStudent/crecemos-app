// src/analisis/charla.ts
// La charla corta del chat "Preguntarle a mis datos": saludos, gracias, despedidas y "qué puedes
// hacer" se contestan AQUÍ, con reglas cerradas y frases fijas, antes de llamar a nadie. Así la
// respuesta es instantánea, funciona sin internet, no gasta créditos y no le suma opciones al
// clasificador. Puro: sin red, sin reloj, sin azar, sin React (AGENTS.md, reglas 3 y 8).
// Solo es charla si TODO el texto encaja con las reglas ("hola, gracias" sí; "hola, cuánto vendí
// ayer" no: esa es una pregunta y sigue su camino). Las frases nunca llevan una cifra ni prometen
// algo que el chat no sepa hacer.

export type CategoriaCharla = 'saludo' | 'agradecimiento' | 'despedida' | 'ayuda';

export interface RespuestaCharla {
  categoria: CategoriaCharla;
  texto: string;
  /** Si la burbuja invita a tocar una pregunta sugerida (termina en "Prueba con una de estas:"). */
  conSugeridas: boolean;
}

/** El largo máximo de un texto que se mira; más que esto nunca es charla corta. */
const MAX_CARACTERES = 80;
/** El nombre del perfil se recorta a esto antes de ponerlo en una frase. */
const MAX_NOMBRE = 30;

/** Las frases que cuentan, ya normalizadas (minúsculas, sin tildes ni signos). */
const REGLAS: Record<CategoriaCharla, readonly string[]> = {
  saludo: [
    'hola',
    'holi',
    'holis',
    'buenas',
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    'hey',
    'que tal',
    'como estas',
  ],
  agradecimiento: ['gracias', 'muchas gracias', 'genial', 'ok gracias', 'listo gracias'],
  despedida: ['chau', 'chao', 'adios', 'hasta luego', 'nos vemos'],
  ayuda: [
    'quien eres',
    'que eres',
    'que haces',
    'que puedes hacer',
    'ayuda',
    'como funciona',
    'que te puedo preguntar',
  ],
};

/** Si el texto trae varias categorías, manda la primera de esta lista. */
const PRIORIDAD: readonly CategoriaCharla[] = ['ayuda', 'saludo', 'despedida', 'agradecimiento'];

const AYUDA_FIN = 'Prueba con una de estas:';

/** `{n}` es ", Nombre" o nada. Cada categoría tiene varias frases; el texto decide cuál sale. */
const FRASES: Record<CategoriaCharla, readonly string[]> = {
  saludo: [
    '¡Hola{n}! Qué gusto verte. Pregúntame lo que quieras de tus ventas.',
    '¡Buenas{n}! Aquí estoy para ayudarte con tus ventas. ¿Qué quieres saber?',
    '¡Hola{n}! Cuéntame qué quieres saber de tu negocio.',
  ],
  agradecimiento: [
    '¡De nada! Aquí estoy para lo que necesites de tu negocio.',
    '¡Con gusto! Si quieres saber algo más de tus ventas, pregúntame.',
    '¡Para eso estoy! Cuando quieras, me preguntas otra cosa.',
  ],
  despedida: [
    '¡Hasta luego{n}! Aquí estaré cuando quieras revisar tus ventas.',
    '¡Chau{n}! Que te vaya muy bien en el día.',
    '¡Nos vemos{n}! Cuando quieras, vuelves a preguntarme.',
  ],
  ayuda: [
    `Soy tu ayudante para revisar tus números. Te puedo decir cuánto vendiste un día, cuál es tu mejor y tu peor día, qué producto te deja más, cuánto te deben, cuánto puedes sacar para la casa y cómo vas contra el ciclo pasado. ${AYUDA_FIN}`,
    `Aquí te ayudo a entender tu negocio. Pregúntame por tus ventas de un día, tu mejor o peor día, el producto que más te deja, lo que te deben, lo que puedes sacar para la casa o cómo vas contra el ciclo pasado. ${AYUDA_FIN}`,
  ],
};

/** Minúsculas, sin tildes ni signos, letras repetidas 3 o más veces reducidas a una, y sin espacios de sobra. */
const normalizar = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .replace(/(.)\1{2,}/g, '$1')
    .trim();

/** Una cuenta simple y estable del texto: la misma entrada siempre elige la misma frase. */
const hashDe = (texto: string): number => {
  let h = 0;
  for (let i = 0; i < texto.length; i += 1) h = (h * 31 + texto.charCodeAt(i)) % 1000003;
  return h;
};

/** El nombre listo para una frase: sin caracteres raros, de un solo renglón y recortado; '' si no queda nada. */
const nombreSeguro = (nombre: unknown): string =>
  typeof nombre === 'string'
    ? nombre
        .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9 '.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_NOMBRE)
        .trim()
    : '';

/**
 * Consume todo el texto con las frases de las reglas (la más larga primero). Devuelve las categorías
 * que encontró, o `null` si queda algo que no es charla.
 */
const categoriasDe = (normal: string): Set<CategoriaCharla> | null => {
  if (normal === '') return null;
  const frases = (Object.keys(REGLAS) as CategoriaCharla[])
    .flatMap(c => REGLAS[c].map(f => ({ c, palabras: f.split(' ') })))
    .sort((a, b) => b.palabras.length - a.palabras.length);
  const palabras = normal.split(' ');
  const halladas = new Set<CategoriaCharla>();
  let i = 0;
  while (i < palabras.length) {
    const regla = frases.find(f => f.palabras.every((p, k) => palabras[i + k] === p));
    if (!regla) return null;
    halladas.add(regla.c);
    i += regla.palabras.length;
  }
  return halladas;
};

/**
 * Si el texto es charla corta, la respuesta fija (y si ofrece las preguntas sugeridas); si no, `null`
 * y la pregunta sigue su camino. `nombre` sale del perfil del teléfono y solo se usa para armar la
 * frase aquí: no viaja a ninguna parte. Nunca lanza.
 */
export const responderCharla = (texto: string, nombre?: string): RespuestaCharla | null => {
  if (typeof texto !== 'string' || texto.length > MAX_CARACTERES) return null;
  const normal = normalizar(texto);
  const halladas = categoriasDe(normal);
  if (halladas === null) return null;
  const categoria = PRIORIDAD.find(c => halladas.has(c));
  if (categoria === undefined) return null;
  const opciones = FRASES[categoria];
  const limpio = nombreSeguro(nombre);
  const frase = opciones[hashDe(normal) % opciones.length].replace(
    '{n}',
    limpio === '' ? '' : `, ${limpio}`,
  );
  return { categoria, texto: frase, conSugeridas: categoria === 'ayuda' };
};
