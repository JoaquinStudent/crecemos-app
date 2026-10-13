// src/navigation/medidasBarra.ts
// Las medidas de la barra inferior en UN solo sitio: la barra las dibuja y las pantallas de
// pestaña las usan para dejarle sitio al final de su contenido (hook `useMedidasBarra`).
// La barra es una capa por encima del contenido (position absolute): nada de números mágicos
// repartidos por las pantallas.
import { Platform } from 'react-native';
import { spacing } from '@theme';

/** Diámetro del círculo central. */
export const DIAMETRO_CENTRO = 64;
/** Alto de las ranuras normales (la fila sólida de la barra, sin el inset). */
export const ALTO_RANURA = 68;
/** Alto de la línea de la etiqueta (14 px de fuente, 20 de interlínea). */
export const ALTO_ETIQUETA = 20;
/** Aire entre la etiqueta y el borde inferior de la barra (todas las etiquetas comparten fila). */
export const AIRE_ETIQUETA = spacing.sm;
/** Cuánto sobresale el círculo por encima de la fila sólida: lo que la ranura central tiene de más. */
export const SALIENTE = DIAMETRO_CENTRO + spacing.xs + ALTO_ETIQUETA + AIRE_ETIQUETA - ALTO_RANURA;

/**
 * Relleno inferior de la barra: el inset del sistema (barra de gestos). En Android, además, nunca
 * menos de spacing.sm, aunque el sistema reporte 0, para que las etiquetas no toquen la píldora.
 */
export const rellenoInferior = (insetInferior: number, os: string = Platform.OS) =>
  os === 'android' ? Math.max(insetInferior, spacing.sm) : insetInferior;

export interface MedidasBarra {
  /** Alto de la fila sólida (ranuras + inset): lo que tapa la barra del borde inferior hacia arriba. */
  alturaBarra: number;
  /** Cuánto sobresale el círculo por encima de la fila sólida (zona transparente). */
  saliente: number;
  /** Relleno inferior para scrolls y listas: la barra + la mitad de lo que sobresale el círculo. */
  rellenoContenido: number;
  /** Todo lo que la barra ocupa desde abajo: fila sólida + saliente completo del círculo. */
  alturaTotal: number;
}

/** Las medidas de la barra para un inset inferior dado. Pura: se prueba sin renderizar. */
export const medidasBarra = (insetInferior: number, os: string = Platform.OS): MedidasBarra => {
  const alturaBarra = ALTO_RANURA + rellenoInferior(insetInferior, os);
  return {
    alturaBarra,
    saliente: SALIENTE,
    rellenoContenido: alturaBarra + Math.round(SALIENTE / 2),
    alturaTotal: alturaBarra + SALIENTE,
  };
};
