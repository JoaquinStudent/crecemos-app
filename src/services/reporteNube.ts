// src/services/reporteNube.ts
// "Crear enlace con QR": arma el PDF del reporte en el teléfono, lo sube al Worker (por `jev.ts`, la puerta
// a la red) y recuerda el enlace SOLO en memoria mientras la app siga abierta. Nada se guarda en el
// almacenamiento: al cerrar la app el enlace se olvida (sigue vivo en la nube hasta que caduque, pero
// el teléfono no lo recuerda). Solo lo llama el botón, DESPUÉS de que la persona confirma. Nunca lanza.
import { Clipboard } from 'react-native';
import { generarPdf } from './pdf';
import { subirReporte, type EnlaceReporte, type ErrorSubida } from './jev';

export type ResultadoCrearEnlace =
  | { ok: true; enlace: EnlaceReporte; reutilizado: boolean }
  | { ok: false; error: ErrorSubida | 'NO_SE_PUDO_PREPARAR' };

/** Enlaces creados en esta sesión, por el documento (HTML) exacto que se subió. Solo memoria. */
const enlacesDeLaSesion = new Map<string, EnlaceReporte>();

/** El enlace de esta sesión para ESTE documento, si todavía no caduca; si no, `null`. */
export const enlaceVigente = (html: string, ahora: number = Date.now()): EnlaceReporte | null => {
  const enlace = enlacesDeLaSesion.get(html);
  if (!enlace) return null;
  if (Date.parse(enlace.caduca) > ahora) return enlace;
  enlacesDeLaSesion.delete(html);
  return null;
};

/** Para las pruebas: olvida los enlaces de la sesión. */
export const olvidarEnlacesDeLaSesion = (): void => enlacesDeLaSesion.clear();

/**
 * Sube el reporte y devuelve su enlace. Si ya hay uno vigente para el mismo documento no sube nada otra
 * vez. Un intento, 8 s (los pone `subirReporte`).
 */
export const crearEnlaceReporte = async (
  html: string,
  nombreArchivo: string,
  fetchFn: typeof fetch,
  url: string,
): Promise<ResultadoCrearEnlace> => {
  const vigente = enlaceVigente(html);
  if (vigente) return { ok: true, enlace: vigente, reutilizado: true };
  const pdf = await generarPdf(html, nombreArchivo);
  if (!pdf.ok) return pdf;
  const subida = await subirReporte(fetchFn, url, pdf.base64);
  if (!subida.ok) return subida;
  enlacesDeLaSesion.set(html, subida.enlace);
  return { ok: true, enlace: subida.enlace, reutilizado: false };
};

/** Copia el enlace al portapapeles. `false` si el teléfono no lo dejó. */
export const copiarEnlace = (enlace: string): boolean => {
  try {
    Clipboard.setString(enlace);
    return true;
  } catch {
    return false;
  }
};
