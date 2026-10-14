// src/components/molecules/SwitchRow/SwitchRow.tsx
// Fila "texto + interruptor". Toda la fila es tocable (48dp+) y se anuncia como UN interruptor;
// el testID va en el Switch de RNE para que se pueda leer su `value` y llamar `onValueChange`.
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Switch } from '@rneui/themed';
import { colors, size, spacing } from '@theme';
import { Text } from '@components/atoms/Text';

export interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const SwitchRow = ({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  style,
  testID,
}: SwitchRowProps) => (
  <Pressable
    accessibilityRole="switch"
    accessibilityLabel={label}
    accessibilityHint={description}
    accessibilityState={{ checked: value, disabled }}
    disabled={disabled}
    onPress={() => onValueChange(!value)}
    style={[styles.fila, style]}
  >
    <View style={styles.textos}>
      <Text variant="bodyStrong" color={disabled ? 'textMuted' : 'text'}>
        {label}
      </Text>
      {description ? (
        <Text variant="caption" color="textMuted">
          {description}
        </Text>
      ) : null}
    </View>
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={onValueChange}
      color={colors.primary}
      trackColor={{ false: colors.disabled, true: colors.primary }}
      // El lector de pantalla ya anuncia la fila completa como un único interruptor.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    />
  </Pressable>
);

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.touchLarge,
    gap: spacing.md,
  },
  textos: { flex: 1 },
});
