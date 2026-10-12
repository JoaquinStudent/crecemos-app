// src/components/molecules/StickyFooter/StickyFooter.tsx
// Pie fijo para las acciones (UX, regla 10: lo principal vive abajo, a la mano). Va FUERA del
// scroll, con borde superior y el margen del gesto del sistema (safe area).
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { border, colors, spacing } from '@theme';

export interface StickyFooterProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const StickyFooter = ({ children, style, testID }: StickyFooterProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.pie, { paddingBottom: spacing.lg + insets.bottom }, style]}
      testID={testID}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  pie: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
    borderTopWidth: border.thin,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
