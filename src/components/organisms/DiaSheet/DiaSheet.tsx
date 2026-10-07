// src/components/organisms/DiaSheet/DiaSheet.tsx
// Hoja inferior de un día del Historial: "Editar este día" y "Borrar este día", con texto.
// Es la vía de tocar la fila (UX, regla 3): ningún gesto es la única forma de editar o borrar.
// Mismo patrón que CambiarPrecioSheet: Modal de React Native y los botones en un pie fijo,
// fuera del ScrollView.
//
// "Borrar este día" no borra: cambia la hoja a la confirmación con la consecuencia en soles
// (UX, regla 8) y recién "Sí, borrar" llama a `eliminarDia`.
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { calcularCierre } from '@dominio/cierre';
import { formatoFecha, formatoSoles } from '@dominio/formato';
import { mensajeBorrar } from '@dominio/historial';
import type { Cierre, FechaNegocio } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';

export interface DiaSheetProps {
  /** El día a editar o borrar; la hoja se muestra mientras `visible` sea verdadero. */
  cierre: Cierre | null;
  visible: boolean;
  onClose: () => void;
  /** Se llama con la fecha del día; quien abre la hoja decide a dónde ir. */
  onEditar: (fecha: FechaNegocio) => void;
}

export const DiaSheet = ({ cierre, visible, onClose, onEditar }: DiaSheetProps) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    {cierre ? (
      <Contenido key={cierre.id} cierre={cierre} onClose={onClose} onEditar={onEditar} />
    ) : null}
  </Modal>
);

const Contenido = ({
  cierre,
  onClose,
  onEditar,
}: {
  cierre: Cierre;
  onClose: () => void;
  onEditar: (fecha: FechaNegocio) => void;
}) => {
  const { eliminarDia } = useCrecemos();
  const insets = useSafeAreaInsets();
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const teQueda = calcularCierre(cierre).teQueda;

  const borrar = async () => {
    setBorrando(true);
    try {
      await eliminarDia(cierre.id);
      onClose();
    } finally {
      setBorrando(false);
    }
  };

  return (
    <View style={styles.fondo}>
      {/* Tocar fuera cierra la hoja; "Cancelar" es la vía visible (ningún gesto es la única vía). */}
      <Pressable style={styles.afuera} onPress={onClose} accessible={false} />
      <View style={styles.hoja}>
        <ScrollView contentContainerStyle={styles.contenido}>
          <Text variant="h2" accessibilityRole="header" testID="hoja-dia-fecha">
            {formatoFecha(cierre.fecha)}
          </Text>

          <View style={styles.resultado}>
            <Text variant="label">Te queda</Text>
            <Text
              variant="amount"
              color={teQueda < 0 ? 'danger' : 'success'}
              testID="hoja-dia-te-queda"
            >
              {formatoSoles(teQueda)}
            </Text>
          </View>

          {confirmando ? (
            <Text
              variant="bodyStrong"
              accessibilityLiveRegion="polite"
              testID="hoja-borrar-mensaje"
            >
              {mensajeBorrar(cierre)}
            </Text>
          ) : null}
        </ScrollView>

        <View style={[styles.pie, { paddingBottom: spacing.lg + insets.bottom }]}>
          {confirmando ? (
            <>
              <Button
                title="Sí, borrar"
                variant="danger"
                size="lg"
                fullWidth
                loading={borrando}
                onPress={borrar}
                testID="confirmar-borrar"
              />
              <Button
                title="No, volver"
                variant="outline"
                fullWidth
                onPress={() => setConfirmando(false)}
                testID="no-borrar"
              />
            </>
          ) : (
            <>
              <Button
                title="Editar este día"
                size="lg"
                fullWidth
                onPress={() => onEditar(cierre.fecha)}
                testID="hoja-editar"
              />
              <Button
                title="Borrar este día"
                variant="outline"
                fullWidth
                onPress={() => setConfirmando(true)}
                testID="hoja-borrar"
              />
              <Button
                title="Cancelar"
                variant="ghost"
                fullWidth
                onPress={onClose}
                testID="hoja-cancelar"
              />
            </>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  afuera: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hoja: {
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  contenido: { padding: spacing.lg, gap: spacing.lg },
  resultado: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  pie: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
