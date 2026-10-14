// src/components/molecules/CargandoBloques/CargandoBloques.tsx
// El marcador de carga de las pantallas: unos bloques grises que laten en el lugar del contenido
// (en vez de dejar la pantalla en blanco mientras se leen los datos del teléfono).
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, spacing } from '@theme';
import { Skeleton } from '@components/atoms/Skeleton';

export interface CargandoBloquesProps {
  /** Cuántos bloques se dibujan. */
  bloques?: number;
  /** Alto de cada bloque en dp. */
  alto?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const CargandoBloques = ({ bloques = 3, alto = 96, style, testID }: CargandoBloquesProps) => (
  <View style={[styles.contenedor, style]} testID={testID}>
    {Array.from({ length: bloques }, (_, i) => (
      <Skeleton key={i} height={alto} style={styles.bloque} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  contenedor: { gap: spacing.md },
  bloque: { borderRadius: radius.lg },
});
