// testutils/recorrido.ts
// En Jest el recorrido guiado viene "ya visto" (ver jest.setup.js). Las pruebas del recorrido lo
// piden de verdad con `usarRecorridoReal()` y lo sueltan con `soltarRecorridoReal()`.
declare global {
  // eslint-disable-next-line no-var
  var __RECORRIDO_REAL__: boolean | undefined;
}

export const usarRecorridoReal = () => {
  globalThis.__RECORRIDO_REAL__ = true;
};

export const soltarRecorridoReal = () => {
  globalThis.__RECORRIDO_REAL__ = undefined;
};
