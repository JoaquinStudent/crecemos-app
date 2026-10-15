// src/dominio/reporteGuardado.ts
// Los enlaces de reporte que la app recuerda en el teléfono y la lista "Mis reportes". Puro: sin React, sin
// reloj (el instante entra como parámetro) y sin red. Una entrada NO lleva cierres, Yape ni ubicación: solo la
// huella del contenido, el enlace, su caducidad, el token para borrarlo y, si la persona quiso, un título.
import { nombreMes } from './formato';
import type { FechaNegocio } from './tipos';

/** Cuántos reportes se pueden guardar en "Mis reportes". Al intentar el 21 hay que quitar uno. */
export const MAX_REPORTES_GUARDADOS = 20;
/** Cuántos enlaces vigentes sin guardar se recuerdan solo para no subir dos veces lo mismo. */
export const MAX_ENLACES_TEMPORALES = 5;
/** Largo máximo del título de un reporte guardado. */
export const MAX_TITULO = 50;

const MS_POR_DIA = 86400000;

export interface EntradaReporte {
  /** Huella del contenido (`claveDelReporte`). */
  clave: string;
  /** El id del enlace (32 hexadecimales). */
  id: string;
  url: string;
  /** Permite borrar el archivo de la nube. Vive solo en el teléfono: nunca se muestra ni se comparte. */
  tokenBorrado: string;
  periodoEtiqueta: string;
  /** El filtro con que se creó (un `FiltroPeriodo`), para poder crear uno nuevo del mismo periodo. */
  filtro: unknown;
  /** ISO 8601. */
  creadoEn: string;
  /** ISO 8601. */
  caduca: string;
  /** `true`: aparece en "Mis reportes". `false`: solo recuerda el enlace para no subirlo dos veces. */
  guardado: boolean;
  titulo?: string;
}

export const esEntradaReporte = (x: unknown): x is EntradaReporte => {
  const e = x as Partial<EntradaReporte> | null;
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof e.clave === 'string' &&
    typeof e.id === 'string' &&
    typeof e.url === 'string' &&
    typeof e.tokenBorrado === 'string' &&
    typeof e.periodoEtiqueta === 'string' &&
    typeof e.creadoEn === 'string' &&
    typeof e.caduca === 'string' &&
    !Number.isNaN(Date.parse(e.caduca)) &&
    typeof e.guardado === 'boolean' &&
    (e.titulo === undefined || typeof e.titulo === 'string')
  );
};

/** ¿Todavía no caduca? (`ahora` en milisegundos) */
export const estaVigente = (e: Pick<EntradaReporte, 'caduca'>, ahora: number): boolean =>
  Date.parse(e.caduca) > ahora;

/** Cuántos días quedan (se redondea hacia arriba: «queda 1 día» hasta el último minuto); 0 si ya caducó. */
export const diasQueQuedan = (caduca: string, ahora: number): number =>
  Math.max(0, Math.ceil((Date.parse(caduca) - ahora) / MS_POR_DIA));

/** El título limpio: sin caracteres de control, con los espacios juntos y de a lo más 50 caracteres. `''` si queda vacío. */
export const sanearTitulo = (titulo: string): string =>
  titulo
    // eslint-disable-next-line no-control-regex -- justamente se quitan los caracteres de control
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITULO)
    .trim();

/** '15 oct': el día y el mes en tres letras. */
const fechaBreve = (f: FechaNegocio): string =>
  `${Number(f.split('-')[2])} ${nombreMes(f).slice(0, 3).toLowerCase()}`;

/**
 * El título que se sugiere según el periodo: «Todo mi historial · 15 oct», «Septiembre 2026»,
 * «Últimos 30 días · 15 oct». La persona lo puede cambiar.
 */
export const tituloSugerido = (
  tipoFiltro: string,
  etiquetaPeriodo: string,
  hoy: FechaNegocio,
): string => {
  const fecha = fechaBreve(hoy);
  const etiqueta = etiquetaPeriodo.replace(/\s*\(en curso\)\s*$/, '');
  const titulo =
    tipoFiltro === 'todo'
      ? `Todo mi historial · ${fecha}`
      : tipoFiltro === 'ultimos30'
      ? `Últimos 30 días · ${fecha}`
      : tipoFiltro === 'esteMes'
      ? `${etiqueta} · ${fecha}`
      : etiqueta;
  return sanearTitulo(titulo);
};
