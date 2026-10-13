import { ActivityIndicator } from 'react-native';
import { Send } from 'lucide-react-native';
import { colors } from '@theme';
import { BotonIcono } from '@components/atoms/BotonIcono';
import { contraste } from '../../testutils/contraste';
import { desmontar, estilo, hostPorTestID, montar } from '../../testutils/componente';

describe('BotonIcono (solo ícono, excepción pedida)', () => {
  it('mide 48x48, es redondo y trae rol y etiqueta', async () => {
    const r = await montar(
      <BotonIcono icon={Send} accessibilityLabel="Preguntar" onPress={() => undefined} testID="b" />,
    );
    const b = hostPorTestID(r, 'b');
    const e = estilo(b);
    expect([e.width, e.height]).toEqual([48, 48]);
    expect(e.borderRadius).toBeGreaterThanOrEqual(24);
    expect(e.backgroundColor).toBe(colors.primary);
    expect(b.props.accessibilityRole).toBe('button');
    expect(b.props.accessibilityLabel).toBe('Preguntar');
    await desmontar(r);
  });

  it('apagado: fondo y ícono de deshabilitado, con contraste legible', async () => {
    const r = await montar(
      <BotonIcono icon={Send} accessibilityLabel="Preguntar" onPress={() => undefined} disabled testID="b" />,
    );
    const b = hostPorTestID(r, 'b');
    expect(estilo(b).backgroundColor).toBe(colors.disabledBg);
    expect(b.props.accessibilityState).toMatchObject({ disabled: true, busy: false });
    expect(contraste(colors.disabledText, colors.disabledBg)).toBeGreaterThanOrEqual(4.5);
    await desmontar(r);
  });

  it('cargando: indicador en vez del ícono, ocupado y del mismo tamaño', async () => {
    const r = await montar(
      <BotonIcono icon={Send} accessibilityLabel="Preguntar" onPress={() => undefined} loading testID="b" />,
    );
    const b = hostPorTestID(r, 'b');
    expect(r.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(b.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect([estilo(b).width, estilo(b).height]).toEqual([48, 48]);
    await desmontar(r);
  });
});
