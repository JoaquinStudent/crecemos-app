// src/analisis/metricas.ts
// Cálculos puros sobre los cierres. Sin React, sin reloj (AGENTS.md, regla 3).
import { formatoSoles, redondearSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, GananciaProducto, ResumenCiclo } from '@dominio/tipos';

const vendidas = (preparadas: number, sobrantes: number): number => preparadas - sobrantes;

/** Ganancia de un día: Σ vendidas × (precio − costo) de sus líneas copiadas (D2). No es "te queda". */
export const gananciaDelDia = (c: Cierre): number =>
  redondearSoles(
    c.lineas.reduce(
      (total, l) =>
        total + vendidas(l.preparadas, l.sobrantes) * (l.precioUnitario - l.costoUnitario),
      0,
    ),
  );

/**
 * Por producto, desde `desde` (inclusive): lo que se vende, lo que deja por porción y la ganancia
 * total. Usa el precio y costo copiados en cada línea, nunca el de hoy (D2). Ordenado por ganancia
 * descendente; el empate, por nombre. El nombre es el de la línea más reciente. No muta la entrada.
 */
export const gananciaPorProducto = (cierres: Cierre[], desde: FechaNegocio): GananciaProducto[] => {
  const ordenados = cierres
    .filter(c => c.fecha >= desde)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const porProducto = new Map<string, GananciaProducto>();
  for (const cierre of ordenados) {
    for (const l of cierre.lineas) {
      const n = vendidas(l.preparadas, l.sobrantes);
      const previo = porProducto.get(l.productoId);
      porProducto.set(l.productoId, {
        productoId: l.productoId,
        nombre: l.nombre,
        seVende: (previo?.seVende ?? 0) + n,
        teDeja: 0,
        ganancia: (previo?.ganancia ?? 0) + n * (l.precioUnitario - l.costoUnitario),
      });
    }
  }
  return [...porProducto.values()]
    .map(g => {
      const ganancia = redondearSoles(g.ganancia);
      return { ...g, ganancia, teDeja: g.seVende > 0 ? redondearSoles(ganancia / g.seVende) : 0 };
    })
    .sort((a, b) => b.ganancia - a.ganancia || a.nombre.localeCompare(b.nombre));
};

/** 'la' si el nombre termina en "a", si no 'el': "la pancita", "el anticucho". */
export const articulo = (nombre: string): string =>
  nombre.toLowerCase().endsWith('a') ? 'la' : 'el';

/**
 * El producto que más se vende y el que más deja por porción, con los mismos desempates para
 * `insight` y para el chat (el otro criterio, luego el nombre). `null` con menos de 2 productos con
 * ventas.
 */
export const extremosDeVentas = (
  g: GananciaProducto[],
): { masVendido: GananciaProducto; masDeja: GananciaProducto } | null => {
  const conVentas = g.filter(x => x.seVende > 0);
  if (conVentas.length < 2) return null;
  // Los empates se resuelven a favor del otro criterio: si el más vendido también deja lo máximo, no hay contraste.
  const masVendido = [...conVentas].sort(
    (a, b) => b.seVende - a.seVende || b.teDeja - a.teDeja || a.nombre.localeCompare(b.nombre),
  )[0];
  const masDeja = [...conVentas].sort(
    (a, b) => b.teDeja - a.teDeja || b.seVende - a.seVende || a.nombre.localeCompare(b.nombre),
  )[0];
  return { masVendido, masDeja };
};

/**
 * "La pancita se vende más, pero el anticucho te deja S/ 0.80 más por porción." La diferencia es de
 * "te deja" por porción entre el que más deja y el más vendido. `null` si son el mismo producto o
 * si hay menos de 2 productos con ventas.
 */
export const insight = (g: GananciaProducto[]): string | null => {
  const extremos = extremosDeVentas(g);
  if (extremos === null) return null;
  const { masVendido, masDeja } = extremos;
  if (masVendido.productoId === masDeja.productoId) return null;
  const diferencia = redondearSoles(masDeja.teDeja - masVendido.teDeja);
  const vendido = masVendido.nombre.toLowerCase();
  const deja = masDeja.nombre.toLowerCase();
  const inicio = `${articulo(vendido)} ${vendido}`;
  return `${inicio.charAt(0).toUpperCase()}${inicio.slice(1)} se vende más, pero ${articulo(
    deja,
  )} ${deja} te deja ${formatoSoles(diferencia)} más por porción.`;
};

/**
 * Compara el "te queda" de dos ciclos. Un solo texto para los tres casos (más, menos, igual),
 * también si el ciclo actual quedó en negativo.
 */
export const compararCiclos = (actual: ResumenCiclo, anterior: ResumenCiclo): string => {
  const diferencia = redondearSoles(actual.teQueda - anterior.teQueda);
  if (diferencia === 0) return 'Ganaste lo mismo que el ciclo pasado';
  return `Ganaste ${formatoSoles(Math.abs(diferencia))} ${
    diferencia > 0 ? 'más' : 'menos'
  } que el ciclo pasado`;
};
