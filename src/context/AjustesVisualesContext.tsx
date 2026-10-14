// src/context/AjustesVisualesContext.tsx
// Entrega a toda la app las preferencias visuales del Perfil. Sin proveedor (pruebas de
// componentes sueltos) vale la tipografía base: "Grande", escala 1, para no mover nada.
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { ajustesVisuales, ESCALA_TAMANO, type AjustesVisuales } from '@dominio/ajustes';
import { useCrecemos } from '@context/CrecemosProvider';
import { forzarMovimientoReducido } from '@hooks/useMovimientoReducido';

interface Valor extends AjustesVisuales {
  /** Multiplicador de la tipografía base. */
  escala: number;
}

const SIN_PROVEEDOR: Valor = {
  tamanoLetra: 'grande',
  vibracion: true,
  reducirAnimaciones: false,
  escala: 1,
};

const Contexto = createContext<Valor>(SIN_PROVEEDOR);

export const AjustesVisualesProvider = ({ children }: { children: React.ReactNode }) => {
  const { perfil } = useCrecemos();
  const { tamanoLetra, vibracion, reducirAnimaciones } = ajustesVisuales(perfil);

  useEffect(() => {
    forzarMovimientoReducido(reducirAnimaciones);
  }, [reducirAnimaciones]);

  const valor = useMemo<Valor>(
    () => ({ tamanoLetra, vibracion, reducirAnimaciones, escala: ESCALA_TAMANO[tamanoLetra] }),
    [tamanoLetra, vibracion, reducirAnimaciones],
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
};

export const useAjustesVisuales = (): Valor => useContext(Contexto);
