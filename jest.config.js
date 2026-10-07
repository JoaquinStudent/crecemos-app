// La fecha del negocio es la fecha local de Lima (AGENTS.md, regla 12).
// Se fija aqui para que los tests de fechas no dependan de la maquina.
process.env.TZ = 'America/Lima';

module.exports = {
  preset: '@react-native/jest-preset',
  // Sin watchman: Jest no lo necesita para un repo de este tamano, y si macOS
  // no le dio permiso a watchman, la suite (y la compuerta) se cuelga.
  watchman: false,
  setupFiles: ['<rootDir>/jest.setup.js'],
  // El preset solo transforma react-native y @react-native(-community). Tambien hay
  // que transformar lo que se publica como ESM o fuente: el mock de AsyncStorage 3
  // (lib/module/jest), React Navigation 7 (lib/module) y las librerias nativas
  // react-native-* (screens, safe-area-context, svg), que Jest resuelve a su fuente.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-[a-z-]+)?|@react-native(-community|-async-storage)?|@react-navigation/[a-z-]+)/)',
  ],
  moduleNameMapper: {
    // lucide publica ESM (.mjs) para React Native; en Jest se usa su build CommonJS.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
};
