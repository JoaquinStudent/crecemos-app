// src/hooks/useDictadoVoz.ts
// Estado del botón "Hablar" de Cuéntame tu día: escucha, texto parcial y error en palabras claras.
// El texto final se entrega UNA vez por escucha (`alTexto`); quien lo usa decide qué hacer con él.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dejarDeEscuchar,
  empezarAEscuchar,
  soltarVoz,
  vozDisponible,
  type ErrorVoz,
} from '@services/voz';

export const MENSAJE_ERROR_VOZ: Record<ErrorVoz, string> = {
  permiso: 'Sin el micrófono no puedo escucharte. Puedes escribir tu día aquí abajo.',
  'sin-servicio': 'No pude usar el micrófono ahora. Intenta otra vez o escribe tu día.',
  'sin-voz': 'No te escuché. Toca Hablar y cuéntame otra vez.',
  otro: 'No pude escucharte. Intenta otra vez o escribe tu día.',
};

interface Opciones {
  /** Lo que se va oyendo mientras habla. */
  alParcial: (texto: string) => void;
  /** Lo que se oyó al terminar (solo si hubo algo). */
  alTexto: (texto: string) => void;
}

export const useDictadoVoz = ({ alParcial, alTexto }: Opciones) => {
  const [escuchando, setEscuchando] = useState(false);
  const [disponible, setDisponible] = useState(true);
  const [error, setError] = useState<ErrorVoz | null>(null);
  const entregado = useRef(false);
  const ultimoParcial = useRef('');
  const vivo = useRef(true);
  // Los callbacks cambian en cada render; el reconocedor guarda solo el último que le dimos.
  const parcialRef = useRef(alParcial);
  const textoRef = useRef(alTexto);
  parcialRef.current = alParcial;
  textoRef.current = alTexto;

  useEffect(() => {
    vivo.current = true;
    vozDisponible().then(ok => {
      if (vivo.current) setDisponible(ok);
    });
    return () => {
      vivo.current = false;
      soltarVoz();
    };
  }, []);

  const entregar = useCallback((texto: string) => {
    const limpio = texto.trim();
    if (entregado.current || limpio === '') return;
    entregado.current = true;
    textoRef.current(limpio);
  }, []);

  const empezar = useCallback(async () => {
    entregado.current = false;
    ultimoParcial.current = '';
    setError(null);
    setEscuchando(true);
    await empezarAEscuchar({
      alParcial: texto => {
        ultimoParcial.current = texto;
        parcialRef.current(texto);
      },
      alFinal: texto => entregar(texto),
      alError: e => {
        if (vivo.current) setError(e);
      },
      alTerminar: () => {
        // Si el sistema cerró sin resultado final, lo último que se oyó vale igual.
        entregar(ultimoParcial.current);
        if (vivo.current) setEscuchando(false);
      },
    });
  }, [entregar]);

  const parar = useCallback(async () => {
    await dejarDeEscuchar();
  }, []);

  return { escuchando, disponible, error, empezar, parar };
};
