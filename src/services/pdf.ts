// src/services/pdf.ts
// Genera el reporte como PDF en el teléfono y abre la hoja nativa de compartir con el archivo. Sin
// red: el PDF se arma con `react-native-html-to-pdf` a partir del HTML y se comparte con
// `react-native-share`. Solo lo llama el botón "Compartir reporte" (P6 de manejo-de-datos.md: ningún
// dato sale sin una acción explícita). No guarda la ruta del archivo: el contenedor de la app cambia
// al reinstalar, así que se genera y se comparte en el momento.
import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import type { ResultadoCompartir } from './compartir';

/** Hoja A4 en puntos. La librería pide ancho y alto juntos: sin ellos usa US Letter. */
export const ANCHO_A4_PT = 595;
export const ALTO_A4_PT = 842;

/** Blanco puro: por defecto la librería pinta la hoja de #F6F5F0. */
const FONDO_BLANCO = '#FFFFFF';
const TIPO_PDF = 'application/pdf';

/**
 * Genera el PDF y abre la hoja de compartir. Nunca lanza: si no se pudo generar devuelve
 * `NO_SE_PUDO_PREPARAR` y si no se pudo abrir la hoja, `NO_SE_PUDO_ABRIR`. Cerrar la hoja sin
 * compartir es `ok: true` (con `failOnCancel` apagado no es un error).
 */
export const compartirPdf = async (
  html: string,
  nombreArchivo: string,
  titulo: string,
): Promise<ResultadoCompartir> => {
  let ruta: string;
  try {
    const pdf = await generatePDF({
      html,
      fileName: nombreArchivo,
      width: ANCHO_A4_PT,
      height: ALTO_A4_PT,
      bgColor: FONDO_BLANCO,
      padding: 0,
      shouldPrintBackgrounds: true,
      directory: 'Documents',
    });
    if (typeof pdf?.filePath !== 'string' || pdf.filePath === '') {
      return { ok: false, error: 'NO_SE_PUDO_PREPARAR' };
    }
    ruta = pdf.filePath;
  } catch {
    return { ok: false, error: 'NO_SE_PUDO_PREPARAR' };
  }

  try {
    await Share.open({
      url: ruta.startsWith('file://') ? ruta : `file://${ruta}`,
      type: TIPO_PDF,
      title: titulo,
      failOnCancel: false,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'NO_SE_PUDO_ABRIR' };
  }
};

/** Un PDF ya armado en el teléfono, con su contenido en base64 (para subirlo si la persona lo confirma). */
export type ResultadoGenerarPdf =
  | { ok: true; base64: string; ruta: string }
  | { ok: false; error: 'NO_SE_PUDO_PREPARAR' };

/**
 * Genera el PDF SIN abrir la hoja de compartir y lo devuelve en base64 (`base64: true` de
 * `react-native-html-to-pdf`, sin librerías nuevas). Solo lo llama "Crear enlace con QR", después de
 * que la persona confirma. Nunca lanza.
 */
export const generarPdf = async (
  html: string,
  nombreArchivo: string,
): Promise<ResultadoGenerarPdf> => {
  try {
    const pdf = await generatePDF({
      html,
      fileName: nombreArchivo,
      width: ANCHO_A4_PT,
      height: ALTO_A4_PT,
      bgColor: FONDO_BLANCO,
      padding: 0,
      shouldPrintBackgrounds: true,
      directory: 'Documents',
      base64: true,
    });
    if (typeof pdf?.base64 !== 'string' || pdf.base64 === '' || typeof pdf.filePath !== 'string') {
      return { ok: false, error: 'NO_SE_PUDO_PREPARAR' };
    }
    return { ok: true, base64: pdf.base64, ruta: pdf.filePath };
  } catch {
    return { ok: false, error: 'NO_SE_PUDO_PREPARAR' };
  }
};
