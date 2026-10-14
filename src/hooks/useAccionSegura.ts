// src/hooks/useAccionSegura.ts
// Envuelve un handler asíncrono (guardar, borrar, activar...) para que una promesa rechazada
// nunca se pierda en silencio: se atrapa, se apaga el "ejecutando" y queda un mensaje en
// palabras de todos los días para mostrar en pantalla (ver `MensajeError`).
import { useCallback, useEffect, useRef, useState } from 'react';

export const MENSAJE_ERROR_GUARDAR = 'No pudimos guardar. Inténtalo otra vez.';

export interface AccionSegura<A extends unknown[], R> {
  /** Corre la acción. Devuelve su resultado, o `undefined` si falló (el error queda en `mensajeError`). */
  ejecutar: (...args: A) => Promise<R | undefined>;
  /** `true` mientras alguna ejecución sigue en curso. */
  ejecutando: boolean;
  /** Mensaje para mostrar a la persona, o `null` si lo último salió bien. */
  mensajeError: string | null;
  limpiarError: () => void;
}

export const useAccionSegura = <A extends unknown[], R>(
  accion: (...args: A) => Promise<R>,
  mensaje: string = MENSAJE_ERROR_GUARDAR,
): AccionSegura<A, R> => {
  const [enCurso, setEnCurso] = useState(0);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  // Siempre la acción más reciente: el handler no se queda con una versión vieja del estado.
  const ultima = useRef(accion);
  ultima.current = accion;
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const ejecutar = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setEnCurso(n => n + 1);
      setMensajeError(null);
      try {
        return await ultima.current(...args);
      } catch {
        if (montado.current) setMensajeError(mensaje);
        return undefined;
      } finally {
        if (montado.current) setEnCurso(n => n - 1);
      }
    },
    [mensaje],
  );

  const limpiarError = useCallback(() => setMensajeError(null), []);

  return { ejecutar, ejecutando: enCurso > 0, mensajeError, limpiarError };
};
