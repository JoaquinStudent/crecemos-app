// src/components/atoms/Badge/Badge.tsx
// Etiqueta corta ("Por cobrar", "Meta de hoy"). Usa el Badge de React Native Elements por dentro.
// El naranja jamás va como texto sobre claro (DESIGN.md): el tono `accent` lleva texto oscuro.
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Badge as RNEBadge } from '@rneui/themed';
import type { LucideIcon } from 'lucide-react-native';
import { ColorName, colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon } from '@components/atoms/Icon';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'danger' | 'info' | 'accent';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const tones: Record<BadgeTone, { bg: ColorName; fg: ColorName }> = {
  neutral: { bg: 'surfacePressed', fg: 'text' },
  brand: { bg: 'primarySoft', fg: 'primary' },
  success: { bg: 'successSoft', fg: 'success' },
  danger: { bg: 'dangerSoft', fg: 'danger' },
  info: { bg: 'infoSoft', fg: 'info' },
  accent: { bg: 'accent', fg: 'text' },
};

export const Badge = ({ label, tone = 'neutral', icon, style, testID }: BadgeProps) => {
  const t = tones[tone];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.contenedor, style]}
      testID={testID}
    >
      <RNEBadge
        value={
          <>
            {icon ? <Icon icon={icon} size="xs" color={t.fg} style={styles.icono} /> : null}
            <Text variant="caption" color={t.fg} style={styles.texto} numberOfLines={1}>
              {label}
            </Text>
          </>
        }
        badgeStyle={[styles.insignia, { backgroundColor: colors[t.bg] }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { alignSelf: 'flex-start' },
  insignia: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    height: undefined,
    minHeight: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
    borderWidth: 0,
  },
  icono: { marginRight: spacing.xs },
  texto: { fontWeight: '600' },
});
