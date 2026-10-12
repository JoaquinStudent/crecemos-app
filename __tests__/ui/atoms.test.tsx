import { act } from 'react-test-renderer';
import { Clock } from 'lucide-react-native';
import { Badge } from '@components/atoms/Badge';
import { MoneyText, textoMonto } from '@components/atoms/MoneyText';
import { ProgressBar } from '@components/atoms/ProgressBar';
import { Skeleton } from '@components/atoms/Skeleton';
import { colors } from '@theme';
import { desmontar, estilo, hostPorTestID, montar, texto } from '../../testutils/componente';
import { contraste } from '../../testutils/contraste';

describe('Badge', () => {
  it('muestra su texto, es un solo elemento accesible y no pasa de 14px abajo', async () => {
    const r = await montar(<Badge label="Por cobrar" tone="brand" icon={Clock} testID="b" />);
    const host = hostPorTestID(r, 'b');
    expect(host.props.accessible).toBe(true);
    expect(host.props.accessibilityLabel).toBe('Por cobrar');
    const t = r.root.findAll(n => (n.type as unknown) === 'Text' && texto(n) === 'Por cobrar')[0];
    expect(estilo(t).fontSize).toBeGreaterThanOrEqual(14);
    await desmontar(r);
  });

  it('todos los tonos tienen contraste 4.5 o más entre texto y fondo', async () => {
    const pares: Array<[string, string]> = [
      [colors.text, colors.surfacePressed],
      [colors.primary, colors.primarySoft],
      [colors.success, colors.successSoft],
      [colors.danger, colors.dangerSoft],
      [colors.info, colors.infoSoft],
      [colors.text, colors.accent], // el naranja es relleno: el texto va oscuro
    ];
    for (const [fg, bg] of pares) expect(contraste(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('el tono accent lleva texto oscuro y no naranja', async () => {
    const r = await montar(<Badge label="Meta" tone="accent" testID="b" />);
    const t = r.root.findAll(n => (n.type as unknown) === 'Text' && texto(n) === 'Meta')[0];
    expect(estilo(t).color).toBe(colors.text);
    expect(estilo(t).color).not.toBe(colors.accent);
    await desmontar(r);
  });
});

describe('MoneyText', () => {
  it('pone el signo y el prefijo S/ además del color', () => {
    expect(textoMonto(120)).toBe('+ S/ 120.00');
    expect(textoMonto(-35.5)).toBe('− S/ 35.50');
    expect(textoMonto(0)).toBe('S/ 0.00');
    expect(textoMonto(35.5, 'gasto')).toBe('− S/ 35.50');
    expect(textoMonto(120, 'ingreso')).toBe('+ S/ 120.00');
    expect(textoMonto(-4, 'neutral')).toBe('S/ 4.00');
  });

  it('usa verde para entradas y rojo para salidas', async () => {
    const r = await montar(
      <>
        <MoneyText monto={10} testID="in" />
        <MoneyText monto={-10} testID="out" />
        <MoneyText monto={7} tone="gasto" testID="gasto" />
        <MoneyText monto={0} testID="cero" />
      </>,
    );
    expect(estilo(hostPorTestID(r, 'in')).color).toBe(colors.success);
    expect(estilo(hostPorTestID(r, 'out')).color).toBe(colors.danger);
    expect(estilo(hostPorTestID(r, 'gasto')).color).toBe(colors.danger);
    expect(estilo(hostPorTestID(r, 'cero')).color).toBe(colors.text);
    await desmontar(r);
  });

  it('una línea, se achica y usa cifras tabulares', async () => {
    const r = await montar(<MoneyText monto={1240} testID="m" />);
    const host = hostPorTestID(r, 'm');
    expect(host.props.numberOfLines).toBe(1);
    expect(host.props.adjustsFontSizeToFit).toBe(true);
    expect(estilo(host).fontVariant).toContain('tabular-nums');
    expect(host.props.maxFontSizeMultiplier).toBeDefined();
    await desmontar(r);
  });

  it('el contraste de verde y rojo sobre blanco cumple 4.5', () => {
    expect(contraste(colors.success, colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(colors.danger, colors.background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('ProgressBar', () => {
  it('es una barra de progreso accesible con su valor y su etiqueta', async () => {
    const r = await montar(
      <ProgressBar value={0.4} accessibilityLabel="Capital recuperado" testID="p" />,
    );
    const host = hostPorTestID(r, 'p');
    expect(host.props.accessibilityRole).toBe('progressbar');
    expect(host.props.accessibilityLabel).toBe('Capital recuperado');
    expect(host.props.accessibilityValue).toMatchObject({ min: 0, max: 100, now: 40 });
    await desmontar(r);
  });

  it('recorta valores fuera de rango', async () => {
    const r = await montar(
      <>
        <ProgressBar value={3} accessibilityLabel="a" testID="alto" />
        <ProgressBar value={-1} accessibilityLabel="b" testID="bajo" />
        <ProgressBar value={Number.NaN} accessibilityLabel="c" testID="nan" />
      </>,
    );
    expect(hostPorTestID(r, 'alto').props.accessibilityValue.now).toBe(100);
    expect(hostPorTestID(r, 'bajo').props.accessibilityValue.now).toBe(0);
    expect(hostPorTestID(r, 'nan').props.accessibilityValue.now).toBe(0);
    await desmontar(r);
  });
});

describe('Skeleton', () => {
  it('avisa que está cargando y respeta tamaño y forma', async () => {
    const r = await montar(<Skeleton width={120} height={20} testID="s" />);
    const host = hostPorTestID(r, 's');
    expect(host.props.accessibilityLabel).toBe('Cargando');
    expect(host.props.accessibilityState).toMatchObject({ busy: true });
    expect(estilo(host)).toMatchObject({ width: 120, height: 20 });
    await desmontar(r);
  });

  it('circle usa la altura como diámetro', async () => {
    const r = await montar(<Skeleton circle height={40} testID="s" />);
    expect(estilo(hostPorTestID(r, 's'))).toMatchObject({ width: 40, height: 40, borderRadius: 20 });
    await desmontar(r);
  });

  it('con "reducir movimiento" no arranca el pulso', async () => {
    const { AccessibilityInfo } = require('react-native');
    (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValueOnce(true);
    const r = await montar(<Skeleton testID="s" />);
    await act(async () => {});
    expect(estilo(hostPorTestID(r, 's')).opacity).toBe(1);
    await desmontar(r);
  });
});
