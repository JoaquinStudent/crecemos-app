// src/components/molecules/Callout/Callout.tsx
// Tarjeta de insight o aviso (DESIGN.md, 8): fondo accentSoft, borde izquierdo de 4px en naranja.
// El texto es siempre oscuro: el naranja es relleno y borde, nunca texto.
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon } from '@components/atoms/Icon';

export interface CalloutProps {
  title?: string;
  /** Texto del mensaje, o cualquier contenido. */
  children: ReactNode;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  /** "polite" para avisos que aparecen de pronto: el lector de pantalla los lee. */
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  testID?: string;
}

export const ANCHO_BORDE_CALLOUT = 4;

export const Callout = ({
  title,
  children,
  icon,
  style,
  accessibilityLiveRegion,
  testID,
}: CalloutProps) => (
  <View
    style={[styles.base, style]}
    accessibilityLiveRegion={accessibilityLiveRegion}
    testID={testID}
  >
    {icon ? <Icon icon={icon} color="text" size="lg" style={styles.icono} /> : null}
    <View style={styles.cuerpo}>
      {title ? (
        <Text variant="bodyStrong" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {typeof children === 'string' ? <Text variant="bodySmall">{children}</Text> : children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    backgroundColor: colors.accentSoft,
    borderLeftWidth: ANCHO_BORDE_CALLOUT,
    borderLeftColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  icono: { marginTop: spacing.xxs },
  cuerpo: { flex: 1, gap: spacing.xs },
});
