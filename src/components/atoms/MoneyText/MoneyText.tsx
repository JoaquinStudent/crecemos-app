// src/components/atoms/MoneyText/MoneyText.tsx
// Un monto en soles: signo explícito (+ / −), color semántico y cifras tabulares.
// El color nunca es la única señal (UX, regla 6): el signo y el prefijo "S/" siempre van.
// Una línea que se achica antes de desbordar (360dp con fuente grande).
import { TextStyle, StyleProp } from 'react-native';
import { ColorName, TypographyVariant } from '@theme';
import { Text } from '@components/atoms/Text';
import { formatoSoles } from '@dominio/formato';

export type MoneyTone = 'auto' | 'ingreso' | 'gasto' | 'neutral';

export interface MoneyTextProps {
  /** Monto en soles. Con tono `auto` el signo sale del número; con `gasto` se muestra como salida. */
  monto: number;
  /**
   * `auto`: verde si es positivo, rojo si es negativo, texto si es cero.
   * `ingreso` / `gasto`: fuerzan el sentido (`gasto` muestra "− S/ …" aunque el monto venga positivo).
   * `neutral`: sin signo ni color semántico.
   */
  tone?: MoneyTone;
  variant?: TypographyVariant;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

const MENOS = '−';

export const signoDe = (monto: number, tone: MoneyTone): '+' | typeof MENOS | '' => {
  if (tone === 'neutral') return '';
  if (tone === 'gasto') return monto === 0 ? '' : MENOS;
  if (tone === 'ingreso') return monto === 0 ? '' : '+';
  return monto === 0 ? '' : monto < 0 ? MENOS : '+';
};

const colorDe = (monto: number, tone: MoneyTone): ColorName => {
  if (tone === 'neutral' || monto === 0) return 'text';
  if (tone === 'gasto') return 'danger';
  if (tone === 'ingreso') return 'success';
  return monto < 0 ? 'danger' : 'success';
};

export const textoMonto = (monto: number, tone: MoneyTone = 'auto'): string => {
  const signo = signoDe(monto, tone);
  const cuerpo = formatoSoles(Math.abs(monto));
  return signo ? `${signo} ${cuerpo}` : cuerpo;
};

export const MoneyText = ({
  monto,
  tone = 'auto',
  variant = 'amount',
  style,
  testID,
}: MoneyTextProps) => (
  <Text
    variant={variant}
    color={colorDe(monto, tone)}
    numberOfLines={1}
    adjustsFontSizeToFit
    minimumFontScale={0.7}
    style={[{ fontVariant: ['tabular-nums'] }, style]}
    testID={testID}
  >
    {textoMonto(monto, tone)}
  </Text>
);
