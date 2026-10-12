// src/components/organisms/BarraNavegacion/BarraNavegacion.tsx
// La barra inferior: Inicio · Historial · [Cerrar día] · Resumen · Asistente.
// "Cerrar día" es la acción principal de la app: va al centro, elevada, en el círculo magenta,
// y NO es una pestaña (abre el formulario encima de todo). Ningún ícono va solo: cada ranura lleva
// su etiqueta de texto de 14 px o más (UX, regla 1) y todo lo tocable mide 48 dp o más (regla 10).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Bot, ChartColumn, Check, ClipboardCheck, History, House } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { border, colors, elevation, size, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon } from '@components/atoms/Icon';
import { fechaLocal } from '@dominio/fecha';
import { useCrecemos } from '@context/CrecemosProvider';

/** Diámetro del círculo central. */
export const DIAMETRO_CENTRO = 64;
/** Cuánto sobresale el círculo por encima de la barra. */
const SALIENTE = 24;
/** Alto de las ranuras normales. */
const ALTO_RANURA = 68;

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

/** Las etiquetas de la barra crecen poco con la fuente grande: cinco ranuras en 360 dp. */
const ESCALA_MAXIMA = 1.2;

export const BarraNavegacion = ({ state, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const { cierres } = useCrecemos();
  const hoyCerrado = cierres.some(c => c.fecha === fechaLocal(new Date()));

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
    return (
      <Pressable
        key={clave}
        accessibilityRole="tab"
        accessibilityLabel={ranura.etiqueta}
        accessibilityState={{ selected: seleccionada }}
        onPress={() => irA(ruta.name, clave)}
        style={styles.ranura}
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
  };

  const [inicio, historial, resumen, asistente] = state.routes.map(r => r.key);
  const etiquetaCentro = hoyCerrado ? ETIQUETA_CERRADO : ETIQUETA_CERRAR;

  return (
    <View style={[styles.barra, { paddingBottom: insets.bottom }]} testID="barra-navegacion">
      <View style={styles.fondo} pointerEvents="none" />
      {pestana(inicio)}
      {pestana(historial)}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hoyCerrado ? 'Hoy ya cerraste. Toca para editar tu día' : 'Cerrar día'}
        onPress={cerrarDia}
        style={styles.centro}
        testID="tab-cerrar-dia"
      >
        {({ pressed }) => (
          <>
            <View style={[styles.circulo, pressed && styles.circuloPresionado]}>
              <Icon icon={hoyCerrado ? Check : ClipboardCheck} color="textInverse" size="xl" />
            </View>
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
      {pestana(resumen)}
      {pestana(asistente)}
    </View>
  );
};

const styles = StyleSheet.create({
  barra: { flexDirection: 'row', alignItems: 'flex-end' },
  // El fondo arranca por debajo del tope del círculo: el círculo "sobresale" de la barra.
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
  ranura: {
    flex: 1,
    height: ALTO_RANURA,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  centro: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: spacing.xs,
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
