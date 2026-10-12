// src/components/molecules/Card/Card.tsx
// Contenedor de contenido (DESIGN.md, capa 1): superficie clara con radio 16.
//  - plain: solo el fondo `surface`.
//  - bordered: además un borde fino `border` (separa tarjetas sobre fondo blanco).
// Por dentro usa el Card de React Native Elements.
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewProps, ViewStyle } from 'react-native';
import { Card as RNECard } from '@rneui/themed';
import { border, colors, radius, spacing } from '@theme';

export type CardVariant = 'plain' | 'bordered';

export interface CardProps extends Omit<ViewProps, 'style'> {
  variant?: CardVariant;
  /** Quita el relleno interno (para listas o contenido que llega al borde). */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export const Card = ({
  variant = 'plain',
  flush = false,
  style,
  children,
  ...rest
}: CardProps) => (
  <RNECard
    containerStyle={[
      styles.base,
      variant === 'bordered' ? styles.bordered : styles.plain,
      flush && styles.flush,
      style,
    ]}
    {...rest}
  >
    {children}
  </RNECard>
);

const styles = StyleSheet.create({
  base: {
    margin: 0,
    marginBottom: 0,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    elevation: 0,
    shadowOpacity: 0,
    borderWidth: 0,
  },
  plain: {},
  bordered: { borderWidth: border.thin, borderColor: colors.border },
  flush: { padding: 0, overflow: 'hidden' },
});
