// src/dominio/unidades.ts
// Singular y plural de la unidad de un producto ('porcion', 'vaso' o lo que escriba la persona).
// Una sola fuente para todas las pantallas y textos del asistente.

/** Lo que se muestra de una unidad en singular: 'porcion' → 'porción'; vacío → 'unidad'. */
export const singularUnidad = (unidad: string | undefined | null): string => {
  const limpia = (unidad ?? '').trim();
  if (limpia === '') return 'unidad';
  return limpia.toLowerCase() === 'porcion' ? 'porción' : limpia;
};

/**
 * Plural en español: 'porción' → 'porciones', 'vaso' → 'vasos', 'unidad' → 'unidades',
 * 'pan' → 'panes'. Lo que ya termina en 's' se deja igual.
 */
export const pluralizarUnidad = (unidad: string | undefined | null): string => {
  const uno = singularUnidad(unidad);
  if (/s$/i.test(uno)) return uno;
  if (/ón$/i.test(uno)) return `${uno.slice(0, -2)}ones`;
  if (/[aeiouáéíóú]$/i.test(uno)) return `${uno}s`;
  if (/z$/i.test(uno)) return `${uno.slice(0, -1)}ces`;
  return `${uno}es`;
};

/** La palabra que corresponde a `n` ('1' → singular, el resto → plural). */
export const unidadSegunCantidad = (n: number, unidad: string | undefined | null): string =>
  n === 1 ? singularUnidad(unidad) : pluralizarUnidad(unidad);

/** '1 porción', '12 porciones', '3 vasos', '2 unidades'. */
export const cantidadConUnidad = (n: number, unidad: string | undefined | null): string =>
  `${n} ${unidadSegunCantidad(n, unidad)}`;
