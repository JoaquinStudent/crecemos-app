// src/components/atoms/Button/Button.tsx
// Se dibuja con el Button de React Native Elements, pero la API (props, testID, accesibilidad)
// es la nuestra: las pantallas nunca importan `@rneui/*`.
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  GestureResponderEvent,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Button as RNEButton } from '@rneui/themed';
import type { LucideIcon } from 'lucide-react-native';
import { colors, ColorName, TypographyVariant, border, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon, IconSize } from '@components/atoms/Icon';
import { useMovimientoReducido } from '@hooks/useMovimientoReducido';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'dangerGhost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

type VariantTokens = {
  bg: ColorName;
  bgPressed: ColorName;
  fg: ColorName;
  border: ColorName;
  /** Variantes con fondo lleno: al deshabilitarse, el fondo pasa a gris */
  filled: boolean;
};

const variants: Record<ButtonVariant, VariantTokens> = {
  primary: {
    bg: 'primary',
    bgPressed: 'primaryPressed',
    fg: 'textInverse',
    border: 'primary',
    filled: true,
  },
  secondary: {
    bg: 'primarySoft',
    bgPressed: 'surfacePressed',
    fg: 'primary',
    border: 'primarySoft',
    filled: false,
  },
  outline: {
    bg: 'transparent',
    bgPressed: 'surface',
    fg: 'primary',
    border: 'primary',
    filled: false,
  },
  ghost: {
    bg: 'transparent',
    bgPressed: 'surface',
    fg: 'primary',
    border: 'transparent',
    filled: false,
  },
  // Acción destructiva que no es la principal de la pantalla: texto rojo, sin relleno.
  dangerGhost: {
    bg: 'transparent',
    bgPressed: 'surface',
    fg: 'danger',
    border: 'transparent',
    filled: false,
  },
  danger: {
    bg: 'danger',
    bgPressed: 'dangerPressed',
    fg: 'textInverse',
    border: 'danger',
    filled: true,
  },
};

const sizes: Record<
  ButtonSize,
  { height: number; paddingX: number; text: TypographyVariant; icon: IconSize }
> = {
  sm: { height: 36, paddingX: spacing.md, text: 'label', icon: 'sm' },
  md: { height: 48, paddingX: spacing.lg, text: 'bodyStrong', icon: 'md' },
  lg: { height: 56, paddingX: spacing.xl, text: 'bodyStrong', icon: 'lg' },
};

const ESCALA_PRESIONADO = 0.97;

export const Button = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) => {
  const v = variants[variant];
  const s = sizes[size];
  const isDisabled = !!disabled || loading;
  const [pressed, setPressed] = useState(false);
  const escala = useRef(new Animated.Value(1)).current;
  const reducido = useMovimientoReducido();

  // Texto: blanco sobre fondo lleno, y gris con contraste 4.5+ cuando está deshabilitado.
  const fg: ColorName = isDisabled ? 'disabledText' : v.fg;
  const pill = Math.min(radius.pill, s.height / 2);

  const mover = useCallback(
    (hasta: number) => {
      if (reducido.current) {
        escala.setValue(hasta);
        return;
      }
      Animated.timing(escala, { toValue: hasta, duration: 90, useNativeDriver: true }).start();
    },
    [escala, reducido],
  );

  const alPresionar = (e: GestureResponderEvent) => {
    setPressed(true);
    if (!isDisabled) mover(ESCALA_PRESIONADO);
    onPressIn?.(e);
  };
  const alSoltar = (e: GestureResponderEvent) => {
    setPressed(false);
    mover(1);
    onPressOut?.(e);
  };

  const fondo = isDisabled && v.filled ? colors.disabledBg : colors[pressed ? v.bgPressed : v.bg];
  const borde =
    isDisabled && v.filled
      ? colors.disabledBg
      : isDisabled && variant === 'outline'
      ? colors.disabled
      : colors[v.border];

  const visual: ViewStyle = {
    height: s.height,
    paddingHorizontal: s.paddingX,
    paddingVertical: 0,
    borderRadius: pill,
    borderWidth: border.thick,
    backgroundColor: fondo,
    borderColor: borde,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Animated.View
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        style,
        { transform: [{ scale: escala }] },
      ]}
    >
      <RNEButton
        type="clear"
        disabled={isDisabled}
        containerStyle={{ borderRadius: pill }}
        buttonStyle={visual}
        disabledStyle={visual}
        // RNE aplica una opacidad al presionar si no hay `style`; la nuestra es la escala y el color.
        style={{ borderRadius: pill, height: s.height }}
        hitSlop={size === 'sm' ? 6 : undefined}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onPressIn={alPresionar}
        onPressOut={alSoltar}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={colors[fg]} />
        ) : (
          <View style={styles.content}>
            {leftIcon ? (
              <Icon icon={leftIcon} size={s.icon} color={fg} style={styles.leftIcon} />
            ) : null}
            {/* El título cede y se achica antes de salirse del botón (fuente grande, 360 dp). */}
            <Text
              variant={s.text}
              color={fg}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={styles.titulo}
            >
              {title}
            </Text>
            {rightIcon ? (
              <Icon icon={rightIcon} size={s.icon} color={fg} style={styles.rightIcon} />
            ) : null}
          </View>
        )}
      </RNEButton>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: { alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0 },
  titulo: { flexShrink: 1 },
  leftIcon: { marginRight: spacing.sm },
  rightIcon: { marginLeft: spacing.sm },
});
