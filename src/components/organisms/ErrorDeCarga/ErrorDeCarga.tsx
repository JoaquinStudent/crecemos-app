// src/components/organisms/ErrorDeCarga/ErrorDeCarga.tsx
// Lo que se ve si la app no pudo leer lo guardado al abrir: un mensaje claro y un botón con
// texto para reintentar. Antes la pantalla se quedaba en blanco para siempre.
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { useCrecemos } from '@context/CrecemosProvider';

/** Muestra `children` salvo que la carga haya fallado; en ese caso ofrece reintentar. */
export const ErrorDeCarga = ({ children }: { children: React.ReactNode }) => {
  const { error, reintentar } = useCrecemos();
  if (!error) return <>{children}</>;
  return (
    <SafeAreaView style={styles.pantalla} testID="error-de-carga">
      <View style={styles.contenido} accessibilityLiveRegion="polite">
        <Text variant="h1">No pudimos abrir tus datos</Text>
        <Text color="textMuted">
          Tus días guardados siguen en el teléfono. Prueba otra vez; si sigue igual, cierra la app y
          vuelve a abrirla.
        </Text>
      </View>
      <View style={styles.pie}>
        <Button title="Reintentar" size="lg" fullWidth onPress={reintentar} testID="reintentar-carga" />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  pie: { padding: spacing.lg },
});
