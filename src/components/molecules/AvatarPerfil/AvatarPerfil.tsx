// src/components/molecules/AvatarPerfil/AvatarPerfil.tsx
// El círculo de "Mi perfil": la foto si hay una válida; si no (o si no carga), la inicial.
// Qué mostrar lo decide el dominio (`avatarDe`); aquí solo se dibuja.
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { colors, ColorName, radius, TypographyVariant } from '@theme';
import { Text } from '@components/atoms/Text';
import { avatarDe } from '@dominio/foto';
import { inicialesAvatar } from '@dominio/perfil';
import type { Perfil } from '@dominio/tipos';

export interface AvatarPerfilProps {
  perfil: Perfil | null;
  /** Alto y ancho del círculo, en dp. */
  tamano: number;
  /** Fondo del círculo de la inicial. */
  fondo?: ColorName;
  /** Grosor del borde blanco, en dp. 0 = sin borde. */
  borde?: number;
  /** Estilo de la letra de la inicial. */
  textoVariant?: TypographyVariant;
  testIDFoto?: string;
  testIDIniciales?: string;
}

export const AvatarPerfil = ({
  perfil,
  tamano,
  fondo = 'primary',
  borde = 0,
  textoVariant = 'bodyStrong',
  testIDFoto,
  testIDIniciales,
}: AvatarPerfilProps) => {
  // La foto cuya carga falló: si llega otra distinta, se vuelve a intentar.
  const [fallida, setFallida] = useState<string | null>(null);
  const avatar = avatarDe(perfil);
  const circulo = {
    width: tamano,
    height: tamano,
    borderRadius: radius.full,
    borderWidth: borde,
    borderColor: colors.background,
  };

  if (avatar.tipo === 'foto' && avatar.uri !== fallida) {
    return (
      <Image
        source={{ uri: avatar.uri }}
        resizeMode="cover"
        accessibilityLabel="Foto de perfil"
        onError={() => setFallida(avatar.uri)}
        style={[circulo, styles.foto]}
        testID={testIDFoto}
      />
    );
  }

  // Sin foto, o con una foto que no cargó: la inicial del nombre.
  const letra = avatar.tipo === 'iniciales' ? avatar.texto : inicialesAvatar(perfil?.nombre ?? '');
  return (
    <View style={[circulo, styles.iniciales, { backgroundColor: colors[fondo] }]}>
      <Text variant={textoVariant} color="textInverse" testID={testIDIniciales}>
        {letra}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  foto: { backgroundColor: colors.surfacePressed },
  iniciales: { alignItems: 'center', justifyContent: 'center' },
});
