// src/screens/PreguntarScreen.tsx
// "Preguntarle a mis datos": un chat. Freddy escribe o toca una pregunta; el servicio (`consultar`)
// entiende qué quiso decir, el código calcula la cifra y vuelve una burbuja con la respuesta, y a
// veces con el semáforo de Jev. La pantalla solo orquesta: no calcula nada ni habla con ningún
// proveedor (AGENTS.md, reglas 3 y 8). Nada se envía al abrir ni al escribir: solo al tocar
// "Preguntar" o una pregunta sugerida, y una sola petición por toque.
// El historial vive solo en el estado de esta pantalla: no se guarda en el teléfono y se va con ella.
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
import { ChevronLeft, Lock } from 'lucide-react-native';
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
const TEXTO_INVITACION = 'Toca una pregunta o escribe la tuya:';

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
  // Un toque, una pregunta: mientras una espera, otro toque no hace nada (el estado llega tarde).
  const ocupado = useRef(false);
  const montado = useRef(true);
  const siguienteId = useRef(0);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);

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

  const ultimoNoEntendi = mensajes.length > 0 && mensajes[mensajes.length - 1].noEntendi === true;

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
          {/* Visible sin hacer scroll: es lo primero que se lee antes de mandar una pregunta. */}
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
        </View>

        <ScrollView
          ref={scroll}
          style={styles.chat}
          contentContainerStyle={styles.conversacion}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd?.({ animated: true })}
          testID="preguntar-chat"
        >
          {mensajes.map((m, i) => (
            <BurbujaChat
              key={m.id}
              autor={m.autor}
              texto={m.texto}
              semaforo={m.semaforo}
              testID={`chat-burbuja-${i}`}
            />
          ))}

          {/* Después de un "No entendí" la burbuja ya invita; en cualquier otro caso, esta línea. */}
          {ultimoNoEntendi ? null : (
            <Text variant="label" color="textMuted" testID="preguntar-invitacion">
              {TEXTO_INVITACION}
            </Text>
          )}
          <View style={styles.sugeridas} testID="preguntar-sugeridas">
            {PREGUNTAS_SUGERIDAS.map((pregunta, i) => (
              <Pressable
                key={pregunta}
                accessibilityRole="button"
                accessibilityLabel={pregunta}
                accessibilityState={{ disabled: pensando }}
                disabled={pensando}
                onPress={() => preguntar(pregunta)}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && styles.chipPresionado,
                  pensando && styles.chipApagado,
                ]}
                testID={`preguntar-sugerida-${i}`}
              >
                <Text variant="label" color={pensando ? 'textMuted' : 'text'}>
                  {pregunta}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* El campo y el botón viven FUERA del scroll, en un pie fijo: siempre a la mano. */}
        <View style={styles.pie}>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  campo: { flex: 1 },
});
