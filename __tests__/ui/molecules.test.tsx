import { StyleSheet, Text as RNText } from 'react-native';
import { act } from 'react-test-renderer';
import { ArrowUp, Info } from 'lucide-react-native';
import { Callout, ANCHO_BORDE_CALLOUT } from '@components/molecules/Callout';
import { Card } from '@components/molecules/Card';
import { CodigoQR } from '@components/molecules/CodigoQR';
import { corridasQR, modulosQR } from '@analisis/pasaporte';
import { EmptyState } from '@components/molecules/EmptyState';
import { ListRow } from '@components/molecules/ListRow';
import { ScreenHeader } from '@components/molecules/ScreenHeader';
import { StickyFooter } from '@components/molecules/StickyFooter';
import { SwitchRow } from '@components/molecules/SwitchRow';
import { MoneyText } from '@components/atoms/MoneyText';
import { colors } from '@theme';
import {
  desmontar,
  estilo,
  hostPorTestID,
  montar,
  texto,
  tocablePorTestID,
} from '../../testutils/componente';
import { contraste } from '../../testutils/contraste';

describe('Card', () => {
  it('plain: fondo surface y sin borde; bordered: con borde fino', async () => {
    const r = await montar(
      <>
        <Card testID="plana">
          <RNText>hola</RNText>
        </Card>
        <Card variant="bordered" testID="borde">
          <RNText>hola</RNText>
        </Card>
      </>,
    );
    expect(estilo(hostPorTestID(r, 'plana'))).toMatchObject({
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 0,
    });
    expect(estilo(hostPorTestID(r, 'borde'))).toMatchObject({
      borderWidth: 1,
      borderColor: colors.border,
    });
    await desmontar(r);
  });
});

describe('Callout', () => {
  it('accentSoft con borde izquierdo naranja de 4px y texto oscuro', async () => {
    const r = await montar(
      <Callout title="Dato" icon={Info} testID="c">
        El anticucho te deja más
      </Callout>,
    );
    expect(estilo(hostPorTestID(r, 'c'))).toMatchObject({
      backgroundColor: colors.accentSoft,
      borderLeftWidth: ANCHO_BORDE_CALLOUT,
      borderLeftColor: colors.accent,
    });
    expect(ANCHO_BORDE_CALLOUT).toBe(4);
    const cuerpo = r.root.findAll(n => (n.type as unknown) === 'Text' && texto(n).includes('anticucho'))[0];
    expect(estilo(cuerpo).color).toBe(colors.text);
    expect(contraste(colors.text, colors.accentSoft)).toBeGreaterThanOrEqual(4.5);
    await desmontar(r);
  });

  it('el título es un encabezado', async () => {
    const r = await montar(<Callout title="Aviso">Texto</Callout>);
    const t = r.root.findAll(n => (n.type as unknown) === 'Text' && texto(n) === 'Aviso')[0];
    expect(t.props.accessibilityRole).toBe('header');
    await desmontar(r);
  });
});

describe('EmptyState', () => {
  it('enseña con título, texto y un botón que ejecuta la acción', async () => {
    const onAction = jest.fn();
    const r = await montar(
      <EmptyState
        title="Aún no cierras ningún día"
        text="Cuando cierres tu día vas a ver aquí lo que pasó."
        actionLabel="Cerrar mi día"
        onAction={onAction}
        testID="vacio"
        actionTestID="vacio-accion"
      />,
    );
    expect(hostPorTestID(r, 'vacio')).toBeTruthy();
    expect(hostPorTestID(r, 'vacio-accion').props.accessibilityRole).toBe('button');
    expect(hostPorTestID(r, 'vacio-accion').props.accessibilityLabel).toBe('Cerrar mi día');
    await act(async () => tocablePorTestID(r, 'vacio-accion').props.onPress());
    expect(onAction).toHaveBeenCalledTimes(1);
    await desmontar(r);
  });

  it('sin acción no dibuja botón', async () => {
    const r = await montar(<EmptyState title="Nada por aquí" actionTestID="x" />);
    expect(r.root.findAll(n => n.props.testID === 'x')).toHaveLength(0);
    await desmontar(r);
  });
});

describe('ScreenHeader', () => {
  it('"Atrás" lleva texto, rol de botón y área táctil de 48dp', async () => {
    const onBack = jest.fn();
    const r = await montar(
      <ScreenHeader title="Perfil" subtitle="Último ciclo" onBack={onBack} backTestID="atras" />,
    );
    const atras = hostPorTestID(r, 'atras');
    expect(atras.props.accessibilityRole).toBe('button');
    expect(atras.props.accessibilityLabel).toBe('Atrás');
    expect(estilo(atras).minHeight).toBeGreaterThanOrEqual(48);
    expect(estilo(atras).minWidth).toBeGreaterThanOrEqual(48);
    expect(r.root.findAll(n => (n.type as unknown) === 'Text' && texto(n) === 'Atrás').length).toBe(1);
    await act(async () => tocablePorTestID(r, 'atras').props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
    const h = r.root.findAll(n => (n.type as unknown) === 'Text' && texto(n) === 'Perfil')[0];
    expect(h.props.accessibilityRole).toBe('header');
    await desmontar(r);
  });

  it('sin onBack no hay botón Atrás', async () => {
    const r = await montar(<ScreenHeader title="Historial" backTestID="atras" />);
    expect(r.root.findAll(n => n.props.testID === 'atras')).toHaveLength(0);
    await desmontar(r);
  });
});

describe('StickyFooter', () => {
  it('lleva borde superior y relleno inferior con el área segura', async () => {
    const r = await montar(
      <StickyFooter testID="pie">
        <RNText>Guardar</RNText>
      </StickyFooter>,
    );
    const e = estilo(hostPorTestID(r, 'pie'));
    expect(e.borderTopWidth).toBe(1);
    expect(e.borderTopColor).toBe(colors.border);
    expect(e.paddingBottom).toBeGreaterThanOrEqual(16);
    await desmontar(r);
  });
});

describe('SwitchRow', () => {
  it('toda la fila es un interruptor accesible y cambia el valor', async () => {
    const onValueChange = jest.fn();
    const r = await montar(
      <SwitchRow
        label="Aceptar Yape"
        description="Anota los pagos"
        value={false}
        onValueChange={onValueChange}
        testID="sw"
      />,
    );
    const fila = r.root.findAll(n => n.props.accessibilityRole === 'switch')[0];
    expect(fila.props.accessibilityLabel).toBe('Aceptar Yape');
    expect(fila.props.accessibilityState).toMatchObject({ checked: false, disabled: false });
    expect(estilo(fila).minHeight).toBeGreaterThanOrEqual(48);
    const sw = r.root.findAll(n => n.props.testID === 'sw' && 'value' in n.props)[0];
    expect(sw.props.value).toBe(false);
    await act(async () => fila.props.onPress());
    expect(onValueChange).toHaveBeenCalledWith(true);
    await desmontar(r);
  });

  it('deshabilitada no cambia', async () => {
    const onValueChange = jest.fn();
    const r = await montar(
      <SwitchRow label="Algo" value disabled onValueChange={onValueChange} testID="sw" />,
    );
    const fila = r.root.findAll(n => n.props.accessibilityRole === 'switch')[0];
    expect(fila.props.accessibilityState.disabled).toBe(true);
    expect(fila.props.disabled).toBe(true);
    await desmontar(r);
  });
});

describe('ListRow', () => {
  it('muestra título, subtítulo y monto a la derecha; mínimo 72dp', async () => {
    const r = await montar(
      <ListRow
        title="Anticucho"
        subtitle="Hoy, 9:40 p. m."
        icon={ArrowUp}
        trailing={<MoneyText monto={120} variant="bodyStrong" />}
        testID="fila"
      />,
    );
    const textos = r.root.findAll(n => (n.type as unknown) === 'Text').map(texto);
    expect(textos).toEqual(expect.arrayContaining(['Anticucho', 'Hoy, 9:40 p. m.', '+ S/ 120.00']));
    const alto = hostPorTestID(r, 'fila').findAll(n => typeof n.type === 'string' && estilo(n).minHeight >= 72);
    expect(alto.length).toBeGreaterThan(0);
    await desmontar(r);
  });

  it('reparte el ancho: ícono fijo, texto flexible que puede encoger, monto que no se recorta', async () => {
    const r = await montar(
      <ListRow
        title="Tu último día"
        subtitle="Martes 6 de octubre"
        icon={ArrowUp}
        trailing={<MoneyText monto={180} variant="h3" testID="monto" />}
        testID="fila"
      />,
    );
    const fila = estilo(hostPorTestID(r, 'fila'));
    expect(fila).toMatchObject({ flexDirection: 'row', alignItems: 'center', gap: 12 });
    const estilos = hostPorTestID(r, 'fila')
      .findAll(n => (n.type as unknown) === 'View')
      .map(n => StyleSheet.flatten(n.props.style) ?? {});
    // Ícono: tamaño fijo y no se achica.
    expect(estilos).toContainEqual(expect.objectContaining({ width: 44, height: 44, flexShrink: 0 }));
    // Texto: ocupa lo que sobra y puede encoger (minWidth 0).
    expect(estilos).toContainEqual(expect.objectContaining({ flex: 1, minWidth: 0 }));
    // Monto: no encoge ni tiene un tope porcentual que lo trunque.
    const derecha = estilos.find(e => e.flexShrink === 0 && e.alignItems === 'flex-end');
    expect(derecha).toBeDefined();
    expect(derecha?.maxWidth).toBeUndefined();
    const titulo = r.root.findAll(n => (n.type as unknown) === 'Text' && texto(n) === 'Tu último día')[0];
    expect(titulo.props.numberOfLines).toBe(2);
    await desmontar(r);
  });

  it('con onPress es un solo botón con etiqueta y se puede tocar', async () => {
    const onPress = jest.fn();
    const r = await montar(
      <ListRow
        title="Martes 6"
        onPress={onPress}
        accessibilityLabel="Martes 6, + S/ 168.00"
        accessibilityHint="Toca para editar"
        testID="fila"
      />,
    );
    const host = hostPorTestID(r, 'fila');
    expect(host.props.accessibilityRole).toBe('button');
    expect(host.props.accessibilityLabel).toBe('Martes 6, + S/ 168.00');
    expect(host.props.accessible).toBe(true);
    await act(async () => tocablePorTestID(r, 'fila').props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
    await desmontar(r);
  });
});

describe('CodigoQR', () => {
  const modulos = modulosQR('CRECEMOS1|P=20260723-20261006|V=5120.00|G=2180.00|D=58|C=650|E=20261007|K=178E5687');

  it('es una imagen accesible con el código en palabras', async () => {
    const r = await montar(<CodigoQR modulos={modulos} codigo="CR-178E-5687" testID="qr" />);
    const host = hostPorTestID(r, 'qr');
    expect(host.props.accessible).toBe(true);
    expect(host.props.accessibilityRole).toBe('image');
    expect(host.props.accessibilityLabel).toBe('Código de constancia CR-178E-5687');
    await desmontar(r);
  });

  it('dibuja un rectángulo por tramo oscuro (más el fondo), no uno por módulo', async () => {
    const r = await montar(<CodigoQR modulos={modulos} codigo="CR-178E-5687" testID="qr" />);
    const rects = hostPorTestID(r, 'qr').findAll(n => String(n.type) === 'RNSVGRect');
    const oscuros = modulos.flat().filter(Boolean).length;
    expect(rects.length).toBe(corridasQR(modulos).length + 1);
    expect(rects.length).toBeLessThan(oscuros);
    await desmontar(r);
  });
});
