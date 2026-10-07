// src/components/molecules/SelectField/SelectField.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, LucideIcon } from 'lucide-react-native';
import { colors, spacing } from '@theme';
import { Accordion } from '@components/atoms/Accordion';
import { Icon } from '@components/atoms/Icon';
import { Text } from '@components/atoms/Text';

export interface SelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
}

export interface SelectFieldProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export const SelectField = ({
  label,
  placeholder = 'Selecciona una opción',
  options,
  value,
  onChange,
  error,
  disabled = false,
}: SelectFieldProps) => {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <View>
      {label ? (
        <Text variant="label" color={disabled ? 'disabled' : 'text'} style={styles.label}>
          {label}
        </Text>
      ) : null}

      <Accordion
        expanded={open}
        onToggle={setOpen}
        disabled={disabled}
        accessibilityLabel={`${label ?? 'Opción'}: ${selected?.label ?? 'sin seleccionar'}`}
        style={[open && styles.accordionOpen, !!error && styles.accordionError]}
        header={
          <>
            {selected?.icon ? <Icon icon={selected.icon} style={styles.leadingIcon} /> : null}
            <Text
              style={styles.value}
              color={selected ? (disabled ? 'disabled' : 'text') : 'textMuted'}
              numberOfLines={1}
            >
              {selected?.label ?? placeholder}
            </Text>
          </>
        }
      >
        {options.map(option => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && styles.pressed,
              ]}
            >
              {option.icon ? (
                <Icon
                  icon={option.icon}
                  color={isSelected ? 'primary' : 'textMuted'}
                  style={styles.leadingIcon}
                />
              ) : null}
              <Text style={styles.value} color={isSelected ? 'primary' : 'text'}>
                {option.label}
              </Text>
              {isSelected ? <Icon icon={Check} color="primary" /> : null}
            </Pressable>
          );
        })}
      </Accordion>

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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  optionSelected: { backgroundColor: colors.primarySoft },
  pressed: { backgroundColor: colors.surface },
  leadingIcon: { marginRight: spacing.sm },
  value: { flex: 1 },
  message: { marginTop: spacing.xs },
  accordionOpen: { borderColor: colors.primary, borderWidth: 2 },
  accordionError: { borderColor: colors.danger, borderWidth: 2 },
});
