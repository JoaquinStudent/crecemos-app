// src/services/compartir.ts
// Abre la hoja nativa de compartir con el texto del reporte (WhatsApp, correo…). Sin red, sin
// dependencias: es `Share` de React Native. Solo lo llama el botón "Compartir reporte" (P6 de
// manejo-de-datos.md: ningún dato sale sin una acción explícita).
import { Share } from 'react-native';

/**
 * `ok: true` también cuando la persona cierra la hoja sin compartir: no es un error. El código de
 * error no llega a ninguna pantalla; la pantalla lo traduce a una frase con voz de Freddy.
 */
export type ResultadoCompartir =
  | { ok: true }
  | { ok: false; error: 'NO_SE_PUDO_ABRIR' | 'NO_SE_PUDO_PREPARAR' };

/** Nunca lanza: si la hoja no se puede abrir devuelve el resultado con error. */
export const compartirReporte = async (texto: string): Promise<ResultadoCompartir> => {
  try {
    await Share.share({ message: texto });
    return { ok: true };
  } catch {
    return { ok: false, error: 'NO_SE_PUDO_ABRIR' };
  }
};
