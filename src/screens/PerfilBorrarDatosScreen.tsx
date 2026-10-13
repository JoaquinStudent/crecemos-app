// src/screens/PerfilBorrarDatosScreen.tsx
// "Borrar datos": quita los datos de ejemplo que vinieron con la demostración. Pide confirmar
// diciendo cuántos días se van (UX, regla 8) y nunca toca lo que la persona anotó. Si no hay nada
// de ejemplo, lo dice; y si tampoco hay productos, ofrece volver a cargar la demostración.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { MensajeError } from '@components/atoms/MensajeError';
import { BotonCargarEjemplo } from '@components/molecules/BotonCargarEjemplo';
import { Card } from '@components/molecules/Card';
import { PantallaPerfilSeccion } from '@components/organisms/PantallaPerfilSeccion';
import { mensajeBorrarEjemplo } from '@dominio/origen';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';

export const PerfilBorrarDatosScreen = () => {
  const { datosDeEjemplo, borrarDatosDeEjemplo, productos } = useCrecemos();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'PerfilBorrarDatos'>>();
  const [confirmando, setConfirmando] = useState(false);
  const hayEjemplo = datosDeEjemplo.dias > 0 || datosDeEjemplo.productos > 0;
  const borrar = useAccionSegura(async () => {
    await borrarDatosDeEjemplo();
    setConfirmando(false);
  }, 'No pudimos borrar los datos de ejemplo. Inténtalo otra vez.');

  return (
    <PantallaPerfilSeccion
      title="Borrar datos"
      subtitle="Quita lo que vino con la demostración"
      onBack={() => navigation.goBack()}
      testID="perfil-borrar"
    >
      {hayEjemplo ? (
        <View style={styles.bloque} testID="perfil-datos-ejemplo">
          <Text color="textMuted">
            Los datos de ejemplo vinieron con la demostración. No cuentan en el reporte para tu banco
            cuando ya tienes tus propios días. Lo que tú anotaste no se toca.
          </Text>
          {confirmando ? (
            <Card variant="bordered" wrapperStyle={styles.bloque}>
              <Text variant="bodyStrong" accessibilityLiveRegion="polite" testID="borrar-ejemplo-mensaje">
                {mensajeBorrarEjemplo(datosDeEjemplo)}
              </Text>
              <MensajeError mensaje={borrar.mensajeError} testID="error-borrar-ejemplo" />
              <Button
                title="Sí, borrar los de ejemplo"
                variant="danger"
                fullWidth
                loading={borrar.ejecutando}
                onPress={() => borrar.ejecutar()}
                testID="borrar-ejemplo-si"
              />
              <Button
                title="No, dejarlos"
                variant="outline"
                fullWidth
                onPress={() => setConfirmando(false)}
                testID="borrar-ejemplo-no"
              />
            </Card>
          ) : (
            <Button
              title="Borrar datos de ejemplo"
              variant="outline"
              fullWidth
              onPress={() => {
                borrar.limpiarError();
                setConfirmando(true);
              }}
              testID="borrar-ejemplo"
            />
          )}
        </View>
      ) : (
        <Card variant="bordered" wrapperStyle={styles.bloque} testID="borrar-vacio">
          <Text variant="h3" accessibilityRole="header">
            No hay datos de ejemplo
          </Text>
          <Text color="textMuted">No hay nada que borrar. Tus días y tus productos están a salvo.</Text>
          {productos.length === 0 ? (
            <BotonCargarEjemplo testID="cargar-ejemplo-borrar" errorTestID="error-cargar-ejemplo-borrar" />
          ) : null}
        </Card>
      )}
    </PantallaPerfilSeccion>
  );
};

const styles = StyleSheet.create({
  bloque: { gap: spacing.md },
});
