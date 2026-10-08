/* eslint-env jest */
// AsyncStorage v3 trae su propio mock en memoria.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// Insets y medidas fijas: sin esto SafeAreaProvider no pinta nada en Jest,
// porque espera una medición nativa que nunca llega.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Red caída por defecto: con el almacenamiento vacío la app pide la semilla al arrancar, y
// ninguna prueba debe tocar la red de verdad ni cambiar sus datos. Las pruebas de la semilla
// ponen su propio fetch simulado y lo restauran al terminar.
global.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
