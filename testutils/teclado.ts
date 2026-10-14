// testutils/teclado.ts
// Teclado simulado: intercepta los oyentes de `Keyboard` para "abrirlo" y "cerrarlo" a voluntad.
// Usar `jest.restoreAllMocks()` en el `afterEach` del archivo que lo use.
import { Keyboard } from 'react-native';
import { act } from 'react-test-renderer';

type Manejador = (e?: unknown) => void;

export const crearTecladoSimulado = () => {
  const manejadores: Record<string, Manejador[]> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((evento: string, fn: Manejador) => {
    (manejadores[evento] ??= []).push(fn);
    return { remove: () => undefined };
  }) as unknown as typeof Keyboard.addListener);

  const emitir = (patron: RegExp, e?: unknown) =>
    act(async () => {
      for (const [nombre, fns] of Object.entries(manejadores)) {
        if (patron.test(nombre)) fns.forEach(fn => fn(e));
      }
    });

  return {
    abrir: (height = 300, screenY = 600) =>
      emitir(/Show$/, { endCoordinates: { height, screenY } }),
    cerrar: () => emitir(/Hide$/),
  };
};
