// src/components/organisms/PantallaPerfilSeccion/PantallaPerfilSeccion.tsx
// El marco común de cada pantalla que se abre desde el Perfil (Mis datos, Cómo me pagan...): zona
// segura arriba, encabezado con "Atrás" y título, y un ScrollView que el teclado no tapa.
// Con borde a borde en Android 16 `adjustResize` se ignora y el teclado se dibuja ENCIMA: el
// KeyboardAvoidingView con `padding` (en las dos plataformas, como Preguntar) achica la zona visible
// y así el campo enfocado y el botón "Guardar" quedan alcanzables.
import { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@theme';
import { ScreenHeader } from '@components/molecules/ScreenHeader';

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
    <KeyboardAvoidingView style={styles.pantalla} behavior="padding" keyboardVerticalOffset={0}>
      <ScrollView
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
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
});
