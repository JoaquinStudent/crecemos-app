// src/components/organisms/FormularioProducto/FormularioProducto.tsx
// Los cuatro campos de un producto (nombre, unidad, precio y costo) y, aparte, sus acciones
// ("Guardar producto" y "Cancelar") para el pie fijo de la pantalla. El estado y el guardado viven en `useFormularioProducto`; aquí solo se dibuja.
import { StyleSheet, View } from 'react-native';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { MensajeError } from '@components/atoms/MensajeError';
import { Card } from '@components/molecules/Card';
import type { FormularioProducto as Formulario } from '@hooks/useFormularioProducto';

export interface FormularioProductoProps {
  formulario: Formulario;
}

export const FormularioProducto = ({ formulario: f }: FormularioProductoProps) => (
  <Card variant="bordered" wrapperStyle={styles.contenido} testID="formulario-producto">
    <Text variant="h3">{f.editado ? 'Editar producto' : 'Nuevo producto'}</Text>
    <Input
      label="Nombre"
      value={f.campos.nombre}
      onChangeText={f.cambiar.nombre}
      error={f.errores.nombre}
      testID="producto-nombre"
    />
    <Input
      label="Unidad de venta"
      value={f.campos.unidad}
      onChangeText={f.cambiar.unidad}
      error={f.errores.unidad}
      testID="producto-unidad"
    />
    <Input
      label="Precio de venta"
      value={f.campos.precio}
      onChangeText={f.cambiar.precio}
      error={f.errores.precioVenta}
      keyboardType="decimal-pad"
      testID="producto-precio"
    />
    <Input
      label="Costo estimado"
      value={f.campos.costo}
      onChangeText={f.cambiar.costo}
      error={f.errores.costoUnitario}
      keyboardType="decimal-pad"
      testID="producto-costo"
    />
  </Card>
);

/** "Guardar producto" y "Cancelar": van en el pie fijo de la pantalla, no dentro del scroll. */
export const AccionesFormularioProducto = ({ formulario: f }: FormularioProductoProps) => (
  <>
    <MensajeError mensaje={f.guardar.mensajeError} testID="error-guardar-producto" />
    <View style={styles.acciones}>
      <Button
        title="Cancelar"
        variant="ghost"
        onPress={f.cerrar}
        style={styles.cancelar}
        testID="cancelar-producto"
      />
      <Button
        title="Guardar producto"
        loading={f.guardar.ejecutando}
        onPress={() => f.guardar.ejecutar()}
        style={styles.guardar}
        testID="guardar-producto"
      />
    </View>
  </>
);

const styles = StyleSheet.create({
  contenido: { gap: spacing.sm },
  acciones: { flexDirection: 'row', gap: spacing.sm },
  cancelar: { flex: 1 },
  guardar: { flex: 2 },
});
