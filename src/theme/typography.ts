// src/theme/typography.ts
// Tamaños según las reglas de UX (contexto-hack/03-producto/UX.md, regla 4):
// texto base 18, secundario 15, monto principal 44 y nunca por debajo de 14.
// `body` y `hero` los audita un test del Sprint-07: no se renombran.
//
// Fuentes (DESIGN.md): Outfit para títulos, Inter para cuerpo y montos. Son estáticas y van
// empaquetadas (assets/fonts, licencia OFL): no se descargan en runtime.
// Cada peso es un archivo distinto, así que el nombre de la familia YA incluye el peso y los
// estilos NO llevan `fontWeight` (con una fuente personalizada, Android puede ignorar la
// fuente si se le pide además un peso). El nombre es el del archivo en Android y el nombre
// PostScript en iOS: aquí coinciden (p. ej. `Inter-SemiBold.ttf` ↔ "Inter-SemiBold").
import { TextStyle } from 'react-native';

export const fuentes = {
  inter: 'Inter-Regular',
  interMedium: 'Inter-Medium',
  interSemiBold: 'Inter-SemiBold',
  interBold: 'Inter-Bold',
  outfitSemiBold: 'Outfit-SemiBold',
  outfitBold: 'Outfit-Bold',
} as const;

export const typography = {
  display: {
    fontFamily: fuentes.outfitBold,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  h1: { fontFamily: fuentes.outfitBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  h2: { fontFamily: fuentes.outfitSemiBold, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fuentes.outfitSemiBold, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fuentes.inter, fontSize: 18, lineHeight: 26 },
  bodyStrong: { fontFamily: fuentes.interSemiBold, fontSize: 18, lineHeight: 26 },
  bodySmall: { fontFamily: fuentes.inter, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fuentes.interMedium, fontSize: 15, lineHeight: 22 },
  labelStrong: { fontFamily: fuentes.interSemiBold, fontSize: 15, lineHeight: 22 },
  caption: { fontFamily: fuentes.inter, fontSize: 14, lineHeight: 20 },
  captionStrong: { fontFamily: fuentes.interSemiBold, fontSize: 14, lineHeight: 20 },
  // Para montos: los números ocupan el mismo ancho y no "bailan" al cambiar
  amount: {
    fontFamily: fuentes.interBold,
    fontSize: 28,
    lineHeight: 34,
    fontVariant: ['tabular-nums'],
  },
  // Monto principal de la pantalla ("Te queda" en Inicio)
  hero: {
    fontFamily: fuentes.interBold,
    fontSize: 44,
    lineHeight: 52,
    fontVariant: ['tabular-nums'],
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
