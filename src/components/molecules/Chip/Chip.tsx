// src/components/molecules/Chip/Chip.tsx
// Un chip tocable (DESIGN.md, 4): 48dp, píldora, ícono opcional y texto siempre.
// Sin seleccionar: fondo `surface`. Seleccionado: fondo suave y borde grueso del tono.
// Lo usan ChipGroup (como "radio") y las preguntas sugeridas del chat (como "button").
import { Pressable, StyleSheet } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { border, ColorName, colors, radius, size, spacing } from '@theme';
import { Icon } from '@components/atoms/Icon';
import { Text } from '@components/atoms/Text';

export type ChipTone = 'primary' | 'success' | 'danger' | 'warning';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: LucideIcon;
  /** Color semántico del ícono y de la selección. Por defecto, la marca. */
  tone?: ChipTone;
  disabled?: boolean;
  /** `radio` dentro de un grupo de opciones; `button` para acciones sueltas. */
  role?: 'radio' | 'button';
  testID?: string;
}

// El texto seleccionado nunca va en naranja/ámbar: en `warning` usa el texto oscuro.
const tonos: Record<ChipTone, { fuerte: ColorName; suave: ColorName; texto: ColorName }> = {
  primary: { fuerte: 'primary', suave: 'primarySoft', texto: 'primary' },
  success: { fuerte: 'success', suave: 'successSoft', texto: 'success' },
  danger: { fuerte: 'danger', suave: 'dangerSoft', texto: 'danger' },
  warning: { fuerte: 'warning', suave: 'warningSoft', texto: 'text' },
};

export const Chip = ({
  label,
  selected = false,
  onPress,
  icon,
  tone = 'primary',
  disabled = false,
  role = 'radio',
  testID,
}: ChipProps) => {
  const t = tonos[tone];
  const colorTexto: ColorName = disabled ? 'textMuted' : selected ? t.texto : 'text';
  const colorIcono: ColorName = disabled ? 'textMuted' : t.fuerte;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityState={
        role === 'radio'
          ? { selected, checked: selected, disabled }
          : { disabled }
      }
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        selected && { borderColor: colors[t.fuerte], backgroundColor: colors[t.suave] },
        pressed && !selected && styles.presionado,
        disabled && styles.apagado,
      ]}
    >
      {icon ? <Icon icon={icon} size="sm" color={colorIcono} style={styles.icono} /> : null}
      <Text variant={selected ? 'labelStrong' : 'label'} color={colorTexto}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minHeight: size.touch,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    // Mismo grosor seleccionado o no: el chip no "salta" de tamaño al tocarlo.
    borderWidth: border.thick,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  presionado: { backgroundColor: colors.surfacePressed },
  apagado: { backgroundColor: colors.disabledSoft },
  icono: { marginRight: spacing.xs },
});
