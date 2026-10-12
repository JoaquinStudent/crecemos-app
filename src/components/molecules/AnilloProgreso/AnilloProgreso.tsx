// src/components/molecules/AnilloProgreso/AnilloProgreso.tsx
// Anillo de avance (la alcancía de la cuota). Se dibuja con react-native-svg y el arco crece
// animado; con "reducir movimiento" aparece ya completo. El avance nunca va solo en un anillo:
// el lector de pantalla oye `accessibilityValueText` y el contenido del centro lleva el texto.
import { ReactNode, useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ColorName, colors } from '@theme';
import { movimientoReducido } from '@hooks/useMovimientoReducido';

const CirculoAnimado = Animated.createAnimatedComponent(Circle);

export interface AnilloProgresoProps {
  /** Avance entre 0 y 1; fuera de rango se recorta. */
  value: number;
  /** Qué mide el anillo ("Avance de tu meta"). */
  accessibilityLabel: string;
  /** Lo que oye el lector de pantalla ("S/ 40.00 de S/ 120.00"). */
  accessibilityValueText: string;
  tone?: Extract<ColorName, 'primary' | 'accent' | 'success'>;
  /** Diámetro en dp. */
  size?: number;
  strokeWidth?: number;
  /** Lo que va en el centro (monto y texto): siempre con palabras. */
  children?: ReactNode;
  testID?: string;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export const AnilloProgreso = ({
  value,
  accessibilityLabel,
  accessibilityValueText,
  tone = 'primary',
  size = 180,
  strokeWidth = 14,
  children,
  testID,
}: AnilloProgresoProps) => {
  const avance = clamp01(value);
  const radio = (size - strokeWidth) / 2;
  const circunferencia = 2 * Math.PI * radio;
  const animado = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animacion = Animated.timing(animado, {
      toValue: avance,
      duration: 700,
      useNativeDriver: false,
    });
    animacion.start();
    let vivo = true;
    // "Reducir movimiento": el arco aparece ya puesto, sin recorrido.
    movimientoReducido().then(reducido => {
      if (!vivo || !reducido) return;
      animacion.stop();
      animado.setValue(avance);
    });
    return () => {
      vivo = false;
      animacion.stop();
    };
  }, [animado, avance]);

  const desplazamiento = useMemo(
    () => animado.interpolate({ inputRange: [0, 1], outputRange: [circunferencia, 0] }),
    [animado, circunferencia],
  );

  const porcentaje = Math.round(avance * 100);

  return (
    <View
      style={[styles.contenedor, { width: size, height: size }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: porcentaje, text: accessibilityValueText }}
      testID={testID}
    >
      <Svg width={size} height={size} style={styles.dibujo}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radio}
          stroke={colors.surfacePressed}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <CirculoAnimado
          cx={size / 2}
          cy={size / 2}
          r={radio}
          stroke={colors[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circunferencia} ${circunferencia}`}
          strokeDashoffset={desplazamiento}
          fill="none"
          // El arco empieza arriba (a las 12), no a la derecha.
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.centro}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  dibujo: { position: 'absolute' },
  centro: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
});
