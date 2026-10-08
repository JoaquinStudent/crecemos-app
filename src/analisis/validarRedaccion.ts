// src/analisis/validarRedaccion.ts
// El código vigila al redactor: una redacción solo se muestra si no cambia, no pierde y no inventa
// ninguna cifra del hecho calculado. Puro: sin red, sin reloj (AGENTS.md, regla 3).
import type { Hecho } from '@dominio/tipos';

export const MAX_CARACTERES_REDACCION = 280;

export type MotivoDescarte = 'VACIA' | 'LARGA' | 'CIFRA_NUEVA' | 'CIFRA_FALTA' | 'ENLACE';

export type ResultadoRedaccion =
  | { ok: true; texto: string }
  | { ok: false; motivo: MotivoDescarte };

// Un número es una racha de dígitos con decimales opcionales, o con miles separados por coma
// ("1,240.00"). Los números en palabras no cuentan: solo dígitos.
const NUMERO = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/**
 * LA definición de "cifra" del proyecto: todo número escrito con dígitos, en el orden en que aparece.
 * Se queda con el número y descarta el resto: `S/ 1,240.00` es `1240.00`, `64 %` es `64`, y el día
 * del mes de "6 de octubre" es `6`. Quita las comas de miles y los ceros a la izquierda; ignora el
 * signo y el punto final de la oración. Los decimales se conservan como vienen (`1.80`): la
 * comparación entre cifras es numérica (`clave`). La usan `responderConsulta` y
 * `validarRedaccion`, para que nunca se desincronicen.
 */
export const extraerCifras = (texto: string): string[] =>
  (texto.match(NUMERO) ?? []).map(n => n.replace(/,/g, '').replace(/^0+(?=\d)/, ''));

/** '205.00', '205.0' y '205' son el mismo número; '250' no. Exacto, sin pasar por coma flotante. */
const clave = (cifra: string): string =>
  cifra.includes('.') ? cifra.replace(/0+$/, '').replace(/\.$/, '') : cifra;

// "http", "www." o una dirección con un dominio común: la redacción no lleva enlaces.
const ENLACE = /http|www\.|:\/\/|\b[\w-]+\.(?:com|pe|net|org|io|app)\b/i;

/**
 * Acepta la redacción solo si no está vacía, mide ≤ 280 caracteres, no lleva enlaces y trae
 * exactamente las cifras del hecho: ninguna distinta y ninguna menos. Compara como números, así que
 * `S/ 205` no equivale a `S/ 250` y `205.0` sí equivale a `205.00`. Devuelve el texto recortado y en
 * una sola línea. Orden de los motivos: `VACIA`, `LARGA`, `ENLACE`, `CIFRA_NUEVA`, `CIFRA_FALTA`.
 */
export const validarRedaccion = (redaccion: string, hecho: Hecho): ResultadoRedaccion => {
  const texto = typeof redaccion === 'string' ? redaccion.replace(/\s+/g, ' ').trim() : '';
  if (texto === '') return { ok: false, motivo: 'VACIA' };
  if (texto.length > MAX_CARACTERES_REDACCION) return { ok: false, motivo: 'LARGA' };
  if (ENLACE.test(texto)) return { ok: false, motivo: 'ENLACE' };

  const esperadas = new Set(hecho.cifras.flatMap(extraerCifras).map(clave));
  const recibidas = new Set(extraerCifras(texto).map(clave));
  for (const c of recibidas) if (!esperadas.has(c)) return { ok: false, motivo: 'CIFRA_NUEVA' };
  for (const c of esperadas) if (!recibidas.has(c)) return { ok: false, motivo: 'CIFRA_FALTA' };
  return { ok: true, texto };
};
