// src/components/molecules/PasoGuia/ScrollGuiado.tsx
// Un ScrollView que sabe moverse cuando el recorrido necesita traer un paso a la vista. Sin esto,
// un paso que está más abajo quedaría fuera de pantalla. Se mueve sin animación (el recorrido no
// añade movimiento) y avisa cuando ya se acomodó.
import React, { ComponentRef, createContext, useMemo, useRef } from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';

export interface DesplazamientoGuia {
  /** Mueve el contenido `dy` puntos hacia abajo (negativo = hacia arriba). */
  desplazarPor: (dy: number) => Promise<void>;
}

export const DesplazamientoGuiaContext = createContext<DesplazamientoGuia | null>(null);

const siguienteCuadro = () => new Promise<void>(resolver => requestAnimationFrame(() => resolver()));

export const ScrollGuiado = ({ onScroll, ...resto }: ScrollViewProps) => {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const posicion = useRef(0);

  const valor = useMemo<DesplazamientoGuia>(
    () => ({
      desplazarPor: async dy => {
        const destino = Math.max(0, posicion.current + dy);
        posicion.current = destino;
        ref.current?.scrollTo({ y: destino, animated: false });
        await siguienteCuadro();
      },
    }),
    [],
  );

  return (
    <DesplazamientoGuiaContext.Provider value={valor}>
      <ScrollView
        {...resto}
        ref={ref}
        scrollEventThrottle={16}
        onScroll={evento => {
          posicion.current = evento.nativeEvent.contentOffset.y;
          onScroll?.(evento);
        }}
      />
    </DesplazamientoGuiaContext.Provider>
  );
};
