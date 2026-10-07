// src/components/molecules/ChipGroup/ChipGroup.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Icon } from '@components/atoms/Icon';
import { Text } from '@components/atoms/Text';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export interface ChipGroupProps<T extends string> {
  label?: string;
  options: readonly ChipOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  error?: string;
}

export const ChipGroup = <T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: ChipGroupProps<T>) => (
  <View>
    {label ? (
      <Text variant="label" style={styles.label}>
        {label}
      </Text>
    ) : null}

    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={option.label}
            style={({ pressed }) => [
              styles.chip,
              selected && styles.chipSelected,
              pressed && !selected && styles.chipPressed,
            ]}
          >
            {option.icon ? (
              <Icon
                icon={option.icon}
                size="sm"
                color={selected ? 'primary' : 'textMuted'}
                style={styles.icon}
              />
            ) : null}
            <Text variant="label" color={selected ? 'primary' : 'text'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>

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

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipPressed: { backgroundColor: colors.surface },
  icon: { marginRight: spacing.xs },
  message: { marginTop: spacing.xs },
});
