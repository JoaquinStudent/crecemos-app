// src/dominio/perfil.ts

/** Inicial en mayúscula de la primera palabra del nombre; '?' si no hay nombre. */
export const inicialesAvatar = (nombre: string): string => {
  const primera = nombre.trim().charAt(0);
  return primera ? primera.toUpperCase() : '?';
};
