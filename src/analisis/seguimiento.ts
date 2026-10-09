// src/analisis/seguimiento.ts
// El hilo de la conversación vive SOLO en el teléfono: a Jev se le manda el texto de la pregunta
// actual y nada más. Cuando Freddy sigue la charla ("¿y de la pancita?", "¿y ayer?"), Jev suele sacar
// bien el producto o el día pero pierde la intención. Aquí el código la completa con la última
// consulta resuelta del hilo, con reglas cerradas. Puro: sin red, sin reloj, sin React (AGENTS.md,
// reglas 3 y 8).
import type { Consulta, IntencionId } from '@dominio/tipos';

/** Las intenciones que usan un producto. */
const USA_PRODUCTO: readonly IntencionId[] = ['cuantoPreparar', 'revisarPrecio'];
/** Las intenciones que usan un día. */
const USA_DIA: readonly IntencionId[] = ['ventaDelDia'];

/** Con tantas palabras o menos, una frase cuenta como corta (un seguimiento, no una pregunta completa). */
const PALABRAS_FRASE_CORTA = 2;
/** Palabras con las que empieza un seguimiento. "y" cubre "y de", "y el", "y la", "y ayer", "y mañana"… */
const CONECTORES = ['y', 'tambien'];
const CONECTORES_DOBLES = ['igual para', 'lo mismo'];

const palabrasDe = (texto: string): string[] =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .trim()
    .split(' ')
    .filter(p => p !== '');

/** ¿La frase es un seguimiento? Corta, o empieza con un conector. */
const esSeguimiento = (texto: string): boolean => {
  const palabras = palabrasDe(texto);
  if (palabras.length === 0) return false;
  if (palabras.length <= PALABRAS_FRASE_CORTA) return true;
  if (CONECTORES.includes(palabras[0])) return true;
  return CONECTORES_DOBLES.includes(`${palabras[0]} ${palabras[1]}`);
};

const tieneDia = (c: Consulta): boolean => c.dia !== undefined && c.dia !== 'ninguno';

/**
 * Completa la consulta nueva con la anterior del hilo (`previa`, la última resuelta con éxito):
 * - Si Jev no entendió pero detectó un producto o un día que la intención anterior usa, se reutiliza
 *   esa intención con el dato nuevo.
 * - Si la intención es real y le falta el producto o el día que usa, y la frase es un seguimiento,
 *   hereda el dato de la previa. Una pregunta completa no hereda nada.
 * - Sin previa, o con una previa que no se entendió, no hay herencia. No muta lo que recibe.
 */
export const completarConsulta = (
  nueva: Consulta,
  previa?: Consulta | null,
  texto = '',
): Consulta => {
  if (!previa || previa.intencion === 'noEntendi') return nueva;

  if (nueva.intencion === 'noEntendi') {
    const productoNuevo = nueva.producto !== undefined && USA_PRODUCTO.includes(previa.intencion);
    const diaNuevo = tieneDia(nueva) && USA_DIA.includes(previa.intencion);
    if (!productoNuevo && !diaNuevo) return nueva;
    return {
      intencion: previa.intencion,
      ...(productoNuevo ? { producto: nueva.producto } : {}),
      ...(diaNuevo ? { dia: nueva.dia } : {}),
      confianza: nueva.confianza,
    };
  }

  if (!esSeguimiento(texto)) return nueva;
  const heredaProducto =
    USA_PRODUCTO.includes(nueva.intencion) &&
    nueva.producto === undefined &&
    previa.producto !== undefined;
  const heredaDia = USA_DIA.includes(nueva.intencion) && !tieneDia(nueva) && tieneDia(previa);
  if (!heredaProducto && !heredaDia) return nueva;
  return {
    ...nueva,
    ...(heredaProducto ? { producto: previa.producto } : {}),
    ...(heredaDia ? { dia: previa.dia } : {}),
  };
};
