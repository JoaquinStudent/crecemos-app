// src/dominio/meta.ts
// "Alcancía de mi cuota": una meta de ahorro atada a la cuota del préstamo. Lógica pura:
// sin React ni almacenamiento, y `hoy` siempre llega por parámetro (regla 12).
import { calcularCierre } from './cierre';
import { diasEntre, finDeMes, restarDias } from './fecha';
import { redondearSoles } from './formato';
import type { Cierre, FechaNegocio } from './tipos';

export interface AporteMeta {
  id: string;
  fecha: FechaNegocio;
  monto: number;
}

export interface Meta {
  id: string;
  /** Casi siempre "Mi cuota". */
  nombre: string;
  montoObjetivo: number;
  fechaLimite: FechaNegocio;
  creada: FechaNegocio;
  aportes: AporteMeta[];
}

export type EstadoMeta = 'al día' | 'vas atrasado' | 'cumplida';

export const NOMBRE_META = 'Mi cuota';
export const MONTO_MAXIMO_META = 100000;

const PASO = 0.5;
const alMedioSol = (n: number): number => Math.ceil(redondearSoles(n) / PASO) * PASO;

/** Lo que ya separó, en total. */
export const totalAportado = (meta: Meta): number =>
  redondearSoles(meta.aportes.reduce((suma, a) => suma + a.monto, 0));

/** Lo que falta para llegar a la meta (nunca negativo). */
export const faltante = (meta: Meta): number =>
  Math.max(0, redondearSoles(meta.montoObjetivo - totalAportado(meta)));

/** Lo que separó en esa fecha. */
export const aportadoEn = (meta: Meta, fecha: FechaNegocio): number =>
  redondearSoles(meta.aportes.filter(a => a.fecha === fecha).reduce((s, a) => s + a.monto, 0));

/** Avance entre 0 y 1. Una meta sin monto válido no avanza. */
export const progreso = (meta: Meta): number => {
  if (!(meta.montoObjetivo > 0)) return 0;
  return Math.min(1, Math.max(0, totalAportado(meta) / meta.montoObjetivo));
};

/** Días que quedan hasta la fecha límite. Hoy o una fecha pasada: 0 (nunca negativo). */
export const diasRestantes = (meta: Meta, hoy: FechaNegocio): number =>
  Math.max(0, diasEntre(hoy, meta.fechaLimite));

export const cumplida = (meta: Meta): boolean => faltante(meta) === 0;

/**
 * Cuánto separar hoy para llegar a tiempo: lo que falta (sin contar lo ya separado hoy)
 * repartido en los días que quedan (mínimo 1), redondeado hacia arriba a S/ 0.50 y sin pasar
 * de lo que falta. Si hoy ya separó esa parte, devuelve 0: no insiste.
 */
export const aporteSugeridoDiario = (meta: Meta, hoy: FechaNegocio): number => {
  const falta = faltante(meta);
  if (falta === 0) return 0;
  const yaHoy = aportadoEn(meta, hoy);
  const dias = Math.max(1, diasRestantes(meta, hoy));
  const cuotaDeHoy = alMedioSol((falta + yaHoy) / dias);
  return Math.min(falta, Math.max(0, redondearSoles(cuotaDeHoy - yaHoy)));
};

export interface SugerenciaDeHoy {
  /** Lo que se le propone separar hoy (puede ser 0). */
  monto: number;
  /** `true` si se bajó porque lo que le queda no alcanza para la cuota diaria. */
  limitadoPorTeQueda: boolean;
}

/**
 * La sugerencia de hoy, sin pasar de lo que le quedó en su último cierre (`teQueda`):
 * no se le propone separar plata que no tiene. Sin cierres (`undefined`) no hay tope.
 */
export const sugerenciaDeHoy = (
  meta: Meta,
  hoy: FechaNegocio,
  teQueda?: number,
): SugerenciaDeHoy => {
  const ideal = aporteSugeridoDiario(meta, hoy);
  if (teQueda === undefined || ideal <= teQueda) return { monto: ideal, limitadoPorTeQueda: false };
  const tope = Math.max(0, Math.floor(redondearSoles(teQueda) / PASO) * PASO);
  return { monto: Math.min(ideal, tope), limitadoPorTeQueda: true };
};

/**
 * Cumplida; vas atrasado (pasó la fecha límite, o lo separado está por debajo de lo que
 * tocaba a esta altura si se repartiera parejo desde que la creaste); si no, al día.
 */
export const estado = (meta: Meta, hoy: FechaNegocio): EstadoMeta => {
  if (cumplida(meta)) return 'cumplida';
  if (hoy > meta.fechaLimite) return 'vas atrasado';
  const total = Math.max(1, diasEntre(meta.creada, meta.fechaLimite));
  const transcurridos = Math.min(total, Math.max(0, diasEntre(meta.creada, hoy)));
  const esperado = (meta.montoObjetivo * transcurridos) / total;
  return totalAportado(meta) + 0.005 < esperado ? 'vas atrasado' : 'al día';
};

export interface DatosMeta {
  montoObjetivo: number;
  fechaLimite: FechaNegocio;
  nombre?: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Valida el formulario de la meta. Las claves de los errores son los campos. */
export const validarMeta = (
  datos: DatosMeta,
  hoy: FechaNegocio,
): { ok: true } | { ok: false; errores: Record<string, string> } => {
  const errores: Record<string, string> = {};
  if (!Number.isFinite(datos.montoObjetivo) || datos.montoObjetivo <= 0) {
    errores.montoObjetivo = 'Escribe cuánto es tu cuota';
  } else if (datos.montoObjetivo > MONTO_MAXIMO_META) {
    errores.montoObjetivo = 'Ese monto es demasiado grande';
  }
  if (!FECHA.test(datos.fechaLimite)) errores.fechaLimite = 'Elige la fecha de tu cuota';
  else if (datos.fechaLimite < hoy) errores.fechaLimite = 'La fecha tiene que ser de hoy en adelante';
  return Object.keys(errores).length ? { ok: false, errores } : { ok: true };
};

/** Valida un aporte (separar plata). */
export const validarAporte = (
  monto: number,
): { ok: true } | { ok: false; errores: Record<string, string> } =>
  !Number.isFinite(monto) || monto <= 0
    ? { ok: false, errores: { monto: 'Escribe cuánto vas a separar' } }
    : monto > MONTO_MAXIMO_META
    ? { ok: false, errores: { monto: 'Ese monto es demasiado grande' } }
    : { ok: true };

const esTexto = (v: unknown): v is string => typeof v === 'string' && v !== '';
const esMonto = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/**
 * Lo guardado puede venir viejo, incompleto o dañado: devuelve una meta usable o `null`.
 * Los aportes inválidos se descartan uno por uno; no se tira toda la meta por uno malo.
 */
export const normalizarMeta = (crudo: unknown): Meta | null => {
  if (typeof crudo !== 'object' || crudo === null) return null;
  const m = crudo as Record<string, unknown>;
  if (!esTexto(m.id) || !esMonto(m.montoObjetivo)) return null;
  if (!esTexto(m.fechaLimite) || !FECHA.test(m.fechaLimite)) return null;
  const aportes = Array.isArray(m.aportes)
    ? m.aportes.flatMap((a): AporteMeta[] => {
        const x = (a ?? {}) as Record<string, unknown>;
        return esTexto(x.id) && esTexto(x.fecha) && FECHA.test(x.fecha) && esMonto(x.monto)
          ? [{ id: x.id, fecha: x.fecha, monto: x.monto }]
          : [];
      })
    : [];
  return {
    id: m.id,
    nombre: esTexto(m.nombre) ? m.nombre : NOMBRE_META,
    montoObjetivo: m.montoObjetivo,
    fechaLimite: m.fechaLimite,
    creada: esTexto(m.creada) && FECHA.test(m.creada) ? m.creada : m.fechaLimite,
    aportes,
  };
};

export interface PlazoRapido {
  value: '7' | '15' | 'finDeMes';
  label: string;
  fecha: FechaNegocio;
}

/** Las elecciones rápidas de fecha: en 7 días, en 15 días y fin de mes (si todavía falta). */
export const plazosRapidos = (hoy: FechaNegocio): PlazoRapido[] => {
  const lista: PlazoRapido[] = [
    { value: '7', label: 'En 7 días', fecha: restarDias(hoy, -7) },
    { value: '15', label: 'En 15 días', fecha: restarDias(hoy, -15) },
  ];
  const fin = finDeMes(hoy);
  if (fin > hoy) lista.push({ value: 'finDeMes', label: 'Fin de mes', fecha: fin });
  return lista;
};

/** Cuánto falta para la fecha, en palabras de todos los días. */
export const textoPlazo = (meta: Meta, hoy: FechaNegocio): string => {
  if (cumplida(meta)) return '¡Meta cumplida!';
  const dias = diasEntre(hoy, meta.fechaLimite);
  if (dias < 0) return 'La fecha ya pasó';
  if (dias === 0) return 'Hoy es el día';
  return dias === 1 ? 'Te falta 1 día' : `Te faltan ${dias} días`;
};

/** Lo que le quedó en el último día cerrado, o `undefined` si todavía no cerró ninguno. */
export const teQuedaDelUltimoCierre = (cierres: Cierre[]): number | undefined => {
  const ultimo = cierres.reduce<Cierre | null>(
    (reciente, c) => (reciente === null || c.fecha > reciente.fecha ? c : reciente),
    null,
  );
  return ultimo ? calcularCierre(ultimo).teQueda : undefined;
};
