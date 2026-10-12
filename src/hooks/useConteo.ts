// src/hooks/useConteo.ts
// Un número que "cuenta" hasta su valor (el monto grande de Inicio). Usa `Animated` del core, sin
// librerías. Con "Reducir movimiento" salta directo al valor final. Al terminar vale exactamente el
// objetivo (sin restos de redondeo).
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { movimientoReducido } from './useMovimientoReducido';

export const DURACION_CONTEO_MS = 700;

const aCentavos = (n: number) => Math.round(n * 100) / 100;

export const useConteo = (objetivo: number, duracion = DURACION_CONTEO_MS): number => {
  const [valor, setValor] = useState(0);
  const animado = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = animado.addListener(({ value }) => setValor(aCentavos(value)));
    return () => animado.removeListener(id);
  }, [animado]);

  useEffect(() => {
    let vivo = true;
    let corriendo: Animated.CompositeAnimation | null = null;
    movimientoReducido().then(reducido => {
      if (!vivo) return;
      if (reducido) {
        animado.setValue(objetivo);
        setValor(aCentavos(objetivo));
        return;
      }
      corriendo = Animated.timing(animado, {
        toValue: objetivo,
        duration: duracion,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
      corriendo.start(({ finished }) => {
        if (finished && vivo) setValor(aCentavos(objetivo));
      });
    });
    return () => {
      vivo = false;
      corriendo?.stop();
    };
  }, [animado, objetivo, duracion]);

  return valor;
};
