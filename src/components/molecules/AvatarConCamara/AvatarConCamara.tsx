// src/components/molecules/AvatarConCamara/AvatarConCamara.tsx
// La foto (o inicial) de "Mi perfil" con un botón redondo de cámara sobre su esquina inferior
// derecha. Al tocarlo se abre la hoja con las opciones de la foto.
// El botón es SOLO un ícono: es una excepción pedida expresamente por el usuario a la regla 1 de
// UX ("ningún ícono suelto"). Por eso su etiqueta de accesibilidad es obligatoria y fija: es lo
// que lee TalkBack. Se ve de 40 dp y, con hitSlop, se toca en 48 dp.
import { Pressable, StyleSheet, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import { border, colors, radius, spacing } from '@theme';
import { Icon } from '@components/atoms/Icon';
import { AvatarPerfil, AvatarPerfilProps } from '@components/molecules/AvatarPerfil';

export interface AvatarConCamaraProps extends AvatarPerfilProps {
  onCamara: () => void;
  disabled?: boolean;
  camaraTestID?: string;
}

export const DIAMETRO_BOTON_CAMARA = 40;
const MARGEN_TACTIL = 4;

export const AvatarConCamara = ({
  onCamara,
  disabled = false,
  camaraTestID,
  ...avatar
}: AvatarConCamaraProps) => (
  <View style={{ width: avatar.tamano, height: avatar.tamano }}>
    <AvatarPerfil {...avatar} />
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cambiar foto"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={MARGEN_TACTIL}
      onPress={onCamara}
      style={({ pressed }) => [styles.boton, pressed && styles.presionado, disabled && styles.apagado]}
      testID={camaraTestID}
    >
      <Icon icon={Camera} size="md" color={disabled ? 'disabledText' : 'primary'} />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  boton: {
    position: 'absolute',
    right: -spacing.xs,
    bottom: -spacing.xs,
    width: DIAMETRO_BOTON_CAMARA,
    height: DIAMETRO_BOTON_CAMARA,
    borderRadius: radius.full,
    borderWidth: border.thin,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presionado: { backgroundColor: colors.primarySoft },
  apagado: { backgroundColor: colors.disabledBg },
});
