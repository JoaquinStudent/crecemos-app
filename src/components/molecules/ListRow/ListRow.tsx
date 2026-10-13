// src/components/molecules/ListRow/ListRow.tsx
// Fila de lista (DESIGN.md, 6): ícono en círculo, título, subtítulo y algo a la derecha (un
// monto, una etiqueta). Mínimo 72dp. Es un View/Pressable simple (el ListItem de RNE metía relleno y flex propios).
// Si tiene `onPress`, es UN solo botón para el lector de pantalla.
import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
}: ListRowProps) => {
  const contenido = (
    <>
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
    </>
  );
  const estilos = [styles.fila, divider && styles.divisor, style];
  // View y Pressable simples: sin el relleno ni el flex propios de ListItem, que apretaban el texto.
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      style={estilos}
      testID={testID}
    >
      {contenido}
    </Pressable>
  ) : (
    <View style={estilos} testID={testID}>
      {contenido}
    </View>
  );
};

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ALTO_MINIMO_FILA,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  divisor: { borderBottomWidth: border.thin, borderBottomColor: colors.border },
  circulo: {
    flexShrink: 0,
    width: DIAMETRO_ICONO_FILA,
    height: DIAMETRO_ICONO_FILA,
    borderRadius: DIAMETRO_ICONO_FILA / 2,
    borderWidth: border.thin,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, minWidth: 0, gap: spacing.xxs },
  derecha: { flexShrink: 0, alignItems: 'flex-end' },
});
