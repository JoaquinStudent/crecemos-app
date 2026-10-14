// src/hooks/useMedidasBarra.ts
// Las medidas de la barra inferior para las pantallas de pestaña. Toda pantalla con scroll o lista
// dentro de las pestañas usa `rellenoContenido` como relleno inferior de su contenido: la barra va
// por encima (position absolute) y así el último elemento puede subir hasta la mitad del círculo
// "Cerrar día" sin quedar tapado. Las pantallas del stack (sin barra) no lo usan.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { medidasBarra, type MedidasBarra } from '@navigation/medidasBarra';

export const useMedidasBarra = (): MedidasBarra => {
  const insets = useSafeAreaInsets();
  return medidasBarra(insets.bottom);
};
