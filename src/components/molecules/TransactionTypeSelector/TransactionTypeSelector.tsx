// src/components/molecules/TransactionTypeSelector/TransactionTypeSelector.tsx
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, LucideIcon } from 'lucide-react-native';
import { colors, ColorName, radius, spacing } from '@theme';
import { Icon } from '@components/atoms/Icon';
import { Text } from '@components/atoms/Text';
import type { TransactionType } from '@utils/budget';

type Option = {
  value: TransactionType;
  label: string;
  icon: LucideIcon;
  color: ColorName;
  soft: ColorName;
};

const options: Option[] = [
  { value: 'expense', label: 'Egreso', icon: ArrowUpRight, color: 'danger', soft: 'dangerSoft' },
  { value: 'income', label: 'Ingreso', icon: ArrowDownLeft, color: 'success', soft: 'successSoft' },
];

export interface TransactionTypeSelectorProps {
  value: TransactionType;
  onChange: (value: TransactionType) => void;
}

export const TransactionTypeSelector = ({ value, onChange }: TransactionTypeSelectorProps) => (
  <View style={styles.row} accessibilityRole="radiogroup">
    {options.map(option => {
      const selected = option.value === value;
      return (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          accessibilityRole="radio"
          accessibilityState={{ selected, checked: selected }}
          accessibilityLabel={option.label}
          style={[
            styles.option,
            selected && { borderColor: colors[option.color], backgroundColor: colors[option.soft] },
          ]}
        >
          <Icon icon={option.icon} color={selected ? option.color : 'textMuted'} />
          <Text
            variant="bodyStrong"
            color={selected ? option.color : 'textMuted'}
            style={styles.label}
          >
            {option.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  label: { marginLeft: spacing.sm },
});
