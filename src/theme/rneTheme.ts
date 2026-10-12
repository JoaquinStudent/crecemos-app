// src/theme/rneTheme.ts
// Puente con React Native Elements: el tema de RNE se construye A PARTIR de nuestros tokens,
// nunca al revés. Solo lo consumen los componentes (src/components/**); las pantallas no.
import { createTheme } from '@rneui/themed';
import { colors } from './colors';
import { spacing, radius } from './spacing';

export const rneTheme = createTheme({
  mode: 'light',
  lightColors: {
    primary: colors.primary,
    secondary: colors.accent,
    background: colors.background,
    white: colors.background,
    black: colors.text,
    grey0: colors.text,
    grey1: colors.textMuted,
    grey2: colors.disabled,
    grey3: colors.border,
    grey4: colors.surfacePressed,
    grey5: colors.surface,
    greyOutline: colors.border,
    searchBg: colors.surface,
    success: colors.success,
    warning: colors.warning,
    error: colors.danger,
    disabled: colors.disabledBg,
    divider: colors.border,
  },
  spacing: {
    xs: spacing.xs,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
    xl: spacing.xl,
  },
  components: {
    Card: {
      containerStyle: {
        margin: 0,
        padding: spacing.lg,
        borderRadius: radius.lg,
      },
    },
  },
});
