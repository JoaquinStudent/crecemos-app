// src/components/molecules/ChipGroup/ChipGroup.tsx
import React from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Chip, ChipTone } from '@components/molecules/Chip';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Color semántico del ícono y de la selección (Ingresos verde, Gastos rojo…). */
  tone?: ChipTone;
}

export type ChipLayout = 'wrap' | 'scroll';

export interface ChipGroupProps<T extends string> {
  label?: string;
  options: readonly ChipOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  error?: string;
  /** Si se pasa, cada chip lleva el testID `<prefijo>-<value>`. */
  testIDPrefix?: string;
  /**
   * `wrap` (por defecto): los chips pasan a la fila de abajo.
   * `scroll`: una sola fila que se desliza; el último chip asoma por el borde para avisar que
   * hay más (UX). Para que asome en el borde de la pantalla, el padre le da `style` con un
   * margen horizontal negativo igual a su relleno.
   */
  layout?: ChipLayout;
  /** Estilo del contenedor (en `scroll`, del ScrollView). */
  style?: StyleProp<ViewStyle>;
}

export const ChipGroup = <T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  testIDPrefix,
  layout = 'wrap',
  style,
}: ChipGroupProps<T>) => {
  const chips = options.map(option => (
    <Chip
      key={option.value}
      label={option.label}
      icon={option.icon}
      tone={option.tone}
      selected={option.value === value}
      onPress={() => onChange(option.value)}
      testID={testIDPrefix ? `${testIDPrefix}-${option.value}` : undefined}
    />
  ));

  return (
    <View style={layout === 'wrap' ? style : undefined}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      ) : null}

      {layout === 'scroll' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={style}
          contentContainerStyle={styles.scroll}
          accessibilityRole="radiogroup"
          accessibilityLabel={label}
          testID={testIDPrefix ? `${testIDPrefix}-scroll` : undefined}
        >
          {chips}
        </ScrollView>
      ) : (
        <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
          {chips}
        </View>
      )}

      {error ? (
        <Text
          variant="caption"
          color="danger"
          style={styles.message}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // Relleno a ambos lados: el primer chip alinea con el contenido y el último no queda pegado.
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  message: { marginTop: spacing.xs },
});
