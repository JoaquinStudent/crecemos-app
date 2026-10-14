// src/hooks/useTecladoVisible.ts
// ¿Está abierto el teclado y cuánto mide? En Android con borde a borde (targetSdk 35+) el sistema
// ya no redimensiona la ventana (`adjustResize` se ignora): el teclado se dibuja ENCIMA de la app y
// cada pantalla con formulario debe hacerse sitio ella misma. Este hook es la fuente única.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export interface EstadoTeclado {
  visible: boolean;
  /** Alto del teclado en dp (0 si está cerrado). */
  height: number;
  /** Dónde empieza el teclado (de arriba hacia abajo, en dp de pantalla), o null si no se sabe. */
  top: number | null;
}

const CERRADO: EstadoTeclado = { visible: false, height: 0, top: null };

export const useTecladoVisible = (): EstadoTeclado => {
  const [estado, setEstado] = useState<EstadoTeclado>(CERRADO);

  useEffect(() => {
    // En iOS "will" anticipa la animación; en Android solo existen los "did".
    const mostrar = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const ocultar = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const alMostrar = Keyboard.addListener(mostrar, e => {
      const screenY = e?.endCoordinates?.screenY;
      setEstado({
        visible: true,
        height: e?.endCoordinates?.height ?? 0,
        top: typeof screenY === 'number' && screenY > 0 ? screenY : null,
      });
    });
    const alOcultar = Keyboard.addListener(ocultar, () => setEstado(CERRADO));
    return () => {
      alMostrar.remove();
      alOcultar.remove();
    };
  }, []);

  return estado;
};
