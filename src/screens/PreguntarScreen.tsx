// src/screens/PreguntarScreen.tsx
// "Preguntarle a mis datos": un chat. Freddy escribe o toca una pregunta; el servicio (`consultar`)
// entiende qué quiso decir, el código calcula la cifra y vuelve una burbuja con la respuesta, y a
// veces con el semáforo de Jev. La pantalla solo orquesta: no calcula nada ni habla con ningún
// proveedor (AGENTS.md, reglas 3 y 8). Nada se envía al abrir ni al escribir: solo al tocar
// "Preguntar" o una pregunta sugerida, y una sola petición por toque.
// Es la pestaña "Asistente" (sin "Atrás"). Con el parámetro `pregunta` la hace al abrirse.
// El historial vive solo en el estado de esta pantalla: no se guarda en el teléfono y se va con ella.
// Para dejarle sitio a la conversación: el encabezado es de una línea, el aviso de privacidad va
// plegado ("Ver aviso" / "Ocultar") y las preguntas sugeridas son una fila de chips que se desliza,
// siempre a la mano encima del campo. Mientras espera hay una burbuja de "pensando" (puntos que
// laten); si algo falla, una burbuja de aviso con la causa (sin internet, muchas preguntas o el
// asistente caído).
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
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Lock } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { Button } from '@components/atoms/Button';
import { Icon } from '@components/atoms/Icon';
import { Chip } from '@components/molecules/Chip';
import { Input } from '@components/atoms/Input';
import { BurbujaChat, BurbujaPensando } from '@components/molecules/BurbujaChat';
import { responderCharla } from '@analisis/charla';
import { PREGUNTAS_SUGERIDAS } from '@analisis/intenciones';
import { fechaLocal } from '@dominio/fecha';
import type { Consulta, Semaforo } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import { consultar, MAX_CARACTERES_PREGUNTA } from '@services/jev';
import type { TabsParamList } from '@navigation/Tabs';
import { JEV_URL } from '../config';

const TEXTO_PRIVACIDAD =
  'Tu pregunta se envía a un servicio de inteligencia artificial para entenderla. Algunas respuestas se envían ya calculadas (por ejemplo, cuánto te queda en el ciclo) para valorar cómo va el negocio. Nunca van tu nombre, tu Yape, lo que te deben por cobrar ni tus días uno por uno.';
const TEXTO_AVISO_CORTO = 'Tu pregunta se envía a una IA';
const TEXTO_INVITACION =
  'Pregúntame lo que quieras de tus ventas. Toca una pregunta o escribe la tuya:';
/** Cuando no se entendió la pregunta: dice con qué sí puede ayudar y manda a las sugeridas. */
const TEXTO_NO_ENTENDI =
  'No entendí la pregunta. Puedo ayudarte con tus ventas, cobros pendientes y productos. Prueba con una de estas:';
/** Ancho fijo del botón: no salta cuando la etiqueta cambia entre "Preguntar" y "Pensando…". */
const ANCHO_BOTON = 140;

/** Una burbuja del historial. */
interface Mensaje {
  id: number;
  autor: 'freddy' | 'jev';
  texto: string;
  semaforo?: Semaforo;
  /** Es un aviso de falla (sin internet, muchas preguntas…), no una respuesta. */
  error?: boolean;
}

export const PreguntarScreen = () => {
  const { cierres, productos, perfil } = useCrecemos();
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList, 'Asistente'>>();
  const route = useRoute<RouteProp<TabsParamList, 'Asistente'>>();

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  // El aviso de privacidad va plegado hasta que Freddy lo abre.
  const [avisoAbierto, setAvisoAbierto] = useState(false);
  // Un toque, una pregunta: mientras una espera, otro toque no hace nada (el estado llega tarde).
  const ocupado = useRef(false);
  const montado = useRef(true);
  const siguienteId = useRef(0);
  // La última consulta resuelta del hilo, solo en el teléfono: completa los seguimientos ("¿y de la
  // pancita?"). Nunca viaja a Jev y se va con la pantalla, igual que el historial.
  const previa = useRef<Consulta | null>(null);
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
    agregar({ autor: 'freddy', texto: limpia });
    // La charla corta (hola, gracias…) se contesta aquí, al instante y sin red. El nombre del perfil
    // solo arma la frase en el teléfono: nunca viaja.
    const charla = responderCharla(limpia, perfil.nombre);
    if (charla !== null) {
      agregar({ autor: 'jev', texto: charla.texto });
      ocupado.current = false;
      setPensando(false);
      return;
    }
    try {
      // El fetch se toma al momento de usarlo y se inyecta: aquí no hay ninguna llamada de red propia.
      const respuesta = await consultar(
        globalThis.fetch,
        JEV_URL,
        limpia,
        {
          cierres,
          productos,
          hoy: fechaLocal(new Date()),
        },
        previa.current,
      ).catch(() => null);
      if (respuesta === null || respuesta.tipo === 'noEntendi') {
        agregar({ autor: 'jev', texto: TEXTO_NO_ENTENDI });
      } else if (respuesta.tipo === 'sinInternet' || respuesta.tipo === 'error') {
        agregar({ autor: 'jev', texto: respuesta.texto, error: true });
      } else {
        previa.current = respuesta.consulta;
        agregar({ autor: 'jev', texto: respuesta.texto, semaforo: respuesta.semaforo });
      }
    } finally {
      ocupado.current = false;
      if (montado.current) setPensando(false);
    }
  };

  // Otra pantalla puede abrir el chat con una pregunta lista (botones "Preguntar por qué"): se hace
  // una sola vez y se borra del parámetro para que volver a la pestaña no la repita.
  const preguntarRef = useRef(preguntar);
  preguntarRef.current = preguntar;
  const preguntaDeRuta = route.params?.pregunta;
  useEffect(() => {
    if (!preguntaDeRuta) return;
    navigation.setParams({ pregunta: undefined });
    preguntarRef.current(preguntaDeRuta).catch(() => undefined);
  }, [preguntaDeRuta, navigation]);

  const ultimo = mensajes.length > 0 ? mensajes[mensajes.length - 1] : null;
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
          {/* Es una pestaña: no lleva "Atrás". Una sola línea, para dejarle sitio al chat. */}
          <Text variant="h2" accessibilityRole="header" numberOfLines={1} testID="preguntar-titulo">
            Preguntarle a mis datos
          </Text>
          {/* El aviso va plegado en una línea; "Ver aviso" lo abre completo. */}
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
          {avisoAbierto ? (
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
          {conversando ? null : (
            <Text variant="label" color="textMuted" testID="preguntar-invitacion">
              {TEXTO_INVITACION}
            </Text>
          )}
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
                error={m.error}
                testID={`chat-burbuja-${i}`}
              />
            </View>
          ))}
          {pensando ? <BurbujaPensando testID="chat-pensando" /> : null}
        </ScrollView>

        {/* Las sugeridas, el campo y el botón viven FUERA del scroll, en un pie fijo: siempre a la mano. */}
        <View style={styles.pie}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.sugeridasFila}
            contentContainerStyle={styles.sugeridas}
            testID="preguntar-sugeridas"
          >
            {PREGUNTAS_SUGERIDAS.map((pregunta, i) => (
              <Chip
                key={pregunta}
                label={pregunta}
                role="button"
                disabled={pensando}
                onPress={() => preguntar(pregunta)}
                testID={`preguntar-sugerida-${i}`}
              />
            ))}
          </ScrollView>
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
              style={styles.enviar}
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

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.background },
  cabecera: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
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
  // Los chips llegan al borde del pie: el último asoma y avisa que hay más.
  sugeridasFila: { marginHorizontal: -spacing.lg, flexGrow: 0 },
  sugeridas: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  pie: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  filaCampo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  campo: { flex: 1 },
  enviar: { width: ANCHO_BOTON },
});
