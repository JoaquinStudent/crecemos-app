// src/dominio/origen.ts
// Datos de ejemplo contra datos propios. Puro: sin React ni almacenamiento.
import type { Cierre, Producto } from './tipos';

/** Sin el campo (datos guardados antes de existir) cuenta como propio. */
export const esEjemplo = (x: { origen?: 'ejemplo' | 'propio' }): boolean => x.origen === 'ejemplo';

/** Los productos de ejemplo que ya usa algún día propio pasan a ser del usuario: no se borran. */
const productosEnUso = (cierres: Cierre[]): Set<string> =>
  new Set(cierres.filter(c => !esEjemplo(c)).flatMap(c => c.lineas.map(l => l.productoId)));

export interface DatosDeEjemplo {
  /** Días de ejemplo que se borrarían. */
  dias: number;
  /** Productos de ejemplo que se borrarían (sin los que ya usa un día propio). */
  productos: number;
}

/** Cuánto hay de ejemplo; todo en cero si no hay nada. */
export const contarDatosDeEjemplo = (cierres: Cierre[], productos: Producto[]): DatosDeEjemplo => {
  const usados = productosEnUso(cierres);
  return {
    dias: cierres.filter(esEjemplo).length,
    productos: productos.filter(p => esEjemplo(p) && !usados.has(p.id)).length,
  };
};

/** Lo que queda después de borrar los datos de ejemplo. No muta la entrada. */
export const sinDatosDeEjemplo = (
  cierres: Cierre[],
  productos: Producto[],
): { cierres: Cierre[]; productos: Producto[] } => {
  const usados = productosEnUso(cierres);
  return {
    cierres: cierres.filter(c => !esEjemplo(c)),
    productos: productos
      .filter(p => !esEjemplo(p) || usados.has(p.id))
      .map(p => (esEjemplo(p) ? { ...p, origen: 'propio' as const } : p)),
  };
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** La confirmación con la consecuencia en palabras claras: cuántos días se van y qué no se toca. */
export const mensajeBorrarEjemplo = ({ dias, productos }: DatosDeEjemplo): string => {
  const quita = [
    plural(dias, 'día de ejemplo', 'días de ejemplo'),
    ...(productos > 0 ? [plural(productos, 'producto de ejemplo', 'productos de ejemplo')] : []),
  ].join(' y ');
  return `Se van a borrar ${quita}. Los días y productos que anotaste tú no se tocan.`;
};
