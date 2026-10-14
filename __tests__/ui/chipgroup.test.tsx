import { act } from 'react-test-renderer';
import { ArrowDown, ArrowUp } from 'lucide-react-native';
import { Chip } from '@components/molecules/Chip';
import { ChipGroup, ChipOption } from '@components/molecules/ChipGroup';
import { colors, spacing } from '@theme';
import { contraste } from '../../testutils/contraste';
import { desmontar, estilo, hostPorTestID, montar, texto } from '../../testutils/componente';

type F = 'todo' | 'ingresos' | 'gastos';
const OPCIONES: readonly ChipOption<F>[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'ingresos', label: 'Ingresos', icon: ArrowUp, tone: 'success' },
  { value: 'gastos', label: 'Gastos', icon: ArrowDown, tone: 'danger' },
];

describe('ChipGroup', () => {
  it('por defecto es wrap: sin ScrollView, con flexWrap', async () => {
    const r = await montar(
      <ChipGroup options={OPCIONES} value="todo" onChange={() => {}} label="Filtro" testIDPrefix="f" />,
    );
    expect(r.root.findAll(n => (n.type as unknown) === 'RCTScrollView')).toHaveLength(0);
    const grupo = r.root.findAll(n => n.props.accessibilityRole === 'radiogroup')[0];
    expect(estilo(grupo).flexWrap).toBe('wrap');
    expect(grupo.props.accessibilityLabel).toBe('Filtro');
    await desmontar(r);
  });

  it('scroll: ScrollView horizontal, sin indicador, con relleno y chips que no se encogen', async () => {
    const r = await montar(
      <ChipGroup
        options={OPCIONES}
        value="todo"
        onChange={() => {}}
        layout="scroll"
        label="Filtro"
        testIDPrefix="f"
      />,
    );
    const scroll = r.root.findAll(n => (n.type as unknown) === 'RCTScrollView')[0];
    expect(scroll.props.horizontal).toBe(true);
    expect(scroll.props.showsHorizontalScrollIndicator).toBe(false);
    expect(estilo({ props: { style: scroll.props.contentContainerStyle } } as never)).toMatchObject({
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    });
    expect(scroll.props.accessibilityRole).toBe('radiogroup');
    for (const id of ['f-todo', 'f-ingresos', 'f-gastos']) {
      const chip = hostPorTestID(r, id);
      expect(estilo(chip).flexShrink).toBe(0);
      expect(estilo(chip).minHeight).toBeGreaterThanOrEqual(48);
    }
    await desmontar(r);
  });

  it('scroll conserva radio, selección, testIDPrefix y onChange', async () => {
    const onChange = jest.fn();
    const r = await montar(
      <ChipGroup options={OPCIONES} value="gastos" onChange={onChange} layout="scroll" testIDPrefix="f" />,
    );
    expect(hostPorTestID(r, 'f-gastos').props.accessibilityRole).toBe('radio');
    expect(hostPorTestID(r, 'f-gastos').props.accessibilityState).toMatchObject({ selected: true });
    expect(hostPorTestID(r, 'f-todo').props.accessibilityState).toMatchObject({ selected: false });
    const tocable = r.root.findAll(n => n.props.testID === 'f-ingresos' && typeof n.props.onPress === 'function');
    await act(async () => tocable[tocable.length - 1].props.onPress());
    expect(onChange).toHaveBeenCalledWith('ingresos');
    await desmontar(r);
  });

  it('scroll muestra el error al pie con aviso en vivo', async () => {
    const r = await montar(
      <ChipGroup options={OPCIONES} value="" onChange={() => {}} layout="scroll" error="Elige una opción" />,
    );
    const t = r.root.findAll(n => (n.type as unknown) === 'Text' && texto(n) === 'Elige una opción')[0];
    expect(t.props.accessibilityLiveRegion).toBe('polite');
    await desmontar(r);
  });

  it('los chips sin seleccionar tienen fondo surface (con y sin scroll)', async () => {
    for (const layout of ['wrap', 'scroll'] as const) {
      const r = await montar(
        <ChipGroup options={OPCIONES} value="todo" onChange={() => {}} layout={layout} testIDPrefix="f" />,
      );
      expect(estilo(hostPorTestID(r, 'f-gastos')).backgroundColor).toBe(colors.surface);
      await desmontar(r);
    }
  });
});

describe('Chip', () => {
  it('48dp, con texto y estado de radio', async () => {
    const r = await montar(
      <Chip label="Ingresos" icon={ArrowUp} tone="success" selected onPress={() => {}} testID="c" />,
    );
    const host = hostPorTestID(r, 'c');
    expect(host.props.accessibilityRole).toBe('radio');
    expect(host.props.accessibilityState).toMatchObject({ selected: true, checked: true });
    const e = estilo(host);
    expect(e.minHeight).toBeGreaterThanOrEqual(48);
    expect(e.borderColor).toBe(colors.success);
    expect(e.backgroundColor).toBe(colors.successSoft);
    expect(e.flexShrink).toBe(0);
    await desmontar(r);
  });

  it('sin seleccionar tiene fondo surface', async () => {
    const r = await montar(<Chip label="Gastos" onPress={() => {}} testID="c" />);
    const e = estilo(hostPorTestID(r, 'c'));
    expect(e.backgroundColor).toBe(colors.surface);
    expect(e.borderColor).toBe(colors.border);
    await desmontar(r);
  });

  it('role button y deshabilitado: estado accesible sin selección', async () => {
    const onPress = jest.fn();
    const r = await montar(
      <Chip label="¿Cuánto vendí?" role="button" disabled onPress={onPress} testID="c" />,
    );
    const host = hostPorTestID(r, 'c');
    expect(host.props.accessibilityRole).toBe('button');
    expect(host.props.accessibilityState).toEqual({ disabled: true });
    await desmontar(r);
  });

  it('los textos seleccionados de cada tono tienen contraste 4.5 o más', () => {
    expect(contraste(colors.primary, colors.primarySoft)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(colors.success, colors.successSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(colors.danger, colors.dangerSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(colors.text, colors.warningSoft)).toBeGreaterThanOrEqual(4.5);
  });
});
