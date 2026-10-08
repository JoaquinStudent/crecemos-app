// src/dominio/perfil.ts
import type { Perfil } from './tipos';

/**
 * Perfil de quien abre la app por primera vez. `actualizadoEn` queda vacío: el
 * dominio no lee el reloj, y la fecha se completa al guardar.
 */
export const PERFIL_POR_DEFECTO: Perfil = {
  nombre: '',
  negocio: '',
  aceptaYape: true,
  yapeAjeno: false,
  actualizadoEn: '',
};

/** Inicial en mayúscula de la primera palabra del nombre; '?' si no hay nombre. */
export const inicialesAvatar = (nombre: string): string => {
  const primera = nombre.trim().charAt(0);
  return primera ? primera.toUpperCase() : '?';
};

/**
 * Un Yape que no se acepta no puede ser "ajeno" (P17). Se apaga `yapeAjeno` y se conservan
 * número, titular y parentesco, para que no se pierdan si vuelve a aceptar Yape. No muta.
 */
export const normalizarPerfil = (p: Perfil): Perfil =>
  p.aceptaYape || !p.yapeAjeno ? p : { ...p, yapeAjeno: false };
