// src/theme/spacing.ts
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  /** Chips y tarjetas grandes (DESIGN.md: rounded-xl) */
  xl: 24,
  /** Botones de 56dp: la mitad de la altura */
  pill: 28,
  full: 999,
} as const;

/** Medidas de interacción (reglas de UX 10: todo lo tocable mide 48dp). */
export const size = {
  touch: 48,
  /** Altura ideal de los botones principales */
  touchLarge: 56,
} as const;

/** Grosores de borde: fino para estructura, grueso para estado (foco, selección, error). */
export const border = {
  thin: 1,
  thick: 1.5,
} as const;

export type SpacingName = keyof typeof spacing;
export type RadiusName = keyof typeof radius;
