// src/analisis/preguntasRegla.ts
// La pregunta que abre el Asistente desde cada recomendación de Inicio ("Preguntar por qué").
// Son frases que el chat ya sabe contestar (coinciden con las intenciones de `intenciones.ts`),
// escritas como las diría Freddy.
import type { Recomendacion } from '@dominio/tipos';

export const PREGUNTA_POR_REGLA: Record<Recomendacion['reglaId'], string> = {
  cobro: '¿Cuánto tengo por cobrar?',
  precio: '¿Debo revisar un precio?',
  preparar: '¿Qué debería preparar mañana?',
  retiro: '¿Cuánto puedo sacar para la casa?',
  diaFlojo: '¿Qué día me va peor?',
  comparacion: '¿Cómo voy contra el ciclo pasado?',
};

export const preguntaDeRegla = (reglaId: Recomendacion['reglaId']): string =>
  PREGUNTA_POR_REGLA[reglaId];
