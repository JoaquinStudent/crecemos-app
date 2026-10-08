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

// Librerias nativas del Sprint-07 (foto, PDF y compartir archivo): en Jest no hay modulo nativo,
// asi que se simulan con lo minimo para que importarlas no falle. Las pruebas que necesiten otra
// respuesta ponen su propio mock encima.
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(() => Promise.resolve({ didCancel: true })),
  launchCamera: jest.fn(() => Promise.resolve({ didCancel: true })),
}));

jest.mock('react-native-html-to-pdf', () => ({
  generatePDF: jest.fn(() => Promise.resolve({ filePath: '/tmp/prueba.pdf' })),
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { open: jest.fn(() => Promise.resolve({ success: true })) },
}));
