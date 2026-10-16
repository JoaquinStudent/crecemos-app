// src/components/molecules/BurbujaChat/BurbujaChat.tsx
// Una burbuja del chat "Preguntarle a mis datos". La pregunta de Freddy va a la derecha y la
// respuesta, a la izquierda. Si la respuesta trae el semáforo de Jev, la burbuja lo dice con TRES
// cosas a la vez, para que ninguna dependa solo del color: la palabra ("Bien", "Ojo", "Urgente"),
// un símbolo distinto (check, alerta, sirena) y un fondo suave distinto. La letra va siempre en
// oscuro sobre ese fondo: el naranja nunca es color de texto (UX, regla 5).
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import {
  CircleCheck,
  FlaskConical,
  Siren,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Icon } from '@components/atoms/Icon';
import { ETIQUETA_SEMAFORO, SIMBOLO_SEMAFORO } from '@analisis/semaforo';
import type { ColorName } from '@theme';
import type { Semaforo } from '@dominio/tipos';
import { movimientoReducido } from '@hooks/useMovimientoReducido';

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
  /** Un aviso de falla (sin internet, muchas preguntas…): otro tono, un ícono y la palabra "Aviso". */
  error?: boolean;
  /** Se respondió en el teléfono, sin red: lleva la etiqueta "Sin internet" (palabra, ícono y borde punteado). */
  sinInternet?: boolean;
  /**
   * La respuesta se calculó con cierres de ejemplo (D121): lleva la etiqueta "Incluye datos de ejemplo"
   * (palabra, ícono de matraz y borde azul; el color nunca va solo). Es la garantía de que se avisa, aunque
   * el texto del modelo no lo mencione.
   */
  ejemplo?: boolean;
  /** El de la burbuja; el texto, la palabra y el símbolo llevan este mismo con un sufijo. */
  testID: string;
}

/** La etiqueta de una respuesta dada sin internet. */
export const TEXTO_SIN_INTERNET_NOTA = 'Sin internet';
/** La etiqueta de una respuesta que usó datos de ejemplo (la misma frase que dice Resumen). */
export const TEXTO_EJEMPLO_NOTA = 'Incluye datos de ejemplo';

export const BurbujaChat = ({
  autor,
  texto,
  semaforo,
  error,
  sinInternet,
  ejemplo,
  testID,
}: BurbujaChatProps) => {
  const esPregunta = autor === 'freddy';
  const estilo = semaforo ? ESTILO_SEMAFORO[semaforo] : null;
  const palabra = semaforo ? ETIQUETA_SEMAFORO[semaforo] : null;
  const conEjemplo = ejemplo === true && !esPregunta && !error;
  // "Respuesta, Bien, sin internet, incluye datos de ejemplo: …": cada marca que tenga, con palabras.
  const marcas = [
    palabra,
    sinInternet ? TEXTO_SIN_INTERNET_NOTA.toLowerCase() : null,
    conEjemplo ? TEXTO_EJEMPLO_NOTA.toLowerCase() : null,
  ].filter(Boolean);
  const etiqueta = esPregunta
    ? `Tu pregunta: ${texto}`
    : error
    ? `Aviso: ${texto}`
    : marcas.length > 0
    ? `Respuesta, ${marcas.join(', ')}: ${texto}`
    : `Respuesta: ${texto}`;

  return (
    <View
      accessible
      accessibilityLabel={etiqueta}
      style={[
        styles.burbuja,
        esPregunta ? styles.pregunta : styles.respuesta,
        (estilo || error) && styles.conSemaforo,
        sinInternet && !esPregunta && styles.respuestaSinInternet,
        conEjemplo && styles.respuestaConEjemplo,
        error && styles.error,
        estilo && { backgroundColor: estilo.fondo, borderLeftColor: colors[estilo.fuerte] },
      ]}
      testID={testID}
    >
      {error ? (
        <View style={styles.semaforo} testID={`${testID}-aviso`}>
          <Icon icon={TriangleAlert} color="danger" size="lg" />
          <Text variant="bodyStrong">Aviso</Text>
        </View>
      ) : null}
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
      {sinInternet && !esPregunta ? (
        <View style={styles.etiquetaSinInternet} testID={`${testID}-etiqueta-sin-internet`}>
          <Icon icon={WifiOff} color="text" size="md" />
          <Text variant="bodySmall" testID={`${testID}-sin-internet`}>
            {TEXTO_SIN_INTERNET_NOTA}
          </Text>
        </View>
      ) : null}
      {conEjemplo ? (
        <View style={styles.etiquetaEjemplo} testID={`${testID}-etiqueta-ejemplo`}>
          <Icon icon={FlaskConical} color="info" size="md" />
          <Text variant="bodySmall" testID={`${testID}-ejemplo`}>
            {TEXTO_EJEMPLO_NOTA}
          </Text>
        </View>
      ) : null}
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
  // Una falla no es una respuesta: fondo rojo suave y borde rojo, con letra oscura.
  error: {
    backgroundColor: colors.dangerSoft,
    borderLeftColor: colors.danger,
    borderColor: colors.dangerSoft,
  },
  // Sin internet: borde punteado y una etiqueta con palabra e ícono; el color nunca va solo.
  respuestaSinInternet: { borderStyle: 'dashed', borderColor: colors.textMuted },
  etiquetaSinInternet: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  // Con datos de ejemplo: borde azul y una etiqueta con relleno suave, palabra e ícono propios (distinta de "Sin internet").
  respuestaConEjemplo: { borderColor: colors.info },
  etiquetaEjemplo: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: colors.info,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  puntos: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 26 },
  punto: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.textMuted },
  semaforo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

const PUNTOS = [0, 1, 2];
const PASO_MS = 300;

/**
 * La burbuja de "el asistente está pensando": tres puntos que laten uno tras otro. Sin texto
 * visible (el lector de pantalla oye "El asistente está pensando"). Con "Reducir movimiento" los
 * puntos quedan quietos.
 */
export const BurbujaPensando = ({ testID, texto }: { testID: string; texto?: string }) => {
  const opacidades = useRef(PUNTOS.map(() => new Animated.Value(0.35))).current;

  useEffect(() => {
    let vivo = true;
    let ciclo: Animated.CompositeAnimation | null = null;
    movimientoReducido().then(reducido => {
      if (!vivo || reducido) return;
      ciclo = Animated.loop(
        Animated.stagger(
          PASO_MS / 2,
          opacidades.map(o =>
            Animated.sequence([
              Animated.timing(o, { toValue: 1, duration: PASO_MS, useNativeDriver: true }),
              Animated.timing(o, { toValue: 0.35, duration: PASO_MS, useNativeDriver: true }),
            ]),
          ),
        ),
      );
      ciclo.start();
    });
    return () => {
      vivo = false;
      ciclo?.stop();
    };
  }, [opacidades]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="El asistente está pensando"
      accessibilityLiveRegion="polite"
      style={[styles.burbuja, styles.respuesta, styles.puntos]}
      testID={testID}
    >
      {opacidades.map((opacidad, i) => (
        <Animated.View key={i} style={[styles.punto, { opacity: opacidad }]} />
      ))}
      {texto ? (
        <Text variant="bodySmall" color="textMuted" testID={`${testID}-texto`}>
          {texto}
        </Text>
      ) : null}
    </View>
  );
};
