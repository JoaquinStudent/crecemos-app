// src/screens/PerfilAyudaScreen.tsx
// "Ayuda": qué hace la app en pocas palabras y "Ver el recorrido otra vez", que olvida que ya lo
// vio, vuelve a Inicio y lo arranca allí.
import React from 'react';
import { StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { MensajeError } from '@components/atoms/MensajeError';
import { Card } from '@components/molecules/Card';
import { PantallaPerfilSeccion } from '@components/organisms/PantallaPerfilSeccion';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useRecorrido } from '@context/RecorridoProvider';
import type { RootStackParamList } from '@navigation/RootStack';

export const PerfilAyudaScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'PerfilAyuda'>>();
  const { repetir } = useRecorrido();
  const recorrido = useAccionSegura(async () => {
    await repetir();
    navigation.navigate('Tabs', { screen: 'Inicio' });
  }, 'No pudimos abrir el recorrido. Inténtalo otra vez.');

  return (
    <PantallaPerfilSeccion
      title="Ayuda"
      subtitle="Un paseo corto por lo más importante de la app"
      onBack={() => navigation.goBack()}
      testID="perfil-ayuda"
    >
      <Card variant="bordered" wrapperStyle={styles.bloque}>
        <Text variant="h3">¿Qué hace Crecemos?</Text>
        <Text color="textMuted">
          Cada día anotas lo que preparaste, lo que te sobró y tus yapes, y la app te dice cuánto te
          queda. Con tus días anotados también arma el reporte para tu banco. Todo se guarda en tu
          teléfono.
        </Text>
      </Card>
      <Button
        title="Ver el recorrido otra vez"
        variant="outline"
        fullWidth
        loading={recorrido.ejecutando}
        onPress={() => recorrido.ejecutar()}
        testID="ver-recorrido"
      />
      <MensajeError mensaje={recorrido.mensajeError} testID="error-ver-recorrido" />
    </PantallaPerfilSeccion>
  );
};

const styles = StyleSheet.create({
  bloque: { gap: spacing.sm },
});
