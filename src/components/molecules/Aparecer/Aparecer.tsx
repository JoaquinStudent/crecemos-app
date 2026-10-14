// src/components/molecules/Aparecer/Aparecer.tsx
// Entrada suave de un bloque: aparece (opacidad) y sube unos puntos. Con `indice` los bloques de
// una pantalla entran uno tras otro. Solo al montarse; con "Reducir movimiento" no se anima y el
// bloque aparece de golpe.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { useRecorrido } from '@context/RecorridoProvider';
import { movimientoReducido } from '@hooks/useMovimientoReducido';

export const DURACION_ENTRADA_MS = 280;
export const RETRASO_ENTRE_BLOQUES_MS = 70;
/** Los bloques de más abajo salen de pantalla: no vale la pena hacerlos esperar. */
export const MAXIMO_ESCALON = 5;
const SUBIDA = 10;

export interface AparecerProps {
  children: React.ReactNode;
  /** Posición del bloque en la pantalla (0 = primero). Define cuánto espera. */
  indice?: number;
  style?: StyleProp<ViewStyle>;
}

export const Aparecer = ({ children, indice = 0, style }: AparecerProps) => {
  const progreso = useRef(new Animated.Value(0)).current;
  // El recorrido guiado mide lo señalado: si el bloque aún se está moviendo, el hueco saldría corrido.
  const { activo: recorridoActivo } = useRecorrido();

  useEffect(() => {
    if (!recorridoActivo) return;
    progreso.stopAnimation();
    progreso.setValue(1);
  }, [recorridoActivo, progreso]);

  useEffect(() => {
    let vivo = true;
    let corriendo: Animated.CompositeAnimation | null = null;
    movimientoReducido().then(reducido => {
      if (!vivo) return;
      if (reducido) {
        progreso.setValue(1);
        return;
      }
      corriendo = Animated.timing(progreso, {
        toValue: 1,
        duration: DURACION_ENTRADA_MS,
        delay: Math.min(indice, MAXIMO_ESCALON) * RETRASO_ENTRE_BLOQUES_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
      corriendo.start();
    });
    return () => {
      vivo = false;
      corriendo?.stop();
    };
  }, [progreso, indice]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progreso,
          transform: [
            { translateY: progreso.interpolate({ inputRange: [0, 1], outputRange: [SUBIDA, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};
