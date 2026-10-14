// src/components/molecules/BotonCargarEjemplo/BotonCargarEjemplo.tsx
// "Cargar datos de ejemplo": pide la demostración y, si falla, lo dice. Se usa donde la persona no
// tiene nada todavía (productos vacíos, nada que borrar). Cargar nunca pisa días ya guardados.
import { StyleSheet, View } from 'react-native';
import { spacing } from '@theme';
import { Button } from '@components/atoms/Button';
import { MensajeError } from '@components/atoms/MensajeError';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { useCrecemos } from '@context/CrecemosProvider';

export interface BotonCargarEjemploProps {
  testID?: string;
  errorTestID?: string;
}

export const BotonCargarEjemplo = ({ testID, errorTestID }: BotonCargarEjemploProps) => {
  const { cargarDatosDeEjemplo, semilla } = useCrecemos();
  const cargar = useAccionSegura(
    () => cargarDatosDeEjemplo(),
    'No pudimos cargar los datos de ejemplo. Inténtalo otra vez.',
  );
  return (
    <View style={styles.contenedor}>
      <Button
        title="Cargar datos de ejemplo"
        variant="ghost"
        onPress={() => cargar.ejecutar()}
        disabled={semilla === 'cargando' || cargar.ejecutando}
        testID={testID}
      />
      <MensajeError mensaje={cargar.mensajeError} testID={errorTestID} />
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { gap: spacing.sm },
});
