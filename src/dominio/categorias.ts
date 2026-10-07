// src/dominio/categorias.ts
import type { CategoriaGasto } from './tipos';

/** Cómo se llama cada categoría de gasto en pantalla (voz de Freddy). */
export const ETIQUETA_GASTO: Readonly<Record<CategoriaGasto, string>> = {
  mercaderia: 'Mercadería',
  carbon: 'Carbón',
  movilidad: 'Movilidad',
  gas: 'Gas',
  otro: 'Otros gastos',
};
