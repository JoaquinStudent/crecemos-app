// src/screens/PerfilScreen.tsx
// "Mi perfil": la foto y el nombre de quien usa la app arriba y, debajo, un menú limpio de opciones.
// Cada opción abre su propia pantalla (Mis datos, Cómo me pagan, Recordatorio diario, Mis productos,
// Borrar datos, Ayuda): aquí no hay formularios ni interruptores, solo filas con un resumen vivo.
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BellRing,
  ChevronLeft,
  CircleHelp,
  Package,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon } from '@components/atoms/Icon';
import { AvatarConCamara } from '@components/molecules/AvatarConCamara';
import { OpcionPerfil } from '@components/molecules/OpcionPerfil';
import { FotoPerfilSheet } from '@components/organisms/FotoPerfilSheet';
import {
  RESUMEN_AYUDA,
  resumenBorrar,
  resumenConfiguracion,
  resumenDatos,
  resumenPagos,
  resumenProductos,
  resumenRecordatorio,
} from '@dominio/perfilResumen';
import { useFotoPerfil } from '@hooks/useFotoPerfil';
import { useCrecemos } from '@context/CrecemosProvider';
import type { RootStackParamList, SeccionPerfil } from '@navigation/RootStack';

export const PerfilScreen = () => {
  const { perfil, productos, datosDeEjemplo } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Perfil'>>();
  const foto = useFotoPerfil();
  const ir = (seccion: SeccionPerfil) => () => navigation.navigate(seccion);

  // El encabezado de Perfil es magenta: con íconos oscuros la barra de estado no se lee. Mientras
  // esta pantalla está al frente se pide el estilo claro; al salir se restaura el oscuro de la app.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      return () => StatusBar.setBarStyle('dark-content');
    }, []),
  );

  return (
    <View style={styles.pantalla}>
      <ScrollView contentContainerStyle={styles.scroll} testID="perfil-scroll">
        <SafeAreaView edges={['top']} style={styles.encabezado}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atrás"
            onPress={() => navigation.goBack()}
            style={styles.atras}
            testID="perfil-atras"
          >
            <Icon icon={ChevronLeft} color="textInverse" size="lg" />
            <Text variant="bodyStrong" color="textInverse">
              Atrás
            </Text>
          </Pressable>
          <AvatarConCamara
            perfil={perfil}
            tamano={96}
            fondo="primaryPressed"
            borde={3}
            textoVariant="display"
            testIDFoto="perfil-avatar-foto"
            testIDIniciales="perfil-iniciales"
            onCamara={foto.abrir}
            disabled={foto.abriendo}
            camaraTestID="perfil-camara"
          />
          <Text variant="h2" color="textInverse" align="center" testID="perfil-nombre">
            {perfil.nombre || 'Agrega tu nombre'}
          </Text>
          {perfil.negocio ? (
            <Text color="textInverse" align="center">
              {perfil.negocio}
            </Text>
          ) : null}
          {foto.error ? (
            <Text variant="bodySmall" color="textInverse" align="center" testID="perfil-foto-error">
              {foto.error}
            </Text>
          ) : null}
        </SafeAreaView>

        <View style={styles.menu} testID="perfil-menu">
          <OpcionPerfil
            icon={UserRound}
            title="Mis datos"
            summary={resumenDatos(perfil)}
            onPress={ir('PerfilDatos')}
            testID="perfil-opcion-datos"
          />
          <OpcionPerfil
            icon={Wallet}
            title="Cómo me pagan"
            summary={resumenPagos(perfil)}
            onPress={ir('PerfilPagos')}
            testID="perfil-opcion-pagos"
          />
          <OpcionPerfil
            icon={BellRing}
            title="Recordatorio diario"
            summary={resumenRecordatorio(perfil)}
            onPress={ir('PerfilRecordatorio')}
            testID="perfil-opcion-recordatorio"
          />
          <OpcionPerfil
            icon={Package}
            title="Mis productos"
            summary={resumenProductos(productos)}
            onPress={ir('PerfilProductos')}
            testID="perfil-opcion-productos"
          />
          <OpcionPerfil
            icon={SlidersHorizontal}
            title="Configuración"
            summary={resumenConfiguracion(perfil)}
            onPress={ir('PerfilConfiguracion')}
            testID="perfil-opcion-configuracion"
          />
          <OpcionPerfil
            icon={Trash2}
            title="Borrar datos"
            summary={resumenBorrar(datosDeEjemplo)}
            onPress={ir('PerfilBorrarDatos')}
            testID="perfil-opcion-borrar"
          />
          <OpcionPerfil
            icon={CircleHelp}
            title="Ayuda"
            summary={RESUMEN_AYUDA}
            onPress={ir('PerfilAyuda')}
            divider={false}
            testID="perfil-opcion-ayuda"
          />
        </View>
      </ScrollView>

      <FotoPerfilSheet foto={foto} />
    </View>
  );
};

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xxl },
  encabezado: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  atras: {
    alignSelf: 'flex-start',
    minHeight: 48,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -spacing.xs,
  },
  menu: {
    margin: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
