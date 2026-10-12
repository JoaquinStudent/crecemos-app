// src/components/organisms/DiaSheet/DiaSheet.tsx
// Hoja inferior de un día del Historial: "Editar este día" y "Borrar este día", con texto.
// Es la vía de tocar la fila (UX, regla 3): ningún gesto es la única forma de editar o borrar.
// Se apoya en el BottomSheet base: los botones van en un pie fijo,
// fuera del ScrollView.
//
// "Borrar este día" no borra: cambia la hoja a la confirmación con la consecuencia en soles
// (UX, regla 8) y recién "Sí, borrar" llama a `eliminarDia`.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { calcularCierre } from '@dominio/cierre';
import { formatoFecha, formatoSoles } from '@dominio/formato';
import { mensajeBorrar } from '@dominio/historial';
import type { Cierre, FechaNegocio } from '@dominio/tipos';
import { MensajeError } from '@components/atoms/MensajeError';
import { BottomSheet } from '@components/organisms/BottomSheet';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useCrecemos } from '@context/CrecemosProvider';

export interface DiaSheetProps {
  /** El día a editar o borrar; la hoja se muestra mientras `visible` sea verdadero. */
  cierre: Cierre | null;
  visible: boolean;
  onClose: () => void;
  /** Se llama con la fecha del día; quien abre la hoja decide a dónde ir. */
  onEditar: (fecha: FechaNegocio) => void;
}

export const DiaSheet = ({ cierre, visible, onClose, onEditar }: DiaSheetProps) =>
  visible && cierre ? (
    <Contenido key={cierre.id} cierre={cierre} onClose={onClose} onEditar={onEditar} />
  ) : null;

const Contenido = ({
  cierre,
  onClose,
  onEditar,
}: {
  cierre: Cierre;
  onClose: () => void;
  onEditar: (fecha: FechaNegocio) => void;
}) => {
  const { eliminarDia, productos } = useCrecemos();
  const [confirmando, setConfirmando] = useState(false);
  const teQueda = calcularCierre(cierre).teQueda;

  // Si borrar falla, la hoja sigue abierta en la confirmación y lo dice (antes no pasaba nada).
  const { ejecutar: borrar, ejecutando: borrando, mensajeError } = useAccionSegura(
    async () => {
      await eliminarDia(cierre.id);
      onClose();
    },
    'No pudimos borrar este día. Inténtalo otra vez.',
  );

  return (
    <BottomSheet
      visible
      onClose={onClose}
      accessibilityLabel="Opciones del día"
      footer={
        confirmando ? (
          <>
            <Button
              title="Sí, borrar"
              variant="danger"
              size="lg"
              fullWidth
              loading={borrando}
              onPress={() => borrar()}
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
        )
      }
    >
      <Text variant="h2" accessibilityRole="header" testID="hoja-dia-fecha">
        {formatoFecha(cierre.fecha)}
      </Text>

      <View style={styles.resultado}>
        <Text variant="label">Resultado registrado</Text>
        <Text variant="amount" color={teQueda < 0 ? 'danger' : 'success'} testID="hoja-dia-te-queda">
          {formatoSoles(teQueda)}
        </Text>
        <Text variant="caption" color="textMuted">
          Ventas menos gastos registrados. Incluye pagos pendientes de recibir.
        </Text>
      </View>

      {cierre.lineas.map(linea => (
        <Text key={linea.productoId} variant="bodySmall" testID={`hoja-producto-${linea.productoId}`}>
          {`${productos.find(p => p.id === linea.productoId)?.nombre ?? linea.nombre}: ${
            linea.preparadas - linea.sobrantes
          } vendidas · ${formatoSoles((linea.preparadas - linea.sobrantes) * linea.precioUnitario)}`}
        </Text>
      ))}

      {confirmando ? (
        <Text variant="bodyStrong" accessibilityLiveRegion="polite" testID="hoja-borrar-mensaje">
          {mensajeBorrar(cierre)}
        </Text>
      ) : null}
      <MensajeError mensaje={mensajeError} testID="hoja-borrar-error" />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  resultado: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
});
