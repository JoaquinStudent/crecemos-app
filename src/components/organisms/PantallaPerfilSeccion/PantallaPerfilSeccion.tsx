// src/components/organisms/PantallaPerfilSeccion/PantallaPerfilSeccion.tsx
// El marco común de cada pantalla que se abre desde el Perfil (Mis datos, Cómo me pagan...): zona
// segura arriba, encabezado con "Atrás" y título, y un ScrollConTeclado que el teclado no tapa.
// Con borde a borde en Android 16 `adjustResize` se ignora y el teclado se dibuja ENCIMA. Dos modos:
//  - Con `pie` (las acciones principales del formulario): mismo patrón que "Cerrar mi día". Un
//    KeyboardAvoidingView sube el pie con el teclado y la zona de scroll termina sobre él, así que el
//    scroll NO suma el teclado otra vez (`conRelleno={false}`); el campo enfocado se lleva sobre el pie.
//  - Sin `pie`: el ScrollConTeclado suma el alto del teclado a su relleno y deja espacio libre bajo
//    el campo para que se vean los botones que lo siguen (p. ej. "Guardar" de un dato editable).
import { ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@theme';
import { ScreenHeader } from '@components/molecules/ScreenHeader';
import { ScrollConTeclado } from '@components/molecules/ScrollConTeclado';
import { StickyFooter } from '@components/molecules/StickyFooter';
import { useTecladoVisible } from '@hooks/useTecladoVisible';

/** Alto de un botón en línea (48) más su separación: lo que debe verse bajo el campo enfocado. */
const BOTONES_BAJO_EL_CAMPO = 48 + spacing.sm;

export interface PantallaPerfilSeccionProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
  /** Acciones principales: van en un pie fijo FUERA del scroll que sube con el teclado. */
  pie?: ReactNode;
  /** Prefijo de los testID: `${testID}-scroll`, `${testID}-titulo`, `${testID}-pie`. */
  testID?: string;
}

export const PantallaPerfilSeccion = ({
  title,
  subtitle,
  onBack,
  children,
  pie,
  testID,
}: PantallaPerfilSeccionProps) => {
  const teclado = useTecladoVisible();
  const encabezado = (
    <ScreenHeader
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      style={styles.encabezado}
      backTestID="seccion-atras"
      titleTestID={testID ? `${testID}-titulo` : undefined}
    />
  );
  const idScroll = testID ? `${testID}-scroll` : undefined;

  if (pie) {
    return (
      <SafeAreaView style={styles.pantalla} edges={['top']} testID={testID}>
        <KeyboardAvoidingView style={styles.pantalla} behavior="padding" keyboardVerticalOffset={0}>
          {encabezado}
          <ScrollConTeclado
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.contenidoConPie}
            conRelleno={false}
            testID={idScroll}
          >
            {children}
          </ScrollConTeclado>
          {/* Con el teclado abierto el margen del gesto del sistema ya no hace falta. */}
          <StickyFooter
            style={teclado.visible ? styles.pieConTeclado : undefined}
            testID={testID ? `${testID}-pie` : undefined}
          >
            {pie}
          </StickyFooter>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']} testID={testID}>
      {encabezado}
      <ScrollConTeclado
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contenido}
        margenInferior={spacing.lg + BOTONES_BAJO_EL_CAMPO}
        testID={idScroll}
      >
        {children}
      </ScrollConTeclado>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  // El encabezado va fuera del scroll: queda fijo mientras el contenido se desplaza.
  encabezado: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  contenido: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  // El colchón de abajo deja que el último campo suba y no quede pegado al pie fijo.
  contenidoConPie: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  pieConTeclado: { paddingBottom: spacing.sm },
});
