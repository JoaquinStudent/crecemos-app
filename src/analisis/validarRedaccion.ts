// src/analisis/validarRedaccion.ts
// El código vigila al modelo que escribe: un texto solo se muestra si no cambia, no pierde y no
// inventa ninguna cifra. Hay dos modos:
//  - `validarRedaccion`: DeepSeek reescribe una respuesta YA calculada; el texto debe traer
//    exactamente las cifras del hecho (ninguna distinta y ninguna menos).
//  - `validarConversacion`: DeepSeek conversa con el resumen del negocio; toda cifra del texto debe
//    estar en el resumen. No se exige nombrarlas todas ("cifra falta" no aplica).
// Puro: sin red, sin reloj (AGENTS.md, regla 3).
import { formatoSoles } from '@dominio/formato';
import type { Hecho } from '@dominio/tipos';
import { extraerCifras } from './cifras';

/** Una redacción es de 1 a 3 frases; este es el tope con que se descarta una que se alarga. */
export const MAX_CARACTERES_REDACCION = 360;
/** La conversación es libre pero acotada: de 2 a 4 frases. */
export const MAX_CARACTERES_CONVERSACION = 600;

export type MotivoDescarte = 'VACIA' | 'LARGA' | 'CIFRA_NUEVA' | 'CIFRA_FALTA' | 'ENLACE';

export type ResultadoRedaccion =
  | { ok: true; texto: string }
  | { ok: false; motivo: MotivoDescarte };

/** '205.00', '205.0' y '205' son el mismo número; '250' no. Exacto, sin pasar por coma flotante. */
const clave = (cifra: string): string =>
  cifra.includes('.') ? cifra.replace(/0+$/, '').replace(/\.$/, '') : cifra;

// "http", "www." o una dirección con un dominio común: el texto no lleva enlaces.
const ENLACE = /http|www\.|:\/\/|\b[\w-]+\.(?:com|pe|net|org|io|app)\b/i;

const revisar = (
  respuesta: string,
  maximo: number,
  permitidas: string[],
  exigirTodas: boolean,
): ResultadoRedaccion => {
  const texto = typeof respuesta === 'string' ? respuesta.replace(/\s+/g, ' ').trim() : '';
  if (texto === '') return { ok: false, motivo: 'VACIA' };
  if (texto.length > maximo) return { ok: false, motivo: 'LARGA' };
  if (ENLACE.test(texto)) return { ok: false, motivo: 'ENLACE' };

  const esperadas = new Set(permitidas.flatMap(extraerCifras).map(clave));
  const recibidas = new Set(extraerCifras(texto).map(clave));
  for (const c of recibidas) if (!esperadas.has(c)) return { ok: false, motivo: 'CIFRA_NUEVA' };
  if (exigirTodas) {
    for (const c of esperadas) if (!recibidas.has(c)) return { ok: false, motivo: 'CIFRA_FALTA' };
  }
  return { ok: true, texto };
};

/**
 * Acepta la redacción solo si no está vacía, mide ≤ 360 caracteres, no lleva enlaces y trae
 * exactamente las cifras del hecho: ninguna distinta y ninguna menos. Compara como números, así que
 * `S/ 205` no equivale a `S/ 250` y `205.0` sí equivale a `205.00`. Devuelve el texto recortado y en
 * una sola línea. Orden de los motivos: `VACIA`, `LARGA`, `ENLACE`, `CIFRA_NUEVA`, `CIFRA_FALTA`.
 */
export const validarRedaccion = (redaccion: string, hecho: Hecho): ResultadoRedaccion =>
  revisar(redaccion, MAX_CARACTERES_REDACCION, hecho.cifras, true);

// Un monto en soles: `S/` y un número con o sin comas de miles y con o sin decimales ("S/20918",
// "S/ 8,726.00", "-S/ 30"). No es un monto la cantidad seguida de "mil", "millones" o "k" ("S/ 20 mil").
const MONTO =
  /(-?)S\/\.?\s*(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\d,]|\.\d|\s?(?:mil|millones?|k)\b)/g;

/**
 * Reescribe cada monto en soles con el formato de la app (`formatoSoles`: "S/ 20,918.00"): el modelo a
 * veces escribe "S/20918". El VALOR no cambia, así que la validación de cifras da lo mismo antes y
 * después. No toca años, días, porcentajes ni montos dichos con palabras.
 */
export const normalizarMontos = (texto: string): string =>
  texto.replace(MONTO, (original, signo: string, entero: string, decimales?: string) => {
    const valor = Number(`${entero.replace(/,/g, '')}${decimales ?? ''}`);
    return Number.isFinite(valor) ? formatoSoles(signo === '-' ? -valor : valor) : original;
  });

/**
 * Acepta la conversación solo si no está vacía, mide ≤ 600 caracteres, no lleva enlaces y toda cifra
 * que escribe está entre `cifrasPermitidas` (las del resumen del negocio). No exige nombrarlas
 * todas. Motivos: `VACIA`, `LARGA`, `ENLACE`, `CIFRA_NUEVA`. El texto aceptado sale con los montos en el
 * formato de la app (`normalizarMontos`).
 */
export const validarConversacion = (
  respuesta: string,
  cifrasPermitidas: string[],
): ResultadoRedaccion => {
  const revisada = revisar(respuesta, MAX_CARACTERES_CONVERSACION, cifrasPermitidas, false);
  return revisada.ok ? { ok: true, texto: normalizarMontos(revisada.texto) } : revisada;
};
