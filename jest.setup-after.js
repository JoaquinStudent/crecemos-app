// Corre antes de cada prueba: el servicio del chat recuerda cuándo falló la red por última vez
// (para no esperar 8 s de más). Cada prueba debe empezar sin esa memoria.
beforeEach(() => {
  try {
    require('./src/services/jev').reiniciarEstadoDeRed();
  } catch {
    // Pruebas que simulan o reinician módulos: no hay estado que limpiar.
  }
});
