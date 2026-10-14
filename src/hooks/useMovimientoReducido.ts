// src/hooks/useMovimientoReducido.ts
// Respeta "Reducir movimiento" del sistema (AccessibilityInfo.isReduceMotionEnabled) y la opción
// "Reducir animaciones" de Perfil → Configuración: basta con que una de las dos esté prendida.
// Devuelve una ref y no un estado: leerla no re-renderiza ni dispara avisos de `act` en las
// pruebas. Se lee en el momento de animar.
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

// La opción de la app. Es de módulo (no de contexto) para que `movimientoReducido()` siga siendo
// una consulta suelta que cualquier componente puede hacer sin un proveedor.
let forzado = false;
const oyentes = new Set<() => void>();

/** Lo llama el proveedor de ajustes cuando la persona cambia "Reducir animaciones". */
export const forzarMovimientoReducido = (valor: boolean): void => {
  if (forzado === valor) return;
  forzado = valor;
  oyentes.forEach(avisar => avisar());
};

const delSistema = (): Promise<boolean> =>
  Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.() ?? false).catch(() => false);

/** Consulta puntual: true si el usuario pidió reducir el movimiento. Nunca rechaza. */
export const movimientoReducido = (): Promise<boolean> =>
  forzado ? Promise.resolve(true) : delSistema();

export const useMovimientoReducido = () => {
  const reducido = useRef(false);

  useEffect(() => {
    let vivo = true;
    let delSistemaAhora = false;
    const actualizar = () => {
      if (vivo) reducido.current = forzado || delSistemaAhora;
    };
    delSistema().then(valor => {
      delSistemaAhora = valor;
      actualizar();
    });
    const suscripcion = AccessibilityInfo.addEventListener?.('reduceMotionChanged', valor => {
      delSistemaAhora = valor;
      actualizar();
    });
    oyentes.add(actualizar);
    actualizar();
    return () => {
      vivo = false;
      oyentes.delete(actualizar);
      suscripcion?.remove?.();
    };
  }, []);

  return reducido;
};
