// src/dominio/ajustes.ts
// Las preferencias de la app que elige la persona (Perfil → Configuración): tamaño de letra,
// vibración al guardar el día y animaciones reducidas. Viven en el Perfil; aquí solo se interpretan.
import type { Perfil } from './tipos';

export type TamanoLetra = 'normal' | 'grande' | 'extra';

/** La tipografía base del tema (typography.ts) está pensada para 18: eso es "Grande". */
const BASE_CUERPO = 18;

/** Cuánto se escala la tipografía base en cada tamaño: Normal = 16, Grande = 18, Extra = 20. */
export const ESCALA_TAMANO: Record<TamanoLetra, number> = {
  normal: 16 / BASE_CUERPO,
  grande: 1,
  extra: 20 / BASE_CUERPO,
};

export const TAMANO_POR_DEFECTO: TamanoLetra = 'normal';

/** Regla 4 de UX: ningún texto baja de 14, ni siquiera en "Normal". */
export const TAMANO_MINIMO = 14;

export const OPCIONES_TAMANO: readonly { valor: TamanoLetra; etiqueta: string }[] = [
  { valor: 'normal', etiqueta: 'Normal' },
  { valor: 'grande', etiqueta: 'Grande' },
  { valor: 'extra', etiqueta: 'Extra grande' },
];

export interface AjustesVisuales {
  tamanoLetra: TamanoLetra;
  vibracion: boolean;
  reducirAnimaciones: boolean;
}

const esTamano = (valor: unknown): valor is TamanoLetra =>
  valor === 'normal' || valor === 'grande' || valor === 'extra';

/** Lo que valen las preferencias de un perfil. Ausente o ilegible = el valor por defecto. */
export const ajustesVisuales = (
  perfil: Pick<Perfil, 'tamanoLetra' | 'vibracion' | 'reducirAnimaciones'>,
): AjustesVisuales => ({
  tamanoLetra: esTamano(perfil.tamanoLetra) ? perfil.tamanoLetra : TAMANO_POR_DEFECTO,
  vibracion: perfil.vibracion !== false,
  reducirAnimaciones: perfil.reducirAnimaciones === true,
});

interface EstiloDeTexto {
  fontSize: number;
  lineHeight: number;
}

/**
 * Las cifras protagonistas (el monto principal de 44, la regla 4 de UX) nunca se achican: en
 * "Normal" quedan como están y solo crecen en "Extra grande".
 */
export const VARIANTES_QUE_NO_SE_ENCOGEN: ReadonlySet<string> = new Set(['hero', 'display']);

/**
 * Escala el tamaño y el interlineado de un estilo de texto. El tamaño no baja de 14; el
 * interlineado conserva la proporción con el tamaño ya escalado. Con `noEncoger`, una escala
 * menor que 1 se ignora.
 */
export const escalarTexto = <T extends EstiloDeTexto>(
  estilo: T,
  factor: number,
  noEncoger = false,
): T => {
  const escala = noEncoger ? Math.max(1, factor) : factor;
  if (escala === 1) return estilo;
  const fontSize = Math.max(TAMANO_MINIMO, Math.round(estilo.fontSize * escala));
  const lineHeight = Math.round(estilo.lineHeight * (fontSize / estilo.fontSize));
  return { ...estilo, fontSize, lineHeight };
};
