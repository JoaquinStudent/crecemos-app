// src/theme/elevation.ts
// Sombra simple (DESIGN.md: "0px 4px 12px rgba(26,16,22,0.08)"), sin pilas de sombras:
// en un Android de gama baja cuestan cuadros.
import { Platform, ViewStyle } from 'react-native';
import { colors } from './colors';

const sombra = (alto: number, radio: number, opacidad: number, elevation: number): ViewStyle =>
  Platform.select<ViewStyle>({
    android: { elevation },
    default: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: alto },
      shadowOpacity: opacidad,
      shadowRadius: radio,
      elevation,
    },
  }) as ViewStyle;

export const elevation = {
  sm: sombra(2, 6, 0.06, 1),
  md: sombra(4, 12, 0.08, 4),
} as const;

export type ElevationName = keyof typeof elevation;
