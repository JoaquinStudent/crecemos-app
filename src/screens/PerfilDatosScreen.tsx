// src/screens/PerfilDatosScreen.tsx
// "Mis datos": un formulario para editar quién es la persona y dónde vende. Un solo "Guardar"
// al final; si sale bien, vuelve al Perfil. "Cancelar" no guarda nada.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { spacing } from '@theme';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { MensajeError } from '@components/atoms/MensajeError';
import { PantallaPerfilSeccion } from '@components/organisms/PantallaPerfilSeccion';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';

export const PerfilDatosScreen = () => {
  const { perfil, guardarPerfil } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'PerfilDatos'>>();
  const [nombre, setNombre] = useState(perfil.nombre ?? '');
  const [negocio, setNegocio] = useState(perfil.negocio ?? '');
  const [ubicacion, setUbicacion] = useState(perfil.ubicacion ?? '');

  // Si el guardado falla, lo dice aquí abajo en vez de callar.
  const guardar = useAccionSegura(async () => {
    await guardarPerfil({
      nombre: nombre.trim(),
      negocio: negocio.trim(),
      ubicacion: ubicacion.trim(),
    });
    navigation.goBack();
  });

  return (
    <PantallaPerfilSeccion
      title="Mis datos"
      subtitle="Así te presentamos en tu perfil y en tu reporte"
      onBack={() => navigation.goBack()}
      testID="perfil-datos"
    >
      <View style={styles.campos}>
        <Input
          label="Mi nombre"
          placeholder="Escribe tu nombre"
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="words"
          testID="input-nombre"
        />
        <Input
          label="Mi negocio"
          placeholder="Escribe el nombre de tu negocio"
          value={negocio}
          onChangeText={setNegocio}
          autoCapitalize="words"
          testID="input-negocio"
        />
        <Input
          label="Dónde vendo"
          placeholder="Escribe dónde vendes"
          value={ubicacion}
          onChangeText={setUbicacion}
          autoCapitalize="words"
          testID="input-ubicacion"
        />
      </View>
      <MensajeError mensaje={guardar.mensajeError} testID="error-guardar-datos" />
      <View style={styles.acciones}>
        <Button
          title="Guardar"
          fullWidth
          loading={guardar.ejecutando}
          onPress={() => guardar.ejecutar()}
          testID="guardar-datos"
        />
        <Button
          title="Cancelar"
          variant="ghost"
          fullWidth
          onPress={() => navigation.goBack()}
          testID="cancelar-datos"
        />
      </View>
    </PantallaPerfilSeccion>
  );
};

const styles = StyleSheet.create({
  campos: { gap: spacing.lg },
  acciones: { gap: spacing.sm },
});
