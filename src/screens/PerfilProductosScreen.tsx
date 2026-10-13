// src/screens/PerfilProductosScreen.tsx
// "Mis productos": la lista de lo que vende, con su precio, lo que le deja y sus acciones (cambiar
// precio, editar, desactivar), y "Agregar producto" arriba. Agregar o editar cambia la pantalla al
// formulario (como "Mi cuota"): una sola tarea a la vez y el teclado nunca tapa el campo.
// Es lo que hace posible el insight: sin precio y costo no hay "Te deja".
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { MensajeError } from '@components/atoms/MensajeError';
import { BotonCargarEjemplo } from '@components/molecules/BotonCargarEjemplo';
import { Card } from '@components/molecules/Card';
import { TarjetaProducto } from '@components/molecules/TarjetaProducto';
import { CambiarPrecioSheet } from '@components/organisms/CambiarPrecioSheet';
import { AccionesFormularioProducto, FormularioProducto } from '@components/organisms/FormularioProducto';
import { PantallaPerfilSeccion } from '@components/organisms/PantallaPerfilSeccion';
import { fechaLocal } from '@dominio/fecha';
import type { Producto } from '@dominio/tipos';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useFormularioProducto } from '@hooks/useFormularioProducto';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';

export const PerfilProductosScreen = () => {
  const { productos, establecerProductoActivo } = useCrecemos();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'PerfilProductos'>>();
  const formulario = useFormularioProducto();
  const [enHoja, setEnHoja] = useState<Producto | null>(null);
  const [hojaVisible, setHojaVisible] = useState(false);
  // Activar o desactivar un producto comparte el aviso de la sección si el guardado falla.
  const activoSeguro = useAccionSegura((tarea: () => Promise<void>) => tarea());
  const hoy = fechaLocal(new Date());

  return (
    <PantallaPerfilSeccion
      title="Mis productos"
      subtitle="Lo que vendes y cuánto te deja cada uno"
      onBack={() => navigation.goBack()}
      testID="perfil-productos"
      pie={formulario.abierto ? <AccionesFormularioProducto formulario={formulario} /> : undefined}
    >
      {formulario.abierto ? (
        <FormularioProducto formulario={formulario} />
      ) : (
        <>
          <Button
            title="Agregar producto"
            fullWidth
            onPress={() => formulario.abrir()}
            testID="agregar-producto"
          />
          <Text variant="caption" color="textMuted">
            Lo que te deja cada producto es su precio de venta menos tu costo estimado.
          </Text>
          <MensajeError mensaje={activoSeguro.mensajeError} testID="error-producto-seccion" />
          {productos.length === 0 ? (
            <Card variant="bordered" wrapperStyle={styles.vacio} testID="productos-vacio">
              <Text>Agrega lo que vendes para registrar tu día.</Text>
              <BotonCargarEjemplo testID="cargar-ejemplo-perfil" errorTestID="error-cargar-ejemplo" />
            </Card>
          ) : null}
          {productos.map(p => (
            <TarjetaProducto
              key={p.id}
              producto={p}
              hoy={hoy}
              onCambiarPrecio={() => {
                setEnHoja(p);
                setHojaVisible(true);
              }}
              onEditar={() => formulario.abrir(p)}
              onActivo={() => activoSeguro.ejecutar(() => establecerProductoActivo(p.id, !p.activo))}
            />
          ))}
        </>
      )}
      <CambiarPrecioSheet
        producto={enHoja}
        visible={hojaVisible}
        onClose={() => setHojaVisible(false)}
      />
    </PantallaPerfilSeccion>
  );
};

const styles = StyleSheet.create({
  vacio: { gap: spacing.sm },
});
