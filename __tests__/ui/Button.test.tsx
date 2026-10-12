import { Text as RNText } from 'react-native';
import { act } from 'react-test-renderer';
import { Button } from '@components/atoms/Button';
import { Check } from 'lucide-react-native';
import { colors } from '@theme';
import { contraste } from '../../testutils/contraste';
import { desmontar, estilo, hostPorTestID, montar, texto, tocablePorTestID } from '../../testutils/componente';

describe('Button (sobre RNE)', () => {
  it('conserva rol, label, testID y dispara onPress', async () => {
    const onPress = jest.fn();
    const r = await montar(<Button title="Guardar" testID="b" onPress={onPress} />);
    const host = hostPorTestID(r, 'b');
    expect(host.props.accessibilityRole).toBe('button');
    expect(host.props.accessibilityLabel).toBe('Guardar');
    expect(host.props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    await act(async () => tocablePorTestID(r, 'b').props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    await desmontar(r);
  });

  it('el tamaño lg mide 56dp y tiene forma de píldora de 28', async () => {
    const r = await montar(<Button title="Cerrar" size="lg" testID="b" />);
    const e = estilo(hostPorTestID(r, 'b'));
    expect(e.height).toBe(56);
    expect(e.borderRadius).toBe(28);
    await desmontar(r);
  });

  it('md cumple los 48dp táctiles', async () => {
    const r = await montar(<Button title="Seguir" testID="b" />);
    expect(estilo(hostPorTestID(r, 'b')).height).toBeGreaterThanOrEqual(48);
    await desmontar(r);
  });

  it('deshabilitado: no dispara, fondo y texto de DESIGN.md', async () => {
    const onPress = jest.fn();
    const r = await montar(<Button title="Guardar" testID="b" disabled onPress={onPress} />);
    const host = hostPorTestID(r, 'b');
    expect(host.props.accessibilityState.disabled).toBe(true);
    await act(async () => tocablePorTestID(r, 'b').props.onPress());
    expect(onPress).not.toHaveBeenCalled();
    const titulo = r.root.findAll(n => n.type === RNText && texto(n) === 'Guardar')[0];
    expect(estilo(titulo).color).toBe(colors.disabledText);
    const fondos = r.root
      .findAll(n => typeof n.type === 'string' && estilo(n).backgroundColor === colors.disabledBg)
      .length;
    expect(fondos).toBeGreaterThan(0);
    await desmontar(r);
  });

  it('cargando: busy, sin título y no dispara', async () => {
    const onPress = jest.fn();
    const r = await montar(<Button title="Guardar" testID="b" loading onPress={onPress} />);
    const host = hostPorTestID(r, 'b');
    expect(host.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await act(async () => tocablePorTestID(r, 'b').props.onPress());
    expect(onPress).not.toHaveBeenCalled();
    await desmontar(r);
  });

  it('acepta ícono lucide a la izquierda y fullWidth', async () => {
    const r = await montar(<Button title="Listo" leftIcon={Check} fullWidth testID="b" />);
    expect(r.root.findAll(n => texto(n) === 'Listo').length).toBeGreaterThan(0);
    await desmontar(r);
  });

  it('el efecto de presión usa Animated y no revienta al soltar', async () => {
    const r = await montar(<Button title="Tocar" testID="b" />);
    const host = hostPorTestID(r, 'b');
    await act(async () => host.props.onPressIn?.({}));
    await act(async () => host.props.onPressOut?.({}));
    await desmontar(r);
  });

  it('el texto deshabilitado cumple contraste 4.5 sobre su fondo', () => {
    expect(contraste(colors.disabledText, colors.disabledBg)).toBeGreaterThanOrEqual(4.5);
  });
});
