// src/dominio/foto.ts
// Foto de perfil: validación y avatar. Puro: sin React, sin reloj, sin Buffer ni atob (Hermes).
import { inicialesAvatar } from './perfil';
import type { Perfil } from './tipos';
import type { ResultadoValidacion } from './validacion';

/** Tope de la foto ya reducida: 60 KB decodificados (SPEC-07). */
export const FOTO_MAX_BYTES = 61440;

export const MENSAJES_FOTO = {
  noEsFoto: 'Esa no parece una foto. Elige otra.',
  pesada: 'Esa foto es muy pesada. Elige otra.',
} as const;

export type Avatar = { tipo: 'foto'; uri: string } | { tipo: 'iniciales'; texto: string };

const PREFIJO = 'data:image/';
const MARCA_BASE64 = ';base64,';

const error = (mensaje: string): ResultadoValidacion => ({
  ok: false,
  errores: { foto: mensaje },
});

/** Bytes que decodifica una carga base64: 3 por cada 4 caracteres, menos el relleno `=`. */
const bytesDeBase64 = (carga: string): number => {
  let relleno = 0;
  while (relleno < 2 && carga.charAt(carga.length - 1 - relleno) === '=') relleno += 1;
  return Math.floor((carga.length * 3) / 4) - relleno;
};

/**
 * Una foto vale si es un "data:image/…;base64,…" con contenido y de 60 KB o menos ya decodificada.
 * Acepta cualquier tipo de imagen: la librería de selección devuelve `image/jpg`, no `image/jpeg`.
 */
export const validarFoto = (fotoUri: string): ResultadoValidacion => {
  const marca = fotoUri.indexOf(MARCA_BASE64);
  const carga = marca < 0 ? '' : fotoUri.slice(marca + MARCA_BASE64.length);
  if (
    !fotoUri.startsWith(PREFIJO) ||
    marca < 0 ||
    fotoUri.slice(0, marca).includes(',') ||
    carga === ''
  ) {
    return error(MENSAJES_FOTO.noEsFoto);
  }
  return bytesDeBase64(carga) > FOTO_MAX_BYTES ? error(MENSAJES_FOTO.pesada) : { ok: true };
};

/**
 * Arma el texto que se guarda en el perfil: 'data:<tipo>;base64,<base64>'. `image/jpg` pasa a
 * `image/jpeg`; sin tipo (o con uno que no es de imagen) es `image/jpeg`. Quita saltos y espacios.
 */
export const armarFotoUri = (base64: string, tipo?: string): string => {
  const limpio = (tipo ?? '').trim().toLowerCase();
  const normalizado =
    limpio === 'image/jpg' || !limpio.startsWith('image/') ? 'image/jpeg' : limpio;
  return `data:${normalizado};base64,${base64.replace(/\s+/g, '')}`;
};

/** Qué dibuja el avatar: la foto si existe y es válida; si no, la inicial del nombre ('?' sin nombre). */
export const avatarDe = (perfil: Perfil | null): Avatar =>
  perfil?.fotoUri !== undefined && validarFoto(perfil.fotoUri).ok
    ? { tipo: 'foto', uri: perfil.fotoUri }
    : { tipo: 'iniciales', texto: inicialesAvatar(perfil?.nombre ?? '') };

/** Copia del perfil sin foto. No muta el original. */
export const quitarFoto = (perfil: Perfil): Perfil => {
  const copia = { ...perfil };
  delete copia.fotoUri;
  return copia;
};
