// src/components/atoms/Text/Text.tsx
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { colors, ColorName } from '@theme/colors';
import { typography, TypographyVariant } from '@theme/typography';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorName;
  align?: 'left' | 'center' | 'right';
}

export const Text = ({
  variant = 'body',
  color = 'text',
  align,
  style,
  maxFontSizeMultiplier = 1.6,
  children,
  ...rest
}: TextProps) => (
  <RNText
    style={[typography[variant], { color: colors[color] }, align && { textAlign: align }, style]}
    maxFontSizeMultiplier={maxFontSizeMultiplier}
    {...rest}
  >
    {children}
  </RNText>
);
