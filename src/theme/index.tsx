// src/theme/index.tsx
// Punto de entrada único del tema. `@rneui/*` NO se reexporta desde acá: el puente con
// React Native Elements vive en `./rneTheme` y solo lo usan los componentes.
export * from './colors';
export * from './typography';
export * from './spacing';
export * from './elevation';
