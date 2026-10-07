// src/theme/typography.ts
import { TextStyle } from 'react-native';

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  h2: { fontSize: 21, lineHeight: 28, fontWeight: '600' },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  // Para montos: los números ocupan el mismo ancho y no "bailan" al cambiar
  amount: { fontSize: 28, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
