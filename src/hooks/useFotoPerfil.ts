// src/hooks/useFotoPerfil.ts
// Todo lo de la foto de perfil que no es dibujo: la hoja de opciones (elegir, tomar, quitar), el
// selector nativo, el guardado y el mensaje amable si algo falla. La foto se guarda al elegirla.
// Cancelar el selector no es un error: no se dice nada.
import { useRef, useState } from 'react';
import { avatarDe } from '@dominio/foto';
import { useCrecemos } from '@context/CrecemosProvider';
import { elegirFoto, mensajeFoto } from '@services/foto';
import { useAccionSegura } from './useAccionSegura';

/** Qué muestra la hoja: las opciones o la pregunta de confirmar antes de quitar. */
export type PasoHojaFoto = 'opciones' | 'quitar';

export const useFotoPerfil = () => {
  const { perfil, guardarFoto, quitarFoto } = useCrecemos();
  const hayFoto = avatarDe(perfil).tipo === 'foto';
  const [paso, setPaso] = useState<PasoHojaFoto | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Un solo selector abierto a la vez, aunque el botón se toque dos veces antes de repintar.
  const selectorAbierto = useRef(false);

  const quitar = useAccionSegura(async () => {
    await quitarFoto();
    setPaso(null);
  }, 'No pudimos quitar tu foto. Inténtalo otra vez.');

  const elegir = async (origen: 'galeria' | 'camara') => {
    if (selectorAbierto.current) return;
    selectorAbierto.current = true;
    // La hoja se cierra antes de abrir el selector del sistema.
    setPaso(null);
    setAbriendo(true);
    setError(null);
    try {
      const resultado = await elegirFoto(origen);
      if (resultado.ok) {
        const guardada = await guardarFoto(resultado.fotoUri);
        if (!guardada.ok) setError(guardada.errores.foto ?? mensajeFoto('INVALIDA'));
      } else if (resultado.motivo !== 'CANCELADA') {
        setError(resultado.mensaje ?? mensajeFoto(resultado.motivo));
      }
    } catch {
      setError(mensajeFoto('NO_SE_PUDO'));
    } finally {
      selectorAbierto.current = false;
      setAbriendo(false);
    }
  };

  return {
    hayFoto,
    paso,
    abriendo,
    error,
    quitar,
    elegir,
    abrir: () => {
      setError(null);
      quitar.limpiarError();
      setPaso('opciones');
    },
    pedirQuitar: () => setPaso('quitar'),
    cerrar: () => setPaso(null),
  };
};

export type FotoPerfil = ReturnType<typeof useFotoPerfil>;
