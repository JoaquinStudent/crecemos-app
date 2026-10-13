// src/components/organisms/FormularioProducto/FormularioProducto.tsx
// Los cuatro campos de un producto (nombre, unidad, precio y costo) con "Guardar producto" y
// "Cancelar". El estado y el guardado viven en `useFormularioProducto`; aquí solo se dibuja.
import { StyleSheet } from 'react-native';
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
    <MensajeError mensaje={f.guardar.mensajeError} testID="error-guardar-producto" />
    <Button
      title="Guardar producto"
      loading={f.guardar.ejecutando}
      onPress={() => f.guardar.ejecutar()}
      testID="guardar-producto"
    />
    <Button title="Cancelar" variant="ghost" onPress={f.cerrar} testID="cancelar-producto" />
  </Card>
);

const styles = StyleSheet.create({
  contenido: { gap: spacing.sm },
});
