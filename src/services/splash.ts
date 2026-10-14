// src/services/splash.ts
// La única puerta al splash nativo de Android (MainActivity lo retiene hasta que JS avise).
// Sin el módulo (iOS, pruebas) no hace nada.
import { NativeModules } from 'react-native';

/** Quita el splash del sistema: debajo ya está pintado el mismo logo en JS. Nunca lanza. */
export const ocultarSplashNativo = (): void => {
  try {
    NativeModules.SplashNativo?.ocultar?.();
  } catch {
    // Si no se pudo avisar, el tope de MainActivity lo suelta igual.
  }
};
