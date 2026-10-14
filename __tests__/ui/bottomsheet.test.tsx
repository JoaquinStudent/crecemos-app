import { Animated, KeyboardAvoidingView, Text as RNText } from 'react-native';
import { act } from 'react-test-renderer';
import { BottomSheet } from '@components/organisms/BottomSheet';
import { colors } from '@theme';
import { desmontar, estilo, hostPorTestID, montar } from '../../testutils/componente';

const hoja = (props: Partial<React.ComponentProps<typeof BottomSheet>> = {}) => (
  <BottomSheet
    visible
    onClose={() => {}}
    testID="hoja"
    scrollTestID="hoja-scroll"
    footerTestID="hoja-pie"
    accessibilityLabel="Opciones"
    footer={<RNText>Pie</RNText>}
    {...props}
  >
    <RNText>Contenido</RNText>
  </BottomSheet>
);

describe('BottomSheet', () => {
  it('el Modal es transparente, cubre la barra de estado y no desliza el fondo', async () => {
    const r = await montar(hoja());
    const modal = r.root.findAll(n => (n.type as unknown) === 'Modal')[0];
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.statusBarTranslucent).toBe(true);
    // El slide nativo movería el fondo con la hoja: la animación es nuestra (fade + subida).
    expect(modal.props.animationType).toBe('none');
    await desmontar(r);
  });

  it('se anuncia como modal para el lector de pantalla', async () => {
    const r = await montar(hoja());
    expect(hostPorTestID(r, 'hoja').props.accessibilityViewIsModal).toBe(true);
    await desmontar(r);
  });

  it('lleva la barra de arrastre decorativa, oculta al lector de pantalla', async () => {
    const r = await montar(hoja());
    const asa = hostPorTestID(r, 'hoja-asa');
    expect(asa.props.accessible).toBe(false);
    expect(asa.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(estilo(asa)).toMatchObject({ height: 4, width: 40 });
    await desmontar(r);
  });

  it('el velo y la hoja se animan por separado: fade para el fondo y slide para la hoja', async () => {
    const r = await montar(hoja());
    const animados = r.root.findAll(n => n.type === Animated.View);
    // Velo: tiene opacidad animada y el color de overlay. Hoja: tiene translateY animado.
    const velo = animados.find(n => estilo(n).backgroundColor === colors.overlay);
    const sube = animados.find(n => Array.isArray(estilo(n).transform));
    expect(velo).toBeDefined();
    expect(sube).toBeDefined();
    expect(velo).not.toBe(sube);
    expect(estilo(velo!).transform).toBeUndefined();
    expect(estilo(sube!).backgroundColor).not.toBe(colors.overlay);
    await desmontar(r);
  });

  it('el pie queda fuera del scroll y el contenido dentro', async () => {
    const r = await montar(hoja());
    const scroll = hostPorTestID(r, 'hoja-scroll');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    const textosEnScroll = scroll.findAll(n => (n.type as unknown) === 'Text').map(n => n.children.join(''));
    expect(textosEnScroll).toContain('Contenido');
    expect(textosEnScroll).not.toContain('Pie');
    expect(hostPorTestID(r, 'hoja-pie')).toBeTruthy();
    await desmontar(r);
  });

  it('sin footer no dibuja pie', async () => {
    const r = await montar(hoja({ footer: undefined }));
    expect(r.root.findAll(n => n.props.testID === 'hoja-pie')).toHaveLength(0);
    await desmontar(r);
  });

  it('el botón físico Atrás de Android llama a onClose', async () => {
    const onClose = jest.fn();
    const r = await montar(hoja({ onClose }));
    const modal = r.root.findAll(n => (n.type as unknown) === 'Modal')[0];
    await act(async () => modal.props.onRequestClose());
    expect(onClose).toHaveBeenCalledTimes(1);
    await desmontar(r);
  });

  it('tocar fuera cierra (y ese velo no es un elemento accesible)', async () => {
    const onClose = jest.fn();
    const r = await montar(hoja({ onClose }));
    const velo = r.root.findAll(n => n.props.onPress === onClose)[0];
    expect(velo.props.accessible).toBe(false);
    await act(async () => velo.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    await desmontar(r);
  });

  it('con visible=false no dibuja nada', async () => {
    const r = await montar(hoja({ visible: false }));
    expect(r.root.findAll(n => typeof n.type === 'string' && n.props.testID === 'hoja')).toHaveLength(0);
    await desmontar(r);
  });

  it('avoidKeyboard envuelve la hoja en un KeyboardAvoidingView y sin él no', async () => {
    const con = await montar(hoja({ avoidKeyboard: true }));
    expect(con.root.findAll(n => n.type === KeyboardAvoidingView).length).toBeGreaterThan(0);
    await desmontar(con);
    const sin = await montar(hoja());
    expect(sin.root.findAll(n => n.type === KeyboardAvoidingView)).toHaveLength(0);
    await desmontar(sin);
  });
});
