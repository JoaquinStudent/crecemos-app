// src/screens/PerfilPagosScreen.tsx
// "Cómo me pagan": si acepta Yape, si el Yape está a su nombre y, de ahí, el número, de quién es y
// qué es para él. Cada cambio de interruptor se guarda al tocarlo; los datos se editan en su lugar.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { border, colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { MensajeError } from '@components/atoms/MensajeError';
import { Card } from '@components/molecules/Card';
import { DatoEditable } from '@components/molecules/DatoEditable';
import { SwitchRow } from '@components/molecules/SwitchRow';
import { PantallaPerfilSeccion } from '@components/organisms/PantallaPerfilSeccion';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { validarNumeroYape } from '@dominio/validacion';
import type { Perfil } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';

export const PerfilPagosScreen = () => {
  const { perfil, guardarPerfil } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'PerfilPagos'>>();
  const pagoSeguro = useAccionSegura((parcial: Partial<Perfil>) => guardarPerfil(parcial));
  const guardarCampo = (campo: keyof Perfil) => (texto: string) =>
    guardarPerfil({ [campo]: texto } as Partial<Perfil>);

  return (
    <PantallaPerfilSeccion
      title="Cómo me pagan"
      subtitle="Para anotar tus yapes y saber cuánto te falta cobrar"
      onBack={() => navigation.goBack()}
      testID="perfil-pagos"
    >
      <Card variant="bordered" style={styles.tarjeta}>
        <SwitchRow
          label="Acepto Yape"
          value={perfil.aceptaYape}
          onValueChange={v => pagoSeguro.ejecutar({ aceptaYape: v })}
          testID="switch-acepta-yape"
        />
        <View style={styles.separador}>
          <SwitchRow
            label="El Yape no está a mi nombre"
            value={perfil.yapeAjeno}
            disabled={!perfil.aceptaYape}
            onValueChange={v => pagoSeguro.ejecutar({ yapeAjeno: v })}
            testID="switch-yape-ajeno"
          />
          <Text variant="caption" color="textMuted" style={styles.ayuda}>
            Lo anotamos como pendiente por cobrar hasta que lo recibas.
          </Text>
        </View>
        {perfil.aceptaYape ? (
          <View style={styles.separador}>
            <DatoEditable
              campo="yapeNumero"
              etiqueta="Número de Yape"
              ayuda="Escribe el número donde recibes Yape"
              valor={perfil.yapeNumero}
              soloDigitos
              maxLength={9}
              validar={validarNumeroYape}
              onGuardar={guardarCampo('yapeNumero')}
              style={styles.dato}
            />
            {perfil.yapeAjeno ? (
              <>
                <View style={styles.separador}>
                  <DatoEditable
                    campo="yapeTitular"
                    etiqueta="¿De quién es el Yape?"
                    ayuda="Escribe el nombre de quien lo tiene"
                    valor={perfil.yapeTitular}
                    onGuardar={guardarCampo('yapeTitular')}
                    style={styles.dato}
                  />
                </View>
                <View style={styles.separador}>
                  <DatoEditable
                    campo="yapeParentesco"
                    etiqueta="¿Quién es para ti?"
                    ayuda="Por ejemplo: hermana, esposa, amigo"
                    valor={perfil.yapeParentesco}
                    onGuardar={guardarCampo('yapeParentesco')}
                    style={styles.dato}
                  />
                </View>
              </>
            ) : null}
          </View>
        ) : null}
        <MensajeError mensaje={pagoSeguro.mensajeError} testID="error-guardar-pagos" />
      </Card>
    </PantallaPerfilSeccion>
  );
};

const styles = StyleSheet.create({
  // Las filas llegan a los lados de la tarjeta con su propio relleno horizontal.
  tarjeta: { backgroundColor: colors.background, paddingVertical: 0, paddingHorizontal: spacing.lg },
  separador: { borderTopWidth: border.thin, borderTopColor: colors.border },
  dato: { paddingVertical: spacing.sm },
  ayuda: { paddingBottom: spacing.md },
});
