// src/components/organisms/BottomSheet/BottomSheet.tsx
// Hoja inferior base. El fondo oscuro aparece con FADE y la hoja SUBE con slide: no se desliza
// todo junto como con `animationType="slide"` (auditoría P1 #20). Lleva barra de arrastre
// (decorativa), cubre la barra de estado y se anuncia como modal para el lector de pantalla.
//
// No usa el BottomSheet de RNE: ese envuelve un Modal con slide del overlay completo, que es
// justo lo que hay que evitar. Sí usa nuestros tokens y el StickyFooter.
//
// Cerrar es inmediato (sin animación de salida): las pruebas y quien la usa esperan que el
// contenido desaparezca en cuanto `visible` pasa a falso.
// "Tocar fuera" cierra, pero siempre debe haber un botón visible con texto (UX, regla 3).
import { ReactNode, useEffect, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, radius, spacing } from '@theme';
import { StickyFooter } from '@components/molecules/StickyFooter';
import { movimientoReducido } from '@hooks/useMovimientoReducido';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Botones fijos al pie, fuera del scroll (el teclado nunca los tapa). */
  footer?: ReactNode;
  /** Sube la hoja cuando se abre el teclado (hojas con campos). */
  avoidKeyboard?: boolean;
  /** Nombre de la hoja para el lector de pantalla. */
  accessibilityLabel?: string;
  testID?: string;
  scrollTestID?: string;
  footerTestID?: string;
}

export const BottomSheet = ({ visible, onClose, ...resto }: BottomSheetProps) => (
  <Modal
    visible={visible}
    transparent
    animationType="none"
    statusBarTranslucent
    onRequestClose={onClose}
  >
    <Hoja onClose={onClose} {...resto} />
  </Modal>
);

const Hoja = ({
  onClose,
  children,
  footer,
  avoidKeyboard = false,
  accessibilityLabel,
  testID,
  scrollTestID,
  footerTestID,
}: Omit<BottomSheetProps, 'visible'>) => {
  const { height } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const subida = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    const animacion = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(subida, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]);
    animacion.start();
    let vivo = true;
    // "Reducir movimiento": la hoja aparece ya puesta, sin recorrido.
    movimientoReducido().then(reducido => {
      if (!vivo || !reducido) return;
      animacion.stop();
      fade.setValue(1);
      subida.setValue(0);
    });
    return () => {
      vivo = false;
      animacion.stop();
    };
  }, [fade, subida]);

  const Contenedor = avoidKeyboard ? KeyboardAvoidingView : View;
  const propsContenedor = avoidKeyboard
    ? { behavior: Platform.OS === 'ios' ? ('padding' as const) : undefined }
    : {};

  return (
    <View style={styles.fondo} accessibilityViewIsModal testID={testID}>
      <Animated.View style={[styles.velo, { opacity: fade }]}>
        {/* Tocar fuera cierra; el botón con texto es la vía visible. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      </Animated.View>
      <Animated.View
        style={[styles.contenedor, { transform: [{ translateY: subida }] }]}
        pointerEvents="box-none"
      >
        <Contenedor
          style={styles.hoja}
          accessibilityLabel={accessibilityLabel}
          {...propsContenedor}
        >
          <View
            style={styles.asa}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            testID="hoja-asa"
          />
          <ScrollView
            contentContainerStyle={styles.contenido}
            keyboardShouldPersistTaps="handled"
            testID={scrollTestID}
          >
            {children}
          </ScrollView>
          {footer ? <StickyFooter testID={footerTestID}>{footer}</StickyFooter> : null}
        </Contenedor>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end' },
  velo: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  contenedor: { maxHeight: '92%', justifyContent: 'flex-end' },
  hoja: {
    flexShrink: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  asa: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    marginTop: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  contenido: { padding: spacing.lg, gap: spacing.lg },
});
