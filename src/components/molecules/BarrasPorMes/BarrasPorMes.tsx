// src/components/molecules/BarrasPorMes/BarrasPorMes.tsx
// Ventas y resultado registrado de cada mes, en barras horizontales hechas con View: el mes arriba,
// y cada barra con su monto escrito. Horizontales y no verticales porque `S/ 5,243.00` no cabe en
// una columna de 50 dp con la letra grande: el texto manda sobre la forma. Solo recibe datos ya
// calculados. El resultado negativo va en rojo, con su signo y su palabra: el color no va solo.
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import type { MesNegocio } from '@analisis/inteligencia';
import { formatoSoles } from '@dominio/formato';

export interface BarrasPorMesProps {
  /** Los meses a dibujar, en orden cronológico. */
  meses: MesNegocio[];
  testID?: string;
}

const TEXTO_VACIO = 'Aún no hay días cerrados en este periodo';
const ALTO_BARRA = 12;

/** Largo de una barra respecto de la mayor, entre 0 y 100; una cifra que no es 0 siempre se ve. */
export const porcentajeDeBarra = (valor: number, mayor: number): number =>
  mayor <= 0 || valor === 0 ? 0 : Math.max(2, Math.round((Math.abs(valor) / mayor) * 100));

const resumen = (m: MesNegocio): string =>
  `${m.etiqueta}: ventas ${formatoSoles(m.venta)}, resultado registrado ${formatoSoles(
    m.resultado,
  )}`;

export const BarrasPorMes = ({ meses, testID = 'grafico-meses' }: BarrasPorMesProps) => {
  if (meses.length === 0) {
    return (
      <Text color="textMuted" testID={`${testID}-vacio`}>
        {TEXTO_VACIO}
      </Text>
    );
  }
  const mayor = Math.max(...meses.flatMap(m => [Math.abs(m.venta), Math.abs(m.resultado)]));
  return (
    <View
      accessible
      accessibilityLabel={`Ventas y resultado registrado por mes. ${meses
        .map(resumen)
        .join('. ')}.`}
      style={styles.contenedor}
      testID={testID}
    >
      {meses.map(m => (
        <View key={m.mes} style={styles.mes} testID={`${testID}-fila-${m.mes}`}>
          <Text variant="bodyStrong" testID={`${testID}-mes-${m.mes}`}>
            {m.etiqueta}
          </Text>
          {m.dias === 0 ? (
            <Text variant="bodySmall" color="textMuted">
              Sin días cerrados
            </Text>
          ) : null}
          <Text variant="bodySmall" testID={`${testID}-venta-${m.mes}`}>
            {`Ventas ${formatoSoles(m.venta)}`}
          </Text>
          <View style={styles.pista}>
            <View
              style={[
                styles.relleno,
                { width: `${porcentajeDeBarra(m.venta, mayor)}%`, backgroundColor: colors.primary },
              ]}
              testID={`${testID}-barra-venta-${m.mes}`}
            />
          </View>
          <Text variant="bodySmall" testID={`${testID}-resultado-${m.mes}`}>
            {`Resultado registrado ${formatoSoles(m.resultado)}`}
          </Text>
          <View style={styles.pista}>
            <View
              style={[
                styles.relleno,
                {
                  width: `${porcentajeDeBarra(m.resultado, mayor)}%`,
                  backgroundColor: m.resultado < 0 ? colors.danger : colors.success,
                },
              ]}
              testID={`${testID}-barra-resultado-${m.mes}`}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { gap: spacing.lg },
  mes: { gap: spacing.xs },
  pista: {
    height: ALTO_BARRA,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  relleno: { height: ALTO_BARRA, borderRadius: radius.full },
});
