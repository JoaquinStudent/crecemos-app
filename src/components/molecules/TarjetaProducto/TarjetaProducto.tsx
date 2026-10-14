// src/components/molecules/TarjetaProducto/TarjetaProducto.tsx
// Un producto del catálogo: nombre y precio, "Costo S/ X · Te deja S/ Y por <unidad>", cuándo se
// actualizó el precio y sus acciones. Tres botones con texto no caben en una fila a 360 dp:
// "Cambiar precio" va a todo el ancho y "Editar" y "Desactivar" se reparten la fila de abajo.
import { StyleSheet, View } from 'react-native';
import { Clock, TriangleAlert } from 'lucide-react-native';
import { colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { Callout } from '@components/molecules/Callout';
import { Card } from '@components/molecules/Card';
import { formatoFechaCorta, formatoSoles } from '@dominio/formato';
import { requiereRevision, teDeja } from '@dominio/producto';
import { singularUnidad } from '@dominio/unidades';
import type { FechaNegocio, Producto } from '@dominio/tipos';

export interface TarjetaProductoProps {
  producto: Producto;
  /** Fecha de hoy: decide si el precio ya está viejo y hay que revisarlo. */
  hoy: FechaNegocio;
  onCambiarPrecio: () => void;
  onEditar: () => void;
  onActivo: () => void;
}

export const TarjetaProducto = ({
  producto,
  hoy,
  onCambiarPrecio,
  onEditar,
  onActivo,
}: TarjetaProductoProps) => {
  const deja = teDeja(producto);
  const revision = requiereRevision(producto, hoy);
  return (
    <Card
      variant="bordered"
      style={styles.tarjeta}
      wrapperStyle={styles.contenido}
      testID={`producto-${producto.id}`}
    >
      <View style={styles.fila}>
        <Text
          variant="bodyStrong"
          numberOfLines={2}
          style={styles.nombre}
          testID={`producto-nombre-${producto.id}`}
        >
          {producto.nombre}
        </Text>
        <Text variant="h3" numberOfLines={1} style={styles.precio}>
          {formatoSoles(producto.precioVenta)}
        </Text>
      </View>
      {!producto.activo ? <Text color="textMuted">Inactivo</Text> : null}
      <Text variant="bodySmall" color="textMuted">
        Costo {formatoSoles(producto.costoUnitario)} ·{' '}
        <Text variant="bodySmall" color={deja.monto < 0 ? 'danger' : 'success'}>
          Te deja {formatoSoles(deja.monto)} por {singularUnidad(producto.unidad)}
        </Text>
      </Text>
      <View style={styles.actualizado}>
        <Icon icon={Clock} size="sm" color="textMuted" />
        <Text variant="caption" color="textMuted" style={styles.actualizadoTexto}>
          Precio actualizado el {formatoFechaCorta(producto.actualizadoEn)}
        </Text>
      </View>
      <View style={styles.acciones} testID={`acciones-producto-${producto.id}`}>
        <Button
          title="Cambiar precio"
          variant="ghost"
          fullWidth
          onPress={onCambiarPrecio}
          accessibilityLabel={`Cambiar precio de ${producto.nombre}`}
          testID={`cambiar-precio-${producto.id}`}
        />
        <View style={styles.secundarias}>
          <Button
            title="Editar"
            variant="ghost"
            style={styles.accionIgual}
            onPress={onEditar}
            testID={`editar-producto-${producto.id}`}
          />
          <Button
            title={producto.activo ? 'Desactivar' : 'Reactivar'}
            variant="ghost"
            style={styles.accionIgual}
            onPress={onActivo}
            testID={`activo-producto-${producto.id}`}
          />
        </View>
      </View>
      {revision.revisar ? (
        <Callout icon={TriangleAlert} style={styles.aviso} testID={`aviso-precio-${producto.id}`}>
          {revision.mensaje}
        </Callout>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  // Padding propio de la tarjeta (spacing.md) y nada más; el aire entre líneas va en el contenedor interno.
  tarjeta: { backgroundColor: colors.background, padding: spacing.md },
  contenido: { gap: spacing.xs },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nombre: { flex: 1 },
  precio: { flexShrink: 0 },
  acciones: { gap: spacing.sm },
  secundarias: { flexDirection: 'row', gap: spacing.sm },
  accionIgual: { flex: 1, alignSelf: 'stretch', minHeight: 48 },
  actualizado: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actualizadoTexto: { flex: 1 },
  aviso: { marginTop: spacing.sm },
});
