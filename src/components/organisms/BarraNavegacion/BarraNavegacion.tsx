// src/components/organisms/BarraNavegacion/BarraNavegacion.tsx
// La barra inferior: Inicio · Historial · [Cerrar día] · Resumen · Asistente.
// "Cerrar día" es la acción principal de la app: va al centro, elevada, en el círculo magenta,
// y NO es una pestaña (abre el formulario encima de todo). Ningún ícono va solo: cada ranura lleva
// su etiqueta de texto de 14 px o más (UX, regla 1) y todo lo tocable mide 48 dp o más (regla 10).
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Bot, ChartColumn, Check, ClipboardCheck, History, House } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { border, colors, elevation, size, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { PASOS, PasoGuia } from '@components/molecules/PasoGuia';
import { Icon } from '@components/atoms/Icon';
import { fechaLocal } from '@dominio/fecha';
import { useCrecemos } from '@context/CrecemosProvider';
import { useBarraOculta } from '@context/BarraOcultaContext';
import { useMedidasBarra } from '@hooks/useMedidasBarra';
import { movimientoReducido } from '@hooks/useMovimientoReducido';
import { useTecladoVisible } from '@hooks/useTecladoVisible';
import {
  AIRE_ETIQUETA,
  ALTO_RANURA,
  DIAMETRO_CENTRO,
  rellenoInferior,
  SALIENTE,
} from '@navigation/medidasBarra';

// Las medidas viven en @navigation/medidasBarra (las pantallas las leen con useMedidasBarra).
export { DIAMETRO_CENTRO, rellenoInferior };

/** La ranura central es un poco más ancha: "Cerrar día" cabe entera a 14 px en 360 dp. */
const PESO_CENTRO = 1.2;

export const ETIQUETA_CERRAR = 'Cerrar día';
export const ETIQUETA_CERRADO = 'Hoy ✓';

interface Ranura {
  etiqueta: string;
  icono: LucideIcon;
  testID: string;
}

const RANURAS: Record<string, Ranura> = {
  Inicio: { etiqueta: 'Inicio', icono: House, testID: 'tab-inicio' },
  Historial: { etiqueta: 'Historial', icono: History, testID: 'tab-historial' },
  Resumen: { etiqueta: 'Resumen', icono: ChartColumn, testID: 'tab-resumen' },
  Asistente: { etiqueta: 'Asistente', icono: Bot, testID: 'tab-asistente' },
};

/** Las etiquetas de la barra NO crecen con la fuente del sistema: cinco ranuras en 360 dp. */
const ESCALA_MAXIMA = 1;

export const BarraNavegacion = ({ state, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const { cierres } = useCrecemos();
  const hoyCerrado = cierres.some(c => c.fecha === fechaLocal(new Date()));
  // Con el teclado abierto la barra se esconde: en Android con borde a borde el teclado se dibuja
  // encima de la app y la barra (una capa absoluta) quedaría tapada o flotando sobre el formulario.
  const teclado = useTecladoVisible();
  // Al bajar el scroll la barra se desliza hacia abajo hasta salir de pantalla; al subir vuelve.
  const { oculta, mostrar } = useBarraOculta();
  const { alturaTotal } = useMedidasBarra();
  const bajada = oculta.interpolate({ inputRange: [0, 1], outputRange: [0, alturaTotal] });
  // Al cerrar el día el círculo hace un "pop" (rebota un poco) para confirmar que quedó hecho.
  // Solo cuando pasa de abierto a cerrado estando la app en pantalla, no al arrancar ya cerrado.
  const pop = useRef(new Animated.Value(1)).current;
  const estabaCerrado = useRef(hoyCerrado);
  useEffect(() => {
    if (hoyCerrado && !estabaCerrado.current) {
      let corriendo: Animated.CompositeAnimation | null = null;
      let vivo = true;
      movimientoReducido().then(reducido => {
        if (!vivo || reducido) return;
        pop.setValue(0.8);
        corriendo = Animated.spring(pop, {
          toValue: 1,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        });
        corriendo.start();
      });
      estabaCerrado.current = hoyCerrado;
      return () => {
        vivo = false;
        corriendo?.stop();
      };
    }
    estabaCerrado.current = hoyCerrado;
    return undefined;
  }, [hoyCerrado, pop]);
  // Cambiar de pestaña siempre la devuelve: la pantalla nueva empieza arriba.
  const indice = state.index;
  useEffect(() => {
    mostrar();
  }, [indice, mostrar]);

  const irA = (nombre: string, clave: string) => {
    const evento = navigation.emit({ type: 'tabPress', target: clave, canPreventDefault: true });
    const enfocada = state.routes[state.index]?.name === nombre;
    if (!enfocada && !evento.defaultPrevented) {
      navigation.dispatch({ ...CommonActions.navigate(nombre), target: state.key });
    }
  };

  // Abre "Cerrar día" encima de las pestañas: la acción sube hasta el stack raíz.
  const cerrarDia = () => navigation.dispatch(CommonActions.navigate({ name: 'CerrarDia' }));

  const pestana = (clave: string) => {
    const ruta = state.routes.find(r => r.key === clave);
    if (!ruta) return null;
    const ranura = RANURAS[ruta.name];
    if (!ranura) return null;
    const seleccionada = state.routes[state.index]?.key === clave;
    const tab = (
      <Pressable
        key={clave}
        accessibilityRole="tab"
        accessibilityLabel={ranura.etiqueta}
        accessibilityState={{ selected: seleccionada }}
        onPress={() => irA(ruta.name, clave)}
        style={[styles.ranura, ruta.name !== 'Asistente' && styles.ranuraSuelta]}
        testID={ranura.testID}
      >
        <Icon
          icon={ranura.icono}
          color={seleccionada ? 'primary' : 'textMuted'}
          size="lg"
          strokeWidth={seleccionada ? 2.5 : 2}
        />
        <Text
          variant={seleccionada ? 'captionStrong' : 'caption'}
          color={seleccionada ? 'primary' : 'textMuted'}
          numberOfLines={1}
          maxFontSizeMultiplier={ESCALA_MAXIMA}
        >
          {ranura.etiqueta}
        </Text>
      </Pressable>
    );
    // La pestaña del Asistente es un paso del recorrido (el resto de pestañas no se señalan).
    return ruta.name === 'Asistente' ? (
      <PasoGuia key={clave} {...PASOS.asistente} style={styles.guia}>
        {tab}
      </PasoGuia>
    ) : (
      tab
    );
  };

  const [inicio, historial, resumen, asistente] = state.routes.map(r => r.key);
  const etiquetaCentro = hoyCerrado ? ETIQUETA_CERRADO : ETIQUETA_CERRAR;

  if (teclado.visible) return null;

  return (
    <Animated.View
      style={[
        styles.barra,
        { paddingBottom: rellenoInferior(insets.bottom) },
        { transform: [{ translateY: bajada }] },
      ]}
      pointerEvents="box-none"
      testID="barra-navegacion"
    >
      <View style={styles.fondo} pointerEvents="none" />
      {pestana(inicio)}
      {pestana(historial)}
      <PasoGuia {...PASOS.cerrarDia} style={styles.guiaCentro}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hoyCerrado ? 'Hoy ya cerraste. Toca para editar tu día' : 'Cerrar día'}
        onPress={cerrarDia}
        style={styles.centro}
        testID="tab-cerrar-dia"
      >
        {({ pressed }) => (
          <>
            <Animated.View
              style={[
                styles.circulo,
                pressed && styles.circuloPresionado,
                { transform: [{ scale: pop }] },
              ]}
            >
              <Icon icon={hoyCerrado ? Check : ClipboardCheck} color="textInverse" size="xl" />
            </Animated.View>
            <Text
              variant="captionStrong"
              color="primary"
              numberOfLines={1}
              maxFontSizeMultiplier={ESCALA_MAXIMA}
              testID="tab-cerrar-dia-etiqueta"
            >
              {etiquetaCentro}
            </Text>
          </>
        )}
      </Pressable>
      </PasoGuia>
      {pestana(resumen)}
      {pestana(asistente)}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // La barra es una CAPA sobre el contenido (absoluta, pegada abajo) y su propio fondo es
  // transparente: la zona de arriba, donde solo sobresale el círculo, deja ver el contenido que
  // sigue pasando por debajo. Las pantallas le dejan sitio con useMedidasBarra.
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.xs,
  },
  // El único fondo sólido: arranca por debajo del tope del círculo ("sobresale" de la barra).
  fondo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: SALIENTE,
    backgroundColor: colors.background,
    borderTopWidth: border.thin,
    borderTopColor: colors.border,
  },
  // El envoltorio del recorrido reparte el ancho igual que la ranura que envuelve.
  guia: { flex: 1 },
  guiaCentro: { flex: PESO_CENTRO },
  // Todas las ranuras anclan su contenido abajo con el mismo aire: la etiqueta de cada una cae en
  // la misma fila, dentro de la barra y por encima del inset inferior.
  ranura: {
    height: ALTO_RANURA,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: AIRE_ETIQUETA,
    gap: spacing.xxs,
  },
  // Sin envoltorio del recorrido, la propia ranura reparte el ancho por igual.
  ranuraSuelta: { flex: 1 },
  // La central no es absoluta: está en la misma fila y solo su círculo sobresale hacia arriba.
  centro: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: AIRE_ETIQUETA,
    gap: spacing.xs,
  },
  circulo: {
    width: DIAMETRO_CENTRO,
    height: DIAMETRO_CENTRO,
    borderRadius: DIAMETRO_CENTRO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...elevation.md,
  },
  circuloPresionado: { backgroundColor: colors.primaryPressed },
});
