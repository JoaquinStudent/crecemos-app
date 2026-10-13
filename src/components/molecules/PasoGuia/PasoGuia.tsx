// src/components/molecules/PasoGuia/PasoGuia.tsx
// Marca un pedazo de pantalla como un paso del recorrido guiado. Es la ÚNICA puerta que usan las
// pantallas y la barra de navegación: cómo se dibuja el recorrido (overlay propio hoy) puede
// cambiar sin tocarlas.
//
//   <PasoGuia {...PASOS.teQueda}>…lo que se señala…</PasoGuia>
//
// El paso solo existe mientras está montado: si su pedazo de pantalla no está (Inicio vacío, sin
// meta, etc.), el recorrido lo salta sin quejarse. `activo={false}` lo deja fuera a propósito
// (para elegir entre dos candidatos al mismo paso) sin desmontar a los hijos.
import React, { ComponentRef, ReactNode, useContext, useEffect, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useAvisoDeLayout, useRegistroDePasos } from '@context/RecorridoProvider';
import { medirVista } from './medir';
import { DesplazamientoGuiaContext } from './ScrollGuiado';

export interface PasoGuiaProps {
  /** Identifica el paso (único en la app). */
  nombre: string;
  /** Posición en el recorrido: 1, 2, 3… */
  orden: number;
  titulo: string;
  texto: string;
  /** `false`: este pedazo no participa del recorrido. Por defecto, sí. */
  activo?: boolean;
  /** Estilo del contenedor (por ejemplo `{ flex: 1 }` dentro de una fila). */
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export const PasoGuia = ({
  nombre,
  orden,
  titulo,
  texto,
  activo = true,
  style,
  children,
}: PasoGuiaProps) => {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const registrar = useRegistroDePasos();
  const avisarLayout = useAvisoDeLayout();
  const desplazamiento = useContext(DesplazamientoGuiaContext);
  const desplazamientoActual = useRef(desplazamiento);
  desplazamientoActual.current = desplazamiento;

  useEffect(() => {
    if (!activo) return undefined;
    return registrar({
      nombre,
      orden,
      titulo,
      texto,
      medir: () => medirVista(ref, nombre),
      traerAVista: desplazamientoActual.current
        ? dy => desplazamientoActual.current?.desplazarPor(dy) ?? Promise.resolve()
        : undefined,
    });
  }, [activo, nombre, orden, titulo, texto, registrar]);

  return (
    <View ref={ref} collapsable={false} style={style} onLayout={() => avisarLayout(nombre)}>
      {children}
    </View>
  );
};
