// src/screens/PerfilRecordatorioScreen.tsx
// "Recordatorio diario": el interruptor, la explicación del permiso (solo cuando aplica), el aviso
// si el sistema lo niega y las horas para elegir. La lógica vive en `useAjusteRecordatorio`.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { border, colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { MensajeError } from '@components/atoms/MensajeError';
import { Card } from '@components/molecules/Card';
import { ChipGroup } from '@components/molecules/ChipGroup';
import { SwitchRow } from '@components/molecules/SwitchRow';
import { PantallaPerfilSeccion } from '@components/organisms/PantallaPerfilSeccion';
import { OPCIONES_HORA_RECORDATORIO } from '@dominio/recordatorio';
import { useAjusteRecordatorio } from '@hooks/useAjusteRecordatorio';
import { avisaConLaAppCerrada } from '@services/recordatorio';
import type { RootStackParamList } from '@navigation/RootStack';

export const PerfilRecordatorioScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'PerfilRecordatorio'>>();
  const r = useAjusteRecordatorio();

  return (
    <PantallaPerfilSeccion
      title="Recordatorio diario"
      subtitle="Para que no se te pase cerrar tu día"
      onBack={() => navigation.goBack()}
      testID="perfil-recordatorio"
    >
      <Card variant="bordered" style={styles.tarjeta} testID="recordatorio-tarjeta">
        <SwitchRow
          label="Recordarme cerrar mi día"
          description={
            avisaConLaAppCerrada()
              ? 'Te avisamos a la hora que elijas si aún no cerraste tu día.'
              : 'Si pasa la hora que elijas y aún no cierras tu día, te lo recordamos aquí, en Inicio. No pide ningún permiso.'
          }
          value={r.activo}
          onValueChange={r.alCambiarInterruptor}
          testID="switch-recordatorio"
        />
        {r.explicandoPermiso ? (
          <View style={[styles.separador, styles.panel]} testID="recordatorio-permiso-explicacion">
            <Text variant="bodyStrong">Para avisarte necesito tu permiso</Text>
            <Text variant="bodySmall" color="textMuted">
              Solo lo usamos para recordarte cerrar tu día a la hora que elijas. No enviamos nada a
              internet.
            </Text>
            <Button
              title="Sí, activar el recordatorio"
              variant="outline"
              fullWidth
              loading={r.activar.ejecutando}
              onPress={() => r.activar.ejecutar()}
              testID="recordatorio-permiso-si"
            />
            <Button
              title="Ahora no"
              variant="ghost"
              fullWidth
              onPress={r.ocultarExplicacion}
              testID="recordatorio-permiso-no"
            />
          </View>
        ) : null}
        {r.permisoNegado ? (
          <Text
            variant="bodySmall"
            style={styles.aviso}
            accessibilityLiveRegion="polite"
            testID="recordatorio-permiso-negado"
          >
            No pudimos activar el recordatorio porque el permiso para avisarte está apagado. Puedes
            prenderlo en los ajustes de tu teléfono y volver a intentarlo.
          </Text>
        ) : null}
        {r.activo ? (
          <View style={[styles.separador, styles.panel]}>
            <ChipGroup
              label="¿A qué hora te aviso?"
              options={OPCIONES_HORA_RECORDATORIO.map(o => ({ value: o.valor, label: o.etiqueta }))}
              value={r.hora}
              onChange={hora => r.cambiar.ejecutar({ recordatorioHora: hora })}
              testIDPrefix="recordatorio-hora"
            />
          </View>
        ) : null}
        <MensajeError mensaje={r.activar.mensajeError} testID="error-activar-recordatorio" />
        <MensajeError mensaje={r.cambiar.mensajeError} testID="error-guardar-recordatorio" />
      </Card>
    </PantallaPerfilSeccion>
  );
};

const styles = StyleSheet.create({
  // Tarjeta con un interruptor adentro: respira arriba y abajo (el texto no toca el borde).
  tarjeta: { backgroundColor: colors.background, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  separador: { borderTopWidth: border.thin, borderTopColor: colors.border },
  panel: { paddingVertical: spacing.md, gap: spacing.sm },
  aviso: { paddingBottom: spacing.md },
});
