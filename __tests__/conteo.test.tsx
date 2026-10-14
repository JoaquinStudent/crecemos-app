/**
 * El monto grande de Inicio "cuenta" hasta su valor (useConteo): empieza en 0, termina exacto en el
 * objetivo y, con "Reducir movimiento", salta directo al valor final.
 */
import { createElement } from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useConteo } from '@hooks/useConteo';

const Monto = ({ objetivo, duracion }: { objetivo: number; duracion: number }) =>
  createElement(Text, { testID: 'monto' }, String(useConteo(objetivo, duracion)));

const esperar = (ms: number) =>
  act(async () => {
    await new Promise(resolver => setTimeout(resolver, ms));
  });

const montar = async (objetivo: number, duracion = 60) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    r = ReactTestRenderer.create(createElement(Monto, { objetivo, duracion }));
  });
  const valor = () =>
    Number(
      r.root
        .findAll(n => (n.type as unknown) === 'Text' && n.props.testID === 'monto')[0]
        .children.join(''),
    );
  return { valor, r };
};

describe('useConteo', () => {
  it('sin "Reducir movimiento" empieza en 0 y termina exactamente en el objetivo', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(false);

    const { valor, r } = await montar(394.5);
    expect(valor()).toBeLessThan(394.5);

    await esperar(300);
    expect(valor()).toBe(394.5);
    await act(async () => r.unmount());
  });

  it('con "Reducir movimiento" muestra el valor final de una vez', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);

    const { valor, r } = await montar(394.5, 5000);

    expect(valor()).toBe(394.5);
    await act(async () => r.unmount());
  });

  it('cuando el objetivo cambia, cuenta hasta el nuevo valor (también hacia abajo, a negativos)', async () => {
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(false);
    const { valor, r } = await montar(100);
    await esperar(300);
    expect(valor()).toBe(100);

    await act(async () => {
      r.update(createElement(Monto, { objetivo: -60, duracion: 60 }));
    });
    await esperar(300);

    expect(valor()).toBe(-60);
    await act(async () => r.unmount());
  });
});
