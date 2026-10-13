// src/components/molecules/ScrollConTeclado/ScrollConTeclado.tsx
// ScrollView para pantallas con formularios. Con el teclado abierto: (1) el contenido puede subir
// tanto como el teclado mide (relleno inferior = alto del teclado + spacing.lg) y (2) el campo
// enfocado se lleva solo por encima del teclado. Los toques no cierran el teclado.
// Si la pantalla ya sube su pie con un KeyboardAvoidingView (la zona de scroll termina sobre el
// teclado), se pasa `conRelleno={false}` para no contar el teclado dos veces.
import { forwardRef, useCallback, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, ScrollViewProps } from 'react-native';
import { spacing } from '@theme';
import { ScrollRef, useScrollAlEnfocar } from './useScrollAlEnfocar';

export interface ScrollConTecladoProps extends ScrollViewProps {
  /** Suma el alto del teclado al relleno inferior (por defecto sí). */
  conRelleno?: boolean;
  /**
   * Espacio que debe quedar libre entre el campo enfocado y el teclado (o el pie). Por defecto
   * spacing.lg; se sube cuando bajo el campo hay botones que también deben verse.
   */
  margenInferior?: number;
}

export const ScrollConTeclado = forwardRef<ScrollRef, ScrollConTecladoProps>(
  (
    { conRelleno = true, margenInferior, contentContainerStyle, onScroll, onContentSizeChange, onFocus, ...resto },
    refExterna,
  ) => {
    const interna = useRef<ScrollRef | null>(null);
    const { teclado, llevarCampoAlTeclado, alScrollear } = useScrollAlEnfocar(interna, margenInferior);

    const asignar = useCallback(
      (nodo: ScrollRef | null) => {
        interna.current = nodo;
        if (typeof refExterna === 'function') refExterna(nodo);
        else if (refExterna) refExterna.current = nodo;
      },
      [refExterna],
    );

    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        {...resto}
        ref={asignar}
        contentContainerStyle={[
          contentContainerStyle,
          conRelleno && teclado.visible && { paddingBottom: teclado.height + spacing.lg },
        ]}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          alScrollear(e);
          onScroll?.(e);
        }}
        // El relleno nuevo recién cuenta cuando el contenido ya cambió de alto: se vuelve a revisar.
        onContentSizeChange={(w, h) => {
          llevarCampoAlTeclado();
          onContentSizeChange?.(w, h);
        }}
        // El foco sube por el árbol desde cada TextInput hijo.
        onFocus={e => {
          llevarCampoAlTeclado();
          onFocus?.(e);
        }}
      />
    );
  },
);
ScrollConTeclado.displayName = 'ScrollConTeclado';
