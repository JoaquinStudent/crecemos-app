// src/components/atoms/Text/Text.tsx
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { colors, ColorName } from '@theme/colors';
import { typography, TypographyVariant } from '@theme/typography';
import { escalarTexto, VARIANTES_QUE_NO_SE_ENCOGEN } from '@dominio/ajustes';
import { useAjustesVisuales } from '@context/AjustesVisualesContext';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: ColorName;
  align?: 'left' | 'center' | 'right';
  /** Ignora el tamaño de letra elegido (la barra inferior no crece: cinco ranuras en 360 dp). */
  sinEscalar?: boolean;
}

export const Text = ({
  variant = 'body',
  color = 'text',
  align,
  sinEscalar = false,
  style,
  maxFontSizeMultiplier = 1.6,
  children,
  ...rest
}: TextProps) => {
  // El tamaño de letra que eligió la persona (Perfil → Configuración) escala toda la tipografía.
  const { escala: elegida } = useAjustesVisuales();
  const escala = sinEscalar ? 1 : elegida;
  return (
    <RNText
      style={[
        escalarTexto(typography[variant], escala, VARIANTES_QUE_NO_SE_ENCOGEN.has(variant)),
        { color: colors[color] },
        align && { textAlign: align },
        style,
      ]}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
    >
      {children}
    </RNText>
  );
};
