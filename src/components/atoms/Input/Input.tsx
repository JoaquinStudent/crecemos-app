// src/components/atoms/Input/Input.tsx
import React, { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Eye, EyeOff, LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@theme';
import { Icon } from '@components/atoms/Icon';
import { Text } from '@components/atoms/Text';

export interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  onRightIconPress?: () => void;
  rightIconAccessibilityLabel?: string;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  prefix?: string;
}

export type InputRef = React.ComponentRef<typeof TextInput>;

export const Input = forwardRef<InputRef, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      onRightIconPress,
      rightIconAccessibilityLabel,
      disabled = false,
      secureTextEntry,
      containerStyle,
      style,
      onFocus,
      onBlur,
      prefix,
      ...rest
    },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(!!secureTextEntry);
    const iconColor = disabled ? 'disabled' : 'textMuted';

    // Si es contraseña y no se pasó rightIcon, se agrega el botón ver/ocultar
    const isPasswordToggle = !!secureTextEntry && !rightIcon;
    const trailingIcon = isPasswordToggle ? (hidden ? Eye : EyeOff) : rightIcon;
    const trailingPress = isPasswordToggle ? () => setHidden(h => !h) : onRightIconPress;
    const trailingLabel = isPasswordToggle
      ? hidden
        ? 'Mostrar contraseña'
        : 'Ocultar contraseña'
      : rightIconAccessibilityLabel;

    return (
      <View style={containerStyle}>
        {label ? (
          <Text variant="label" color={disabled ? 'disabled' : 'text'} style={styles.label}>
            {label}
          </Text>
        ) : null}

        <View
          style={[
            styles.field,
            focused && styles.fieldFocused,
            !!error && styles.fieldError,
            disabled && styles.fieldDisabled,
          ]}
        >
          {leftIcon ? <Icon icon={leftIcon} color={iconColor} style={styles.leftIcon} /> : null}

          {prefix ? (
            <Text variant="body" color="textMuted" style={styles.prefix}>
              {prefix}
            </Text>
          ) : null}

          <TextInput
            ref={ref}
            editable={!disabled}
            secureTextEntry={hidden}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={label}
            accessibilityHint={error ?? helperText}
            accessibilityState={{ disabled }}
            style={[styles.input, disabled && styles.inputDisabled, style]}
            onFocus={e => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={e => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />

          {trailingIcon ? (
            trailingPress ? (
              <Pressable
                onPress={trailingPress}
                hitSlop={10}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={trailingLabel}
              >
                <Icon icon={trailingIcon} color={iconColor} />
              </Pressable>
            ) : (
              <Icon icon={trailingIcon} color={iconColor} />
            )
          ) : null}
        </View>

        {error || helperText ? (
          <Text
            variant="caption"
            color={error ? 'danger' : 'textMuted'}
            style={styles.message}
            accessibilityLiveRegion={error ? 'polite' : 'none'}
          >
            {error ?? helperText}
          </Text>
        ) : null}
      </View>
    );
  },
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  fieldFocused: { borderColor: colors.primary, borderWidth: 2 },
  fieldError: { borderColor: colors.danger, borderWidth: 2 },
  fieldDisabled: {
    backgroundColor: colors.disabledSoft,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  inputDisabled: { color: colors.disabled },
  leftIcon: { marginRight: spacing.sm },
  prefix: { marginRight: spacing.xs },
  message: { marginTop: spacing.xs },
});
