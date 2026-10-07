// src/theme/index.ts
import { colors } from './colors';
import { typography } from './typography';
import { spacing, radius } from './spacing';

export * from './colors';
export * from './typography';
export * from './spacing';

export const theme = { colors, typography, spacing, radius } as const;
export type Theme = typeof theme;
