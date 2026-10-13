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
}

export const useTecladoVisible = (): EstadoTeclado => {
  const [estado, setEstado] = useState<EstadoTeclado>({ visible: false, height: 0 });

  useEffect(() => {
    // En iOS "will" anticipa la animación; en Android solo existen los "did".
    const mostrar = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const ocultar = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const alMostrar = Keyboard.addListener(mostrar, e =>
      setEstado({ visible: true, height: e?.endCoordinates?.height ?? 0 }),
    );
    const alOcultar = Keyboard.addListener(ocultar, () => setEstado({ visible: false, height: 0 }));
    return () => {
      alMostrar.remove();
      alOcultar.remove();
    };
  }, []);

  return estado;
};
