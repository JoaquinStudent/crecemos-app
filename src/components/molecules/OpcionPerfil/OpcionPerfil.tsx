// src/components/molecules/OpcionPerfil/OpcionPerfil.tsx
// Una opción del menú de Perfil: círculo con ícono, título, una línea de resumen con el dato real y
// una flecha que dice "esto abre otra pantalla". Toda la fila es UN botón (56 dp o más) y el lector
// de pantalla la lee como "<título>. <resumen>". Es solo la fila: no lleva formularios ni interruptores.
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { border, colors, size, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon } from '@components/atoms/Icon';

export interface OpcionPerfilProps {
  icon: LucideIcon;
  title: string;
  /** Lo que hay hoy en esa sección ("Yape activado", "3 productos activos"...). */
  summary: string;
  onPress: () => void;
  /** Línea fina debajo de la fila (por defecto sí; la última de la lista no la lleva). */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const DIAMETRO_ICONO_OPCION = 40;

export const OpcionPerfil = ({
  icon,
  title,
  summary,
  onPress,
  divider = true,
  style,
  testID,
}: OpcionPerfilProps) => (
  <Pressable
    accessible
    accessibilityRole="button"
    accessibilityLabel={`${title}. ${summary}`}
    onPress={onPress}
    style={({ pressed }) => [
      styles.fila,
      divider && styles.divisor,
      pressed && styles.presionada,
      style,
    ]}
    testID={testID}
  >
    <View style={styles.circulo}>
      <Icon icon={icon} color="primary" size="md" />
    </View>
    <View style={styles.textos}>
      <Text
        variant="bodyStrong"
        numberOfLines={2}
        testID={testID ? `${testID}-titulo` : undefined}
      >
        {title}
      </Text>
      <Text
        variant="caption"
        color="textMuted"
        numberOfLines={2}
        testID={testID ? `${testID}-resumen` : undefined}
      >
        {summary}
      </Text>
    </View>
    <Icon icon={ChevronRight} color="textMuted" size="md" />
  </Pressable>
);

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: size.touchLarge,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  divisor: { borderBottomWidth: border.thin, borderBottomColor: colors.border },
  presionada: { backgroundColor: colors.surfacePressed },
  circulo: {
    flexShrink: 0,
    width: DIAMETRO_ICONO_OPCION,
    height: DIAMETRO_ICONO_OPCION,
    borderRadius: DIAMETRO_ICONO_OPCION / 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: { flex: 1, minWidth: 0, gap: spacing.xxs },
});
