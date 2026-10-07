// src/components/organisms/CambiarPrecioSheet/CambiarPrecioSheet.tsx
// Hoja inferior "Cambiar precio" (mock 07). Con el Modal de React Native, sin dependencias.
//
// El botón principal vive FUERA del ScrollView, en un pie fijo, y todo va dentro de un
// KeyboardAvoidingView: con el teclado abierto "Guardar el nuevo precio" sigue a la vista
// y se puede tocar. Es la lección del Sprint-01 (memory.md, D27): ahí el teclado tapó el botón.
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Info } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { AmountInput } from '@components/molecules/AmountInput';
import { formatoFechaCorta, formatoSoles, parseAmount, redondearSoles } from '@dominio/formato';
import { teDeja } from '@dominio/producto';
import type { Producto } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';

export interface CambiarPrecioSheetProps {
  /** El producto a cambiar; la hoja se muestra mientras `visible` sea verdadero. */
  producto: Producto | null;
  visible: boolean;
  onClose: () => void;
}

export const CambiarPrecioSheet = ({ producto, visible, onClose }: CambiarPrecioSheetProps) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    {producto ? <Contenido key={producto.id} producto={producto} onClose={onClose} /> : null}
  </Modal>
);

const conSigno = (n: number) => `${n < 0 ? '−' : '+'} ${formatoSoles(Math.abs(n))}`;

const Contenido = ({ producto, onClose }: { producto: Producto; onClose: () => void }) => {
  const { cambiarPrecioProducto } = useCrecemos();
  const insets = useSafeAreaInsets();
  const [precio, setPrecio] = useState(producto.precioVenta.toFixed(2));
  const [costo, setCosto] = useState(producto.costoUnitario.toFixed(2));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  // Resultado en vivo: lo que deja ahora contra lo que dejaba antes (D10: "te deja", no "te queda").
  const nuevo = redondearSoles(parseAmount(precio) - parseAmount(costo));
  const diferencia = redondearSoles(nuevo - teDeja(producto).monto);

  const guardarPrecio = async () => {
    const resultado = await cambiarPrecioProducto(
      producto.id,
      parseAmount(precio),
      parseAmount(costo),
    );
    if (!resultado.ok) {
      // Cada mensaje va al pie de su campo (claves precioVenta y costoUnitario).
      setErrores(resultado.errores);
      return;
    }
    onClose();
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      await guardarPrecio();
    } finally {
      setGuardando(false);
    }
  };

  return (
    <View style={styles.fondo}>
      {/* Tocar fuera cierra la hoja; "Cancelar" es la vía visible (ningún gesto es la única vía). */}
      <Pressable style={styles.afuera} onPress={onClose} accessible={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.hoja}
      >
        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
          testID="hoja-precio-scroll"
        >
          <View>
            <Text variant="h2" accessibilityRole="header">
              {producto.nombre}
            </Text>
            <Text variant="label" color="textMuted">
              Precio actual: {formatoSoles(producto.precioVenta)} desde el{' '}
              {formatoFechaCorta(producto.actualizadoEn)}
            </Text>
          </View>

          <AmountInput
            label="¿A cuánto lo vendes?"
            value={precio}
            onChangeText={setPrecio}
            error={errores.precioVenta}
            testID="precio-input"
          />

          <AmountInput
            label="¿Cuánto te cuesta hacer uno?"
            helperText="Si no estás seguro, pon un aproximado. Lo puedes corregir después."
            value={costo}
            onChangeText={setCosto}
            error={errores.costoUnitario}
            testID="costo-input"
          />

          <View style={styles.resultado} testID="resultado-en-vivo">
            <View style={styles.resultadoTexto}>
              <Text variant="label">Te va a dejar</Text>
              <Text variant="amount" color={nuevo > 0 ? 'success' : nuevo < 0 ? 'danger' : 'text'}>
                {nuevo < 0 ? '−' : ''}
                {formatoSoles(Math.abs(nuevo))} por porción
              </Text>
            </View>
            {diferencia !== 0 ? (
              <Text variant="bodyStrong" color={diferencia > 0 ? 'success' : 'danger'}>
                {conSigno(diferencia)} que antes
              </Text>
            ) : null}
          </View>

          <View style={styles.aviso}>
            <Icon icon={Info} color="accent" />
            <Text variant="bodySmall" style={styles.avisoTexto}>
              Esto vale desde hoy. Los días que ya registraste se quedan con el precio que tenían,
              para que tu historial no cambie.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.pie, { paddingBottom: spacing.lg + insets.bottom }]}>
          <Button
            title="Guardar el nuevo precio"
            size="lg"
            fullWidth
            loading={guardando}
            onPress={guardar}
            testID="guardar-precio"
          />
          <Button
            title="Cancelar"
            variant="ghost"
            fullWidth
            onPress={onClose}
            testID="cancelar-precio"
          />
        </View>
      </KeyboardAvoidingView>
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
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  resultadoTexto: { gap: spacing.xs },
  aviso: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  avisoTexto: { flex: 1 },
  pie: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
