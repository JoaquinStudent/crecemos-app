// src/dominio/estacionalidad.ts
// Avisos por época del año. Hoy uno solo: en octubre y en marzo los costos suelen subir (entrevista
// a Freddy). Es una constante de configuración: agregar otro aviso es agregar una fila.
import { restarDias } from './fecha';
import { nombreMes } from './formato';
import type { Cierre, FechaNegocio, Producto } from './tipos';

export interface AlertaEstacional {
  /** Meses del año, 1 a 12. */
  meses: number[];
  /** Lo que pasa, sin el mes ni el producto. */
  texto: string;
}

export const ALERTAS_DE_COSTO: AlertaEstacional[] = [
  { meses: [10, 3], texto: 'tus costos suelen subir' },
];

/** Los últimos días que se miran para saber en qué producto se va más mercadería. */
const DIAS_DE_COSTO = 30;

/** El producto donde más pones (preparadas × costo, últimos 30 días), en minúscula; `null` si no se sabe. */
export const productoDeMayorCosto = (
  cierres: Cierre[],
  productos: Producto[],
  hoy: FechaNegocio,
): string | null => {
  const desde = restarDias(hoy, DIAS_DE_COSTO);
  const totales = new Map<string, { nombre: string; total: number }>();
  for (const c of cierres) {
    if (c.fecha < desde || c.fecha > hoy) continue;
    for (const l of c.lineas) {
      const previo = totales.get(l.productoId);
      const nombre = productos.find(p => p.id === l.productoId)?.nombre ?? l.nombre;
      totales.set(l.productoId, {
        nombre,
        total: (previo?.total ?? 0) + l.preparadas * l.costoUnitario,
      });
    }
  }
  let mayor: { nombre: string; total: number } | null = null;
  for (const t of totales.values()) {
    if (t.total > (mayor?.total ?? 0)) mayor = t;
  }
  return mayor ? mayor.nombre.toLowerCase() : null;
};

/**
 * El aviso de costos del mes de `hoy`: "Octubre: tus costos suelen subir, sobre todo en anticucho,
 * donde más pones. Revisa tus costos en Perfil." `null` fuera de esos meses.
 */
export const alertaDeCostos = (
  hoy: FechaNegocio,
  cierres: Cierre[],
  productos: Producto[],
): string | null => {
  const mes = Number(hoy.split('-')[1]);
  const alerta = ALERTAS_DE_COSTO.find(a => a.meses.includes(mes));
  if (!alerta) return null;
  const nombre = nombreMes(hoy);
  const inicio = `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`;
  const mayor = productoDeMayorCosto(cierres, productos, hoy);
  const sobreTodo = mayor ? `, sobre todo en ${mayor}, donde más pones` : '';
  return `${inicio}: ${alerta.texto}${sobreTodo}. Revisa tus costos en Perfil.`;
};
