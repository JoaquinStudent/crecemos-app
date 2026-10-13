import { Shield } from 'lucide-react-native';
import { OpcionPerfil } from '@components/molecules/OpcionPerfil';
import { desmontar, estilo, hostPorTestID, montar, texto, tocablePorTestID } from '../../testutils/componente';

const largo = 'Un resumen muy largo que en un teléfono de 360 dp y con la letra grande no cabe en una línea';

describe('OpcionPerfil', () => {
  it('es UN botón con la etiqueta "<título>. <resumen>" y dispara onPress', async () => {
    const alTocar = jest.fn();
    const r = await montar(
      <OpcionPerfil icon={Shield} title="Cómo me pagan" summary="Yape activado" onPress={alTocar} testID="op" />,
    );
    const fila = hostPorTestID(r, 'op');
    expect(fila.props.accessibilityRole).toBe('button');
    expect(fila.props.accessibilityLabel).toBe('Cómo me pagan. Yape activado');
    tocablePorTestID(r, 'op').props.onPress();
    expect(alTocar).toHaveBeenCalledTimes(1);
    expect(texto(hostPorTestID(r, 'op-titulo'))).toBe('Cómo me pagan');
    expect(texto(hostPorTestID(r, 'op-resumen'))).toBe('Yape activado');
    await desmontar(r);
  });

  it('mide al menos 56 dp y la línea fina separa una fila de otra', async () => {
    const r = await montar(
      <>
        <OpcionPerfil icon={Shield} title="A" summary="a" onPress={() => {}} testID="con" />
        <OpcionPerfil icon={Shield} title="B" summary="b" onPress={() => {}} divider={false} testID="sin" />
      </>,
    );
    const e = (id: string) => estilo(hostPorTestID(r, id));
    expect(e('con').minHeight).toBeGreaterThanOrEqual(56);
    expect(e('con').borderBottomWidth).toBe(1);
    expect(e('sin').borderBottomWidth).toBeUndefined();
    await desmontar(r);
  });

  it('título y resumen se parten en hasta dos líneas: nada se corta con letra grande', async () => {
    const r = await montar(
      <OpcionPerfil icon={Shield} title="Un título bastante largo para esta opción" summary={largo} onPress={() => {}} testID="op" />,
    );
    expect(hostPorTestID(r, 'op-titulo').props.numberOfLines).toBe(2);
    expect(hostPorTestID(r, 'op-resumen').props.numberOfLines).toBe(2);
    await desmontar(r);
  });
});
