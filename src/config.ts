// src/config.ts
// Dirección de la semilla de ejemplo (Mock API). Es la primera de las dos direcciones de red de la app.
export const SEED_URL =
  'https://raw.githubusercontent.com/JoaquinStudent/crecemos-app/main/seed/semilla.json';

// Dirección del servidor intermedio (Cloudflare Worker) del chat "Preguntarle a mis datos". La app
// nunca habla con el proveedor de IA: habla con este Worker, que guarda la clave como secreto. No es
// un secreto: es solo una dirección pública. Es la segunda y última dirección de red de la app.
export const JEV_URL = 'https://crecemos-asistente.joaquiningsoft.workers.dev';
