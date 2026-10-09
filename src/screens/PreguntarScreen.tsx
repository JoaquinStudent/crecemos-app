// src/screens/PreguntarScreen.tsx
// "Preguntarle a mis datos": un chat. Freddy escribe o toca una pregunta; el servicio (`consultar`)
// entiende qué quiso decir, el código calcula la cifra y vuelve una burbuja con la respuesta, y a
// veces con el semáforo de Jev. La pantalla solo orquesta: no calcula nada ni habla con ningún
// proveedor (AGENTS.md, reglas 3 y 8). Nada se envía al abrir ni al escribir: solo al tocar
// "Preguntar" o una pregunta sugerida, y una sola petición por toque.
// El historial vive solo en el estado de esta pantalla: no se guarda en el teléfono y se va con ella.
// Para dejarle sitio a la conversación, el aviso de privacidad y las preguntas sugeridas se pliegan
// en cuanto hay una pregunta: el aviso queda en una línea con "Ver aviso" / "Ocultar", y las
// sugeridas pasan a un panel que se abre con "Preguntas sugeridas", justo encima del campo.
// El campo y el botón van FIJOS al pie, fuera del scroll y dentro de un KeyboardAvoidingView: con el
// teclado abierto se ven y se pueden tocar (lección del Sprint-01, memory.md D27, y del Sprint-02).
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronDown, ChevronLeft, ChevronUp, Lock } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { Input } from '@components/atoms/Input';
import { BurbujaChat } from '@components/molecules/BurbujaChat';
import { PREGUNTAS_SUGERIDAS } from '@analisis/intenciones';
import { fechaLocal } from '@dominio/fecha';
import type { Semaforo } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import { consultar, MAX_CARACTERES_PREGUNTA, TEXTO_NO_ENTENDI } from '@services/jev';
import type { RootStackParamList } from '@navigation/RootStack';
import { JEV_URL } from '../config';

const TEXTO_PRIVACIDAD =
  'Tu pregunta y unos totales se envían a un servicio de inteligencia artificial para entenderla y escribirte la respuesta. Nunca va tu nombre, tu Yape ni tus movimientos.';
const TEXTO_AVISO_CORTO = 'Tu pregunta se envía a una IA';
const TEXTO_INVITACION = 'Toca una pregunta o escribe la tuya:';
/** Alto máximo del panel de sugeridas: si no cabe, se desplaza por dentro y siempre se puede cerrar. */
const ALTO_MAXIMO_PANEL = 200;

/** Una burbuja del historial. `noEntendi` lleva las preguntas sugeridas justo debajo. */
interface Mensaje {
  id: number;
  autor: 'freddy' | 'jev';
  texto: string;
  semaforo?: Semaforo;
  noEntendi?: boolean;
}

export const PreguntarScreen = () => {
  const { cierres, productos } = useCrecemos();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Preguntar'>>();

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  // Con la conversación empezada, el aviso y las sugeridas están plegados hasta que Freddy los abre.
  const [avisoAbierto, setAvisoAbierto] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);
  // Un toque, una pregunta: mientras una espera, otro toque no hace nada (el estado llega tarde).
  const ocupado = useRef(false);
  const montado = useRef(true);
  const siguienteId = useRef(0);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Dónde empieza (de arriba hacia abajo) la última pregunta de Freddy, para dejarla a la vista.
  const alturaUltimaPregunta = useRef<number | null>(null);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const agregar = (mensaje: Omit<Mensaje, 'id'>) => {
    if (!montado.current) return;
    // El id se toma ya: el actualizador de estado corre después y vería un contador más adelantado.
    siguienteId.current += 1;
    const id = siguienteId.current;
    setMensajes(anteriores => [...anteriores, { ...mensaje, id }]);
  };

  /** Pregunta lo que se le pase (lo escrito o una sugerida). Tocar una sugerida equivale a escribirla. */
  const preguntar = async (pregunta: string): Promise<void> => {
    const limpia = pregunta.trim();
    if (ocupado.current || limpia === '') return;
    ocupado.current = true;
    setPensando(true);
    setTexto('');
    setPanelAbierto(false);
    agregar({ autor: 'freddy', texto: limpia });
    try {
      // El fetch se toma al momento de usarlo y se inyecta: aquí no hay ninguna llamada de red propia.
      const respuesta = await consultar(globalThis.fetch, JEV_URL, limpia, {
        cierres,
        productos,
        hoy: fechaLocal(new Date()),
      }).catch(() => null);
      if (respuesta === null || respuesta.tipo === 'noEntendi') {
        agregar({ autor: 'jev', texto: respuesta?.texto ?? TEXTO_NO_ENTENDI, noEntendi: true });
      } else if (respuesta.tipo === 'sinInternet') {
        agregar({ autor: 'jev', texto: respuesta.texto });
      } else {
        agregar({ autor: 'jev', texto: respuesta.texto, semaforo: respuesta.semaforo });
      }
    } finally {
      ocupado.current = false;
      if (montado.current) setPensando(false);
    }
  };

  const ultimo = mensajes.length > 0 ? mensajes[mensajes.length - 1] : null;
  const ultimoNoEntendi = ultimo?.noEntendi === true;
  const conversando = ultimo !== null;

  /**
   * Tras una respuesta, la pantalla se queda con la pregunta arriba y su respuesta debajo (si caben).
   * Mientras se espera, baja hasta el final para que la pregunta recién hecha se vea.
   */
  const acomodarScroll = () => {
    if (ultimo?.autor === 'jev' && alturaUltimaPregunta.current !== null) {
      scroll.current?.scrollTo?.({
        y: Math.max(0, alturaUltimaPregunta.current - spacing.sm),
        animated: true,
      });
    } else {
      scroll.current?.scrollToEnd?.({ animated: true });
    }
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'bottom']} testID="preguntar-pantalla">
      <KeyboardAvoidingView
        style={styles.pantalla}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.cabecera}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Atrás"
            onPress={() => navigation.goBack()}
            style={styles.atras}
            testID="preguntar-atras"
          >
            <Icon icon={ChevronLeft} color="primary" size="lg" />
            <Text variant="bodyStrong" color="primary">
              Atrás
            </Text>
          </Pressable>
          <Text variant="h1" accessibilityRole="header">
            Preguntarle a mis datos
          </Text>
          {/* Al abrir, completo y sin scroll. Ya con una pregunta, una línea con "Ver aviso". */}
          {conversando ? (
            <View style={styles.avisoCorto} testID="preguntar-aviso-compacto">
              <Icon icon={Lock} color="primary" size="md" />
              <Text variant="bodySmall" style={styles.avisoCortoTexto}>
                {TEXTO_AVISO_CORTO}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={avisoAbierto ? 'Ocultar' : 'Ver aviso'}
                accessibilityState={{ expanded: avisoAbierto }}
                onPress={() => setAvisoAbierto(abierto => !abierto)}
                style={styles.alternarAviso}
                testID="preguntar-aviso-alternar"
              >
                <Text variant="bodyStrong" color="primary">
                  {avisoAbierto ? 'Ocultar' : 'Ver aviso'}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {!conversando || avisoAbierto ? (
            <View style={styles.privacidad} testID="preguntar-aviso-privacidad">
              <Icon icon={Lock} color="primary" size="lg" />
              <Text
                variant="bodySmall"
                style={styles.privacidadTexto}
                testID="preguntar-aviso-privacidad-texto"
              >
                {TEXTO_PRIVACIDAD}
              </Text>
            </View>
          ) : null}
        </View>

        <ScrollView
          ref={scroll}
          style={styles.chat}
          contentContainerStyle={styles.conversacion}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={acomodarScroll}
          testID="preguntar-chat"
        >
          {mensajes.map((m, i) => (
            <View
              key={m.id}
              onLayout={
                m.autor === 'freddy'
                  ? e => {
                      alturaUltimaPregunta.current = e.nativeEvent.layout.y;
                    }
                  : undefined
              }
            >
              <BurbujaChat
                autor={m.autor}
                texto={m.texto}
                semaforo={m.semaforo}
                testID={`chat-burbuja-${i}`}
              />
            </View>
          ))}

          {/* Al abrir: las sugeridas completas. Ya conversando se pliegan en el panel de abajo, salvo
              después de un "No entendí", cuando la burbuja misma las ofrece debajo. */}
          {!conversando || ultimoNoEntendi ? (
            <>
              {ultimoNoEntendi ? null : (
                <Text variant="label" color="textMuted" testID="preguntar-invitacion">
                  {TEXTO_INVITACION}
                </Text>
              )}
              <View style={styles.sugeridas} testID="preguntar-sugeridas">
                {PREGUNTAS_SUGERIDAS.map((pregunta, i) => (
                  <Chip
                    key={pregunta}
                    pregunta={pregunta}
                    apagado={pensando}
                    alTocar={() => preguntar(pregunta)}
                    testID={`preguntar-sugerida-${i}`}
                  />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>

        {/* El campo y el botón viven FUERA del scroll, en un pie fijo: siempre a la mano. */}
        <View style={styles.pie}>
          {conversando ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Preguntas sugeridas"
              accessibilityState={{ expanded: panelAbierto }}
              onPress={() => setPanelAbierto(abierto => !abierto)}
              style={styles.alternarPanel}
              testID="preguntar-panel-alternar"
            >
              <Text variant="bodyStrong" color="primary">
                Preguntas sugeridas
              </Text>
              <Icon icon={panelAbierto ? ChevronDown : ChevronUp} color="primary" size="md" />
            </Pressable>
          ) : null}
          {conversando && panelAbierto ? (
            <ScrollView
              style={styles.panel}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              testID="preguntar-panel"
            >
              <View style={styles.sugeridas}>
                {PREGUNTAS_SUGERIDAS.map((pregunta, i) => (
                  <Chip
                    key={pregunta}
                    pregunta={pregunta}
                    apagado={pensando}
                    alTocar={() => preguntar(pregunta)}
                    testID={`preguntar-panel-sugerida-${i}`}
                  />
                ))}
              </View>
            </ScrollView>
          ) : null}
          <View style={styles.filaCampo}>
            <Input
              containerStyle={styles.campo}
              placeholder="Escribe tu pregunta"
              accessibilityLabel="Tu pregunta"
              value={texto}
              onChangeText={setTexto}
              maxLength={MAX_CARACTERES_PREGUNTA}
              returnKeyType="done"
              testID="preguntar-campo"
            />
            <Button
              title={pensando ? 'Pensando…' : 'Preguntar'}
              size="md"
              disabled={pensando || texto.trim() === ''}
              onPress={() => preguntar(texto)}
              testID="preguntar-enviar"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/** Una pregunta sugerida tocable; mientras Jev piensa se apaga para que no salgan dos preguntas. */
const Chip = ({
  pregunta,
  apagado,
  alTocar,
  testID,
}: {
  pregunta: string;
  apagado: boolean;
  alTocar: () => void;
  testID: string;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={pregunta}
    accessibilityState={{ disabled: apagado }}
    disabled={apagado}
    onPress={alTocar}
    style={({ pressed }) => [
      styles.chip,
      pressed && styles.chipPresionado,
      apagado && styles.chipApagado,
    ]}
    testID={testID}
  >
    <Text variant="label" color={apagado ? 'textMuted' : 'text'}>
      {pregunta}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  cabecera: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs, gap: spacing.sm },
  atras: {
    alignSelf: 'flex-start',
    minHeight: 48,
    minWidth: 48,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -spacing.xs,
  },
  privacidad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  privacidadTexto: { flex: 1 },
  avisoCorto: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avisoCortoTexto: { flex: 1 },
  alternarAviso: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  chat: { flex: 1 },
  conversacion: { padding: spacing.lg, gap: spacing.md },
  sugeridas: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipPresionado: { backgroundColor: colors.surface },
  chipApagado: { backgroundColor: colors.disabledSoft },
  pie: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  alternarPanel: {
    alignSelf: 'flex-start',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  panel: {
    maxHeight: ALTO_MAXIMO_PANEL,
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  filaCampo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  campo: { flex: 1 },
});
