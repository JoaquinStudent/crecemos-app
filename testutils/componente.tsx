// testutils/componente.tsx
// Monta un componente suelto (dentro del tema) para las pruebas de la biblioteca de UI.
import { ReactElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { TemaProvider } from '@components/organisms/TemaProvider';

export const montar = async (elemento: ReactElement) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(<TemaProvider>{elemento}</TemaProvider>);
  });
  return r;
};

export const desmontar = async (r: ReactTestRenderer.ReactTestRenderer) => {
  await act(async () => r.unmount());
};

/** Texto de un nodo, incluido el de los Text anidados. */
export const texto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(texto).join('');

export const hostPorTestID = (r: ReactTestRenderer.ReactTestRenderer, testID: string) => {
  const n = r.root.findAll(x => typeof x.type === 'string' && x.props.testID === testID)[0];
  if (!n) throw new Error(`No hay ningún nodo nativo con testID "${testID}"`);
  return n;
};

export const estilo = (n: ReactTestInstance) => StyleSheet.flatten(n.props.style) ?? {};

/** Todos los textos nativos del árbol. */
export const textos = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(n => (n.type as unknown) === 'Text').map(texto);

/** El componente más interno con ese testID que responde a onPress (el que corre la lógica real). */
export const tocablePorTestID = (r: ReactTestRenderer.ReactTestRenderer, testID: string) => {
  const todos = r.root.findAll(
    x => x.props.testID === testID && typeof x.props.onPress === 'function',
  );
  if (!todos.length) throw new Error();
  return todos[todos.length - 1];
};
