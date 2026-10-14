// src/components/organisms/SplashAnimado/SplashAnimado.tsx
// El splash de la marca. El del sistema (Android) muestra el logo sobre el magenta; este pinta
// EXACTAMENTE lo mismo (mismo color, mismo tamaño, mismo lugar) justo debajo y recién entonces
// avisa para quitar el nativo: de uno a otro no hay salto ni parpadeo. Desde ahí el logo "crece"
// despacio (la idea de la marca) mientras carga la app y, al terminar, se agranda un poco más y se
// desvanece. Con "Reducir movimiento" no se anima: queda quieto y se quita.
// No es interactivo ni lo anuncia el lector de pantalla: es decoración de unos segundos.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '@theme';
import { ocultarSplashNativo } from '@services/splash';
import { movimientoReducido } from '@hooks/useMovimientoReducido';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../../../assets/icono/splash-logo.png');

/** Lado del logo en dp: el ícono del splash de Android 12+ mide 288 dp. */
const LADO = 288;
/** Lo mínimo que se ve la marca, aunque la app cargue antes. */
export const MINIMO_MS = 1100;
const CRECE_HASTA = 1.08;
const SALE_HASTA = 1.25;
export const SALIDA_MS = 380;
/** Si la imagen no avisa que cargó, se sigue igual (nunca queda el splash colgado). */
const ESPERA_IMAGEN_MS = 500;

export interface SplashAnimadoProps {
  /** La app ya tiene sus datos: el splash puede irse (después del mínimo). */
  listo: boolean;
}

export const SplashAnimado = ({ listo }: SplashAnimadoProps) => {
  const [visible, setVisible] = useState(true);
  const [pintado, setPintado] = useState(false);
  const [minimoCumplido, setMinimoCumplido] = useState(false);
  const escala = useRef(new Animated.Value(1)).current;
  const opacidad = useRef(new Animated.Value(1)).current;

  // Por si la imagen nunca avisa (no pasa en Android, pero así no hay nada que se cuelgue).
  useEffect(() => {
    const id = setTimeout(() => setPintado(true), ESPERA_IMAGEN_MS);
    return () => clearTimeout(id);
  }, []);

  // El logo ya está pintado: se quita el splash del sistema y empieza a "crecer".
  useEffect(() => {
    if (!pintado) return undefined;
    let vivo = true;
    ocultarSplashNativo();
    const id = setTimeout(() => setMinimoCumplido(true), MINIMO_MS);
    movimientoReducido().then(reducido => {
      if (!vivo || reducido) return;
      Animated.timing(escala, {
        toValue: CRECE_HASTA,
        duration: MINIMO_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [pintado, escala]);

  // Listo y cumplido el mínimo: se agranda un poco más y se desvanece.
  useEffect(() => {
    if (!listo || !minimoCumplido) return undefined;
    let vivo = true;
    movimientoReducido().then(reducido => {
      if (!vivo) return;
      if (reducido) {
        setVisible(false);
        return;
      }
      Animated.parallel([
        Animated.timing(escala, {
          toValue: SALE_HASTA,
          duration: SALIDA_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacidad, {
          toValue: 0,
          duration: SALIDA_MS,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && vivo) setVisible(false);
      });
    });
    return () => {
      vivo = false;
    };
  }, [listo, minimoCumplido, escala, opacidad]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.fondo, { opacity: opacidad }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID="splash-animado"
    >
      <View style={styles.centro}>
        <Animated.Image
          source={LOGO}
          style={[styles.logo, { transform: [{ scale: escala }] }]}
          onLoad={() => setPintado(true)}
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fondo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.splash,
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LADO, height: LADO },
});
