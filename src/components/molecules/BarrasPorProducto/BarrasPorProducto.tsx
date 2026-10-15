// src/components/molecules/BarrasPorProducto/BarrasPorProducto.tsx
// Cuánto se vendió de cada producto, de mayor a menor: una fila por producto con su nombre, las
// unidades vendidas y el monto, y una barra de largo proporcional a la venta. Hechas con View.
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import type { ProductoPeriodo } from '@analisis/graficos';
import { formatoSoles } from '@dominio/formato';

export interface BarrasPorProductoProps {
  /** Ordenados de mayor a menor venta (`productosDelPeriodo`). */
  productos: ProductoPeriodo[];
  testID?: string;
}

/** Cuántos productos se dibujan; el resto se resume en una línea. */
export const MAX_PRODUCTOS_EN_BARRAS = 8;
const TEXTO_VACIO = 'Aún no hay días cerrados en este periodo';
const ALTO_BARRA = 12;

const unidades = (n: number): string => `${n} ${n === 1 ? 'unidad vendida' : 'unidades vendidas'}`;

export const BarrasPorProducto = ({
  productos,
  testID = 'grafico-productos',
}: BarrasPorProductoProps) => {
  if (productos.length === 0) {
    return (
      <Text color="textMuted" testID={`${testID}-vacio`}>
        {TEXTO_VACIO}
      </Text>
    );
  }
  const visibles = productos.slice(0, MAX_PRODUCTOS_EN_BARRAS);
  const quedan = productos.length - visibles.length;
  const mayor = Math.max(...productos.map(p => p.venta));
  return (
    <View style={styles.contenedor} testID={testID}>
      {visibles.map(p => (
        <View
          key={p.productoId}
          style={styles.fila}
          accessible
          accessibilityLabel={`${p.nombre}: ${unidades(p.porciones)}, ${formatoSoles(p.venta)}`}
          testID={`${testID}-fila-${p.productoId}`}
        >
          <Text variant="bodyStrong" testID={`${testID}-nombre-${p.productoId}`}>
            {p.nombre}
          </Text>
          <Text variant="bodySmall" testID={`${testID}-detalle-${p.productoId}`}>
            {`${unidades(p.porciones)} · ${formatoSoles(p.venta)}`}
          </Text>
          <View style={styles.pista}>
            <View
              style={[
                styles.relleno,
                { width: `${mayor > 0 ? Math.max(2, Math.round((p.venta / mayor) * 100)) : 0}%` },
              ]}
              testID={`${testID}-barra-${p.productoId}`}
            />
          </View>
        </View>
      ))}
      {quedan > 0 ? (
        <Text variant="bodySmall" color="textMuted" testID={`${testID}-mas`}>
          {quedan === 1 ? 'y 1 producto más' : `y ${quedan} productos más`}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { gap: spacing.lg },
  fila: { gap: spacing.xs },
  pista: {
    height: ALTO_BARRA,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  relleno: { height: ALTO_BARRA, borderRadius: radius.full, backgroundColor: colors.primary },
});
