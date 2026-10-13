// src/components/organisms/FotoPerfilSheet/FotoPerfilSheet.tsx
// La hoja que se abre con el botón de cámara: "Elegir de la galería", "Tomar foto" y, solo si ya
// hay foto, "Quitar foto" (que antes pregunta diciendo qué pasa). Siempre hay un "Cancelar" con
// texto: tocar fuera también cierra, pero esa no es la única vía (UX, regla 3).
// El estado vive en `useFotoPerfil`; aquí solo se dibuja.
import { StyleSheet } from 'react-native';
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { MensajeError } from '@components/atoms/MensajeError';
import { BottomSheet } from '@components/organisms/BottomSheet';
import type { FotoPerfil } from '@hooks/useFotoPerfil';

export interface FotoPerfilSheetProps {
  foto: FotoPerfil;
}

export const FotoPerfilSheet = ({ foto }: FotoPerfilSheetProps) => (
  <BottomSheet
    visible={foto.paso !== null}
    onClose={foto.cerrar}
    accessibilityLabel="Foto de perfil"
    testID="perfil-foto-hoja"
  >
    {foto.paso === 'quitar' ? (
      <>
        <Text variant="h3" accessibilityRole="header">
          Quitar foto
        </Text>
        <Text testID="perfil-foto-quitar-pregunta">¿Quitar tu foto? Se va a ver tu inicial.</Text>
        <MensajeError mensaje={foto.quitar.mensajeError} testID="perfil-foto-quitar-error" />
        <Button
          title="Sí, quitar"
          variant="danger"
          fullWidth
          loading={foto.quitar.ejecutando}
          onPress={() => foto.quitar.ejecutar()}
          testID="perfil-foto-quitar-si"
        />
        <Button
          title="No, dejarla"
          variant="outline"
          fullWidth
          onPress={foto.cerrar}
          testID="perfil-foto-quitar-no"
        />
      </>
    ) : (
      <>
        <Text variant="h3" accessibilityRole="header">
          Foto de perfil
        </Text>
        <Button
          title="Elegir de la galería"
          variant="outline"
          fullWidth
          leftIcon={ImageIcon}
          disabled={foto.abriendo}
          onPress={() => foto.elegir('galeria')}
          testID="perfil-foto-galeria"
        />
        <Button
          title="Tomar foto"
          variant="outline"
          fullWidth
          leftIcon={Camera}
          disabled={foto.abriendo}
          onPress={() => foto.elegir('camara')}
          testID="perfil-foto-camara"
        />
        {foto.hayFoto ? (
          <Button
            title="Quitar foto"
            variant="dangerGhost"
            fullWidth
            leftIcon={Trash2}
            disabled={foto.abriendo}
            onPress={foto.pedirQuitar}
            testID="perfil-foto-quitar"
          />
        ) : null}
        <Button
          title="Cancelar"
          variant="ghost"
          fullWidth
          onPress={foto.cerrar}
          style={styles.cancelar}
          testID="perfil-foto-cancelar"
        />
      </>
    )}
  </BottomSheet>
);

const styles = StyleSheet.create({
  cancelar: { marginTop: spacing.xs },
});
