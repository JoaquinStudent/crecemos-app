// src/hooks/useAjusteRecordatorio.ts
// Lo que hace el interruptor del recordatorio diario. Prender pide permiso solo cuando la persona
// lo toca, y antes le explica por qué; si el sistema lo niega, el interruptor se queda apagado y se
// lo dice en palabras claras. Cada guardado pasa por `useAccionSegura`: si falla, lo dice.
import { useState } from 'react';
import { ajustesDeRecordatorio } from '@dominio/recordatorio';
import { useCrecemos } from '@context/CrecemosProvider';
import { avisaConLaAppCerrada, pedirPermisoDeAvisos } from '@services/recordatorio';
import { useAccionSegura } from './useAccionSegura';

export const useAjusteRecordatorio = () => {
  const { perfil, guardarPerfil } = useCrecemos();
  const ajustes = ajustesDeRecordatorio(perfil);
  const [explicandoPermiso, setExplicandoPermiso] = useState(false);
  const [permisoNegado, setPermisoNegado] = useState(false);

  const activar = useAccionSegura(async () => {
    const permiso = await pedirPermisoDeAvisos();
    setExplicandoPermiso(false);
    if (permiso !== 'concedido') {
      setPermisoNegado(true);
      return;
    }
    await guardarPerfil({ recordatorioActivo: true });
  }, 'No pudimos activar el recordatorio. Inténtalo otra vez.');
  const cambiar = useAccionSegura(
    (parcial: Parameters<typeof guardarPerfil>[0]) => guardarPerfil(parcial),
    'No pudimos guardar el recordatorio. Inténtalo otra vez.',
  );

  const alCambiarInterruptor = (prender: boolean) => {
    activar.limpiarError();
    cambiar.limpiarError();
    setPermisoNegado(false);
    if (!prender) {
      setExplicandoPermiso(false);
      cambiar.ejecutar({ recordatorioActivo: false });
    } else if (avisaConLaAppCerrada()) {
      setExplicandoPermiso(true);
    } else {
      activar.ejecutar();
    }
  };

  return {
    ...ajustes,
    explicandoPermiso,
    permisoNegado,
    activar,
    cambiar,
    alCambiarInterruptor,
    ocultarExplicacion: () => setExplicandoPermiso(false),
  };
};
