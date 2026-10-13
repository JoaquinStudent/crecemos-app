// testutils/app.tsx
// Ayudas compartidas para las pruebas que montan la app real y la usan por testID.
import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import App from '../App';

// Texto de un nodo, incluido el de los Text anidados.
export const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

type Evento = 'onPress' | 'onChangeText' | 'onValueChange';

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
export const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  montada = app;

  const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
  // Si no existe, el error lo dice: sin esto sería un "undefined.props" que no explica nada.
  const nodo = (testID: string, evento: Evento) => {
    const encontrado = app.root.findAll(
      n => n.props.testID === testID && typeof n.props[evento] === 'function',
    )[0];
    if (!encontrado) throw new Error(`No hay nada con testID "${testID}" que responda a ${evento}`);
    return encontrado;
  };
  const tocar = (testID: string) =>
    act(async () => {
      await nodo(testID, 'onPress').props.onPress();
    });
  const escribir = (testID: string, texto: string) =>
    act(async () => {
      nodo(testID, 'onChangeText').props.onChangeText(texto);
    });
  const cambiarInterruptor = (testID: string, valor: boolean) =>
    act(async () => {
      await nodo(testID, 'onValueChange').props.onValueChange(valor);
    });
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const textos = () => app.root.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  const textoNodo = (testID: string) => {
    const encontrado = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!encontrado) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return encontrado;
  };
  const textoDe = (testID: string) => textoCompleto(textoNodo(testID));
  // El estilo (aplanado) de un texto.
  const estiloTextoDe = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style);
  // Las props de un texto (numberOfLines, etc.).
  const textoNodoProps = (testID: string) => textoNodo(testID).props;
  const colorDe = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style).color;
  // Lo que escribió o precargó en un campo.
  const valorDe = (testID: string): string => {
    const campo = app.root.findAll(n => esHost(n, 'TextInput') && n.props.testID === testID)[0];
    if (!campo) throw new Error(`No hay ningún campo con testID "${testID}"`);
    return campo.props.value;
  };
  const botonDe = (testID: string) => nodo(testID, 'onPress');
  // Las props del primer nodo con ese testID (accessibilityValue de un anillo, etc.).
  const propsDe = (testID: string) => {
    const todos = app.root.findAll(n => n.props.testID === testID);
    const encontrado = todos.find(n => typeof n.type === 'string') ?? todos[0];
    if (!encontrado) throw new Error(`No hay nada con testID "${testID}"`);
    return encontrado.props;
  };
  const interruptor = (testID: string) => {
    const encontrado = app.root.findAll(n => n.props.testID === testID && 'value' in n.props)[0];
    if (!encontrado) throw new Error(`No hay ningún interruptor con testID "${testID}"`);
    return encontrado;
  };
  const estiloDe = (testID: string) => {
    const vista = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!vista) throw new Error(`No hay ninguna vista con testID "${testID}"`);
    return StyleSheet.flatten(vista.props.style);
  };
  // Estilo del primer contenedor interno de una tarjeta (el que envuelve a los hijos: ahí aplica el gap).
  const estiloDeContenido = (testID: string) => {
    const vista = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!vista) throw new Error('No hay ninguna vista con ese testID: '+testID);
    const hijo = vista.findAll(n => esHost(n, 'View') && n !== vista)[0];
    return StyleSheet.flatten(hijo?.props.style);
  };
  // Los colores de fondo de las vistas dibujadas dentro de ese nodo (para distinguir lleno de contorno).
  const fondosDe = (testID: string): unknown[] => {
    const nodoRaiz = app.root.findAll(n => n.props.testID === testID)[0];
    if (!nodoRaiz) throw new Error('No hay nada con testID: ' + testID);
    return nodoRaiz
      .findAll(n => esHost(n, 'View'))
      .map(n => StyleSheet.flatten(n.props.style)?.backgroundColor)
      .filter(Boolean);
  };
  const cuantos = (prefijo: string) =>
    app.root.findAll(n => esHost(n, 'View') && String(n.props.testID ?? '').startsWith(prefijo))
      .length;
  const pestanaActiva = (testID: string) =>
    app.root.findAll(n => n.props.testID === testID && n.props.accessibilityState)[0]?.props
      .accessibilityState.selected === true;
  // Los testID pedidos, en el orden en que están en pantalla (de arriba hacia abajo), sin repetir.
  const enOrden = (ids: string[]) => {
    const vistos: string[] = [];
    app.root
      .findAll(n => (esHost(n, 'Text') || esHost(n, 'View')) && ids.includes(n.props.testID))
      .forEach(n => {
        if (!vistos.includes(n.props.testID)) vistos.push(n.props.testID);
      });
    return vistos;
  };
  // El color (hexadecimal) con que se dibujó el ícono dentro de esa vista.
  const colorDelIcono = (testID: string): string | undefined => {
    const vista = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!vista) throw new Error(`No hay ninguna vista con testID "${testID}"`);
    return vista.findAll(n => /^#[0-9A-Fa-f]{6}$/.test(String(n.props.color)))[0]?.props.color;
  };
  // Los títulos de día, en el orden en que aparecen.
  const titulosDeDia = () =>
    app.root
      .findAll(n => esHost(n, 'Text') && String(n.props.testID ?? '').startsWith('dia-titulo-'))
      .map(textoCompleto);

  // Todos los nodos del árbol que cumplen el predicado.
  const buscar = (predicado: (n: ReactTestInstance) => boolean) => app.root.findAll(predicado);

  return {
    buscar,
    tocar,
    escribir,
    cambiarInterruptor,
    existe,
    botonDe,
    propsDe,
    textos,
    textoDe,
    colorDe,
    estiloTextoDe,
    textoNodoProps,
    valorDe,
    interruptor,
    estiloDe,
    estiloDeContenido,
    fondosDe,
    cuantos,
    pestanaActiva,
    titulosDeDia,
    enOrden,
    colorDelIcono,
  };
};
/** Desmonta la app montada por `montarApp` (para el afterEach). */
export const desmontarApp = async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
};
