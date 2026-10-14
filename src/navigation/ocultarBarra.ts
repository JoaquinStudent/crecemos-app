// src/navigation/ocultarBarra.ts
// Cuándo la barra inferior se esconde o vuelve: baja el scroll → se esconde; sube → vuelve.
// Pura: se prueba sin renderizar.

/** Lo que hay que desplazarse en un mismo sentido antes de reaccionar (evita parpadeos). */
export const UMBRAL_SCROLL = 12;
/** Cerca del tope la barra siempre se ve: no hay contenido que estorbe. */
export const TOPE_SIEMPRE_VISIBLE = 48;

/** `true` si la barra debe quedar visible tras pasar de `anterior` a `actual` (offset vertical). */
export const barraVisibleTras = (actual: number, anterior: number, visibleAhora: boolean): boolean => {
  // El rebote de iOS da offsets negativos; el final del scroll en Android, un salto mínimo.
  if (actual <= TOPE_SIEMPRE_VISIBLE) return true;
  const delta = actual - anterior;
  if (delta >= UMBRAL_SCROLL) return false;
  if (delta <= -UMBRAL_SCROLL) return true;
  return visibleAhora;
};
