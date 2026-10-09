// src/components/molecules/BurbujaChat/BurbujaChat.tsx
// Una burbuja del chat "Preguntarle a mis datos". La pregunta de Freddy va a la derecha y la
// respuesta, a la izquierda. Si la respuesta trae el semáforo de Jev, la burbuja lo dice con TRES
// cosas a la vez, para que ninguna dependa solo del color: la palabra ("Bien", "Ojo", "Urgente"),
// un símbolo distinto (check, alerta, sirena) y un fondo suave distinto. La letra va siempre en
// oscuro sobre ese fondo: el naranja nunca es color de texto (UX, regla 5).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CircleCheck, Siren, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon } from '@components/atoms/Icon';
import { ETIQUETA_SEMAFORO, SIMBOLO_SEMAFORO } from '@analisis/semaforo';
import type { ColorName } from '@theme';
import type { Semaforo } from '@dominio/tipos';

/** El ícono de cada símbolo; los nombres salen de `SIMBOLO_SEMAFORO`, que no sabe de pantallas. */
const ICONO_DEL_SIMBOLO: Record<string, LucideIcon> = {
  check: CircleCheck,
  alerta: TriangleAlert,
  sirena: Siren,
};

interface EstiloSemaforo {
  fondo: string;
  /** Borde izquierdo y color del ícono: un tono fuerte, nunca un color de letra. */
  fuerte: ColorName;
}

const ESTILO_SEMAFORO: Record<Semaforo, EstiloSemaforo> = {
  bien: { fondo: colors.successSoft, fuerte: 'success' },
  ojo: { fondo: colors.warningSoft, fuerte: 'warning' },
  urgente: { fondo: colors.dangerSoft, fuerte: 'danger' },
};

export interface BurbujaChatProps {
  /** `freddy` es la pregunta (derecha); `jev` es la respuesta (izquierda). */
  autor: 'freddy' | 'jev';
  texto: string;
  /** El juicio de Jev. Sin él, la burbuja sale normal. */
  semaforo?: Semaforo;
  /** El de la burbuja; el texto, la palabra y el símbolo llevan este mismo con un sufijo. */
  testID: string;
}

export const BurbujaChat = ({ autor, texto, semaforo, testID }: BurbujaChatProps) => {
  const esPregunta = autor === 'freddy';
  const estilo = semaforo ? ESTILO_SEMAFORO[semaforo] : null;
  const palabra = semaforo ? ETIQUETA_SEMAFORO[semaforo] : null;
  const etiqueta = esPregunta
    ? `Tu pregunta: ${texto}`
    : palabra
    ? `Respuesta, ${palabra}: ${texto}`
    : `Respuesta: ${texto}`;

  return (
    <View
      accessible
      accessibilityLabel={etiqueta}
      style={[
        styles.burbuja,
        esPregunta ? styles.pregunta : styles.respuesta,
        estilo && styles.conSemaforo,
        estilo && { backgroundColor: estilo.fondo, borderLeftColor: colors[estilo.fuerte] },
      ]}
      testID={testID}
    >
      {semaforo && estilo && palabra ? (
        <View style={styles.semaforo} testID={`${testID}-semaforo`}>
          <View testID={`${testID}-semaforo-simbolo`}>
            <Icon
              icon={ICONO_DEL_SIMBOLO[SIMBOLO_SEMAFORO[semaforo]] ?? CircleCheck}
              color={estilo.fuerte}
              size="lg"
            />
          </View>
          <Text variant="bodyStrong" testID={`${testID}-semaforo-palabra`}>
            {palabra}
          </Text>
        </View>
      ) : null}
      <Text testID={`${testID}-texto`}>{texto}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  burbuja: {
    maxWidth: '88%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  pregunta: { alignSelf: 'flex-end', backgroundColor: colors.primarySoft },
  respuesta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conSemaforo: { borderLeftWidth: 4 },
  semaforo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
