// src/context/BarraOcultaContext.tsx
// Comparte entre las pestañas y la barra inferior si la barra está escondida. Las pantallas con
// scroll llaman a `useEsconderBarraAlDesplazar()`; la barra lee `oculta` (0 = visible, 1 = escondida)
// y se desliza hacia abajo. Sin proveedor (pantallas sueltas, pruebas) todo es un no-op.
import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useMovimientoReducido } from '@hooks/useMovimientoReducido';
import { barraVisibleTras } from '@navigation/ocultarBarra';

const DURACION_MS = 220;

interface BarraOculta {
  /** 0 = barra visible, 1 = escondida. Animado con el driver nativo. */
  oculta: Animated.Value;
  mostrar: () => void;
  alDesplazar: (evento: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const SIN_BARRA: BarraOculta = {
  oculta: new Animated.Value(0),
  mostrar: () => {},
  alDesplazar: () => {},
};

const BarraOcultaContext = createContext<BarraOculta>(SIN_BARRA);

export const BarraOcultaProvider = ({ children }: { children: React.ReactNode }) => {
  const oculta = useRef(new Animated.Value(0)).current;
  const visible = useRef(true);
  const anterior = useRef(0);
  const reducido = useMovimientoReducido();

  const mover = useCallback(
    (mostrarla: boolean) => {
      if (visible.current === mostrarla) return;
      visible.current = mostrarla;
      Animated.timing(oculta, {
        toValue: mostrarla ? 0 : 1,
        duration: reducido.current ? 0 : DURACION_MS,
        easing: mostrarla ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [oculta, reducido],
  );

  const valor = useMemo<BarraOculta>(
    () => ({
      oculta,
      mostrar: () => {
        anterior.current = 0;
        mover(true);
      },
      alDesplazar: evento => {
        const { contentOffset, contentSize, layoutMeasurement } = evento.nativeEvent;
        const actual = contentOffset.y;
        // Rebote de iOS al final: no cuenta como "subir".
        const alFinal = actual + layoutMeasurement.height >= contentSize.height;
        const sigue = alFinal ? visible.current : barraVisibleTras(actual, anterior.current, visible.current);
        anterior.current = actual;
        mover(sigue);
      },
    }),
    [oculta, mover],
  );

  return <BarraOcultaContext.Provider value={valor}>{children}</BarraOcultaContext.Provider>;
};

export const useBarraOculta = () => useContext(BarraOcultaContext);

/** Props para el scroll de una pestaña: esconde la barra al bajar y la devuelve al subir. */
export const useEsconderBarraAlDesplazar = () => {
  const { alDesplazar } = useBarraOculta();
  return { onScroll: alDesplazar, scrollEventThrottle: 16 } as const;
};
