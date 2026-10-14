// src/components/molecules/ScreenHeader/ScreenHeader.tsx
// Encabezado de pantalla con "Atrás" CON TEXTO (UX, regla 1: nada de íconos solos). Reemplaza
// los cuatro encabezados copiados de Perfil, Preguntar, QueMeDeja y MiReporte.
import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { size, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon } from '@components/atoms/Icon';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Si se pasa, aparece el botón "Atrás". */
  onBack?: () => void;
  /** Contenido a la derecha del título (un botón con texto, por ejemplo). */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  backTestID?: string;
  titleTestID?: string;
  subtitleTestID?: string;
}

export const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  right,
  style,
  testID,
  backTestID,
  titleTestID,
  subtitleTestID,
}: ScreenHeaderProps) => (
  <View style={style} testID={testID}>
    {onBack ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Atrás"
        onPress={onBack}
        style={styles.atras}
        testID={backTestID}
      >
        <Icon icon={ChevronLeft} color="primary" size="lg" />
        <Text variant="bodyStrong" color="primary">
          Atrás
        </Text>
      </Pressable>
    ) : null}

    <View style={styles.fila}>
      <View style={styles.titulos}>
        <Text variant="h1" accessibilityRole="header" testID={titleTestID}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" testID={subtitleTestID}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  </View>
);

const styles = StyleSheet.create({
  atras: {
    alignSelf: 'flex-start',
    minHeight: size.touch,
    minWidth: size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -spacing.xs,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titulos: { flex: 1 },
});
