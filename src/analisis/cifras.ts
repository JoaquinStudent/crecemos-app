// src/analisis/cifras.ts
// La definición única de "cifra" del proyecto. Puro: sin red, sin reloj (AGENTS.md, regla 3).

// Un número es una racha de dígitos con decimales opcionales, o con miles separados por coma
// ("1,240.00"). Los números en palabras no cuentan: solo dígitos.
const NUMERO = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/**
 * LA definición de "cifra" del proyecto: todo número escrito con dígitos, en el orden en que aparece.
 * Se queda con el número y descarta el resto: `S/ 1,240.00` es `1240.00`, `64 %` es `64`, y el día
 * del mes de "6 de octubre" es `6`. Quita las comas de miles y los ceros a la izquierda; ignora el
 * signo y el punto final de la oración. Los decimales se conservan como vienen (`1.80`): la
 * comparación entre cifras es numérica (`clave`). La usa `responderConsulta`
 * para armar las cifras de cada respuesta.
 */
export const extraerCifras = (texto: string): string[] =>
  (texto.match(NUMERO) ?? []).map(n => n.replace(/,/g, '').replace(/^0+(?=\d)/, ''));
