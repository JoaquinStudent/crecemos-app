// src/components/atoms/Icon/Icon.tsx
import { StyleProp, ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, ColorName } from '@theme/colors';

export type { LucideIcon as IconComponent };
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const iconSizes: Record<IconSize, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize | number;
  color?: ColorName;
  strokeWidth?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export const Icon = ({
  icon: LucideComponent,
  size = 'md',
  color = 'text',
  strokeWidth = 2,
  accessibilityLabel,
  style,
}: IconProps) => {
  const px = typeof size === 'number' ? size : iconSizes[size];
  const decorative = !accessibilityLabel;

  return (
    <LucideComponent
      size={px}
      color={colors[color]}
      strokeWidth={strokeWidth}
      nonScalingStroke
      style={style}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityElementsHidden={decorative}
    />
  );
};
