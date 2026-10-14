// src/services/recordatorio.ts
// La única puerta a los avisos del sistema para "¿Cerramos tu día?". Hoy el aviso vive DENTRO de
// la app (un cartel en Inicio pasada la hora, ver `mostrarAvisoDeCierre`): no necesita permiso ni
// librería nativa. La razón de no usar @notifee/react-native está en el commit de esta función:
// su última versión (9.1.8, dic. 2024) es un módulo del puente viejo, anterior a React Native 0.87
// (que ya no trae la arquitectura antigua), y no se pudo probar en un teléfono.
//
// Para activar avisos con la app cerrada, basta reemplazar el cuerpo de estas cuatro funciones
// (y `avisaConLaAppCerrada`) por la librería nativa elegida: nadie más importa una. Los
// contratos son los mismos: `pedirPermiso` es el único que muestra un diálogo del sistema, y
// `programar` recibe el plan ya decidido por `decidirRecordatorio`.
import type { DecisionRecordatorio, PermisoAvisos } from '@dominio/recordatorio';

export type PlanDeAvisos = Extract<DecisionRecordatorio, { accion: 'programar' }>;

/** ¿El sistema avisa aunque la app esté cerrada? `false`: solo se avisa dentro de la app. */
export const avisaConLaAppCerrada = (): boolean => false;

/** El permiso de hoy, sin preguntar. Dentro de la app no hay permiso que pedir: siempre concedido. */
export const permisoDeAvisos = async (): Promise<PermisoAvisos> => 'concedido';

/** Pide el permiso al sistema (solo cuando la persona prende el recordatorio). */
export const pedirPermisoDeAvisos = async (): Promise<PermisoAvisos> => 'concedido';

/** Deja programado el aviso diario a la hora del plan. Dentro de la app no hay nada que programar. */
export const programarAvisos = async (_plan: PlanDeAvisos): Promise<void> => undefined;

/** Quita el aviso programado. */
export const cancelarAvisos = async (): Promise<void> => undefined;
