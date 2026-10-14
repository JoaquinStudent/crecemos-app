// src/components/organisms/AnotarYapeSheet/AnotarYapeSheet.tsx
// Hoja inferior "Anotar un yape": como el cuaderno donde Freddy apunta cada Yape con su hora.
// Monto, hora de ahora, "Guardar yape" y, debajo, lo anotado hoy con su "Quitar" y la suma.
// Se queda abierta al guardar para poder anotar otro; "Cerrar" es el botón con texto para salir.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { MensajeError } from '@components/atoms/MensajeError';
import { AmountInput } from '@components/molecules/AmountInput';
import { BottomSheet } from '@components/organisms/BottomSheet';
import { fechaLocal } from '@dominio/fecha';
import { formatoSoles, parseAmount } from '@dominio/formato';
import { formatoHora, horaLocal, totalDelDia, yapesDeFecha } from '@dominio/yape';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useCrecemos } from '@context/CrecemosProvider';

export interface AnotarYapeSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const AnotarYapeSheet = ({ visible, onClose }: AnotarYapeSheetProps) =>
  visible ? <Contenido onClose={onClose} /> : null;

const Contenido = ({ onClose }: { onClose: () => void }) => {
  const { yapes, anotarYape, quitarYape } = useCrecemos();
  const [monto, setMonto] = useState('');
  const [error, setError] = useState<string | undefined>();
  // La hora que se va a guardar es la de ahora; se muestra al abrir la hoja.
  const [ahora] = useState(() => horaLocal(new Date()));

  const hoy = fechaLocal(new Date());
  const deHoy = yapesDeFecha(yapes, hoy);

  const { ejecutar: guardar, ejecutando: guardando, mensajeError } = useAccionSegura(async () => {
    const resultado = await anotarYape(parseAmount(monto));
    if (!resultado.ok) {
      setError(resultado.errores.monto);
      return;
    }
    setError(undefined);
    setMonto('');
  });
  const { ejecutar: quitar, mensajeError: errorQuitar } = useAccionSegura(
    async (id: string) => quitarYape(id),
    'No pudimos quitarlo. Inténtalo otra vez.',
  );

  return (
    <BottomSheet
      visible
      onClose={onClose}
      avoidKeyboard
      accessibilityLabel="Anotar un yape"
      scrollTestID="yape-scroll"
      footer={
        <>
          <MensajeError mensaje={mensajeError} testID="yape-error-guardar" />
          <Button
            title="Guardar yape"
            size="lg"
            fullWidth
            loading={guardando}
            onPress={() => guardar()}
            testID="yape-guardar"
          />
          <Button title="Cerrar" variant="ghost" fullWidth onPress={onClose} testID="yape-cerrar" />
        </>
      }
    >
      <Text variant="h2" accessibilityRole="header">
        Anotar un yape
      </Text>

      <AmountInput
        label="¿Cuánto fue?"
        value={monto}
        onChangeText={texto => {
          setMonto(texto);
          setError(undefined);
        }}
        error={error}
        testID="yape-monto"
      />
      <Text color="textMuted" testID="yape-hora">
        {`Ahora · ${formatoHora(ahora)}`}
      </Text>

      <View style={styles.lista}>
        <Text variant="h3" accessibilityRole="header">
          Lo que anotaste hoy
        </Text>
        <MensajeError mensaje={errorQuitar} testID="yape-error-quitar" />
        {deHoy.length === 0 ? (
          <Text color="textMuted" testID="yape-vacio">
            Todavía no anotaste ningún yape hoy.
          </Text>
        ) : (
          deHoy.map((y, i) => (
            <View key={y.id} style={styles.fila} testID={`yape-fila-${i}`}>
              <View style={styles.filaTexto}>
                <Text variant="bodyStrong" testID={`yape-fila-${i}-monto`}>
                  {formatoSoles(y.monto)}
                </Text>
                <Text variant="caption" color="textMuted">
                  {formatoHora(y.hora)}
                </Text>
              </View>
              <Button
                title="Quitar"
                variant="ghost"
                accessibilityLabel={`Quitar el yape de ${formatoSoles(y.monto)} de las ${formatoHora(y.hora)}`}
                onPress={() => quitar(y.id)}
                testID={`yape-quitar-${i}`}
              />
            </View>
          ))
        )}
        <Text variant="bodyStrong" testID="yape-total">
          {`Hoy llevas ${formatoSoles(totalDelDia(yapes, hoy))} en Yape`}
        </Text>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  lista: { gap: spacing.sm },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filaTexto: { flex: 1 },
});
