// src/dominio/yape.ts
// "Anotar un yape": apuntes rápidos de cada Yape que entra durante el día, para sumarlos al
// cerrar. Lógica pura, sin React ni almacenamiento.
import { redondearSoles } from './formato';
import type { FechaNegocio } from './tipos';

export interface YapeAnotado {
  id: string;
  fecha: FechaNegocio;
  /** 'HH:mm' en hora local, formato de 24 horas. */
  hora: string;
  monto: number;
}

export const MONTO_MAXIMO_YAPE = 100000;

const dos = (n: number): string => String(n).padStart(2, '0');

/** 'HH:mm' de la hora local del teléfono. */
export const horaLocal = (ahora: Date): string => `${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;

/** '19:42' → '7:42 p. m.'; '00:05' → '12:05 a. m.'. Si no es una hora válida, la devuelve igual. */
export const formatoHora = (hora: string): string => {
  const partes = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!partes) return hora;
  const h = Number(partes[1]);
  const m = partes[2];
  if (h > 23 || Number(m) > 59) return hora;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};

/** Los yapes de esa fecha, del más temprano al más tarde. */
export const yapesDeFecha = (yapes: YapeAnotado[], fecha: FechaNegocio): YapeAnotado[] =>
  yapes.filter(y => y.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora));

/** Cuánto suman los yapes de esa fecha. */
export const totalDelDia = (yapes: YapeAnotado[], fecha: FechaNegocio): number =>
  redondearSoles(yapesDeFecha(yapes, fecha).reduce((suma, y) => suma + y.monto, 0));

export interface YapesDelDia {
  fecha: FechaNegocio;
  yapes: YapeAnotado[];
  total: number;
}

/** Agrupa por fecha, la más reciente primero. */
export const agrupar = (yapes: YapeAnotado[]): YapesDelDia[] =>
  [...new Set(yapes.map(y => y.fecha))]
    .sort((a, b) => b.localeCompare(a))
    .map(fecha => ({ fecha, yapes: yapesDeFecha(yapes, fecha), total: totalDelDia(yapes, fecha) }));

/** Valida el monto de un yape anotado. */
export const validarYape = (
  monto: number,
): { ok: true } | { ok: false; errores: Record<string, string> } =>
  !Number.isFinite(monto) || monto <= 0
    ? { ok: false, errores: { monto: 'Escribe cuánto fue el yape' } }
    : monto > MONTO_MAXIMO_YAPE
    ? { ok: false, errores: { monto: 'Ese monto es demasiado grande' } }
    : { ok: true };

/** Lo guardado puede venir viejo o dañado: deja solo los yapes completos y válidos. */
export const normalizarYapes = (crudo: unknown): YapeAnotado[] =>
  Array.isArray(crudo)
    ? crudo.flatMap((y): YapeAnotado[] => {
        const x = (y ?? {}) as Record<string, unknown>;
        return typeof x.id === 'string' &&
          x.id !== '' &&
          typeof x.fecha === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) &&
          typeof x.hora === 'string' &&
          /^\d{2}:\d{2}$/.test(x.hora) &&
          typeof x.monto === 'number' &&
          Number.isFinite(x.monto) &&
          x.monto > 0
          ? [{ id: x.id, fecha: x.fecha, hora: x.hora, monto: x.monto }]
          : [];
      })
    : [];
