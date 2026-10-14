// src/theme/colors.ts
// Paleta de marca magenta/naranja. Ver contexto-hack/03-producto/Identidad.md
export const colors = {
  // Marca
  primary: '#CD0157',
  primaryPressed: '#A80147',
  primarySoft: '#F9E3EE',
  accent: '#FFA400',
  accentSoft: '#FFF2DB',
  // Fondo del splash y del ícono: el magenta que trae el logo. Mismo valor que
  // `ic_launcher_background` (android/.../values), para que el splash nativo y el de JS coincidan.
  splash: '#CA0358',

  // Estados
  success: '#0F7A4F',
  successSoft: '#E3F1EA',
  warning: '#B07400',
  warningSoft: '#FFF2DB',
  danger: '#B3261E',
  dangerPressed: '#8C1D17',
  dangerSoft: '#FBE9E7',
  info: '#2B6CB0',
  infoSoft: '#E6EFF9',

  // Texto
  text: '#1A1016',
  textMuted: '#6B5A62',
  textInverse: '#FFFFFF',

  // Superficies
  background: '#FFFFFF',
  surface: '#FAF5F7',
  surfacePressed: '#F2E8ED',
  border: '#E4D7DE',

  // Deshabilitado
  // `disabled`: íconos y pistas de interruptores (decorativo).
  // `disabledBg` + `disabledText`: botones deshabilitados (DESIGN.md), contraste 4.5+.
  disabled: '#C9BCC3',
  disabledSoft: '#F1EBEE',
  disabledBg: '#E4D7DE',
  disabledText: '#6B5A62',

  overlay: 'rgba(26, 16, 22, 0.4)',
  shadow: '#1A1016',
  transparent: 'transparent',
} as const;

export type ColorName = keyof typeof colors;
