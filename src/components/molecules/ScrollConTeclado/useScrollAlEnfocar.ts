// src/components/molecules/ScrollConTeclado/useScrollAlEnfocar.ts
// Lleva el campo enfocado a una posición cómoda, por encima del teclado. En Android con borde a
// borde (`adjustResize` se ignora) el teclado se dibuja ENCIMA y nadie mueve el scroll: este hook
// mide el campo y la zona visible y hace `scrollTo` lo justo. Es idempotente (si el campo ya se
// ve no hace nada), así que se puede llamar al abrirse el teclado, al enfocar otro campo y cuando
// el contenido cambia de alto, sin temporizadores.
// Las mediciones viven aquí (src/components) y no en las pantallas (regla de arquitectura de UI).
import { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  TextInput,
} from 'react-native';
import { spacing } from '@theme';
import { useTecladoVisible } from '@hooks/useTecladoVisible';
import type { EstadoTeclado } from '@hooks/useTecladoVisible';

export type ScrollRef = React.ComponentRef<typeof ScrollView>;

/** Cuánto hay que mover el scroll (+ baja el contenido, − lo sube); 0 si el campo ya se ve bien. */
export const desplazamientoParaVer = (medidas: {
  campoArriba: number;
  campoAlto: number;
  zonaArriba: number;
  /** Abajo de la zona visible: el menor entre el teclado y el borde del scroll. */
  zonaAbajo: number;
  margen: number;
  /** Margen de abajo si debe ser distinto (p. ej. para que se vean también los botones bajo el campo). */
  margenAbajo?: number;
}): number => {
  const { campoArriba, campoAlto, zonaArriba, zonaAbajo, margen, margenAbajo = margen } = medidas;
  const campoAbajo = campoArriba + campoAlto;
  const limite = zonaAbajo - margenAbajo;
  if (campoAbajo > limite) {
    // Si el campo es más alto que la zona, manda su borde de arriba (no se pierde el inicio).
    return Math.min(campoAbajo - limite, campoArriba - (zonaArriba + margen));
  }
  if (campoArriba < zonaArriba) return campoArriba - (zonaArriba + margen);
  return 0;
};

export const useScrollAlEnfocar = (
  scrollRef: React.RefObject<ScrollRef | null>,
  margenInferior: number = spacing.lg,
) => {
  const teclado = useTecladoVisible();
  const tecladoRef = useRef<EstadoTeclado>(teclado);
  tecladoRef.current = teclado;
  const desplazado = useRef(0);

  const llevarCampoAlTeclado = useCallback(() => {
    const t = tecladoRef.current;
    const scroll = scrollRef.current;
    const campo = TextInput.State?.currentlyFocusedInput?.();
    if (!t.visible || !scroll || !campo) return;
    scroll.measureInWindow((_x, zonaY, _w, zonaAlto) => {
      campo.measureInWindow((_cx, campoY, _cw, campoAlto) => {
        const tecladoArriba = t.top ?? Dimensions.get('window').height - t.height;
        const delta = desplazamientoParaVer({
          campoArriba: campoY,
          campoAlto,
          zonaArriba: zonaY,
          zonaAbajo: Math.min(tecladoArriba, zonaY + zonaAlto),
          margen: spacing.lg,
          margenAbajo: margenInferior,
        });
        if (delta === 0) return;
        const y = Math.max(0, desplazado.current + delta);
        desplazado.current = y;
        scroll.scrollTo?.({ y, animated: false });
      });
    });
  }, [scrollRef, margenInferior]);

  // Al abrirse el teclado (o cambiar de alto) se revisa el campo que tenga el foco.
  useEffect(() => {
    if (teclado.visible) llevarCampoAlTeclado();
  }, [teclado.visible, teclado.height, teclado.top, llevarCampoAlTeclado]);

  const alScrollear = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    desplazado.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { teclado, llevarCampoAlTeclado, alScrollear };
};
