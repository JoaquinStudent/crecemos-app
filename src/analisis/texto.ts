// src/analisis/texto.ts
// Una sola forma de normalizar lo que escribe Freddy, compartida por la charla, el seguimiento y el
// clasificador local. Puro: sin red, sin reloj, sin React.

/** Minúsculas, sin tildes ni signos, letras repetidas 3 o más veces reducidas a una, y sin espacios de sobra. */
export const normalizarTexto = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .replace(/(.)\1{2,}/g, '$1')
    .trim();

/** Las palabras de `normalizarTexto`, sin vacíos. */
export const palabrasDe = (texto: string): string[] =>
  normalizarTexto(texto)
    .split(' ')
    .filter(p => p !== '');
