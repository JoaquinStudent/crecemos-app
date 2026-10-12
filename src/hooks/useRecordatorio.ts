// src/hooks/useRecordatorio.ts
// Mantiene al día el aviso del sistema: lo reevalúa cuando cambia el perfil, cuando se guarda o se
// borra el cierre de hoy, cuando cruza la hora elegida y cuando la app vuelve al frente. La decisión
// es `decidirRecordatorio` (pura); aquí solo se ejecuta contra `@services/recordatorio`.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import {
  ajustesDeRecordatorio,
  decidirRecordatorio,
  minutosDeHora,
  mostrarAvisoDeCierre,
} from '@dominio/recordatorio';
import { fechaLocal } from '@dominio/fecha';
import type { Cierre, Perfil } from '@dominio/tipos';
import { cancelarAvisos, permisoDeAvisos, programarAvisos } from '@services/recordatorio';

export interface EstadoRecordatorio {
  /** Mostrar en Inicio el cartel "aún no cierras tu día". */
  mostrarAviso: boolean;
  /** 'HH:MM' elegida. */
  hora: string;
}

export const useRecordatorio = (
  perfil: Perfil,
  cierres: Cierre[],
  cargando: boolean,
  ahora: Date,
): EstadoRecordatorio => {
  const { activo, hora } = ajustesDeRecordatorio(perfil);
  const hoy = fechaLocal(ahora);
  const cerradoHoy = cierres.some(c => c.fecha === hoy);
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const pasoLaHora = minutosAhora >= minutosDeHora(hora);

  // Cada vez que la app vuelve al frente se vuelve a decidir (el permiso o el día pudieron cambiar).
  const [alFrente, setAlFrente] = useState(0);
  useEffect(() => {
    const suscripcion = AppState.addEventListener('change', estado => {
      if (estado === 'active') setAlFrente(n => n + 1);
    });
    return () => suscripcion.remove();
  }, []);

  useEffect(() => {
    if (cargando) return;
    let vigente = true;
    (async () => {
      const permiso = await permisoDeAvisos();
      const decision = decidirRecordatorio({ activo, hora, permiso, cerradoHoy, hoy, minutosAhora });
      if (!vigente) return;
      if (decision.accion === 'programar') await programarAvisos(decision);
      else await cancelarAvisos();
    })().catch(() => undefined); // un aviso que no se programa nunca tumba la pantalla
    return () => {
      vigente = false;
    };
    // `minutosAhora` cambia con cada tic del reloj; el plan solo cambia al cruzar la hora (`pasoLaHora`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, activo, hora, cerradoHoy, hoy, pasoLaHora, alFrente]);

  return { mostrarAviso: !cargando && mostrarAvisoDeCierre({ activo, hora, cerradoHoy, minutosAhora }), hora };
};
