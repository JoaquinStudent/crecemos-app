// src/theme/typography.ts
// Tamaños según las reglas de UX (contexto-hack/03-producto/UX.md, regla 4):
// texto base 18, secundario 15, monto principal 44 y nunca por debajo de 14.
// `body` y `hero` los audita un test del Sprint-07: no se renombran.
import { TextStyle } from 'react-native';

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  h1: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.3 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  h3: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 18, lineHeight: 26, fontWeight: '400' },
  bodyStrong: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  bodySmall: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  // Para montos: los números ocupan el mismo ancho y no "bailan" al cambiar
  amount: { fontSize: 28, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  // Monto principal de la pantalla ("Te queda" en Inicio)
  hero: { fontSize: 44, lineHeight: 52, fontWeight: '700', fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
