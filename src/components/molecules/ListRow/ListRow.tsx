// src/components/molecules/ListRow/ListRow.tsx
// Fila de lista (DESIGN.md, 6): ícono en círculo, título, subtítulo y algo a la derecha (un
// monto, una etiqueta). Mínimo 72dp. Por dentro usa el ListItem de React Native Elements.
// Si tiene `onPress`, es UN solo botón para el lector de pantalla.
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ListItem } from '@rneui/themed';
import type { LucideIcon } from 'lucide-react-native';
import { border, colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon } from '@components/atoms/Icon';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Ícono (lucide) dentro de un círculo de 44. */
  icon?: LucideIcon;
  /** Lo que va a la derecha: normalmente un `MoneyText` o un `Badge`. */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Línea fina debajo de la fila (por defecto sí). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ALTO_MINIMO_FILA = 72;
export const DIAMETRO_ICONO_FILA = 44;

export const ListRow = ({
  title,
  subtitle,
  icon,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  divider = true,
  style,
  testID,
}: ListRowProps) => (
  <ListItem
    onPress={onPress}
    accessible={onPress ? true : undefined}
    accessibilityRole={onPress ? 'button' : undefined}
    accessibilityLabel={onPress ? accessibilityLabel ?? title : undefined}
    accessibilityHint={onPress ? accessibilityHint : undefined}
    containerStyle={[styles.fila, divider && styles.divisor, style]}
    testID={testID}
  >
    {icon ? (
      <View style={styles.circulo}>
        <Icon icon={icon} color="text" size="md" />
      </View>
    ) : null}
    <View style={styles.textos}>
      <Text variant="bodyStrong" numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {trailing ? <View style={styles.derecha}>{trailing}</View> : null}
  </ListItem>
);

const styles = StyleSheet.create({
  fila: {
    minHeight: ALTO_MINIMO_FILA,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  divisor: { borderBottomWidth: border.thin, borderBottomColor: colors.border },
  circulo: {
    width: DIAMETRO_ICONO_FILA,
    height: DIAMETRO_ICONO_FILA,
    borderRadius: DIAMETRO_ICONO_FILA / 2,
    borderWidth: border.thin,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, gap: spacing.xxs },
  derecha: { flexShrink: 0, maxWidth: '45%', alignItems: 'flex-end' },
});
