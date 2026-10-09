// src/analisis/reglas.ts
// Seis decisiones que Freddy ya toma, como funciones puras sobre los cierres (Arquitectura, sección 4).
// Escalar es agregar una regla a REGLAS. Sin React, sin reloj, sin IA (AGENTS.md, reglas 3 y 14).
import { agruparCiclos, resumirCiclo } from '@dominio/ciclo';
import { totalPorCobrar } from '@dominio/cobro';
import { diasEntre, diaSemana } from '@dominio/fecha';
import { formatoFechaCorta, formatoSoles, nombreMes, redondearSoles } from '@dominio/formato';
import { teDeja } from '@dominio/producto';
import type { Ciclo, ContextoAnalisis, Producto, Recomendacion } from '@dominio/tipos';
import { compararCiclos, gananciaDelDia } from './metricas';

/** Más de este monto por cobrar y la regla `cobro` salta (S/). */
export const UMBRAL_COBRO_SOLES = 100;
/** Un cobro con más días que estos y la regla `cobro` salta. */
export const DIAS_COBRO_VENCIDO = 7;
/** Cuántos días atrás se mira el "te deja" para comparar (la línea más reciente con esa antigüedad o más). */
export const DIAS_COMPARACION_PRECIO = 90;
/** Caída del "te deja" por porción que activa la regla `precio` (S/). */
export const CAIDA_PRECIO_SOLES = 0.3;
/** Sobrantes por ciclo, del mismo producto, que activan la regla `preparar`. */
export const SOBRANTES_MINIMOS = 3;
/** Días entre el primer y el último cierre para tener "4 semanas" de datos. */
export const DIAS_MINIMOS_DIA_FLOJO = 28;
/** Cierres mínimos de un mismo día de la semana para juzgarlo. */
export const CIERRES_MINIMOS_DIA_FLOJO = 2;
/** Cuánto por debajo del promedio (en %) hace "flojo" a un día de la semana. */
export const PORCENTAJE_DIA_FLOJO = 20;
/** Ciclos registrados para que el motor opine; con menos, no inventa. */
export const CICLOS_MINIMOS = 2;
/** Cuántas recomendaciones devuelve el motor como máximo. */
export const MAX_RECOMENDACIONES = 2;

export interface Regla {
  id: Recomendacion['reglaId'];
  /** 1 es la más alta. */
  prioridad: number;
  aplica: (ctx: ContextoAnalisis) => boolean;
  mensaje: (ctx: ContextoAnalisis) => string;
}

export const DIAS_PLURAL = [
  'domingos',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábados',
];

/** El último ciclo cerrado (el penúltimo) y el actual (el último). Un solo ciclo no cierra nada. */
export const cicloCerradoYActual = (
  ctx: ContextoAnalisis,
): { cerrado: Ciclo; actual: Ciclo } | null => {
  const ciclos = agruparCiclos(ctx.cierres);
  if (ciclos.length < CICLOS_MINIMOS) return null;
  return { cerrado: ciclos[ciclos.length - 2], actual: ciclos[ciclos.length - 1] };
};

// --- cobro ---------------------------------------------------------------------------------

const cobroAplica = (ctx: ContextoAnalisis): boolean => {
  const { total, desde } = totalPorCobrar(ctx.cierres);
  if (total > UMBRAL_COBRO_SOLES) return true;
  return desde !== undefined && diasEntre(desde, ctx.hoy) > DIAS_COBRO_VENCIDO;
};

export const cobroMensaje = (ctx: ContextoAnalisis): string => {
  const { total, desde } = totalPorCobrar(ctx.cierres);
  return `Tienes ${formatoSoles(total)} por cobrar desde el ${formatoFechaCorta(
    desde ?? ctx.hoy,
  )}.`;
};

// --- precio --------------------------------------------------------------------------------

export interface CaidaDePrecio {
  nombre: string;
  caida: number;
  mes: string;
  /** El "te deja" por porción de la línea de referencia: de lo que se mide la caída. */
  margenAnterior: number;
}

/** Cuánto cayó el "te deja" de hoy de ese producto contra su línea más reciente de hace 90 días o más; `null` si no cayó lo suficiente. */
export const caidaDePrecio = (ctx: ContextoAnalisis, p: Producto): CaidaDePrecio | null => {
  let referencia: { fecha: string; margen: number } | null = null;
  for (const c of ctx.cierres) {
    if (diasEntre(c.fecha, ctx.hoy) < DIAS_COMPARACION_PRECIO) continue;
    if (referencia !== null && c.fecha <= referencia.fecha) continue;
    const l = c.lineas.find(x => x.productoId === p.id);
    if (l)
      referencia = { fecha: c.fecha, margen: redondearSoles(l.precioUnitario - l.costoUnitario) };
  }
  if (referencia === null) return null;
  const caida = redondearSoles(referencia.margen - teDeja(p).monto);
  return caida < CAIDA_PRECIO_SOLES
    ? null
    : {
        nombre: p.nombre,
        caida,
        mes: nombreMes(referencia.fecha),
        margenAnterior: referencia.margen,
      };
};

/** El producto activo cuyo "te deja" de hoy más cayó contra su línea más reciente de hace 90 días o más. */
const mayorCaidaDePrecio = (ctx: ContextoAnalisis): CaidaDePrecio | null => {
  let mejor: CaidaDePrecio | null = null;
  for (const p of ctx.productos.filter(x => x.activo)) {
    const c = caidaDePrecio(ctx, p);
    if (c === null) continue;
    if (
      mejor === null ||
      c.caida > mejor.caida ||
      (c.caida === mejor.caida && p.nombre < mejor.nombre)
    ) {
      mejor = c;
    }
  }
  return mejor;
};

// --- preparar ------------------------------------------------------------------------------

/** Sobrantes por producto sumados en todo el ciclo, con el nombre de su última línea. */
const sobrantesDelCiclo = (ciclo: Ciclo): Map<string, { nombre: string; sobrantes: number }> => {
  const mapa = new Map<string, { nombre: string; sobrantes: number }>();
  for (const c of ciclo.cierres) {
    for (const l of c.lineas) {
      mapa.set(l.productoId, {
        nombre: l.nombre,
        sobrantes: (mapa.get(l.productoId)?.sobrantes ?? 0) + l.sobrantes,
      });
    }
  }
  return mapa;
};

/**
 * Lo que sobró de ese producto en cada uno de los dos últimos ciclos: la menor cifra es cuánto bajar.
 * `null` con menos de 2 ciclos. Un producto que no estuvo en un ciclo sobró 0 en él.
 */
export const sobranteDeDosCiclos = (
  ctx: ContextoAnalisis,
  productoId: string,
): { nombre?: string; cantidad: number } | null => {
  const ciclos = cicloCerradoYActual(ctx);
  if (ciclos === null) return null;
  const antes = sobrantesDelCiclo(ciclos.cerrado).get(productoId);
  const ahora = sobrantesDelCiclo(ciclos.actual).get(productoId);
  return {
    nombre: ahora?.nombre ?? antes?.nombre,
    cantidad: Math.min(antes?.sobrantes ?? 0, ahora?.sobrantes ?? 0),
  };
};

/** El producto que sobró SOBRANTES_MINIMOS o más en cada uno de los dos últimos ciclos: cuánto bajar es la menor cifra. */
const productoQueSobra = (
  ctx: ContextoAnalisis,
): { productoId: string; nombre: string; cantidad: number } | null => {
  const ciclos = cicloCerradoYActual(ctx);
  if (ciclos === null) return null;
  const antes = sobrantesDelCiclo(ciclos.cerrado);
  const ahora = sobrantesDelCiclo(ciclos.actual);
  let mejor: { productoId: string; nombre: string; cantidad: number } | null = null;
  for (const [productoId, ultimo] of ahora) {
    const previo = antes.get(productoId);
    if (previo === undefined) continue;
    const cantidad = Math.min(previo.sobrantes, ultimo.sobrantes);
    if (cantidad < SOBRANTES_MINIMOS) continue;
    if (
      mejor === null ||
      cantidad > mejor.cantidad ||
      (cantidad === mejor.cantidad && ultimo.nombre < mejor.nombre)
    ) {
      mejor = { productoId, nombre: ultimo.nombre, cantidad };
    }
  }
  return mejor;
};

// --- retiro --------------------------------------------------------------------------------

const retiroAplica = (ctx: ContextoAnalisis): boolean => cicloCerradoYActual(ctx) !== null;

export const retiroMensaje = (ctx: ContextoAnalisis): string => {
  const ciclos = cicloCerradoYActual(ctx);
  const teQueda = ciclos === null ? 0 : resumirCiclo(ciclos.cerrado).teQueda;
  return teQueda > 0
    ? `Puedes sacar ${formatoSoles(teQueda)} para la casa sin tocar tu capital.`
    : 'Este ciclo no te dejó ganancia. Mejor no saques plata del negocio todavía.';
};

// --- diaFlojo ------------------------------------------------------------------------------

/** Un día de la semana (0 = domingo) con cuánto se aparta su ganancia promedio del promedio de todos los días. */
export interface DiaMedido {
  dia: number;
  /** Ganancia promedio de ese día de la semana. */
  promedio: number;
  /** `general − promedio`: positivo si el día está por debajo del promedio general, negativo si por encima. */
  diferencia: number;
  /** Cierres de ese día de la semana que entraron en el promedio. */
  cierres: number;
}

/**
 * Promedio de ganancia de cada día de la semana contra el de todos los días. Se mide la ganancia
 * del día, no "te queda": ese depende de qué día compró la mercadería. Con 4 semanas de cierres, al
 * menos 2 cierres de ese día y un promedio general positivo; si no, `null`. La comparten la regla
 * `diaFlojo` y el chat ("¿qué día me va peor?").
 */
const medirDias = (ctx: ContextoAnalisis): { general: number; dias: DiaMedido[] } | null => {
  if (ctx.cierres.length === 0) return null;
  const fechas = ctx.cierres.map(c => c.fecha).sort();
  if (diasEntre(fechas[0], fechas[fechas.length - 1]) < DIAS_MINIMOS_DIA_FLOJO) return null;

  const porDia = new Map<number, number[]>();
  const todas: number[] = [];
  for (const c of ctx.cierres) {
    const ganancia = gananciaDelDia(c);
    todas.push(ganancia);
    porDia.set(diaSemana(c.fecha), [...(porDia.get(diaSemana(c.fecha)) ?? []), ganancia]);
  }
  const promedio = (xs: number[]): number =>
    redondearSoles(xs.reduce((s, x) => s + x, 0) / xs.length);
  const general = promedio(todas);
  if (general <= 0) return null;

  const dias: DiaMedido[] = [];
  for (const [dia, ganancias] of porDia) {
    if (ganancias.length < CIERRES_MINIMOS_DIA_FLOJO) continue;
    const delDia = promedio(ganancias);
    dias.push({
      dia,
      promedio: delDia,
      diferencia: redondearSoles(general - delDia),
      cierres: ganancias.length,
    });
  }
  return { general, dias };
};

/**
 * El día de la semana que más baja del promedio, sin importar cuánto, con el promedio general y los
 * cierres de ese día (para juzgar si son pocos). `null` si no hay datos o ninguno baja.
 */
export const peorDiaMedido = (
  ctx: ContextoAnalisis,
): { dia: number; diferencia: number; general: number; cierres: number } | null => {
  const medido = medirDias(ctx);
  let peor: DiaMedido | null = null;
  for (const d of medido?.dias ?? []) if (peor === null || d.diferencia > peor.diferencia) peor = d;
  if (medido === null || peor === null || peor.diferencia <= 0) return null;
  return {
    dia: peor.dia,
    diferencia: peor.diferencia,
    general: medido.general,
    cierres: peor.cierres,
  };
};

/** El día de la semana que más baja del promedio, sin importar cuánto. `null` si no hay datos para juzgar o ninguno baja. */
export const peorDiaDeLaSemana = (
  ctx: ContextoAnalisis,
): { dia: number; diferencia: number } | null => {
  const peor = peorDiaMedido(ctx);
  return peor === null ? null : { dia: peor.dia, diferencia: peor.diferencia };
};

/** El día de la semana que más sube sobre el promedio. `diferencia` es cuánto gana de más. `null` si ninguno sube. */
export const mejorDiaDeLaSemana = (
  ctx: ContextoAnalisis,
): { dia: number; diferencia: number } | null => {
  const medido = medirDias(ctx);
  let mejor: DiaMedido | null = null;
  for (const d of medido?.dias ?? [])
    if (mejor === null || d.diferencia < mejor.diferencia) mejor = d;
  return mejor === null || mejor.diferencia >= 0
    ? null
    : { dia: mejor.dia, diferencia: redondearSoles(-mejor.diferencia) };
};

/**
 * El día de la semana que gana 20 % o más por debajo del promedio de todos los días, con 4 semanas de
 * cierres y al menos 2 cierres de ese día. Es el que recomienda la regla `diaFlojo`.
 */
export const diaMasFlojo = (ctx: ContextoAnalisis): { dia: number; diferencia: number } | null => {
  const medido = medirDias(ctx);
  if (medido === null) return null;
  let mejor: { dia: number; diferencia: number } | null = null;
  for (const d of medido.dias) {
    // En centavos enteros: 19.9 % no es 20 %, y 0.8 × 100 no da 80 exacto.
    const flojo =
      Math.round(d.promedio * 100) * 100 <=
      Math.round(medido.general * 100) * (100 - PORCENTAJE_DIA_FLOJO);
    if (flojo && (mejor === null || d.diferencia > mejor.diferencia)) {
      mejor = { dia: d.dia, diferencia: d.diferencia };
    }
  }
  return mejor;
};

// --- comparacion ---------------------------------------------------------------------------

export const comparacionMensaje = (ctx: ContextoAnalisis): string => {
  const ciclos = cicloCerradoYActual(ctx);
  if (ciclos === null) return '';
  return compararCiclos(resumirCiclo(ciclos.actual), resumirCiclo(ciclos.cerrado));
};

// --------------------------------------------------------------------------------------------

export const REGLAS: Regla[] = [
  { id: 'cobro', prioridad: 1, aplica: cobroAplica, mensaje: cobroMensaje },
  {
    id: 'precio',
    prioridad: 2,
    aplica: ctx => mayorCaidaDePrecio(ctx) !== null,
    mensaje: ctx => {
      const m = mayorCaidaDePrecio(ctx);
      return m === null
        ? ''
        : `Tu ${m.nombre.toLowerCase()} te deja ${formatoSoles(m.caida)} menos que en ${
            m.mes
          }. ¿Revisas el precio?`;
    },
  },
  {
    id: 'preparar',
    prioridad: 3,
    aplica: ctx => productoQueSobra(ctx) !== null,
    mensaje: ctx => {
      const p = productoQueSobra(ctx);
      if (p === null) return '';
      const unidad =
        ctx.productos.find(x => x.id === p.productoId)?.unidad === 'vaso' ? 'vasos' : 'porciones';
      return `Te sobró ${p.nombre.toLowerCase()} dos ciclos seguidos. Prepara ${
        p.cantidad
      } ${unidad} menos.`;
    },
  },
  { id: 'retiro', prioridad: 4, aplica: retiroAplica, mensaje: retiroMensaje },
  {
    id: 'diaFlojo',
    prioridad: 5,
    aplica: ctx => diaMasFlojo(ctx) !== null,
    mensaje: ctx => {
      const d = diaMasFlojo(ctx);
      return d === null
        ? ''
        : `Los ${DIAS_PLURAL[d.dia]} ganas ${formatoSoles(d.diferencia)} menos que tu promedio.`;
    },
  },
  { id: 'comparacion', prioridad: 6, aplica: retiroAplica, mensaje: comparacionMensaje },
];

/**
 * Evalúa todas las reglas y devuelve como máximo 2, las de mayor prioridad (1 = la más alta).
 * Con menos de 2 ciclos registrados devuelve []: no inventa.
 */
export const evaluarReglas = (ctx: ContextoAnalisis): Recomendacion[] => {
  if (agruparCiclos(ctx.cierres).length < CICLOS_MINIMOS) return [];
  return REGLAS.filter(r => r.aplica(ctx))
    .sort((a, b) => a.prioridad - b.prioridad)
    .slice(0, MAX_RECOMENDACIONES)
    .map(r => ({ reglaId: r.id, prioridad: r.prioridad, mensaje: r.mensaje(ctx) }));
};
