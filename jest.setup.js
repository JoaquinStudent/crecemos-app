// AsyncStorage v3 trae su propio mock en memoria.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
