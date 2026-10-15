// src/analisis/frasesInteligencia.ts
// Las frases de la inteligencia de negocio: una sola redacción para la pantalla, el texto compartido
// y el documento del reporte. Puro: sin React, sin reloj (AGENTS.md, regla 3).
import { formatoSoles } from '@dominio/formato';
import { textoPorcion } from './graficos';
import type { DiaSemanaNegocio, Inteligencia, MesNegocio } from './inteligencia';

export const NOTA_SIN_DOS_MESES =
  'Aún no hay dos meses terminados para decir cuál fue el más fuerte y cuál el más débil.';
export const NOTA_SIN_DIAS_SEMANA =
  'Aún faltan semanas de registro para decir qué día de la semana deja más y cuál menos.';
export const NOTA_SIN_DIA_VENTAS =
  'Aún faltan días de registro para decir qué día de la semana vendes más.';

/** '1 día cerrado' · '12 días cerrados'. */
export const diasCerradosTexto = (n: number): string =>
  `${n} ${n === 1 ? 'día cerrado' : 'días cerrados'}`;

export const fraseMesFuerte = (m: MesNegocio): string =>
  `${m.etiqueta} (ventas ${formatoSoles(m.venta)}; ${diasCerradosTexto(m.dias)})`;

export const fraseDiaMasVentas = (d: DiaSemanaNegocio): string =>
  `${d.nombre} (${formatoSoles(d.monto)} en promedio por día cerrado)`;

export const fraseDiaQueMasDeja = (d: DiaSemanaNegocio): string =>
  `${d.nombre} (${formatoSoles(d.monto)} más que el promedio de los días)`;

export const fraseDiaQueMenosDeja = (d: DiaSemanaNegocio): string =>
  `${d.nombre} (${formatoSoles(d.monto)} menos que el promedio de los días)`;

export const fraseProductoEstrella = (i: Inteligencia): string | null => {
  const estrella = i.productoEstrella;
  if (estrella === null) return null;
  const porcion = i.torta.find(p => p.productoId === estrella.productoId);
  return porcion
    ? `${textoPorcion(porcion)} (${formatoSoles(estrella.venta)})`
    : `${estrella.nombre} (${formatoSoles(estrella.venta)})`;
};

/** Cuántas comparaciones entre meses entran en el texto compartido (la más reciente): ahí no hay lugar. */
export const COMPARACIONES_EN_TEXTO = 1;

/**
 * Las líneas de la inteligencia para el texto compartido. `mesesMaximos` recorta la lista de meses
 * (los más viejos se van primero) y `detalle` en falso quita la comparación y los días de la semana:
 * así el texto cabe en el tope aunque haya años de historial.
 */
export const lineasTextoInteligencia = (
  i: Inteligencia,
  mesesMaximos: number,
  detalle = true,
): string[] => {
  if (!i.hayDatos) return ['Sin días cerrados en este periodo.'];
  const estrella = fraseProductoEstrella(i);
  const mesesLista = mesesMaximos > 0 ? i.meses.slice(-mesesMaximos) : [];
  return [
    `Ventas del periodo: ${formatoSoles(i.venta)} · Gastos: ${formatoSoles(
      i.gastos,
    )} · Resultado registrado: ${formatoSoles(i.resultado)} (${diasCerradosTexto(i.dias)})`,
    `Promedio por día cerrado: ventas ${formatoSoles(
      i.promedioVentaDia,
    )} · resultado registrado ${formatoSoles(i.promedioResultadoDia)}`,
    ...(mesesLista.length > 0
      ? [
          'Por mes (ventas · gastos · resultado registrado):',
          ...mesesLista.map(
            m =>
              `- ${m.etiqueta}: ${formatoSoles(m.venta)} · ${formatoSoles(
                m.gastos,
              )} · ${formatoSoles(m.resultado)} (${diasCerradosTexto(m.dias)})`,
          ),
        ]
      : []),
    ...(i.mesMasFuerte && i.mesMasDebil
      ? [
          `Mes más fuerte: ${fraseMesFuerte(i.mesMasFuerte)}`,
          `Mes más débil: ${fraseMesFuerte(i.mesMasDebil)}`,
        ]
      : i.notaMeses
      ? [i.notaMeses]
      : []),
    ...(detalle
      ? [
          ...i.comparaciones.slice(-COMPARACIONES_EN_TEXTO).map(c => `Comparación: ${c.frase}`),
          ...(i.diaMasVentas ? [`Día que más vendes: ${fraseDiaMasVentas(i.diaMasVentas)}`] : []),
          ...(i.diaQueMasDeja ? [`Día que más deja: ${fraseDiaQueMasDeja(i.diaQueMasDeja)}`] : []),
          ...(i.diaQueMenosDeja
            ? [`Día que menos deja: ${fraseDiaQueMenosDeja(i.diaQueMenosDeja)}`]
            : []),
        ]
      : []),
    ...(estrella ? [`Producto estrella: ${estrella}`] : []),
  ];
};
