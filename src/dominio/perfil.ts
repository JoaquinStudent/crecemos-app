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
