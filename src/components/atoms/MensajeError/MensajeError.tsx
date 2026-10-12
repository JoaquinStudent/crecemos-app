// src/components/atoms/MensajeError/MensajeError.tsx
// El texto de error de una acción que falló: en rojo, con palabras claras y anunciado por el
// lector de pantalla (accessibilityLiveRegion). No dibuja nada si no hay mensaje.
import { StyleProp, TextStyle } from 'react-native';
import { ColorName } from '@theme';
import { Text } from '@components/atoms/Text';

export interface MensajeErrorProps {
  mensaje: string | null | undefined;
  color?: ColorName;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export const MensajeError = ({ mensaje, color = 'danger', style, testID = 'mensaje-error' }: MensajeErrorProps) =>
  mensaje ? (
    <Text color={color} accessibilityLiveRegion="polite" style={style} testID={testID}>
      {mensaje}
    </Text>
  ) : null;
