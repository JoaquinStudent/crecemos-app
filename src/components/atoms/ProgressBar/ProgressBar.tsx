// src/components/atoms/ProgressBar/ProgressBar.tsx
// Barra de avance animada (capital recuperado, meta). Por dentro usa el LinearProgress de RNE,
// pero el valor accesible lo ponemos nosotros: el de RNE redondea 0..1 a 0 o 1 y no sirve.
import { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { LinearProgress } from '@rneui/themed';
import { ColorName, colors, radius } from '@theme';
import { movimientoReducido } from '@hooks/useMovimientoReducido';

export type ProgressBarTone = 'primary' | 'accent' | 'success';

export interface ProgressBarProps {
  /** Avance entre 0 y 1; fuera de rango se recorta. */
  value: number;
  /** Qué mide la barra, para el lector de pantalla ("Capital recuperado"). */
  accessibilityLabel: string;
  tone?: ProgressBarTone;
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const tonos: Record<ProgressBarTone, ColorName> = {
  primary: 'primary',
  accent: 'accent',
  success: 'success',
};

export const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export const ProgressBar = ({
  value,
  accessibilityLabel,
  tone = 'primary',
  height = 8,
  style,
  testID,
}: ProgressBarProps) => {
  const avance = clamp01(value);
  const porcentaje = Math.round(avance * 100);
  // Solo se actualiza si el usuario pidió reducir el movimiento (lo normal no re-renderiza).
  const [reducido, setReducido] = useState(false);
  useEffect(() => {
    let vivo = true;
    movimientoReducido().then(r => {
      if (vivo && r) setReducido(true);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <LinearProgress
      value={avance}
      variant="determinate"
      color={colors[tonos[tone]]}
      trackColor={colors.surfacePressed}
      // Con "reducir movimiento" la barra aparece llena de una vez, sin animación.
      animation={reducido ? false : { duration: 600 }}
      style={[styles.pista, { height }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: porcentaje, text: `${porcentaje} por ciento` }}
      testID={testID}
    />
  );
};

const styles = StyleSheet.create({
  pista: { borderRadius: radius.full },
});
