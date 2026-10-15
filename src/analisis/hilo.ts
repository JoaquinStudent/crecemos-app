// src/analisis/hilo.ts
// El hilo reciente de la conversación: lo único que, además de la pregunta, viaja a la redacción y a
// la conversación (nunca a la clasificación). Solo texto, las últimas 4 intervenciones y cada una
// recortada. Puro: sin red, sin reloj, sin React (AGENTS.md, reglas 3 y 8).

/** Quién dijo cada cosa: la persona o el asistente. */
export type RolHilo = 'freddy' | 'asistente';

export interface MensajeHilo {
  rol: RolHilo;
  texto: string;
}

/** Cuántas intervenciones (preguntas y respuestas juntas) viajan como máximo. */
export const MAX_MENSAJES_HILO = 4;
/** Largo máximo de cada una; el servidor pone el mismo tope. */
export const MAX_CARACTERES_HILO = 200;

/**
 * El texto en una sola línea y sin caracteres de control (el servidor rechaza los que trae un pegado
 * raro): los espacios, saltos y tabulaciones se vuelven un espacio y el resto de los controles se van.
 */
export const textoEnUnaLinea = (texto: string): string =>
  Array.from(texto.replace(/\s+/g, ' '))
    .filter(c => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
    .join('')
    .trim();

/**
 * Deja las últimas `MAX_MENSAJES_HILO` intervenciones válidas, en una sola línea y de a lo más
 * `MAX_CARACTERES_HILO` caracteres (si se pasa, termina en "…"). Descarta las vacías y las de un
 * rol desconocido. No muta lo que recibe.
 */
export const recortarHilo = (hilo?: readonly MensajeHilo[] | null): MensajeHilo[] => {
  const limpios: MensajeHilo[] = [];
  for (const m of hilo ?? []) {
    if (!m || (m.rol !== 'freddy' && m.rol !== 'asistente') || typeof m.texto !== 'string')
      continue;
    const texto = textoEnUnaLinea(m.texto);
    if (texto === '') continue;
    limpios.push({
      rol: m.rol,
      texto:
        texto.length > MAX_CARACTERES_HILO ? `${texto.slice(0, MAX_CARACTERES_HILO - 1)}…` : texto,
    });
  }
  return limpios.slice(-MAX_MENSAJES_HILO);
};
