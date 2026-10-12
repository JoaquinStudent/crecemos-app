// src/hooks/useAhora.ts
// La hora de ahora, que se renueva sola: cada medio minuto y cada vez que la app vuelve al frente.
// Sirve para lo que depende de la hora (el aviso de cierre) y para que "hoy" no se quede viejo.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

const CADA_MS = 30 * 1000;

export const useAhora = (): Date => {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const actualizar = () => setAhora(new Date());
    const reloj = setInterval(actualizar, CADA_MS);
    const suscripcion = AppState.addEventListener('change', estado => {
      if (estado === 'active') actualizar();
    });
    return () => {
      clearInterval(reloj);
      suscripcion.remove();
    };
  }, []);
  return ahora;
};
