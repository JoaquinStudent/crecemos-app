// src/services/reporteNube.ts
// "Crear enlace con QR": reserva el enlace en el Worker, arma el PDF del reporte CON el QR de ese enlace,
// lo sube y recuerda el resultado en el almacenamiento local (una entrada pequeña por enlace: la huella del
// contenido, el id, la dirección y la fecha de caducidad), para que cerrar y abrir la app NO suba el mismo
// contenido otra vez. El enlace ya es público y caduca igual; recordarlo no expone nada nuevo.
// Solo lo llama el botón, DESPUÉS de que la persona confirma. Nunca lanza.
import { Clipboard } from 'react-native';
import type { EntradaReporte } from '@dominio/reporteGuardado';
import {
  entradaDeReporte,
  quitarReporteDeLista,
  registrarEntradaDeReporte,
} from '@storage/repositorio';
import { generarPdf } from './pdf';
import {
  borrarReporteEnNube,
  reservarReporte,
  subirReporte,
  type EnlaceReporte,
  type ErrorSubida,
} from './jev';

export type ResultadoCrearEnlace =
  | { ok: true; entrada: EntradaReporte; reutilizado: boolean }
  | { ok: false; error: ErrorSubida | 'NO_SE_PUDO_PREPARAR' };

/** Lo que identifica al reporte que se va a subir: el periodo con que se creó (para poder crear otro igual). */
export interface MetaReporte {
  filtro: unknown;
  periodoEtiqueta: string;
}

/** La entrada vigente de ese contenido (la clave sale de `claveDelReporte`), o `null`. Lo vencido se descarta. */
export const entradaVigente = (clave: string): Promise<EntradaReporte | null> =>
  entradaDeReporte(clave);

/** El enlace público de una entrada. */
export const enlaceDe = (e: EntradaReporte): EnlaceReporte => ({
  id: e.id,
  url: e.url,
  caduca: e.caduca,
});

/** Creaciones en curso, por clave: un segundo toque (o volver a la pantalla) no lanza otra. */
const creaciones = new Map<string, Promise<ResultadoCrearEnlace>>();

/** La creación que está corriendo para esa clave, si la hay. */
export const creacionEnCurso = (clave: string): Promise<ResultadoCrearEnlace> | null =>
  creaciones.get(clave) ?? null;

const crear = async (
  clave: string,
  meta: MetaReporte,
  armarHtml: (enlace: EnlaceReporte) => string,
  nombreArchivo: string,
  fetchFn: typeof fetch,
  url: string,
): Promise<ResultadoCrearEnlace> => {
  const vigente = await entradaVigente(clave);
  if (vigente) return { ok: true, entrada: vigente, reutilizado: true };
  const reserva = await reservarReporte(fetchFn, url);
  if (!reserva.ok) return reserva;
  const pdf = await generarPdf(armarHtml(reserva.enlace), nombreArchivo);
  if (!pdf.ok) return pdf;
  const subida = await subirReporte(fetchFn, url, reserva.enlace.id, pdf.base64);
  if (!subida.ok) return subida;
  // Solo un enlace COMPLETO se recuerda: si algo falló antes, no queda nada guardado.
  const entrada: EntradaReporte = {
    clave,
    ...subida.enlace,
    tokenBorrado: reserva.token,
    periodoEtiqueta: meta.periodoEtiqueta,
    filtro: meta.filtro,
    creadoEn: new Date().toISOString(),
    guardado: false,
  };
  await registrarEntradaDeReporte(entrada);
  // Si esa clave ya estaba guardada, la entrada heredó su lugar y su título: se devuelve la que quedó.
  return { ok: true, entrada: (await entradaVigente(clave)) ?? entrada, reutilizado: false };
};

/**
 * Crea el enlace del reporte. Si ya hay uno vigente para el mismo contenido (en esta sesión o en una anterior)
 * no reserva ni sube nada. Si no: reserva → PDF con el QR de la dirección reservada → sube ese mismo PDF. Mientras
 * corre, otra llamada con la misma clave recibe la MISMA promesa. `armarHtml(enlace)` devuelve el documento con
 * el QR de ese enlace.
 */
export const crearEnlaceReporte = (
  clave: string,
  meta: MetaReporte,
  armarHtml: (enlace: EnlaceReporte) => string,
  nombreArchivo: string,
  fetchFn: typeof fetch,
  url: string,
): Promise<ResultadoCrearEnlace> => {
  const enCurso = creaciones.get(clave);
  if (enCurso) return enCurso;
  const promesa = crear(clave, meta, armarHtml, nombreArchivo, fetchFn, url)
    .catch((): ResultadoCrearEnlace => ({ ok: false, error: 'SERVIDOR' }))
    .finally(() => {
      creaciones.delete(clave);
    });
  creaciones.set(clave, promesa);
  return promesa;
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

/** Borrados en curso, por clave: un segundo toque no lanza otro. */
const borrados = new Set<string>();

export type ResultadoBorrarDeLaNube = { ok: true } | { ok: false; error: ErrorSubida | 'OCUPADO' };

/**
 * Borra el archivo de la nube con el token guardado y, solo si el Worker lo confirmó, quita la entrada de la
 * lista (un enlace borrado ya no tiene nada que mostrar). Si falla, la entrada se queda tal cual. Nunca lanza.
 */
export const borrarDeLaNube = async (
  entrada: EntradaReporte,
  fetchFn: typeof fetch,
  url: string,
): Promise<ResultadoBorrarDeLaNube> => {
  if (borrados.has(entrada.clave)) return { ok: false, error: 'OCUPADO' };
  borrados.add(entrada.clave);
  try {
    const r = await borrarReporteEnNube(fetchFn, url, entrada.id, entrada.tokenBorrado);
    if (!r.ok) return r;
    await quitarReporteDeLista(entrada.clave);
    return { ok: true };
  } catch {
    return { ok: false, error: 'SERVIDOR' };
  } finally {
    borrados.delete(entrada.clave);
  }
};
