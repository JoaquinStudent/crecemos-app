// src/hooks/useMovimientoReducido.ts
// Respeta "Reducir movimiento" del sistema (AccessibilityInfo.isReduceMotionEnabled).
// Devuelve una ref y no un estado: leerla no re-renderiza ni dispara avisos de `act` en las
// pruebas. Se lee en el momento de animar.
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Consulta puntual: true si el usuario pidió reducir el movimiento. Nunca rechaza. */
export const movimientoReducido = (): Promise<boolean> =>
  Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.() ?? false).catch(() => false);

export const useMovimientoReducido = () => {
  const reducido = useRef(false);

  useEffect(() => {
    let vivo = true;
    movimientoReducido().then(valor => {
      if (vivo) reducido.current = valor;
    });
    const suscripcion = AccessibilityInfo.addEventListener?.('reduceMotionChanged', valor => {
      reducido.current = valor;
    });
    return () => {
      vivo = false;
      suscripcion?.remove?.();
    };
  }, []);

  return reducido;
};
