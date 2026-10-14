// src/components/molecules/DatoEditable/DatoEditable.tsx
// Un dato suelto que se edita en su lugar: muestra la etiqueta y el valor (o una pista si está vacío)
// con un "Editar"; al tocarlo aparece el campo con "Guardar" y "Cancelar". Guarda con
// `useAccionSegura`, así que un fallo se dice en palabras claras en vez de callarse.
import { useState } from 'react';
import { KeyboardTypeOptions, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { MensajeError } from '@components/atoms/MensajeError';
import { useAccionSegura } from '@hooks/useAccionSegura';

export interface DatoEditableProps {
  /** Nombre corto del dato; arma los testID: `editar-<campo>`, `input-<campo>`, `valor-<campo>`... */
  campo: string;
  etiqueta: string;
  /** Lo que se lee cuando todavía no hay valor. */
  ayuda: string;
  valor?: string;
  /** Guarda el texto ya recortado. Si lanza, el aviso aparece bajo el campo. */
  onGuardar: (texto: string) => Promise<void>;
  /** Texto de error en palabras claras, o `null` si el valor es válido. */
  validar?: (texto: string) => string | null;
  /** Deja pasar solo dígitos (un número de teléfono). */
  soloDigitos?: boolean;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  style?: StyleProp<ViewStyle>;
}

export const DatoEditable = ({
  campo,
  etiqueta,
  ayuda,
  valor,
  onGuardar,
  validar,
  soloDigitos = false,
  maxLength,
  keyboardType = 'default',
  style,
}: DatoEditableProps) => {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState('');
  const [error, setError] = useState<string | undefined>();

  const guardar = useAccionSegura(async () => {
    const texto = borrador.trim();
    const problema = validar?.(texto) ?? null;
    if (problema) {
      setError(problema);
      return;
    }
    await onGuardar(texto);
    setEditando(false);
  });

  const abrir = () => {
    setBorrador(valor ?? '');
    setError(undefined);
    guardar.limpiarError();
    setEditando(true);
  };

  if (editando) {
    return (
      <View style={[styles.edicion, style]}>
        <Input
          label={etiqueta}
          value={borrador}
          onChangeText={texto => setBorrador(soloDigitos ? texto.replace(/\D/g, '') : texto)}
          error={error}
          autoFocus
          autoCapitalize={soloDigitos ? 'none' : 'words'}
          keyboardType={soloDigitos ? 'phone-pad' : keyboardType}
          maxLength={maxLength}
          testID={`input-${campo}`}
        />
        <View style={styles.acciones}>
          <Button
            title="Guardar"
            variant="outline"
            loading={guardar.ejecutando}
            onPress={() => guardar.ejecutar()}
            testID={`guardar-${campo}`}
          />
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setEditando(false)}
            testID={`cancelar-${campo}`}
          />
        </View>
        <MensajeError mensaje={guardar.mensajeError} testID={`error-guardar-${campo}`} />
      </View>
    );
  }

  return (
    <View style={[styles.dato, style]}>
      <View style={styles.textos}>
        <Text variant="label" color="textMuted">
          {etiqueta}
        </Text>
        {valor ? (
          <Text testID={`valor-${campo}`}>{valor}</Text>
        ) : (
          <Text color="textMuted">{ayuda}</Text>
        )}
      </View>
      <Button
        title="Editar"
        variant="ghost"
        onPress={abrir}
        accessibilityLabel={`Editar ${etiqueta.toLowerCase()}`}
        testID={`editar-${campo}`}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  dato: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  textos: { flex: 1 },
  edicion: { gap: spacing.sm },
  acciones: { flexDirection: 'row', gap: spacing.sm },
});
