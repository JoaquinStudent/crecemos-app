// src/components/atoms/Skeleton/Skeleton.tsx
// Marcador de carga con pulso de opacidad (Animated del core, sin dependencias).
// Con "reducir movimiento" queda quieto. Hecho a mano y no con el Skeleton de RNE porque ese
// arranca un bucle infinito que nunca se detiene al desmontarse.
import { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@theme';
import { movimientoReducido } from '@hooks/useMovimientoReducido';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  /** Círculo (avatar); usa `height` como diámetro. */
  circle?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Skeleton = ({ width = '100%', height = 16, circle, style, testID }: SkeletonProps) => {
  const opacidad = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let vivo = true;
    let bucle: Animated.CompositeAnimation | null = null;
    movimientoReducido().then(reducido => {
      if (!vivo || reducido) return;
      bucle = Animated.loop(
        Animated.sequence([
          Animated.timing(opacidad, { toValue: 0.45, duration: 700, useNativeDriver: true }),
          Animated.timing(opacidad, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      bucle.start();
    });
    return () => {
      vivo = false;
      bucle?.stop();
    };
  }, [opacidad]);

  return (
    <Animated.View
      accessible
      accessibilityLabel="Cargando"
      accessibilityState={{ busy: true }}
      style={[
        styles.base,
        { width: circle ? height : width, height, opacity: opacidad },
        circle && { borderRadius: height / 2 },
        style,
      ]}
      testID={testID}
    />
  );
};

const styles = StyleSheet.create({
  base: { backgroundColor: colors.surfacePressed, borderRadius: radius.sm },
});
