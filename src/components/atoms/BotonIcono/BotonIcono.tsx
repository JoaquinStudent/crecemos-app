// src/components/atoms/BotonIcono/BotonIcono.tsx
// Un botón redondo de 48 dp con SOLO un ícono. Es una excepción: la regla 1 de UX pide texto
// visible junto a cada ícono, pero el usuario pidió expresamente un botón compacto (el "enviar" del
// chat). Por eso la etiqueta de accesibilidad es obligatoria: es lo que lee TalkBack.
// Con `loading` el ícono se cambia por un indicador del mismo tamaño: el botón no cambia de ancho.
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radius, size } from '@theme';
import { Icon } from '@components/atoms/Icon';

export interface BotonIconoProps {
  icon: LucideIcon;
  /** Lo que dice el lector de pantalla: el botón no tiene texto visible. */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  /** Esperando respuesta: muestra un indicador en vez del ícono y no deja tocar. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const BotonIcono = ({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  loading = false,
  style,
  testID,
}: BotonIconoProps) => {
  const apagado = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: apagado, busy: loading }}
      disabled={apagado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        apagado ? styles.apagado : pressed ? styles.presionado : styles.normal,
        style,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={colors.disabledText} />
      ) : (
        <Icon icon={icon} size="lg" color={apagado ? 'disabledText' : 'textInverse'} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    width: size.touch,
    height: size.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  normal: { backgroundColor: colors.primary },
  presionado: { backgroundColor: colors.primaryPressed },
  apagado: { backgroundColor: colors.disabledBg },
});
