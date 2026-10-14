// src/components/molecules/PasoGuia/medir.ts
// La única medición nativa del recorrido: dónde está una vista en la ventana. Vive aparte para
// que las pruebas (Jest no tiene diseño nativo) la reemplacen con medidas conocidas.
import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** El rectángulo de la vista en la ventana, o `null` si no está montada o no tiene tamaño. */
export const medirVista = (ref: RefObject<ComponentRef<typeof View> | null>, _nombre: string): Promise<Rect | null> =>
  new Promise(resolve => {
    const vista = ref.current;
    if (!vista || typeof vista.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    try {
      vista.measureInWindow((x, y, width, height) => {
        resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } catch {
      resolve(null);
    }
  });
