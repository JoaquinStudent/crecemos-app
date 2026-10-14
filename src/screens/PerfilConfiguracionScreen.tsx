// src/screens/PerfilConfiguracionScreen.tsx
// "Configuración": el tamaño de la letra (con una muestra que cambia al instante), la vibración al
// guardar el día y las animaciones reducidas. Todo se guarda en el Perfil, en el teléfono; si un
// guardado falla, `useAccionSegura` lo dice en palabras claras.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { MensajeError } from '@components/atoms/MensajeError';
import { Card } from '@components/molecules/Card';
import { ChipGroup } from '@components/molecules/ChipGroup';
import { SwitchRow } from '@components/molecules/SwitchRow';
import { PantallaPerfilSeccion } from '@components/organisms/PantallaPerfilSeccion';
import { OPCIONES_TAMANO, type TamanoLetra } from '@dominio/ajustes';
import { useAjustesVisuales } from '@context/AjustesVisualesContext';
import { useCrecemos } from '@context/CrecemosProvider';
import { useAccionSegura } from '@hooks/useAccionSegura';
import type { RootStackParamList } from '@navigation/RootStack';

export const PerfilConfiguracionScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'PerfilConfiguracion'>>();
  const { guardarPerfil } = useCrecemos();
  const { tamanoLetra, vibracion, reducirAnimaciones } = useAjustesVisuales();
  const guardar = useAccionSegura(
    (parcial: Parameters<typeof guardarPerfil>[0]) => guardarPerfil(parcial),
    'No pudimos guardar el cambio. Inténtalo otra vez.',
  );

  const cambiar = (parcial: Parameters<typeof guardarPerfil>[0]) => {
    guardar.limpiarError();
    guardar.ejecutar(parcial);
  };

  return (
    <PantallaPerfilSeccion
      title="Configuración"
      subtitle="Deja la app a tu medida"
      onBack={() => navigation.goBack()}
      testID="perfil-configuracion"
    >
      <Card
        variant="bordered"
        style={styles.tarjeta}
        wrapperStyle={styles.interior}
        testID="configuracion-letra"
      >
        <ChipGroup<TamanoLetra>
          label="Tamaño de la letra"
          options={OPCIONES_TAMANO.map(o => ({ value: o.valor, label: o.etiqueta }))}
          value={tamanoLetra}
          onChange={valor => cambiar({ tamanoLetra: valor })}
          testIDPrefix="configuracion-tamano"
        />
        <View style={styles.muestra} testID="configuracion-muestra">
          <Text variant="label" color="textMuted">
            Así se verá
          </Text>
          <Text variant="bodyStrong" testID="configuracion-muestra-texto">
            Hoy vendiste 20 de 21 porciones
          </Text>
          <Text variant="bodySmall" color="textMuted">
            Te quedan S/ 130.00 después de tus gastos.
          </Text>
        </View>
      </Card>

      <Card
        variant="bordered"
        style={styles.tarjeta}
        wrapperStyle={styles.interior}
        testID="configuracion-opciones"
      >
        <SwitchRow
          label="Vibrar al guardar mi día"
          description="Una vibración corta confirma que tu día quedó guardado."
          value={vibracion}
          onValueChange={valor => cambiar({ vibracion: valor })}
          testID="switch-vibracion"
        />
        <View style={styles.separador} />
        <SwitchRow
          label="Reducir animaciones"
          description="Los números y las tarjetas aparecen sin moverse. También se respeta lo que pida tu teléfono."
          value={reducirAnimaciones}
          onValueChange={valor => cambiar({ reducirAnimaciones: valor })}
          testID="switch-animaciones"
        />
      </Card>

      <MensajeError mensaje={guardar.mensajeError} testID="error-guardar-configuracion" />
    </PantallaPerfilSeccion>
  );
};

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  // El `gap` va en el contenedor interno de RNE: en el estilo de la tarjeta no se aplica.
  interior: { gap: spacing.md },
  muestra: { gap: spacing.xxs },
  separador: { height: 1, backgroundColor: colors.border },
});
