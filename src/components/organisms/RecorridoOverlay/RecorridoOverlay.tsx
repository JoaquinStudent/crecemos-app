// src/components/organisms/RecorridoOverlay/RecorridoOverlay.tsx
// El recorrido guiado dibujado: la pantalla atenuada con un hueco sobre lo que se señala (cuatro
// vistas oscuras alrededor del rectángulo, sin SVG) y una tarjeta con el paso. Reglas de UX:
//  - todo botón lleva texto; "Saltar recorrido" siempre está a la vista y mide 48 dp;
//  - nada avanza solo: ni temporizadores ni animaciones (por eso no hay nada que reducir);
//  - la tarjeta se pone del lado con más espacio, nunca encima de lo señalado;
//  - el lector de pantalla queda atrapado aquí (accessibilityViewIsModal) y oye el título primero.
import React, { ComponentRef, useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { border, colors, elevation, radius, size, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import type { Rect } from '@components/molecules/PasoGuia';

/** Aire entre lo señalado y el borde del hueco. */
const MARGEN_HUECO = spacing.sm;
/** En la barra de abajo: solo aire vertical; a los lados el hueco no pasa de lo medido (no tapa las etiquetas vecinas). */
const MARGEN_HUECO_BARRA = spacing.xs;
/** Separación entre el hueco y la tarjeta. */
const SEPARACION = spacing.md;
/** La tarjeta nunca se achica de esto (aunque haya poco espacio), con scroll adentro. */
const ALTO_MINIMO = 160;

export interface RecorridoOverlayProps {
  rect: Rect;
  /** Posición del paso (desde 0) y cuántos hay: "Paso 2 de 5". */
  indice: number;
  total: number;
  titulo: string;
  texto: string;
  alSiguiente: () => void;
  alAtras: () => void;
  alSaltar: () => void;
  /** El hueco se dibujó o cambió: pide medir otra vez lo señalado. */
  alRemedir?: () => void;
}

export const RecorridoOverlay = ({
  rect,
  indice,
  total,
  titulo,
  texto,
  alSiguiente,
  alAtras,
  alSaltar,
  alRemedir,
}: RecorridoOverlayProps) => {
  const { width: ancho, height: alto } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tituloRef = useRef<ComponentRef<typeof View>>(null);
  const esUltimo = indice === total - 1;

  // Al cambiar de paso, el lector de pantalla salta al título de la tarjeta.
  useEffect(() => {
    try {
      const nodo = findNodeHandle(tituloRef.current);
      if (nodo) AccessibilityInfo.setAccessibilityFocus(nodo);
    } catch {
      // Sin lector de pantalla (o sin nodo nativo) no hay foco que mover.
    }
  }, [indice]);

  // Lo que llega hasta la barra de abajo lleva un margen más justo; el hueco siempre cabe en la ventana.
  const enBarra = rect.y + rect.height >= alto - insets.bottom - size.touch;
  const margen = enBarra ? MARGEN_HUECO_BARRA : MARGEN_HUECO;
  const margenX = enBarra ? 0 : margen;
  const x = Math.min(ancho, Math.max(0, rect.x - margenX));
  const y = Math.min(alto, Math.max(0, rect.y - margen));
  const derecha = Math.max(x, Math.min(ancho, rect.x + rect.width + margenX));
  const abajoDelHueco = Math.max(y, Math.min(alto, rect.y + rect.height + margen));
  const anchoHueco = derecha - x;
  const altoHueco = abajoDelHueco - y;

  const espacioArriba = y - insets.top - SEPARACION;
  const espacioAbajo = alto - abajoDelHueco - insets.bottom - SEPARACION;
  const tarjetaAbajo = espacioAbajo >= espacioArriba;
  const espacio = Math.max(ALTO_MINIMO, tarjetaAbajo ? espacioAbajo : espacioArriba);
  const posicionTarjeta = tarjetaAbajo
    ? { top: abajoDelHueco + SEPARACION }
    : { bottom: alto - y + SEPARACION };

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      // Todo el overlay se traga los toques: el hueco no deja tocar lo señalado (es un recorrido).
      onStartShouldSetResponder={() => true}
      testID="recorrido-overlay"
    >
      <View style={[styles.velo, styles.veloArriba, { height: y }]} />
      <View style={[styles.velo, styles.veloAbajo, { top: abajoDelHueco }]} />
      <View style={[styles.velo, styles.veloIzquierda, { top: y, width: x, height: altoHueco }]} />
      <View style={[styles.velo, styles.veloDerecha, { top: y, left: derecha, height: altoHueco }]} />
      <View
        pointerEvents="none"
        style={[styles.marco, { top: y, left: x, width: anchoHueco, height: altoHueco }]}
        testID="recorrido-marco"
        onLayout={alRemedir}
      />

      <View
        style={[styles.tarjeta, posicionTarjeta, { maxHeight: espacio }]}
        accessibilityLabel={`Recorrido guiado. Paso ${indice + 1} de ${total}`}
        testID="recorrido-tarjeta"
      >
        <ScrollView bounces={false} contentContainerStyle={styles.contenido}>
          <Text variant="caption" color="textMuted" testID="recorrido-contador">
            {`Paso ${indice + 1} de ${total}`}
          </Text>
          <View ref={tituloRef} accessible accessibilityRole="header">
            <Text variant="h3" testID="recorrido-titulo">
              {titulo}
            </Text>
          </View>
          <Text testID="recorrido-texto">{texto}</Text>
          <View style={styles.botones}>
            {indice > 0 ? (
              <Button
                title="Atrás"
                variant="outline"
                onPress={alAtras}
                style={styles.boton}
                testID="recorrido-atras"
              />
            ) : null}
            <Button
              title={esUltimo ? 'Entendido' : 'Siguiente'}
              onPress={alSiguiente}
              style={styles.boton}
              testID="recorrido-siguiente"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Saltar recorrido"
            onPress={alSaltar}
            style={styles.saltar}
            testID="recorrido-saltar"
          >
            <Text variant="bodyStrong" color="primary">
              Saltar recorrido
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  velo: { position: 'absolute', backgroundColor: colors.overlay },
  veloArriba: { top: 0, left: 0, right: 0 },
  veloAbajo: { left: 0, right: 0, bottom: 0 },
  veloIzquierda: { left: 0 },
  veloDerecha: { right: 0 },
  marco: {
    position: 'absolute',
    borderWidth: border.thick,
    borderColor: colors.background,
    borderRadius: radius.md,
  },
  tarjeta: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    ...elevation.md,
  },
  contenido: { padding: spacing.lg, gap: spacing.sm },
  botones: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  boton: { flexGrow: 1 },
  saltar: {
    minHeight: size.touch,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
});
