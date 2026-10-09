// src/analisis/semaforo.ts
// El semáforo de Jev (solo en el chat): Jev JUZGA una respuesta ya calculada, pero no es una
// calculadora y no compara bien números crudos. Por eso no recibe cifras para comparar sino la frase
// y SEÑALES CON NOMBRE ("tendencia: baja", "magnitud: grande") que arma el código con los umbrales de
// abajo. El juicio es del modelo; la aritmética es del código. Puro: sin red, sin reloj, sin React
// (AGENTS.md, reglas 3, 12 y 13). La fecha de hoy entra por `ctx.hoy`.
import { z } from 'zod';
import { mercaderiaDelCiclo, resumirCiclo } from '@dominio/ciclo';
import { totalPorCobrar } from '@dominio/cobro';
import { diasEntre } from '@dominio/fecha';
import { redondearSoles } from '@dominio/formato';
import { requiereRevision } from '@dominio/producto';
import type {
  Ciclo,
  Consulta,
  ContextoAnalisis,
  Hecho,
  HechoJuicio,
  IntencionId,
  Juicio,
  Semaforo,
  SenalesJuicio,
} from '@dominio/tipos';
import { productoDe, UMBRAL_CONFIANZA } from './intenciones';
import {
  caidaDePrecio,
  cicloCerradoYActual,
  DIAS_COBRO_VENCIDO,
  peorDiaMedido,
  SOBRANTES_MINIMOS,
  sobranteDeDosCiclos,
  UMBRAL_COBRO_SOLES,
} from './reglas';

// --- Umbrales (constantes con nombre; cambiarlos no exige tocar la lógica) ----------------------

/** compararCiclo: hasta este % de variación del "te queda" la magnitud es pequeña. */
export const PCT_MAGNITUD_PEQUENA = 5;
/** compararCiclo: hasta este % es media; más es grande. */
export const PCT_MAGNITUD_MEDIA = 20;
/** peorDia: hasta este % por debajo del promedio la brecha es pequeña. */
export const PCT_BRECHA_PEQUENA = 10;
/** peorDia: hasta este % es media; más es grande. */
export const PCT_BRECHA_MEDIA = 25;
/** peorDia: con menos cierres de ese día de la semana, los datos son pocos (uno por semana, 4 semanas). */
export const CIERRES_DIA_SUFICIENTES = 4;
/** cuantoPorCobrar: hasta estos días el pago más antiguo es reciente (hasta `DIAS_COBRO_VENCIDO`, normal). */
export const DIAS_COBRO_RECIENTE = 3;
/** cuantoSacarParaLaCasa: hasta este % del capital del ciclo la holgura es poca. */
export const PCT_HOLGURA_POCA = 10;
/** cuantoSacarParaLaCasa: hasta este % es media; más es mucha. */
export const PCT_HOLGURA_MEDIA = 30;
/** cuantoPreparar: hasta este % de lo preparado, lo que sobra es poco. */
export const PCT_SOBRA_POCO = 10;
/** revisarPrecio: una caída de esta cantidad de soles por porción o más es fuerte. */
export const CAIDA_FUERTE_SOLES = 1;
/** revisarPrecio: una caída de este % del margen anterior o más es fuerte. */
export const PCT_CAIDA_FUERTE = 30;

// --- Palabras y símbolos -----------------------------------------------------------------------

export const ETIQUETA_SEMAFORO: Record<Semaforo, string> = {
  bien: 'Bien',
  ojo: 'Ojo',
  urgente: 'Urgente',
};

/** Solo el nombre del símbolo: la pantalla elige el ícono. Distintos entre sí, para no depender del color. */
export const SIMBOLO_SEMAFORO: Record<Semaforo, string> = {
  bien: 'check',
  ojo: 'alerta',
  urgente: 'sirena',
};

// --- Qué se juzga ------------------------------------------------------------------------------

/** Las intenciones cuya respuesta se juzga. Las demás (un dato, un récord) no piden juicio. */
export const INTENCIONES_JUZGABLES: readonly IntencionId[] = [
  'compararCiclo',
  'cuantoPorCobrar',
  'cuantoSacarParaLaCasa',
  'cuantoPreparar',
  'revisarPrecio',
  'peorDia',
];

export const esJuzgable = (intencion: IntencionId): boolean =>
  INTENCIONES_JUZGABLES.includes(intencion);

// --- Las señales -------------------------------------------------------------------------------

const centavos = (n: number): number => Math.round(n * 100);

/** ¿`parte` es como mucho `pct` % de `total`? En centavos enteros: 5 % justo es 5 %, no 5.0000001. */
const hastaPct = (parte: number, total: number, pct: number): boolean =>
  centavos(Math.abs(parte)) * 100 <= pct * centavos(Math.abs(total));

const compararCiclo = (ctx: ContextoAnalisis): SenalesJuicio | null => {
  const ciclos = cicloCerradoYActual(ctx);
  if (ciclos === null) return null;
  const anterior = resumirCiclo(ciclos.cerrado).teQueda;
  const diferencia = redondearSoles(resumirCiclo(ciclos.actual).teQueda - anterior);
  const tendencia = diferencia === 0 ? 'igual' : diferencia > 0 ? 'sube' : 'baja';
  let magnitud = 'grande';
  if (diferencia === 0) magnitud = 'pequena';
  else if (anterior !== 0) {
    if (hastaPct(diferencia, anterior, PCT_MAGNITUD_PEQUENA)) magnitud = 'pequena';
    else if (hastaPct(diferencia, anterior, PCT_MAGNITUD_MEDIA)) magnitud = 'media';
  }
  return { tendencia, magnitud };
};

const peorDia = (ctx: ContextoAnalisis): SenalesJuicio | null => {
  const peor = peorDiaMedido(ctx);
  if (peor === null) return null;
  let brecha = 'grande';
  if (hastaPct(peor.diferencia, peor.general, PCT_BRECHA_PEQUENA)) brecha = 'pequena';
  else if (hastaPct(peor.diferencia, peor.general, PCT_BRECHA_MEDIA)) brecha = 'media';
  return { brecha, datos: peor.cierres >= CIERRES_DIA_SUFICIENTES ? 'suficientes' : 'pocos' };
};

const cuantoPorCobrar = (ctx: ContextoAnalisis): SenalesJuicio | null => {
  const { total, pagos, desde } = totalPorCobrar(ctx.cierres);
  if (pagos === 0 || desde === undefined) return null;
  const dias = diasEntre(desde, ctx.hoy);
  let plazo = 'vencido';
  if (dias <= DIAS_COBRO_RECIENTE) plazo = 'reciente';
  else if (dias <= DIAS_COBRO_VENCIDO) plazo = 'normal';
  return { plazo, monto: total > UMBRAL_COBRO_SOLES ? 'alto' : 'bajo' };
};

const cuantoSacarParaLaCasa = (ctx: ContextoAnalisis): SenalesJuicio | null => {
  const ciclos = cicloCerradoYActual(ctx);
  if (ciclos === null) return null;
  const { teQueda, capital } = resumirCiclo(ciclos.cerrado);
  if (teQueda < 0) return { resultado: 'perdida', holgura: 'poca' };
  if (teQueda === 0) return { resultado: 'justo', holgura: 'poca' };
  let holgura = 'mucha';
  if (capital > 0) {
    if (hastaPct(teQueda, capital, PCT_HOLGURA_POCA)) holgura = 'poca';
    else if (hastaPct(teQueda, capital, PCT_HOLGURA_MEDIA)) holgura = 'media';
  }
  return { resultado: 'ganancia', holgura };
};

/** Lo que sobró y lo que se preparó de ese producto en un ciclo. */
const sobrantesYPreparadas = (
  ciclo: Ciclo,
  productoId: string,
): { sobrantes: number; preparadas: number } => {
  const m = mercaderiaDelCiclo(ciclo).find(x => x.productoId === productoId);
  return { sobrantes: (m?.preparadas ?? 0) - (m?.vendidas ?? 0), preparadas: m?.preparadas ?? 0 };
};

const cuantoPreparar = (consulta: Consulta, ctx: ContextoAnalisis): SenalesJuicio | null => {
  const id = consulta.producto;
  const ciclos = cicloCerradoYActual(ctx);
  if (id === undefined || ciclos === null) return null;
  const sobrante = sobranteDeDosCiclos(ctx, id);
  if (sobrante === null) return null;
  if (sobrante.cantidad === 0) return { sobra: 'nada', repite: 'no' };
  const a = sobrantesYPreparadas(ciclos.cerrado, id);
  const b = sobrantesYPreparadas(ciclos.actual, id);
  // Manda el ciclo en que menos sobró, en proporción a lo que se preparó (producto cruzado, sin dividir).
  const menor = a.sobrantes * b.preparadas <= b.sobrantes * a.preparadas ? a : b;
  return {
    sobra: menor.sobrantes * 100 <= PCT_SOBRA_POCO * menor.preparadas ? 'poco' : 'mucho',
    repite: sobrante.cantidad >= SOBRANTES_MINIMOS ? 'si' : 'no',
  };
};

const revisarPrecio = (consulta: Consulta, ctx: ContextoAnalisis): SenalesJuicio | null => {
  const producto = productoDe(consulta, ctx);
  if (producto === undefined) return null;
  const c = caidaDePrecio(ctx, producto);
  let caida = 'ninguna';
  if (c !== null) {
    const fuerte =
      c.caida >= CAIDA_FUERTE_SOLES ||
      c.margenAnterior <= 0 ||
      centavos(c.caida) * 100 >= PCT_CAIDA_FUERTE * centavos(c.margenAnterior);
    caida = fuerte ? 'fuerte' : 'leve';
  }
  // Cuánto hace que no cambia el precio: hasta 90 días o más (la misma cuenta del aviso de precio viejo).
  return { caida, plazo: requiereRevision(producto, ctx.hoy).revisar ? 'mas' : '90dias' };
};

/**
 * Las señales con nombre de la respuesta de esta consulta, o `null` si la intención no se juzga o la
 * respuesta no tiene datos suficientes (las frases de "todavía no tengo…", "no tienes nada por
 * cobrar", "¿de cuál producto?" no se juzgan). Cada valor sale de un vocabulario cerrado; nunca un
 * número crudo. No muta lo que recibe.
 */
export const senalesDeJuicio = (
  consulta: Consulta,
  ctx: ContextoAnalisis,
): SenalesJuicio | null => {
  switch (consulta.intencion) {
    case 'compararCiclo':
      return compararCiclo(ctx);
    case 'peorDia':
      return peorDia(ctx);
    case 'cuantoPorCobrar':
      return cuantoPorCobrar(ctx);
    case 'cuantoSacarParaLaCasa':
      return cuantoSacarParaLaCasa(ctx);
    case 'cuantoPreparar':
      return cuantoPreparar(consulta, ctx);
    case 'revisarPrecio':
      return revisarPrecio(consulta, ctx);
    default:
      return null;
  }
};

/**
 * El cuerpo de la petición para juzgar: la intención, la frase, las cifras y las señales. Nada más:
 * ni el perfil, ni el Yape, ni un cierre. Copia lo que recibe y deja fuera cualquier otra llave.
 */
export const armarHechoParaJuicio = (hecho: Hecho, senales: SenalesJuicio): HechoJuicio => ({
  intencion: hecho.intencion,
  frase: hecho.frase,
  cifras: [...hecho.cifras],
  senales: { ...senales },
});

const esquemaJuicio = z.object({
  semaforo: z.enum(['bien', 'ojo', 'urgente']),
  confianza: z.number().min(0).max(1),
});

/**
 * Lee el juicio ya parseado (`{ semaforo, confianza }`). `null` si falta un campo, si el semáforo no
 * es uno de los tres o si la confianza no es un número de 0 a 1. Con menos de `UMBRAL_CONFIANZA`
 * tampoco se fía: `null` es "sin juicio" y la respuesta sale sin semáforo.
 */
export const interpretarJuicio = (json: unknown): Juicio | null => {
  const r = esquemaJuicio.safeParse(json);
  if (!r.success || r.data.confianza < UMBRAL_CONFIANZA) return null;
  return { semaforo: r.data.semaforo, confianza: r.data.confianza };
};
