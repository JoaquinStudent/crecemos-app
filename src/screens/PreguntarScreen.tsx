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
// En Android con borde a borde el sistema ya no redimensiona la ventana (`adjustResize` se ignora):
// el teclado se dibuja ENCIMA. Por eso el KeyboardAvoidingView usa `padding` en las dos plataformas,
// la barra inferior se esconde mientras el teclado está abierto (useTecladoVisible) y la
// conversación baja hasta el último mensaje.
// El botón de enviar es solo un ícono (avión de papel): excepción pedida por el usuario a la regla de
// "ícono siempre con texto visible"; su etiqueta de accesibilidad es "Preguntar".
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Lock, Send } from 'lucide-react-native';
import { colors, radius, spacing } from '@theme';
import { Text } from '@components/atoms/Text';
import { BotonIcono } from '@components/atoms/BotonIcono';
import { Icon } from '@components/atoms/Icon';
import { Chip } from '@components/molecules/Chip';
import { Input } from '@components/atoms/Input';
import { BurbujaChat, BurbujaPensando } from '@components/molecules/BurbujaChat';
import type { MensajeHilo } from '@analisis/hilo';
import { PREGUNTAS_SUGERIDAS } from '@analisis/intenciones';
import { esReservada } from '@analisis/semaforo';
import { fechaLocal } from '@dominio/fecha';
import type { Consulta, Semaforo } from '@dominio/tipos';
import { useCrecemos } from '@context/CrecemosProvider';
import { consultar, MAX_CARACTERES_PREGUNTA, TEXTO_NO_ENTENDI } from '@services/jev';
import { useMedidasBarra } from '@hooks/useMedidasBarra';
import { useTecladoVisible } from '@hooks/useTecladoVisible';
import type { TabsParamList } from '@navigation/Tabs';
import { JEV_URL } from '../config';

const TEXTO_PRIVACIDAD =
  'Tu pregunta y lo último que hablaron se envían a un servicio de inteligencia artificial para entenderla y escribirte la respuesta. Algunas respuestas se envían ya calculadas (por ejemplo, cuánto te queda en el ciclo), y si conversan, viajan unos totales por mes y por producto. Nunca van tu nombre, tu Yape, los montos ni las fechas de lo que te deben, ni la lista de tus días. Para opinar sobre tus cobros solo viaja una señal como «alto» o «vencido». Si no hay internet, solo respondo las preguntas sugeridas y no se envía nada.';
const TEXTO_AVISO_CORTO = 'Tu pregunta se envía a una IA';
const TEXTO_INVITACION =
  'Pregúntame lo que quieras de tus ventas. Toca una pregunta o escribe la tuya:';
/** Lo que se ve mientras la respuesta tarda más de lo normal (pueden ser dos o tres llamadas seguidas). */
const TEXTO_SIGUE_PENSANDO = 'Sigo revisando tus datos, un momento…';
/** Pasado este tiempo esperando, la burbuja de "pensando" dice que sigue trabajando. */
const ESPERA_LARGA_MS = 3500;
/** Encima de las sugeridas del aviso sin internet. */
const TEXTO_SIN_INTERNET_SUGERIDAS = 'Sin internet puedo responder estas:';

/** Una burbuja del historial. */
interface Mensaje {
  id: number;
  autor: 'freddy' | 'jev';
  texto: string;
  semaforo?: Semaforo;
  /** Es un aviso de falla (sin internet, muchas preguntas…), no una respuesta. */
  error?: boolean;
  /** Se respondió sin red, con la clasificación del teléfono. */
  sinInternet?: boolean;
  /** La respuesta se calculó con cierres de ejemplo: la burbuja lleva "Incluye datos de ejemplo". */
  ejemplo?: boolean;
  /** Preguntas tocables debajo de la burbuja mientras sea el último mensaje (el aviso sin internet). */
  sugeridas?: string[];
  /** No entra al hilo que viaja: avisos, "no entendí" y lo que lleva datos que no salen del teléfono. */
  fueraDelHilo?: boolean;
}

export const PreguntarScreen = () => {
  const { cierres, productos } = useCrecemos();
  const navigation = useNavigation<BottomTabNavigationProp<TabsParamList, 'Asistente'>>();
  const route = useRoute<RouteProp<TabsParamList, 'Asistente'>>();
  const { alturaTotal } = useMedidasBarra();
  const teclado = useTecladoVisible();

  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  // Una espera larga no debe parecer un cuelgue: pasados unos segundos la burbuja lo dice.
  const [esperaLarga, setEsperaLarga] = useState(false);
  // El aviso de privacidad va plegado hasta que Freddy lo abre.
  const [avisoAbierto, setAvisoAbierto] = useState(false);
  // Un toque, una pregunta: mientras una espera, otro toque no hace nada (el estado llega tarde).
  const ocupado = useRef(false);
  const montado = useRef(true);
  const siguienteId = useRef(0);
  // La última consulta resuelta del hilo, solo en el teléfono: completa los seguimientos ("¿y de la
  // pancita?"). Nunca viaja a Jev y se va con la pantalla, igual que el historial.
  const previa = useRef<Consulta | null>(null);
  // Lo que se habló en la pantalla, solo texto: `consultar` envía las últimas 4 intervenciones a la
  // redacción y a la conversación (nunca a Jev, que solo recibe la pregunta actual).
  const hilo = useRef<MensajeHilo[]>([]);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // Dónde empieza (de arriba hacia abajo) la última pregunta de Freddy, para dejarla a la vista.
  const alturaUltimaPregunta = useRef<number | null>(null);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Si la espera se alarga, la burbuja de "pensando" lo dice. El temporizador se limpia al responder.
  useEffect(() => {
    if (!pensando) {
      setEsperaLarga(false);
      return undefined;
    }
    const temporizador = setTimeout(() => setEsperaLarga(true), ESPERA_LARGA_MS);
    return () => clearTimeout(temporizador);
  }, [pensando]);

  const agregar = (mensaje: Omit<Mensaje, 'id'>) => {
    if (!montado.current) return;
    if (!mensaje.error && !mensaje.fueraDelHilo) {
      hilo.current.push({
        rol: mensaje.autor === 'freddy' ? 'freddy' : 'asistente',
        texto: mensaje.texto,
      });
    }
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
    // Lo hablado ANTES de esta pregunta: la pregunta de ahora viaja aparte, en `texto`.
    const hiloPrevio = [...hilo.current];
    agregar({ autor: 'freddy', texto: limpia });
    try {
      // El fetch se toma al momento de usarlo y se inyecta: aquí no hay ninguna llamada de red propia.
      // El nombre del perfil no sale del teléfono: ni siquiera se pasa al servicio.
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
        hiloPrevio,
      ).catch(() => null);
      if (respuesta === null) {
        agregar({ autor: 'jev', texto: TEXTO_NO_ENTENDI, fueraDelHilo: true });
      } else if (respuesta.tipo === 'noEntendi') {
        agregar({ autor: 'jev', texto: respuesta.texto, fueraDelHilo: true });
      } else if (respuesta.tipo === 'sinInternet') {
        // Sin red y sin ser una pregunta predefinida: el aviso y tres preguntas que sí se responden sin internet.
        agregar({
          autor: 'jev',
          texto: respuesta.texto,
          error: true,
          sugeridas: respuesta.sugeridas,
        });
      } else if (respuesta.tipo === 'error') {
        agregar({ autor: 'jev', texto: respuesta.texto, error: true });
      } else if (respuesta.tipo === 'conversacion') {
        agregar({ autor: 'jev', texto: respuesta.texto, ejemplo: respuesta.ejemplo });
      } else {
        previa.current = respuesta.consulta;
        agregar({
          autor: 'jev',
          texto: respuesta.texto,
          semaforo: respuesta.semaforo,
          sinInternet: respuesta.sinInternet,
          ejemplo: respuesta.hecho.ejemplo,
          // Lo que te deben (monto y fecha del Yape) nunca sale del teléfono, ni siquiera en el hilo.
          fueraDelHilo: esReservada(respuesta.hecho.intencion),
        });
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

  // Al abrirse el teclado el chat se encoge: se baja hasta el último mensaje para que se siga viendo.
  useEffect(() => {
    if (teclado.visible) scroll.current?.scrollToEnd?.({ animated: true });
  }, [teclado.visible]);

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
    <SafeAreaView style={styles.pantalla} edges={['top']} testID="preguntar-pantalla">
      <KeyboardAvoidingView style={styles.pantalla} behavior="padding" keyboardVerticalOffset={0}>
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
          onLayout={() => {
            // El alto del chat cambia cuando el teclado entra: recién ahí el final queda a la vista.
            if (teclado.visible) scroll.current?.scrollToEnd?.({ animated: false });
          }}
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
                sinInternet={m.sinInternet}
                ejemplo={m.ejemplo}
                testID={`chat-burbuja-${i}`}
              />
              {/* Las preguntas que sí se responden sin internet, a un toque, mientras sea lo último que se dijo. */}
              {m.sugeridas && i === mensajes.length - 1 && !pensando ? (
                <View style={styles.sugeridasAviso} testID={`chat-sugeridas-${i}`}>
                  <Text variant="bodySmall" color="textMuted">
                    {TEXTO_SIN_INTERNET_SUGERIDAS}
                  </Text>
                  <View style={styles.sugeridasChips}>
                    {m.sugeridas.map((pregunta, k) => (
                      <Chip
                        key={pregunta}
                        label={pregunta}
                        role="button"
                        onPress={() => preguntar(pregunta)}
                        testID={`chat-sugerida-${i}-${k}`}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ))}
          {pensando ? (
            <BurbujaPensando
              testID="chat-pensando"
              texto={esperaLarga ? TEXTO_SIGUE_PENSANDO : undefined}
            />
          ) : null}
        </ScrollView>

        {/* Las sugeridas, el campo y el botón viven FUERA del scroll, en un pie fijo: siempre a la mano. */}
        {/* La barra es una capa encima: el pie se sube lo que ella ocupa (con su círculo). */}
        {/* Con el teclado abierto la barra no está: el pie se apoya directamente sobre el teclado. */}
        <View
          style={[
            styles.pie,
            { paddingBottom: teclado.visible ? spacing.sm : alturaTotal + spacing.sm },
          ]}
          testID="preguntar-pie"
        >
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
              placeholder="Tu pregunta"
              accessibilityLabel="Tu pregunta"
              value={texto}
              onChangeText={setTexto}
              maxLength={MAX_CARACTERES_PREGUNTA}
              returnKeyType="done"
              testID="preguntar-campo"
            />
            <BotonIcono
              icon={Send}
              accessibilityLabel="Preguntar"
              loading={pensando}
              disabled={texto.trim() === ''}
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
  // Con fuente grande el enlace "Ver aviso" baja a su propia línea en vez de apretar el texto.
  avisoCorto: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  avisoCortoTexto: { flexGrow: 1, flexShrink: 1 },
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
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  sugeridasAviso: { gap: spacing.xs, marginTop: spacing.sm },
  sugeridasChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filaCampo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  // El campo toma todo lo que sobra; el botón de enviar es un círculo fijo de 48 dp.
  campo: { flex: 1, minWidth: 0 },
});
