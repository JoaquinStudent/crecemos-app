// src/components/molecules/CodigoQR/CodigoQR.tsx
// El código QR de la constancia, dibujado con react-native-svg: un rectángulo por tramo oscuro
// (no uno por módulo). Las matrices las arma `modulosQR` (src/analisis/pasaporte.ts); aquí solo se
// dibujan. Nunca va solo: el código en palabras (`CR-XXXX-XXXX`) lo acompaña en la pantalla.
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { colors } from '@theme';
import { corridasQR, MARGEN_QR } from '@analisis/pasaporte';

export interface CodigoQRProps {
  /** Matriz de módulos (true = oscuro), de `modulosQR`. */
  modulos: boolean[][];
  /** El código en palabras ('CR-B2ED-AA41'): va en la etiqueta para el lector de pantalla. */
  codigo: string;
  /** Lado en dp, margen blanco incluido. */
  size?: number;
  testID?: string;
}

export const CodigoQR = ({ modulos, codigo, size = 132, testID }: CodigoQRProps) => {
  const total = modulos.length + 2 * MARGEN_QR;
  const corridas = useMemo(() => corridasQR(modulos), [modulos]);
  return (
    <View
      style={[styles.marco, { width: size, height: size }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Código de constancia ${codigo}`}
      testID={testID}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
        <Rect width={total} height={total} fill={colors.background} />
        {corridas.map(c => (
          <Rect
            key={`${c.y}-${c.x}`}
            x={c.x + MARGEN_QR}
            y={c.y + MARGEN_QR}
            width={c.ancho}
            height={1}
            fill={colors.text}
          />
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  marco: { backgroundColor: colors.background },
});
