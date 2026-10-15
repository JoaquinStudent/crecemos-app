// src/analisis/claveReporte.ts
// La clave de un reporte: una huella corta de sus DATOS de entrada (el periodo, los cierres que entran, los
// productos y la identidad del negocio). Sirve para no subir dos veces el mismo contenido a la nube. Puro: sin
// reloj, sin React, sin red. NO depende de nada que cambie solo: ni la fecha de emisión, ni la hora, ni el
// enlace, su QR o su código. Tampoco guarda ni deja ver los datos: del contenido solo sale la huella.
import type { Cierre, Perfil, Producto } from '@dominio/tipos';

/** Dos hashes de 32 bits independientes (FNV-1a y DJB2) juntos: 64 bits en 16 hexadecimales. */
const huella = (texto: string): string => {
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i);
    fnv = Math.imul(fnv ^ c, 0x01000193) >>> 0;
    djb = (Math.imul(djb, 33) + c) >>> 0;
  }
  return `${fnv.toString(16).padStart(8, '0')}${djb.toString(16).padStart(8, '0')}`;
};

/**
 * La clave del reporte. Entran: la etiqueta del periodo (es lo que dice el documento), cada cierre del periodo
 * con lo que el reporte usa (fecha, porciones, precios, gastos; no el Yape), los productos por id y nombre,
 * el nombre, el negocio y la foto, y si son datos de ejemplo. El orden de las listas no cambia la clave.
 */
export const claveDelReporte = (
  etiquetaPeriodo: string,
  cierres: readonly Cierre[],
  productos: readonly Producto[],
  perfil: Perfil | null,
  soloEjemplo: boolean,
): string => {
  const dias = [...cierres]
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id < b.id ? -1 : 1))
    .map(c => [
      c.id,
      c.fecha,
      c.lineas.map(l => [
        l.productoId,
        l.nombre,
        l.preparadas,
        l.sobrantes,
        l.precioUnitario,
        l.costoUnitario,
      ]),
      c.gastos.map(g => [g.categoria, g.monto]),
    ]);
  const catalogo = [...productos].map(p => [p.id, p.nombre]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return huella(
    JSON.stringify([
      etiquetaPeriodo,
      dias,
      catalogo,
      perfil?.nombre ?? '',
      perfil?.negocio ?? '',
      perfil?.fotoUri ?? '',
      soloEjemplo,
    ]),
  );
};
