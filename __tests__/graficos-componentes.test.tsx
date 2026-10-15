/**
 * Pruebas de apoyo de los componentes de gráficos y del selector de periodo (los escenarios del
 * SPEC-15 con pantalla son spec15_e15 a e18). Reciben datos ya calculados: aquí solo se mira qué
 * dibujan, qué dicen y que ningún texto baje de 14 px ni use el naranja.
 */
import { StyleSheet } from 'react-native';
import { act, ReactTestInstance } from 'react-test-renderer';
import { colors } from '@theme';
import { BarrasPorMes, porcentajeDeBarra } from '@components/molecules/BarrasPorMes';
import {
  BarrasPorProducto,
  MAX_PRODUCTOS_EN_BARRAS,
} from '@components/molecules/BarrasPorProducto';
import { GraficoUltimosDias, medidasDeLaZona } from '@components/molecules/GraficoUltimosDias';
import { InteligenciaReporte } from '@components/organisms/InteligenciaReporte';
import { SelectorPeriodo } from '@components/organisms/SelectorPeriodo';
import type { ProductoPeriodo, UltimosDias } from '@analisis/graficos';
import { inteligenciaDelNegocio, type MesNegocio } from '@analisis/inteligencia';
import type { FiltroPeriodo } from '@analisis/periodo';
import type { Cierre } from '@dominio/tipos';
import { desmontar, estilo, hostPorTestID, montar, texto, textos } from '../testutils/componente';

const mes = (m: string, venta: number, gastos: number, dias = 5, enCurso = false): MesNegocio => ({
  mes: m,
  etiqueta: `${m}${enCurso ? ' (en curso)' : ''}`,
  etiquetaCorta: m,
  venta,
  gastos,
  resultado: venta - gastos,
  dias,
  enCurso,
});

/** Ningún texto del árbol baja de 14 px ni va en naranja. */
const textosLegibles = (r: Awaited<ReturnType<typeof montar>>) => {
  const hosts = r.root.findAll(n => (n.type as unknown) === 'Text');
  expect(hosts.length).toBeGreaterThan(0);
  for (const t of hosts) {
    const e = StyleSheet.flatten(t.props.style) ?? {};
    expect(e.fontSize).toBeGreaterThanOrEqual(14);
    expect(e.color).not.toBe(colors.accent);
  }
};

const nodos = (r: Awaited<ReturnType<typeof montar>>, prefijo: string): ReactTestInstance[] =>
  r.root.findAll(
    n => typeof n.type === 'string' && String(n.props.testID ?? '').startsWith(prefijo),
  );

describe('BarrasPorMes', () => {
  it('escribe el monto de cada barra y rotula el mes en curso', async () => {
    const r = await montar(
      <BarrasPorMes
        meses={[mes('2026-09', 5000, 2000), mes('2026-10', 2000, 500, 3, true)]}
        testID="m"
      />,
    );
    expect(texto(hostPorTestID(r, 'm-mes-2026-10'))).toBe('2026-10 (en curso)');
    expect(texto(hostPorTestID(r, 'm-venta-2026-09'))).toBe('Ventas S/ 5,000.00');
    expect(texto(hostPorTestID(r, 'm-resultado-2026-09'))).toBe('Resultado registrado S/ 3,000.00');
    textosLegibles(r);
    await desmontar(r);
  });

  it('la barra mayor llena el ancho y las demás son proporcionales', async () => {
    const r = await montar(
      <BarrasPorMes meses={[mes('2026-09', 4000, 0), mes('2026-10', 1000, 0)]} testID="m" />,
    );
    expect(estilo(hostPorTestID(r, 'm-barra-venta-2026-09')).width).toBe('100%');
    expect(estilo(hostPorTestID(r, 'm-barra-venta-2026-10')).width).toBe('25%');
    expect(porcentajeDeBarra(0, 100)).toBe(0);
    expect(porcentajeDeBarra(1, 10000)).toBe(2);
    expect(porcentajeDeBarra(5, 0)).toBe(0);
    await desmontar(r);
  });

  it('un resultado negativo va en rojo, con su signo y su palabra', async () => {
    const r = await montar(<BarrasPorMes meses={[mes('2026-09', 100, 400)]} testID="m" />);
    expect(texto(hostPorTestID(r, 'm-resultado-2026-09'))).toBe('Resultado registrado -S/ 300.00');
    expect(estilo(hostPorTestID(r, 'm-barra-resultado-2026-09')).backgroundColor).toBe(
      colors.danger,
    );
    await desmontar(r);
  });

  it('un mes sin cierres lo dice; sin meses, el estado vacío amable', async () => {
    const r = await montar(<BarrasPorMes meses={[mes('2026-09', 0, 0, 0)]} testID="m" />);
    expect(textos(r)).toContain('Sin días cerrados');
    await desmontar(r);
    const vacio = await montar(<BarrasPorMes meses={[]} testID="m" />);
    expect(textos(vacio)).toEqual(['Aún no hay días cerrados en este periodo']);
    await desmontar(vacio);
  });

  it('el lector de pantalla oye todos los meses', async () => {
    const r = await montar(<BarrasPorMes meses={[mes('2026-09', 100, 0)]} testID="m" />);
    const etiqueta = r.root.findAll(n => n.props.testID === 'm' && n.props.accessibilityLabel)[0]
      .props.accessibilityLabel as string;
    expect(etiqueta).toContain('ventas S/ 100.00');
    expect(etiqueta).toContain('resultado registrado S/ 100.00');
    await desmontar(r);
  });
});

describe('BarrasPorProducto', () => {
  const p = (i: number, venta: number): ProductoPeriodo => ({
    productoId: `p-${i}`,
    nombre: `Producto ${i}`,
    porciones: i,
    venta,
  });

  it('una fila por producto con unidades y monto, y la barra proporcional', async () => {
    const r = await montar(<BarrasPorProducto productos={[p(1, 400), p(2, 100)]} testID="b" />);
    expect(texto(hostPorTestID(r, 'b-detalle-p-1'))).toBe('1 unidad vendida · S/ 400.00');
    expect(texto(hostPorTestID(r, 'b-detalle-p-2'))).toBe('2 unidades vendidas · S/ 100.00');
    expect(estilo(hostPorTestID(r, 'b-barra-p-1')).width).toBe('100%');
    expect(estilo(hostPorTestID(r, 'b-barra-p-2')).width).toBe('25%');
    textosLegibles(r);
    await desmontar(r);
  });

  it('muestra hasta 8 productos y resume el resto', async () => {
    const muchos = Array.from({ length: 11 }, (_, i) => p(i + 1, 1000 - i));
    const r = await montar(<BarrasPorProducto productos={muchos} testID="b" />);
    expect(nodos(r, 'b-fila-')).toHaveLength(MAX_PRODUCTOS_EN_BARRAS);
    expect(texto(hostPorTestID(r, 'b-mas'))).toBe('y 3 productos más');
    await desmontar(r);
  });

  it('sin productos, el estado vacío amable', async () => {
    const r = await montar(<BarrasPorProducto productos={[]} testID="b" />);
    expect(textos(r)).toEqual(['Aún no hay días cerrados en este periodo']);
    await desmontar(r);
  });
});

describe('GraficoUltimosDias', () => {
  const datos = (resultados: (number | null)[]): UltimosDias => {
    const dias = resultados.map((resultado, i) => ({
      fecha: `2026-10-${String(i + 1).padStart(2, '0')}`,
      resultado,
      venta: resultado ?? 0,
    }));
    const con = dias.filter(d => d.resultado !== null);
    const orden = [...con].sort((a, b) => (a.resultado as number) - (b.resultado as number));
    return {
      dias,
      mejor: orden.length ? orden[orden.length - 1] : null,
      peor: orden.length ? orden[0] : null,
    };
  };

  it('una columna por día: barra, hueco con contorno y barra negativa', async () => {
    const r = await montar(
      <GraficoUltimosDias
        datos={datos([100, null, -50])}
        tramo={7}
        onCambiarTramo={() => {}}
        testID="d"
      />,
    );
    expect(nodos(r, 'd-columna-')).toHaveLength(3);
    expect(nodos(r, 'd-barra-2026-10-01')).toHaveLength(1);
    expect(nodos(r, 'd-hueco-2026-10-02')).toHaveLength(1);
    expect(estilo(hostPorTestID(r, 'd-hueco-2026-10-02')).borderStyle).toBe('dashed');
    expect(estilo(hostPorTestID(r, 'd-barra-2026-10-03')).backgroundColor).toBe(colors.danger);
    expect(estilo(hostPorTestID(r, 'd-barra-2026-10-01')).backgroundColor).toBe(colors.success);
    expect(texto(hostPorTestID(r, 'd-mejor'))).toBe('Mejor día: Jueves 1 de octubre, S/ 100.00');
    expect(texto(hostPorTestID(r, 'd-peor'))).toBe('Día más flojo: Sábado 3 de octubre, -S/ 50.00');
    expect(texto(hostPorTestID(r, 'd-leyenda'))).toContain('Contorno vacío: día sin cierre');
    textosLegibles(r);
    await desmontar(r);
  });

  it('un solo día cerrado se dice como tal y no repite el peor', async () => {
    const r = await montar(
      <GraficoUltimosDias datos={datos([80])} tramo={7} onCambiarTramo={() => {}} testID="d" />,
    );
    expect(texto(hostPorTestID(r, 'd-mejor'))).toBe(
      'Único día cerrado: Jueves 1 de octubre, S/ 80.00',
    );
    expect(nodos(r, 'd-peor')).toHaveLength(0);
    // Sin huecos, la leyenda no habla de contornos.
    expect(texto(hostPorTestID(r, 'd-leyenda'))).not.toContain('Contorno');
    await desmontar(r);
  });

  it('el selector tiene tres chips con texto y avisa el tramo que se toca', async () => {
    const onCambiarTramo = jest.fn();
    const r = await montar(
      <GraficoUltimosDias
        datos={datos([10])}
        tramo={14}
        onCambiarTramo={onCambiarTramo}
        testID="d"
      />,
    );
    expect(textos(r)).toEqual(expect.arrayContaining(['7 días', '14 días', '30 días']));
    await act(async () => {
      r.root.findAll(n => n.props.testID === 'd-tramo-30' && n.props.onPress)[0].props.onPress();
    });
    expect(onCambiarTramo).toHaveBeenCalledWith(30);
    const seleccionado = r.root.findAll(
      n => n.props.testID === 'd-tramo-14' && n.props.accessibilityState,
    )[0].props.accessibilityState;
    expect(seleccionado.selected).toBe(true);
    await desmontar(r);
  });

  it('sin días, el estado vacío amable y el selector sigue', async () => {
    const r = await montar(
      <GraficoUltimosDias
        datos={{ dias: [], mejor: null, peor: null }}
        tramo={14}
        onCambiarTramo={() => {}}
        testID="d"
      />,
    );
    expect(texto(hostPorTestID(r, 'd-vacio'))).toBe('Aún no hay días cerrados en este periodo');
    expect(nodos(r, 'd-columna-')).toHaveLength(0);
    await desmontar(r);
  });

  it('medidasDeLaZona: el mayor llena su lado y siempre cabe un hueco', () => {
    const d = (resultado: number | null) => ({ fecha: '2026-10-01', resultado, venta: 0 });
    expect(medidasDeLaZona([d(100), d(-100)])).toMatchObject({ positivo: 60, negativo: 60 });
    expect(medidasDeLaZona([d(100)]).negativo).toBe(0);
    expect(medidasDeLaZona([d(null)]).positivo).toBeGreaterThanOrEqual(11);
    expect(medidasDeLaZona([d(-10)]).positivo).toBeGreaterThanOrEqual(11);
    expect(medidasDeLaZona([])).toMatchObject({ negativo: 0, escala: 0 });
  });
});

describe('SelectorPeriodo', () => {
  const MESES = ['2026-10', '2026-09', '2026-08'];

  const montarSelector = async (filtro: FiltroPeriodo, etiqueta = 'Todo tu historial') => {
    const onChange = jest.fn();
    const r = await montar(
      <SelectorPeriodo
        filtro={filtro}
        etiqueta={etiqueta}
        meses={MESES}
        onChange={onChange}
        testID="s"
      />,
    );
    return { r, onChange };
  };
  const tocar = (r: Awaited<ReturnType<typeof montar>>, testID: string) =>
    act(async () => {
      const t = r.root.findAll(
        n => n.props.testID === testID && typeof n.props.onPress === 'function',
      );
      if (!t.length) throw new Error(`No hay nada tocable con testID "${testID}"`);
      t[t.length - 1].props.onPress();
    });

  it('el botón dice el periodo, con texto, y mide 48 dp o más', async () => {
    const { r } = await montarSelector({ tipo: 'todo' });
    expect(texto(hostPorTestID(r, 's-etiqueta'))).toBe('Periodo: Todo tu historial');
    const boton = r.root.findAll(
      n => n.props.testID === 's-boton' && n.props.accessibilityLabel,
    )[0];
    expect(boton.props.accessibilityLabel).toBe('Periodo: Todo tu historial. Cambiar');
    const e = StyleSheet.flatten(
      typeof boton.props.style === 'function'
        ? boton.props.style({ pressed: false })
        : boton.props.style,
    );
    expect(e.minHeight).toBeGreaterThanOrEqual(48);
    expect(textos(r)).toContain('Cambiar');
    await desmontar(r);
  });

  it('la hoja ofrece las seis opciones y "Listo"', async () => {
    const { r } = await montarSelector({ tipo: 'todo' });
    expect(nodos(r, 's-opcion-')).toHaveLength(0);
    await tocar(r, 's-boton');
    expect(textos(r)).toEqual(
      expect.arrayContaining([
        'Todo el historial',
        'Este mes',
        'Mes pasado',
        'Últimos 30 días',
        'Elegir mes',
        'Rango de meses',
        'Listo',
      ]),
    );
    await tocar(r, 's-listo');
    expect(r.root.findAll(n => n.props.testID === 's-opcion-todo')).toHaveLength(0);
    await desmontar(r);
  });

  it('cada opción avisa el filtro: las rápidas, el mes más reciente y el rango completo', async () => {
    const { r, onChange } = await montarSelector({ tipo: 'todo' });
    await tocar(r, 's-boton');
    await tocar(r, 's-opcion-esteMes');
    expect(onChange).toHaveBeenLastCalledWith({ tipo: 'esteMes' });
    await tocar(r, 's-opcion-ultimos30');
    expect(onChange).toHaveBeenLastCalledWith({ tipo: 'ultimos30' });
    await tocar(r, 's-opcion-mes');
    expect(onChange).toHaveBeenLastCalledWith({ tipo: 'mes', mes: '2026-10' });
    await tocar(r, 's-opcion-rango');
    expect(onChange).toHaveBeenLastCalledWith({
      tipo: 'rango',
      desde: '2026-08',
      hasta: '2026-10',
    });
    await desmontar(r);
  });

  it('con "Elegir mes" salen los meses con cierres, el más reciente primero', async () => {
    const { r, onChange } = await montarSelector(
      { tipo: 'mes', mes: '2026-09' },
      'Septiembre 2026',
    );
    await tocar(r, 's-boton');
    const chips = nodos(r, 's-mes-').map(n => n.props.testID);
    expect([...new Set(chips)]).toEqual(['s-mes-2026-10', 's-mes-2026-09', 's-mes-2026-08']);
    expect(textos(r)).toEqual(expect.arrayContaining(['Oct 2026', 'Sep 2026', 'Ago 2026']));
    await tocar(r, 's-mes-2026-08');
    expect(onChange).toHaveBeenLastCalledWith({ tipo: 'mes', mes: '2026-08' });
    await desmontar(r);
  });

  it('con el rango salen "Desde" y "Hasta" y cada toque conserva el otro extremo', async () => {
    const filtro: FiltroPeriodo = { tipo: 'rango', desde: '2026-08', hasta: '2026-10' };
    const { r, onChange } = await montarSelector(filtro, 'Del 1 de agosto al 15 de octubre');
    await tocar(r, 's-boton');
    expect(textos(r)).toEqual(expect.arrayContaining(['Desde', 'Hasta']));
    await tocar(r, 's-desde-2026-09');
    expect(onChange).toHaveBeenLastCalledWith({
      tipo: 'rango',
      desde: '2026-09',
      hasta: '2026-10',
    });
    await tocar(r, 's-hasta-2026-09');
    expect(onChange).toHaveBeenLastCalledWith({
      tipo: 'rango',
      desde: '2026-08',
      hasta: '2026-09',
    });
    await desmontar(r);
  });

  it('los chips miden 48 dp y la hoja dice el periodo vigente en palabras', async () => {
    const { r } = await montarSelector({ tipo: 'esteMes' }, 'Octubre 2026 (en curso)');
    await tocar(r, 's-boton');
    // El que dibuja de verdad es el último con ese testID (los de arriba son envoltorios).
    const chips = r.root.findAll(n => n.props.testID === 's-opcion-esteMes' && n.props.onPress);
    const chip = chips[chips.length - 1];
    const e = StyleSheet.flatten(
      typeof chip.props.style === 'function'
        ? chip.props.style({ pressed: false })
        : chip.props.style,
    );
    expect(e.minHeight).toBeGreaterThanOrEqual(48);
    expect(texto(hostPorTestID(r, 's-ayuda'))).toBe('Ahora ves: Octubre 2026 (en curso).');
    await desmontar(r);
  });
});

describe('InteligenciaReporte', () => {
  const venta = (fecha: string, soles: number, gasto = 0): Cierre => ({
    id: fecha,
    fecha,
    lineas: [
      {
        productoId: 'p-a',
        nombre: 'Anticucho',
        preparadas: soles / 10,
        sobrantes: 0,
        precioUnitario: 10,
        costoUnitario: 8,
      },
    ],
    montoYape: 0,
    yapePendiente: false,
    gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
    abreCiclo: false,
    creadoEn: '',
    actualizadoEn: '',
  });

  it('muestra los totales, el mes más fuerte y más débil, la comparación y el producto estrella', async () => {
    const i = inteligenciaDelNegocio(
      [venta('2026-08-10', 1000, 200), venta('2026-09-10', 2000, 300), venta('2026-10-05', 500)],
      [],
      '2026-10-15',
    );
    const r = await montar(
      <InteligenciaReporte inteligencia={i} etiquetaPeriodo="Todo tu historial" />,
    );
    expect(texto(hostPorTestID(r, 'reporte-inteligencia-periodo'))).toBe(
      'Todo tu historial · 3 días cerrados',
    );
    expect(texto(hostPorTestID(r, 'reporte-intel-venta'))).toBe('S/ 3,500.00');
    expect(texto(hostPorTestID(r, 'reporte-intel-gastos'))).toBe('S/ 500.00');
    expect(texto(hostPorTestID(r, 'reporte-intel-resultado'))).toBe('S/ 3,000.00');
    expect(texto(hostPorTestID(r, 'reporte-intel-fuerte'))).toContain('Septiembre 2026');
    expect(texto(hostPorTestID(r, 'reporte-intel-debil'))).toContain('Agosto 2026');
    expect(texto(hostPorTestID(r, 'reporte-intel-comparacion-2026-09'))).toContain(
      'más que en agosto 2026',
    );
    expect(texto(hostPorTestID(r, 'reporte-intel-estrella'))).toContain(
      'Anticucho, 100 % de lo que vendiste',
    );
    expect(textos(r).join(' ')).not.toMatch(/ganancia|te queda|balance|margen/i);
    textosLegibles(r);
    await desmontar(r);
  });

  it('sin días cerrados, una frase amable', async () => {
    const r = await montar(
      <InteligenciaReporte
        inteligencia={inteligenciaDelNegocio([], [], '2026-10-15')}
        etiquetaPeriodo="Septiembre 2026"
      />,
    );
    expect(texto(hostPorTestID(r, 'reporte-inteligencia-vacio'))).toBe(
      'Sin días cerrados en este periodo.',
    );
    await desmontar(r);
  });
});
