// src/services/voz.ts
// La única puerta al reconocedor de voz del sistema (Android SpeechRecognizer) para "Cuéntame tu
// día". Nadie más importa la librería nativa: si hay que cambiarla, se cambia solo este archivo.
//
// Privacidad: el audio lo procesa el servicio de voz del teléfono. Si el teléfono no tiene el
// paquete de español sin conexión, Android puede enviarlo a Google. Por eso el aviso de
// PreguntarScreen y el de Cerrar día lo dicen. El texto reconocido NO sale de la app: lo lee
// `interpretarDia`, que es local.
import { PermissionsAndroid, Platform } from 'react-native';
import Voice from '@react-native-voice/voice';
import type { SpeechErrorEvent, SpeechResultsEvent } from '@react-native-voice/voice';

export const IDIOMA_VOZ = 'es-PE';

/** Por qué no se pudo dictar, en un código que la pantalla traduce a una frase clara. */
export type ErrorVoz = 'permiso' | 'sin-servicio' | 'sin-voz' | 'otro';

export interface EscuchaVoz {
  /** Texto parcial mientras la persona habla. */
  alParcial: (texto: string) => void;
  /** Texto final cuando termina de hablar. */
  alFinal: (texto: string) => void;
  alError: (error: ErrorVoz) => void;
  /** Se cerró la escucha (con o sin resultado). */
  alTerminar: () => void;
}

/** Códigos de SpeechRecognizer.ERROR_*: 7 = no entendió nada, 6 = no habló, 9 = sin permiso. */
export const errorDeCodigo = (codigo: string | undefined): ErrorVoz => {
  switch (codigo) {
    case '6':
    case '7':
      return 'sin-voz';
    case '9':
      return 'permiso';
    case '2':
    case '3':
    case '5':
    case '8':
    case '11':
      return 'sin-servicio';
    default:
      return 'otro';
  }
};

const primero = (e: SpeechResultsEvent): string => (e.value && e.value[0] ? e.value[0] : '');

const pedirPermisoMicrofono = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  const resultado = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Usar el micrófono',
    message: 'Crecemos usa el micrófono solo mientras tocas "Hablar", para anotar tu día.',
    buttonPositive: 'Permitir',
    buttonNegative: 'Ahora no',
  });
  return resultado === PermissionsAndroid.RESULTS.GRANTED;
};

/** ¿El teléfono trae un reconocedor de voz? Sin él, la pantalla esconde el botón. */
export const vozDisponible = async (): Promise<boolean> => {
  try {
    return Boolean(await Voice.isAvailable());
  } catch {
    return false;
  }
};

/** Empieza a escuchar. Pide el permiso la primera vez. Nunca lanza: avisa por `alError`. */
export const empezarAEscuchar = async (escucha: EscuchaVoz): Promise<void> => {
  Voice.onSpeechPartialResults = e => escucha.alParcial(primero(e));
  Voice.onSpeechResults = e => escucha.alFinal(primero(e));
  Voice.onSpeechError = (e: SpeechErrorEvent) => {
    escucha.alError(errorDeCodigo(e.error?.code));
    escucha.alTerminar();
  };
  Voice.onSpeechEnd = () => escucha.alTerminar();
  try {
    if (!(await pedirPermisoMicrofono())) {
      escucha.alError('permiso');
      escucha.alTerminar();
      return;
    }
    await Voice.start(IDIOMA_VOZ);
  } catch {
    escucha.alError('otro');
    escucha.alTerminar();
  }
};

/** Deja de escuchar; el reconocedor entrega el resultado final. */
export const dejarDeEscuchar = async (): Promise<void> => {
  try {
    await Voice.stop();
  } catch {
    // Ya estaba detenido.
  }
};

/** Libera el reconocedor al salir de la pantalla. */
export const soltarVoz = async (): Promise<void> => {
  try {
    await Voice.destroy();
  } catch {
    // Nada que liberar.
  }
  Voice.removeAllListeners();
};
