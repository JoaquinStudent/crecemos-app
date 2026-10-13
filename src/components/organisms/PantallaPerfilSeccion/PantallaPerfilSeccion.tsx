// src/components/organisms/PantallaPerfilSeccion/PantallaPerfilSeccion.tsx
// El marco común de cada pantalla que se abre desde el Perfil (Mis datos, Cómo me pagan...): zona
// segura arriba, encabezado con "Atrás" y título, y un ScrollConTeclado que el teclado no tapa.
// Con borde a borde en Android 16 `adjustResize` se ignora y el teclado se dibuja ENCIMA: el
// ScrollConTeclado suma el alto del teclado al relleno inferior y lleva el campo enfocado sobre él,
// así el campo y el botón "Guardar" quedan alcanzables. UN solo mecanismo: sin KeyboardAvoidingView.
import { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@theme';
import { ScreenHeader } from '@components/molecules/ScreenHeader';
import { ScrollConTeclado } from '@components/molecules/ScrollConTeclado';

export interface PantallaPerfilSeccionProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
  /** Prefijo de los testID: `${testID}-scroll`, `${testID}-titulo`. */
  testID?: string;
}

export const PantallaPerfilSeccion = ({
  title,
  subtitle,
  onBack,
  children,
  testID,
}: PantallaPerfilSeccionProps) => (
  <SafeAreaView style={styles.pantalla} edges={['top']} testID={testID}>
    <ScrollConTeclado
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.contenido}
      testID={testID ? `${testID}-scroll` : undefined}
    >
      <ScreenHeader
        title={title}
        subtitle={subtitle}
        onBack={onBack}
        backTestID="seccion-atras"
        titleTestID={testID ? `${testID}-titulo` : undefined}
      />
      {children}
    </ScrollConTeclado>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
});
