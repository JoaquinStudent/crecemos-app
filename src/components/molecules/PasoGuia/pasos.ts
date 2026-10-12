// src/components/molecules/PasoGuia/pasos.ts
// Los cinco pasos del recorrido: el texto de cada uno vive aquí, en un solo lugar, en palabras de
// todos los días y tratando de "tú". Cada pantalla solo elige a quién señala (`<PasoGuia {...PASOS.x}>`).
export const PASOS = {
  teQueda: {
    nombre: 'te-queda',
    orden: 1,
    titulo: 'Lo que te queda',
    texto: 'Aquí ves cuánto te queda: lo que vendiste menos lo que gastaste.',
  },
  cerrarDia: {
    nombre: 'cerrar-dia',
    orden: 2,
    titulo: 'Cierra tu día',
    texto: 'Cada noche toca aquí para anotar tu día. Te toma menos de un minuto.',
  },
  decidir: {
    nombre: 'decidir',
    orden: 3,
    titulo: 'Qué hacer hoy y mañana',
    texto: 'Te sugiero qué hacer hoy y cuánto preparar mañana.',
  },
  asistente: {
    nombre: 'asistente',
    orden: 4,
    titulo: 'Pregúntame lo que quieras',
    texto: 'Pregúntame lo que quieras de tu negocio. Funciona aunque no tengas internet.',
  },
  cuota: {
    nombre: 'cuota',
    orden: 5,
    titulo: 'Tu cuota y tus yapes',
    texto: 'Separa un poco cada día para tu cuota y anota tus yapes.',
  },
} as const;
