// src/dominio/recordatorio.ts
// El recordatorio diario "¿Cerramos tu día?": qué hora, cuándo avisar y cuándo callar. Puro: sin
// React, sin reloj y sin librerías nativas. `hoy` y la hora de ahora entran como parámetros.
import { restarDias } from './fecha';
import type { FechaNegocio, Perfil } from './tipos';

/** 'HH:MM' en 24 horas. */
export const HORA_RECORDATORIO_POR_DEFECTO = '21:30';

export interface OpcionHora {
  /** 'HH:MM' en 24 horas: lo que se guarda en el perfil. */
  valor: string;
  /** '9:30 p. m.': lo que se lee. */
  etiqueta: string;
}

export const OPCIONES_HORA_RECORDATORIO: readonly OpcionHora[] = [
  { valor: '20:30', etiqueta: '8:30 p. m.' },
  { valor: '21:30', etiqueta: '9:30 p. m.' },
  { valor: '22:30', etiqueta: '10:30 p. m.' },
];

const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutos desde la medianoche de 'HH:MM'. */
export const minutosDeHora = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

/** '21:30' → '9:30 p. m.'. Sin Intl, igual que el resto de formatos de la app. */
export const etiquetaDeHora = (hora: string): string => {
  const [h, m] = hora.split(':').map(Number);
  const doce = h % 12 === 0 ? 12 : h % 12;
  return `${doce}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};

export interface AjustesRecordatorio {
  activo: boolean;
  /** 'HH:MM'. */
  hora: string;
}

/**
 * Lo que el perfil dice del recordatorio. Un perfil guardado antes de existir el recordatorio, o
 * con un valor ilegible, queda apagado y a las 9:30 p. m. (lectura tolerante).
 */
export const ajustesDeRecordatorio = (
  perfil: Pick<Perfil, 'recordatorioActivo' | 'recordatorioHora'>,
): AjustesRecordatorio => ({
  activo: perfil.recordatorioActivo === true,
  hora:
    typeof perfil.recordatorioHora === 'string' && HORA_VALIDA.test(perfil.recordatorioHora)
      ? perfil.recordatorioHora
      : HORA_RECORDATORIO_POR_DEFECTO,
});

/** Lo que el sistema dice del permiso para avisar con la app cerrada. */
export type PermisoAvisos = 'concedido' | 'denegado' | 'sin-decidir';

export interface EntradaDecision {
  activo: boolean;
  hora: string;
  permiso: PermisoAvisos;
  cerradoHoy: boolean;
  hoy: FechaNegocio;
  /** Minutos desde la medianoche, en la hora local del teléfono. */
  minutosAhora: number;
}

export type DecisionRecordatorio =
  | { accion: 'cancelar'; motivo: 'apagado' | 'sin-permiso' }
  | {
      accion: 'programar';
      hora: string;
      /** Cuándo suena el próximo aviso; de ahí en adelante, todos los días a esa hora. */
      primerAviso: { fecha: FechaNegocio; hora: string };
    };

/**
 * Qué hacer con el aviso del sistema. Apagado o sin permiso: cancelarlo. Si hoy ya está cerrado o
 * la hora de hoy ya pasó, el primer aviso es mañana; si no, es hoy.
 */
export const decidirRecordatorio = (e: EntradaDecision): DecisionRecordatorio => {
  if (!e.activo) return { accion: 'cancelar', motivo: 'apagado' };
  if (e.permiso !== 'concedido') return { accion: 'cancelar', motivo: 'sin-permiso' };
  const esHoy = !e.cerradoHoy && e.minutosAhora < minutosDeHora(e.hora);
  return {
    accion: 'programar',
    hora: e.hora,
    primerAviso: { fecha: esHoy ? e.hoy : restarDias(e.hoy, -1), hora: e.hora },
  };
};

/**
 * ¿Mostrar en Inicio el aviso "aún no cierras tu día"? Después de la hora elegida y mientras hoy
 * no esté cerrado. No se quita solo: lo decide el reloj del día y el cierre, nada más.
 */
export const mostrarAvisoDeCierre = (
  e: Pick<EntradaDecision, 'activo' | 'hora' | 'cerradoHoy' | 'minutosAhora'>,
): boolean => e.activo && !e.cerradoHoy && e.minutosAhora >= minutosDeHora(e.hora);

export const textoAvisoDeCierre = (hora: string): string =>
  `Son más de las ${etiquetaDeHora(hora)} y aún no cierras tu día`;

export const TITULO_AVISO = '¿Cerramos tu día?';
export const CUERPO_AVISO = 'Anota lo que vendiste hoy. Te toma menos de un minuto.';
