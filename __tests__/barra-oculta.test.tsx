/** La barra no se esconde mientras corre el recorrido guiado (él desplaza y señala la barra). */
import { createElement } from 'react';
import { Animated } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { BarraOcultaProvider, useBarraOculta } from '@context/BarraOcultaContext';
import { useRecorrido } from '@context/RecorridoProvider';

jest.mock('@context/RecorridoProvider', () => ({ useRecorrido: jest.fn() }));

const bajar = (y: number) =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentSize: { width: 360, height: 3000 },
      layoutMeasurement: { width: 360, height: 800 },
    },
  }) as never;

const montar = (activo: boolean) => {
  (useRecorrido as jest.Mock).mockReturnValue({ activo });
  let barra!: ReturnType<typeof useBarraOculta>;
  const Sonda = () => {
    barra = useBarraOculta();
    return null;
  };
  act(() => {
    ReactTestRenderer.create(createElement(BarraOcultaProvider, null, createElement(Sonda)));
  });
  return barra;
};

describe('BarraOcultaProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('al bajar el scroll anima el escondido de la barra', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const barra = montar(false);
    act(() => {
      barra.alDesplazar(bajar(200));
    });
    expect(timing).toHaveBeenCalledWith(barra.oculta, expect.objectContaining({ toValue: 1 }));
  });

  it('con el recorrido en marcha ignora el scroll y deja la barra a la vista', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const barra = montar(true);
    act(() => {
      barra.alDesplazar(bajar(200));
    });
    expect(timing).not.toHaveBeenCalled();
    expect((barra.oculta as unknown as { __getValue: () => number }).__getValue()).toBe(0);
  });
});
