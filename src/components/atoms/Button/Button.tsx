// src/components/atoms/Button/Button.tsx
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, ColorName, TypographyVariant, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon, IconSize } from '@components/atoms/Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
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
  ...rest
}: ButtonProps) => {
  const v = variants[variant];
  const s = sizes[size];
  const isDisabled = !!disabled || loading;

  const fg: ColorName = !isDisabled ? v.fg : v.filled ? 'textInverse' : 'disabled';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 6 : undefined}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.paddingX,
          backgroundColor: colors[pressed ? v.bgPressed : v.bg],
          borderColor: colors[v.border],
        },
        isDisabled && v.filled && styles.filledDisabled,
        isDisabled && variant === 'outline' && styles.outlineDisabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={colors[fg]} />
      ) : (
        <View style={styles.content}>
          {leftIcon ? (
            <Icon icon={leftIcon} size={s.icon} color={fg} style={styles.leftIcon} />
          ) : null}
          <Text variant={s.text} color={fg} numberOfLines={1}>
            {title}
          </Text>
          {rightIcon ? (
            <Icon icon={rightIcon} size={s.icon} color={fg} style={styles.rightIcon} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  filledDisabled: {
    backgroundColor: colors.disabled,
    borderColor: colors.disabled,
  },
  outlineDisabled: { borderColor: colors.disabled },
  content: { flexDirection: 'row', alignItems: 'center' },
  leftIcon: { marginRight: spacing.sm },
  rightIcon: { marginLeft: spacing.sm },
});
