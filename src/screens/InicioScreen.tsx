// src/screens/InicioScreen.tsx
// Responde "¿cómo me fue?": cuánto te queda del último día cerrado.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { calcularCierre } from '@dominio/cierre';
import { formatoSoles } from '@dominio/formato';
import { inicialesAvatar } from '@dominio/perfil';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList } from '@navigation/RootStack';
import type { TabsParamList } from '@navigation/Tabs';
import { fechaEnPalabras } from './fechaEnPalabras';

type InicioNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabsParamList, 'Inicio'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export const InicioScreen = () => {
  const { cierres, perfil, cargando } = useCrecemos();
  const navigation = useNavigation<InicioNavigation>();

  // 'YYYY-MM-DD' ordena igual como texto que como fecha.
  const ultimo = cierres.reduce<(typeof cierres)[number] | null>(
    (masReciente, c) => (masReciente === null || c.fecha > masReciente.fecha ? c : masReciente),
    null,
  );

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.encabezado}>
          <Text variant="h1">Inicio</Text>
          {/* El círculo nunca va solo: lleva debajo su etiqueta (UX, regla 1). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mi perfil"
            onPress={() => navigation.navigate('Perfil')}
            style={styles.perfil}
            testID="abrir-perfil"
          >
            <View style={styles.avatar}>
              <Text variant="bodyStrong" color="textInverse" testID="inicio-avatar-iniciales">
                {inicialesAvatar(perfil.nombre)}
              </Text>
            </View>
            <Text variant="caption" color="primary">
              Mi perfil
            </Text>
          </Pressable>
        </View>

        {cargando ? null : ultimo ? (
          <ResumenDelDia fecha={ultimo.fecha} resumen={calcularCierre(ultimo)} />
        ) : (
          <View style={styles.tarjeta}>
            <Text variant="h3">Aún no cierras ningún día</Text>
            <Text color="textMuted" style={styles.separado}>
              Cuando cierres tu día, aquí vas a ver cuánto te queda: lo que vendiste menos lo que
              gastaste.
            </Text>
            <Button
              title="Cerrar mi día"
              size="lg"
              fullWidth
              style={styles.separado}
              testID="inicio-cerrar-dia"
              onPress={() => navigation.navigate('CerrarDia')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const ResumenDelDia = ({
  fecha,
  resumen,
}: {
  fecha: string;
  resumen: ReturnType<typeof calcularCierre>;
}) => (
  <View style={styles.tarjeta}>
    <Text variant="label" color="textMuted">
      Tu último día · {fechaEnPalabras(fecha)}
    </Text>
    <Text variant="bodyStrong" style={styles.separado}>
      Te queda
    </Text>
    <Text
      variant="hero"
      color={resumen.teQueda < 0 ? 'danger' : 'success'}
      testID="inicio-te-queda"
      adjustsFontSizeToFit
      numberOfLines={1}
    >
      {formatoSoles(resumen.teQueda)}
    </Text>
    <View style={[styles.fila, styles.separado]}>
      <View style={styles.columna}>
        <Text variant="label" color="textMuted">
          Vendiste
        </Text>
        <Text variant="h3" color="success">
          + {formatoSoles(resumen.venta)}
        </Text>
      </View>
      <View style={styles.columna}>
        <Text variant="label" color="textMuted">
          Gastaste
        </Text>
        <Text variant="h3" color="danger">
          − {formatoSoles(resumen.gastoTotal)}
        </Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  contenido: { padding: spacing.lg, gap: spacing.xl },
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  perfil: { minWidth: 48, minHeight: 48, alignItems: 'center', gap: spacing.xxs },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjeta: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  separado: { marginTop: spacing.md },
  fila: { flexDirection: 'row', gap: spacing.lg },
  columna: { flex: 1 },
});
