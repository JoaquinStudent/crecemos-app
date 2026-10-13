// src/screens/PerfilScreen.tsx
// "Mi perfil": foto y datos de quien usa la app, cómo le pagan, el recordatorio diario, sus
// productos y los datos de ejemplo (cargarlos o borrarlos).
// Es la pantalla que hace posible el insight: sin precio y costo no hay "Te deja".
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, UserRound, Wallet, BellRing, Package, Trash2, CircleHelp } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { MensajeError } from '@components/atoms/MensajeError';
import { useAccionSegura } from '@hooks/useAccionSegura';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { AvatarPerfil } from '@components/molecules/AvatarPerfil';
import { OpcionPerfil } from '@components/molecules/OpcionPerfil';
import {
  RESUMEN_AYUDA,
  resumenBorrar,
  resumenDatos,
  resumenPagos,
  resumenProductos,
  resumenRecordatorio,
} from '@dominio/perfilResumen';
import { avatarDe } from '@dominio/foto';
import { useCrecemos } from '@context/CrecemosProvider';
import { elegirFoto, mensajeFoto } from '@services/foto';
import type { RootStackParamList } from '@navigation/RootStack';

export const PerfilScreen = () => {
  const { perfil, productos, guardarFoto, quitarFoto, datosDeEjemplo } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Perfil'>>();
  // El encabezado de Perfil es magenta: con íconos oscuros la barra de estado no se lee. Mientras
  // esta pantalla está al frente se pide el estilo claro; al salir se restaura el oscuro de la app.
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      return () => StatusBar.setBarStyle('dark-content');
    }, []),
  );


  const fotoSegura = useAccionSegura(async () => {
    await quitarFoto();
    setConfirmandoQuitar(false);
  }, 'No pudimos quitar tu foto. Inténtalo otra vez.');

  // Foto de perfil: se guarda al elegirla. Los botones dependen de si ya hay una foto válida.
  const hayFoto = avatarDe(perfil).tipo === 'foto';
  const [abriendoFoto, setAbriendoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [cambiandoFoto, setCambiandoFoto] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  // Un solo selector abierto a la vez, aunque el botón se toque dos veces antes de repintar.
  const selectorAbierto = useRef(false);

  const elegirLaFoto = async (origen: 'galeria' | 'camara') => {
    if (selectorAbierto.current) return;
    selectorAbierto.current = true;
    setAbriendoFoto(true);
    setErrorFoto(null);
    try {
      const resultado = await elegirFoto(origen);
      if (resultado.ok) {
        const guardada = await guardarFoto(resultado.fotoUri);
        if (guardada.ok) setCambiandoFoto(false);
        else setErrorFoto(guardada.errores.foto ?? mensajeFoto('INVALIDA'));
      } else if (resultado.motivo !== 'CANCELADA') {
        // Cancelar no es un error: no se dice nada.
        setErrorFoto(resultado.mensaje ?? mensajeFoto(resultado.motivo));
      }
    } catch {
      setErrorFoto(mensajeFoto('NO_SE_PUDO'));
    } finally {
      selectorAbierto.current = false;
      setAbriendoFoto(false);
    }
  };

  const pedirCambiarFoto = () => {
    setErrorFoto(null);
    setConfirmandoQuitar(false);
    setCambiandoFoto(true);
  };

  const pedirQuitarFoto = () => {
    setErrorFoto(null);
    setCambiandoFoto(false);
    setConfirmandoQuitar(true);
  };

  return (
    <View style={styles.pantalla}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        testID="perfil-scroll"
      >
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
          <AvatarPerfil
            perfil={perfil}
            tamano={96}
            fondo="primaryPressed"
            borde={3}
            textoVariant="display"
            testIDFoto="perfil-avatar-foto"
            testIDIniciales="perfil-iniciales"
          />
          <Text variant="h2" color="textInverse" align="center" testID="perfil-nombre">
            {perfil.nombre || 'Agrega tu nombre'}
          </Text>
          {perfil.negocio ? (
            <Text color="textInverse" align="center">
              {perfil.negocio}
            </Text>
          ) : null}

          {/* Cada acción de la foto lleva su texto: ningún ícono suelto (UX, regla 1). */}
          {hayFoto ? (
            <View style={styles.fotoAcciones}>
              <Button
                title="Cambiar foto"
                variant="secondary"
                disabled={abriendoFoto}
                onPress={pedirCambiarFoto}
                testID="perfil-foto-cambiar"
              />
              <Button
                title="Quitar foto"
                variant="secondary"
                disabled={abriendoFoto}
                onPress={pedirQuitarFoto}
                testID="perfil-foto-quitar"
              />
            </View>
          ) : (
            <View style={styles.fotoAcciones}>
              <Button
                title="Elegir de la galería"
                variant="secondary"
                disabled={abriendoFoto}
                onPress={() => elegirLaFoto('galeria')}
                testID="perfil-foto-galeria"
              />
              <Button
                title="Tomar foto"
                variant="secondary"
                disabled={abriendoFoto}
                onPress={() => elegirLaFoto('camara')}
                testID="perfil-foto-camara"
              />
            </View>
          )}

          {hayFoto && cambiandoFoto ? (
            <View style={styles.fotoPanel} testID="perfil-foto-cambiar-panel">
              <Button
                title="Elegir de la galería"
                variant="outline"
                fullWidth
                disabled={abriendoFoto}
                onPress={() => elegirLaFoto('galeria')}
                testID="perfil-foto-cambiar-galeria"
              />
              <Button
                title="Tomar foto"
                variant="outline"
                fullWidth
                disabled={abriendoFoto}
                onPress={() => elegirLaFoto('camara')}
                testID="perfil-foto-cambiar-camara"
              />
              <Button
                title="Cancelar"
                variant="ghost"
                fullWidth
                onPress={() => setCambiandoFoto(false)}
                testID="perfil-foto-cambiar-cancelar"
              />
            </View>
          ) : null}

          {hayFoto && confirmandoQuitar ? (
            <View style={styles.fotoPanel} testID="perfil-foto-quitar-panel">
              <Text align="center">¿Quitar tu foto? Se va a ver tu inicial.</Text>
              <Button
                title="Sí, quitar"
                variant="danger"
                fullWidth
                onPress={() => fotoSegura.ejecutar()}
                testID="perfil-foto-quitar-si"
              />
              <Button
                title="No, dejarla"
                variant="outline"
                fullWidth
                onPress={() => setConfirmandoQuitar(false)}
                testID="perfil-foto-quitar-no"
              />
            </View>
          ) : null}

          <MensajeError mensaje={fotoSegura.mensajeError} color="textInverse" testID="perfil-foto-quitar-error" />

          {errorFoto ? (
            <Text variant="bodySmall" color="textInverse" align="center" testID="perfil-foto-error">
              {errorFoto}
            </Text>
          ) : null}
        </SafeAreaView>

        <View style={styles.contenido}>
          <View style={styles.menu} testID="perfil-menu">
            <OpcionPerfil
              icon={UserRound}
              title="Mis datos"
              summary={resumenDatos(perfil)}
              onPress={() => navigation.navigate('PerfilDatos')}
              testID="perfil-opcion-datos"
            />
            <OpcionPerfil
              icon={Wallet}
              title="Cómo me pagan"
              summary={resumenPagos(perfil)}
              onPress={() => navigation.navigate('PerfilPagos')}
              testID="perfil-opcion-pagos"
            />
            <OpcionPerfil
              icon={BellRing}
              title="Recordatorio diario"
              summary={resumenRecordatorio(perfil)}
              onPress={() => navigation.navigate('PerfilRecordatorio')}
              testID="perfil-opcion-recordatorio"
            />
            <OpcionPerfil
              icon={Package}
              title="Mis productos"
              summary={resumenProductos(productos)}
              onPress={() => navigation.navigate('PerfilProductos')}
              testID="perfil-opcion-productos"
            />
            <OpcionPerfil
              icon={Trash2}
              title="Borrar datos"
              summary={resumenBorrar(datosDeEjemplo)}
              onPress={() => navigation.navigate('PerfilBorrarDatos')}
              testID="perfil-opcion-borrar"
            />
            <OpcionPerfil
              icon={CircleHelp}
              title="Ayuda"
              summary={RESUMEN_AYUDA}
              onPress={() => navigation.navigate('PerfilAyuda')}
              divider={false}
              testID="perfil-opcion-ayuda"
            />
          </View>
        </View>
      </ScrollView>
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
  fotoAcciones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fotoPanel: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  contenido: { padding: spacing.lg, gap: spacing.xl },
  menu: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
});
