/**
 * Pruebas de apoyo de las pantallas Historial y Resumen, de la hoja de un día, del modo
 * edición de "Cerrar mi día" y de las 4 pestañas (no son escenarios del SPEC; el recorrido
 * completo es spec03_e10). La app real, por testID, como lo haría una persona.
 */

import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { colors } from '@theme';
import { nuevoCierre } from '@dominio/cierre';
import { ETIQUETA_GASTO } from '@dominio/categorias';
import { cambiarPrecio } from '@dominio/producto';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, DatosCierre } from '@dominio/tipos';
import { guardarCierre, guardarProducto, listarCierres } from '@storage/repositorio';

// Texto de un nodo, incluido el de los Text anidados.
const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

type Evento = 'onPress' | 'onChangeText' | 'onValueChange';

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  montada = app;

  const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
  // Si no existe, el error lo dice: sin esto sería un "undefined.props" que no explica nada.
  const nodo = (testID: string, evento: Evento) => {
    const encontrado = app.root.findAll(
      n => n.props.testID === testID && typeof n.props[evento] === 'function',
    )[0];
    if (!encontrado) throw new Error(`No hay nada con testID "${testID}" que responda a ${evento}`);
    return encontrado;
  };
  const tocar = (testID: string) =>
    act(async () => {
      await nodo(testID, 'onPress').props.onPress();
    });
  const escribir = (testID: string, texto: string) =>
    act(async () => {
      nodo(testID, 'onChangeText').props.onChangeText(texto);
    });
  const cambiarInterruptor = (testID: string, valor: boolean) =>
    act(async () => {
      await nodo(testID, 'onValueChange').props.onValueChange(valor);
    });
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const textos = () => app.root.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  const textoNodo = (testID: string) => {
    const encontrado = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!encontrado) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return encontrado;
  };
  const textoDe = (testID: string) => textoCompleto(textoNodo(testID));
  const colorDe = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style).color;
  // Lo que escribió o precargó en un campo.
  const valorDe = (testID: string): string => {
    const campo = app.root.findAll(n => esHost(n, 'TextInput') && n.props.testID === testID)[0];
    if (!campo) throw new Error(`No hay ningún campo con testID "${testID}"`);
    return campo.props.value;
  };
  const botonDe = (testID: string) => nodo(testID, 'onPress');
  const interruptor = (testID: string) => {
    const encontrado = app.root.findAll(n => n.props.testID === testID && 'value' in n.props)[0];
    if (!encontrado) throw new Error(`No hay ningún interruptor con testID "${testID}"`);
    return encontrado;
  };
  const estiloDe = (testID: string) => {
    const vista = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!vista) throw new Error(`No hay ninguna vista con testID "${testID}"`);
    return StyleSheet.flatten(vista.props.style);
  };
  const cuantos = (prefijo: string) =>
    app.root.findAll(n => esHost(n, 'View') && String(n.props.testID ?? '').startsWith(prefijo))
      .length;
  const pestanaActiva = (testID: string) =>
    app.root.findAll(n => n.props.testID === testID && n.props.accessibilityState)[0]?.props
      .accessibilityState.selected === true;
  // Los testID pedidos, en el orden en que están en pantalla (de arriba hacia abajo), sin repetir.
  const enOrden = (ids: string[]) => {
    const vistos: string[] = [];
    app.root
      .findAll(n => (esHost(n, 'Text') || esHost(n, 'View')) && ids.includes(n.props.testID))
      .forEach(n => {
        if (!vistos.includes(n.props.testID)) vistos.push(n.props.testID);
      });
    return vistos;
  };
  // El color (hexadecimal) con que se dibujó el ícono dentro de esa vista.
  const colorDelIcono = (testID: string): string | undefined => {
    const vista = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!vista) throw new Error(`No hay ninguna vista con testID "${testID}"`);
    return vista.findAll(n => /^#[0-9A-Fa-f]{6}$/.test(String(n.props.color)))[0]?.props.color;
  };
  // Los títulos de día, en el orden en que aparecen.
  const titulosDeDia = () =>
    app.root
      .findAll(n => esHost(n, 'Text') && String(n.props.testID ?? '').startsWith('dia-titulo-'))
      .map(textoCompleto);

  return {
    tocar,
    escribir,
    cambiarInterruptor,
    existe,
    botonDe,
    textos,
    textoDe,
    colorDe,
    valorDe,
    interruptor,
    estiloDe,
    cuantos,
    pestanaActiva,
    titulosDeDia,
    enOrden,
    colorDelIcono,
  };
};

const ahora = new Date('2026-10-07T12:00:00-05:00');

interface Dia {
  lineas?: DatosCierre['lineas'];
  gastos?: DatosCierre['gastos'];
  montoYape?: number;
  porCobrar?: boolean;
  abreCiclo?: boolean;
  productos?: typeof PRODUCTOS_POR_DEFECTO;
}

// Siembra un cierre con fecha e id explícitos ANTES de montar la app: el id es 'c-<fecha>'.
const sembrar = async (fecha: string, dia: Dia = {}): Promise<Cierre> => {
  const cierre: Cierre = {
    ...nuevoCierre(
      {
        fecha,
        lineas: dia.lineas ?? [],
        montoYape: dia.montoYape ?? 0,
        gastos: dia.gastos ?? [],
        abreCiclo: dia.abreCiclo ?? false,
      },
      dia.productos ?? PRODUCTOS_POR_DEFECTO,
      null,
      ahora,
    ),
    id: `c-${fecha}`,
    yapePendiente: dia.porCobrar ?? false,
  };
  await guardarCierre(cierre);
  return cierre;
};

// Tres días de un mismo ciclo (el 4 lo abre):
//   4 oct · 10 anticuchos (S/ 100.00) − mercadería S/ 60.00        → +S/ 40.00
//   5 oct · 20 anticuchos (S/ 200.00; S/ 46.00 por Yape por cobrar) − carbón S/ 14.00 → +S/ 186.00
//   6 oct · 40 anticuchos + 6 chichas (S/ 412.00) − mercadería S/ 244.00             → +S/ 168.00
const sembrarTresDias = async () => {
  await sembrar('2026-10-04', {
    abreCiclo: true,
    lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
    gastos: [{ categoria: 'mercaderia', monto: 60 }],
  });
  await sembrar('2026-10-05', {
    lineas: [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 0 }],
    montoYape: 46,
    porCobrar: true,
    gastos: [{ categoria: 'carbon', monto: 14 }],
  });
  await sembrar('2026-10-06', {
    lineas: [
      { productoId: 'p-anticucho', preparadas: 40, sobrantes: 0 },
      { productoId: 'p-chicha', preparadas: 6, sobrantes: 0 },
    ],
    gastos: [{ categoria: 'mercaderia', monto: 244 }],
  });
};

describe('Las 4 pestañas', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('cada pestaña lleva su texto: Inicio, Cerrar mi día, Historial y Resumen', async () => {
    const { botonDe } = await montarApp();
    const etiquetas: Record<string, string> = {
      'tab-inicio': 'Inicio',
      'tab-cerrar-dia': 'Cerrar mi día',
      'tab-historial': 'Historial',
      'tab-resumen': 'Resumen',
    };

    // El ícono acompaña, nunca va solo: el botón de la pestaña trae el texto.
    for (const [testID, etiqueta] of Object.entries(etiquetas)) {
      expect(textoCompleto(botonDe(testID))).toBe(etiqueta);
    }
  });

  it('tocar Historial y Resumen cambia de pestaña', async () => {
    const { tocar, pestanaActiva } = await montarApp();

    await tocar('tab-historial');
    expect(pestanaActiva('tab-historial')).toBe(true);
    await tocar('tab-resumen');
    expect(pestanaActiva('tab-resumen')).toBe(true);
    await tocar('tab-inicio');
    expect(pestanaActiva('tab-inicio')).toBe(true);
  });
});

describe('Cerrar mi día: interruptor y categorías', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('"Hoy compré mercadería" viene apagado y tiene etiqueta de texto', async () => {
    const { tocar, textos, interruptor } = await montarApp();
    await tocar('tab-cerrar-dia');

    expect(textos()).toContain('Hoy compré mercadería');
    expect(interruptor('hoy-compre-mercaderia').props.value).toBe(false);
    expect(interruptor('hoy-compre-mercaderia').props.accessibilityLabel).toBe(
      'Hoy compré mercadería',
    );
  });

  it('encendido, el cierre guardado abre ciclo; apagado, no', async () => {
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
    const { tocar, escribir, cambiarInterruptor, interruptor } = await montarApp();
    await tocar('tab-cerrar-dia');
    await cambiarInterruptor('hoy-compre-mercaderia', true);
    expect(interruptor('hoy-compre-mercaderia').props.value).toBe(true);
    await escribir('preparadas-p-anticucho', '10');
    await tocar('guardar-dia');

    const guardados = await listarCierres();
    expect(guardados).toHaveLength(1);
    expect(guardados[0].abreCiclo).toBe(true);

    // Al volver, el formulario está vacío y el interruptor, apagado.
    await tocar('tab-cerrar-dia');
    expect(interruptor('hoy-compre-mercaderia').props.value).toBe(false);
  });

  it('un cierre sin tocar el interruptor no abre ciclo', async () => {
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
    const { tocar, escribir } = await montarApp();
    await tocar('tab-cerrar-dia');
    await escribir('preparadas-p-anticucho', '10');
    await tocar('guardar-dia');

    expect((await listarCierres())[0].abreCiclo).toBe(false);
  });

  it('los chips de gasto salen de ETIQUETA_GASTO, y el último es "Otros gastos"', async () => {
    const { tocar, textos } = await montarApp();
    await tocar('tab-cerrar-dia');

    for (const etiqueta of Object.values(ETIQUETA_GASTO)) expect(textos()).toContain(etiqueta);
    expect(ETIQUETA_GASTO.otro).toBe('Otros gastos');
    expect(textos()).not.toContain('Otro');
  });
});

describe('Historial', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('sin cierres invita a cerrar el día y el botón lleva a "Cerrar mi día"', async () => {
    const { tocar, textos, existe, pestanaActiva } = await montarApp();
    await tocar('tab-historial');

    expect(textos()).toContain('Aún no cierras ningún día');
    expect(existe('historial-vacio')).toBe(true);
    await tocar('historial-cerrar-dia');
    expect(pestanaActiva('tab-cerrar-dia')).toBe(true);
  });

  it('un grupo por día, del más reciente al más antiguo, con su neto y color', async () => {
    await sembrarTresDias();
    const { tocar, textoDe, colorDe, titulosDeDia, cuantos } = await montarApp();
    await tocar('tab-historial');

    expect(cuantos('dia-c-')).toBe(3);
    expect(titulosDeDia()).toEqual([
      'Martes 6 de octubre',
      'Lunes 5 de octubre',
      'Domingo 4 de octubre',
    ]);
    expect(textoDe('dia-neto-c-2026-10-06')).toBe('+ S/ 168.00');
    expect(textoDe('dia-neto-c-2026-10-05')).toBe('+ S/ 186.00');
    expect(textoDe('dia-neto-c-2026-10-04')).toBe('+ S/ 40.00');
    expect(colorDe('dia-neto-c-2026-10-06')).toBe(colors.success);
  });

  it('un día con neto negativo lleva el signo menos y el rojo', async () => {
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: 120 }],
    });
    const { tocar, textoDe, colorDe } = await montarApp();
    await tocar('tab-historial');

    expect(textoDe('dia-neto-c-2026-10-06')).toBe('− S/ 20.00');
    expect(colorDe('dia-neto-c-2026-10-06')).toBe(colors.danger);
  });

  it('cada fila dice qué es, cómo entró y su monto con signo y color', async () => {
    await sembrarTresDias();
    const { tocar, textoDe, colorDe, textos } = await montarApp();
    await tocar('tab-historial');

    // 5 oct: efectivo S/ 154.00, Yape S/ 46.00 por cobrar y carbón −S/ 14.00.
    expect(textoDe('fila-c-2026-10-05-0-etiqueta')).toBe('Venta del día');
    expect(textoDe('fila-c-2026-10-05-0-metodo')).toBe('Efectivo');
    expect(textoDe('fila-c-2026-10-05-0-monto')).toBe('+ S/ 154.00');
    expect(colorDe('fila-c-2026-10-05-0-monto')).toBe(colors.success);
    expect(textoDe('fila-c-2026-10-05-1-metodo')).toBe('Yape');
    expect(textoDe('fila-c-2026-10-05-1-monto')).toBe('+ S/ 46.00');
    expect(textoDe('fila-c-2026-10-05-2-etiqueta')).toBe('Carbón');
    expect(textoDe('fila-c-2026-10-05-2-monto')).toBe('− S/ 14.00');
    expect(colorDe('fila-c-2026-10-05-2-monto')).toBe(colors.danger);
    expect(textos()).toContain('Mercadería');
  });

  it('el Yape pendiente lleva "Por cobrar" con letra oscura, nunca naranja', async () => {
    await sembrarTresDias();
    const { tocar, textoDe, colorDe, existe } = await montarApp();
    await tocar('tab-historial');

    expect(textoDe('fila-c-2026-10-05-1-por-cobrar')).toBe('Por cobrar');
    expect(colorDe('fila-c-2026-10-05-1-por-cobrar')).not.toBe(colors.accent);
    expect(colorDe('fila-c-2026-10-05-1-por-cobrar')).toBe(colors.text);
    // Solo ese movimiento está por cobrar.
    expect(existe('fila-c-2026-10-05-0-por-cobrar')).toBe(false);
    expect(existe('fila-c-2026-10-06-0-por-cobrar')).toBe(false);
  });

  it('los filtros Ingresos, Gastos y Por cobrar muestran solo lo que toca', async () => {
    await sembrarTresDias();
    const { tocar, textoDe, titulosDeDia, existe } = await montarApp();
    await tocar('tab-historial');

    await tocar('filtro-ingresos');
    expect(titulosDeDia()).toHaveLength(3);
    expect(textoDe('dia-neto-c-2026-10-06')).toBe('+ S/ 412.00');
    expect(existe('fila-c-2026-10-06-1')).toBe(false); // el gasto ya no está

    await tocar('filtro-gastos');
    expect(titulosDeDia()).toHaveLength(3);
    expect(textoDe('dia-neto-c-2026-10-06')).toBe('− S/ 244.00');
    expect(textoDe('fila-c-2026-10-06-0-etiqueta')).toBe('Mercadería');

    await tocar('filtro-porCobrar');
    expect(titulosDeDia()).toEqual(['Lunes 5 de octubre']);
    expect(textoDe('dia-neto-c-2026-10-05')).toBe('+ S/ 46.00');

    await tocar('filtro-todo');
    expect(titulosDeDia()).toHaveLength(3);
  });

  it('un filtro sin resultados lo dice con palabras de Freddy', async () => {
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
    });
    const { tocar, textos, existe } = await montarApp();
    await tocar('tab-historial');

    await tocar('filtro-porCobrar');

    expect(textos()).toContain('No hay nada con este filtro');
    expect(existe('historial-sin-resultados')).toBe(true);
    expect(existe('historial-vacio')).toBe(false); // hay cierres: no es el vacío de arranque
  });

  it('tocar una fila abre la hoja con el día y su "Te queda", y los botones con texto', async () => {
    await sembrarTresDias();
    const { tocar, textos, textoDe, existe } = await montarApp();
    await tocar('tab-historial');
    expect(existe('hoja-editar')).toBe(false);

    await tocar('fila-c-2026-10-06-1');

    expect(textoDe('hoja-dia-fecha')).toBe('Martes 6 de octubre');
    expect(textoDe('hoja-dia-te-queda')).toBe('S/ 168.00');
    expect(textos()).toContain('Resultado registrado');
    expect(textos()).toContain('Editar este día');
    expect(textos()).toContain('Borrar este día');
    expect(textos()).toContain('Cancelar');
  });

  it('"Cancelar" cierra la hoja sin tocar nada', async () => {
    await sembrarTresDias();
    const { tocar, existe } = await montarApp();
    await tocar('tab-historial');
    await tocar('fila-c-2026-10-06-0');

    await tocar('hoja-cancelar');

    expect(existe('hoja-editar')).toBe(false);
    expect(await listarCierres()).toHaveLength(3);
  });

  it('"Borrar este día" dice la consecuencia en soles antes de borrar', async () => {
    await sembrarTresDias();
    const { tocar, textoDe, textos, existe } = await montarApp();
    await tocar('tab-historial');
    await tocar('fila-c-2026-10-06-0');

    await tocar('hoja-borrar');

    expect(textoDe('hoja-borrar-mensaje')).toBe(
      '¿Borrar el cierre del martes 6 de octubre? Se van a restar S/ 168.00 de tu ciclo.',
    );
    expect(textos()).toContain('Sí, borrar');
    expect(textos()).toContain('No, volver');
    expect(existe('hoja-editar')).toBe(false); // la confirmación reemplaza a las acciones
    expect(await listarCierres()).toHaveLength(3); // todavía no se borró
  });

  it('"Sí, borrar" elimina el día, cierra la hoja y actualiza la lista', async () => {
    await sembrarTresDias();
    const { tocar, titulosDeDia, existe } = await montarApp();
    await tocar('tab-historial');
    await tocar('fila-c-2026-10-06-0');
    await tocar('hoja-borrar');

    await tocar('confirmar-borrar');

    expect(existe('confirmar-borrar')).toBe(false);
    expect(titulosDeDia()).toEqual(['Lunes 5 de octubre', 'Domingo 4 de octubre']);
    const quedan = await listarCierres();
    expect(quedan.map(c => c.fecha).sort()).toEqual(['2026-10-04', '2026-10-05']);
  });

  it('"No, volver" no borra y deja la hoja con sus acciones', async () => {
    await sembrarTresDias();
    const { tocar, titulosDeDia, existe } = await montarApp();
    await tocar('tab-historial');
    await tocar('fila-c-2026-10-06-0');
    await tocar('hoja-borrar');

    await tocar('no-borrar');

    expect(existe('confirmar-borrar')).toBe(false);
    expect(existe('hoja-editar')).toBe(true);
    expect(titulosDeDia()).toHaveLength(3);
    expect(await listarCierres()).toHaveLength(3);
  });

  it('al borrar el único día, el Historial vuelve a invitar a cerrar el día', async () => {
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
    });
    const { tocar, textos } = await montarApp();
    await tocar('tab-historial');
    await tocar('fila-c-2026-10-06-0');
    await tocar('hoja-borrar');
    await tocar('confirmar-borrar');

    expect(textos()).toContain('Aún no cierras ningún día');
    expect(await listarCierres()).toEqual([]);
  });

  it('borrar un día con te queda negativo dice cuánto se suma al ciclo', async () => {
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: 120 }],
    });
    const { tocar, textoDe } = await montarApp();
    await tocar('tab-historial');
    await tocar('fila-c-2026-10-06-0');
    await tocar('hoja-borrar');

    expect(textoDe('hoja-borrar-mensaje')).toBe(
      '¿Borrar el cierre del martes 6 de octubre? Se van a sumar S/ 20.00 a tu ciclo.',
    );
  });
});

describe('Editar un día desde Historial', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  const abrirEdicion = async (
    app: Awaited<ReturnType<typeof montarApp>>,
    fecha = '2026-10-05',
    fila = 0,
  ) => {
    await app.tocar('tab-historial');
    await app.tocar(`fila-c-${fecha}-${fila}`);
    await app.tocar('hoja-editar');
  };

  it('"Editar este día" abre "Cerrar mi día" con ese día precargado', async () => {
    await sembrarTresDias();
    const app = await montarApp();

    await abrirEdicion(app);

    expect(app.pestanaActiva('tab-cerrar-dia')).toBe(true);
    expect(app.textos()).toContain('Editando el lunes 5 de octubre');
    expect(app.textos()).toContain('Guardar los cambios');
    expect(app.textos()).toContain('Cancelar');
    expect(app.textos()).not.toContain('Guardar mi día');
    expect(app.valorDe('preparadas-p-anticucho')).toBe('20');
    expect(app.valorDe('sobrantes-p-anticucho')).toBe('0');
    expect(app.valorDe('preparadas-p-rachi')).toBe('');
    expect(app.valorDe('monto-yape')).toBe('46');
    expect(app.textoDe('gasto-0-categoria')).toBe('Carbón');
    expect(app.textoDe('gasto-0-monto')).toBe('− S/ 14.00');
    expect(app.textoDe('cerrar-te-queda')).toBe('S/ 186.00');
    expect(app.interruptor('hoy-compre-mercaderia').props.value).toBe(false);
  });

  it('precarga también el interruptor "Hoy compré mercadería"', async () => {
    await sembrar('2026-10-04', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
    });
    const app = await montarApp();

    await abrirEdicion(app, '2026-10-04');

    expect(app.interruptor('hoy-compre-mercaderia').props.value).toBe(true);
  });

  it('guardar los cambios conserva el id y la fecha, y vuelve a Historial', async () => {
    await sembrarTresDias();
    const antes = (await listarCierres()).find(c => c.fecha === '2026-10-05')!;
    const app = await montarApp();
    await abrirEdicion(app);

    await app.escribir('preparadas-p-anticucho', '30');
    expect(app.textoDe('cerrar-te-queda')).toBe('S/ 286.00'); // 30 × S/ 10.00 − S/ 14.00
    await app.tocar('guardar-dia');

    expect(app.pestanaActiva('tab-historial')).toBe(true);
    const despues = await listarCierres();
    expect(despues).toHaveLength(3); // se reemplazó, no se duplicó
    const editado = despues.find(c => c.fecha === '2026-10-05')!;
    expect(editado.id).toBe(antes.id);
    expect(editado.creadoEn).toBe(antes.creadoEn);
    expect(editado.lineas[0].preparadas).toBe(30);
    expect(app.textoDe('dia-neto-c-2026-10-05')).toBe('+ S/ 286.00');
    expect(app.titulosDeDia()).toHaveLength(3);
  });

  it('después de guardar, "Cerrar mi día" vuelve con el formulario vacío', async () => {
    await sembrarTresDias();
    const app = await montarApp();
    await abrirEdicion(app);
    await app.tocar('guardar-dia');

    await app.tocar('tab-cerrar-dia');

    expect(app.textos()).not.toContain('Guardar los cambios');
    expect(app.textos()).toContain('Guardar mi día');
    expect(app.textos().some(t => t.startsWith('Editando'))).toBe(false);
    expect(app.valorDe('preparadas-p-anticucho')).toBe('');
    expect(app.valorDe('sobrantes-p-anticucho')).toBe('');
    expect(app.valorDe('monto-yape')).toBe('');
    expect(app.valorDe('monto-gasto')).toBe('');
    expect(app.textoDe('cerrar-te-queda')).toBe('S/ 0.00');
    expect(app.interruptor('hoy-compre-mercaderia').props.value).toBe(false);
    expect(app.existe('gasto-0')).toBe(false); // el gasto del día editado no se queda pegado
  });

  it('"Cancelar" vuelve a Historial sin guardar y deja el formulario vacío', async () => {
    await sembrarTresDias();
    const app = await montarApp();
    await abrirEdicion(app);
    await app.escribir('preparadas-p-anticucho', '99');

    await app.tocar('cancelar-edicion');

    expect(app.pestanaActiva('tab-historial')).toBe(true);
    const sinCambios = (await listarCierres()).find(c => c.fecha === '2026-10-05')!;
    expect(sinCambios.lineas[0].preparadas).toBe(20);

    await app.tocar('tab-cerrar-dia');
    expect(app.textos().some(t => t.startsWith('Editando'))).toBe(false);
    expect(app.valorDe('preparadas-p-anticucho')).toBe('');
    expect(app.textos()).toContain('Guardar mi día');
  });

  it('editar otro día después de cancelar carga el otro día, no restos del anterior', async () => {
    await sembrarTresDias();
    const app = await montarApp();
    await abrirEdicion(app, '2026-10-05');
    await app.tocar('cancelar-edicion');

    await abrirEdicion(app, '2026-10-06');

    expect(app.textos()).toContain('Editando el martes 6 de octubre');
    expect(app.valorDe('preparadas-p-anticucho')).toBe('40');
    expect(app.valorDe('preparadas-p-chicha')).toBe('6');
    expect(app.valorDe('monto-yape')).toBe('');
  });

  it('la vista previa de "Te queda" respeta los precios con que se cerró el día', async () => {
    await sembrarTresDias();
    // Desde hoy el anticucho cuesta S/ 12.00; el 5 de octubre se cerró a S/ 10.00.
    const anticucho = PRODUCTOS_POR_DEFECTO.find(p => p.id === 'p-anticucho')!;
    await guardarProducto(cambiarPrecio(anticucho, 12, 8.2, '2026-10-07'));
    const app = await montarApp();
    await abrirEdicion(app);

    // La tarjeta dice el precio de ese día, no el de hoy (el mismo S/ 10.00 que se va a conservar).
    expect(app.textos()).toContain('a S/ 10.00');
    expect(app.textos()).not.toContain('a S/ 12.00');
    expect(app.textoDe('cerrar-te-queda')).toBe('S/ 186.00');
    await app.escribir('preparadas-p-anticucho', '30');
    expect(app.textoDe('cerrar-te-queda')).toBe('S/ 286.00'); // 30 × S/ 10.00, no × S/ 12.00
    await app.tocar('guardar-dia');

    const editado = (await listarCierres()).find(c => c.fecha === '2026-10-05')!;
    expect(editado.lineas[0].precioUnitario).toBe(10);
  });

  it('salir de la edición por la barra de pestañas la cancela: al volver el formulario está vacío', async () => {
    await sembrarTresDias();
    const app = await montarApp();
    await abrirEdicion(app);
    expect(app.textos()).toContain('Editando el lunes 5 de octubre');

    await app.tocar('tab-inicio');
    await app.tocar('tab-cerrar-dia');

    expect(app.textos()).not.toContain('Editando el lunes 5 de octubre');
    expect(app.textos()).toContain('Guardar mi día');
    expect(app.valorDe('preparadas-p-anticucho')).toBe('');
  });

  it('un error al guardar la edición se muestra y no cambia nada', async () => {
    await sembrarTresDias();
    const app = await montarApp();
    await abrirEdicion(app);

    await app.escribir('sobrantes-p-anticucho', '25'); // más que las 20 preparadas
    await app.tocar('guardar-dia');

    expect(app.textos()).toContain('No te pueden sobrar más de los que preparaste');
    expect(app.pestanaActiva('tab-cerrar-dia')).toBe(true); // sigue editando
    expect(app.textos()).toContain('Guardar los cambios');
    const intacto = (await listarCierres()).find(c => c.fecha === '2026-10-05')!;
    expect(intacto.lineas[0].sobrantes).toBe(0);
  });
});

describe('Resumen', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  // Dos ciclos. Solo cuenta el último (el que abre el 5):
  //   1 oct · ciclo anterior, no debe aparecer.
  //   5 oct · anticucho 20/2 (S/ 180.00) + rachi 16/5 (S/ 99.00) = S/ 279.00; mercadería S/ 220.00
  //   6 oct · anticucho 20/0 (S/ 200.00); otros gastos S/ 24.00
  //   Venta S/ 479.00 · capital S/ 244.00 · te queda S/ 235.00
  const sembrarCicloActual = async () => {
    await sembrar('2026-10-01', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-chicha', preparadas: 50, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: 30 }],
    });
    await sembrar('2026-10-05', {
      abreCiclo: true,
      lineas: [
        { productoId: 'p-anticucho', preparadas: 20, sobrantes: 2 },
        { productoId: 'p-rachi', preparadas: 16, sobrantes: 5 },
      ],
      gastos: [{ categoria: 'mercaderia', monto: 220 }],
    });
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 0 }],
      gastos: [{ categoria: 'otro', monto: 24 }],
    });
  };

  it('sin cierres invita a cerrar el día y el botón lleva a "Cerrar mi día"', async () => {
    const { tocar, textos, existe, pestanaActiva } = await montarApp();
    await tocar('tab-resumen');

    expect(textos()).toContain('Aún no cierras ningún día');
    expect(existe('resumen-vacio')).toBe(true);
    expect(existe('resumen-te-queda')).toBe(false);
    await tocar('resumen-cerrar-dia');
    expect(pestanaActiva('tab-cerrar-dia')).toBe(true);
  });

  it('muestra el ciclo actual: rango, "Te queda" grande y capital recuperado', async () => {
    await sembrarCicloActual();
    const { tocar, textos, textoDe, colorDe } = await montarApp();
    await tocar('tab-resumen');

    expect(textos()).toContain('Ciclo actual');
    expect(textoDe('resumen-rango')).toBe('5 de octubre — 6 de octubre');
    expect(textos()).toContain('Resultado registrado');
    expect(textoDe('resumen-te-queda')).toBe('S/ 235.00');
    expect(colorDe('resumen-te-queda')).toBe(colors.success);
    // La venta del 5 (S/ 279.00) ya cubre el capital de S/ 244.00.
    expect(textoDe('resumen-capital-texto')).toBe('Recuperaste tu capital el lunes 5 de octubre');
  });

  it('la barra capital/ganancia son vistas de ancho porcentual, con sus etiquetas', async () => {
    await sembrarCicloActual();
    const { tocar, textoDe, colorDe, estiloDe } = await montarApp();
    await tocar('tab-resumen');

    expect(textoDe('resumen-capital')).toBe('Capital S/ 244.00');
    expect(textoDe('resumen-ganancia')).toBe('Resultado positivo S/ 235.00');
    // 244 de 479 = 51 %; el resto, ganancia.
    expect(estiloDe('resumen-barra-capital').width).toBe('51%');
    expect(estiloDe('resumen-barra-ganancia').width).toBe('49%');
    expect(estiloDe('resumen-barra-capital').backgroundColor).toBe(colors.danger);
    expect(estiloDe('resumen-barra-ganancia').backgroundColor).toBe(colors.success);
    expect(colorDe('resumen-capital')).toBe(colors.danger);
    expect(colorDe('resumen-ganancia')).toBe(colors.success);
  });

  it('cuenta solo el último ciclo, no el anterior', async () => {
    await sembrarCicloActual();
    const { tocar, textos, existe } = await montarApp();
    await tocar('tab-resumen');

    expect(existe('mercaderia-p-chicha')).toBe(false); // la chicha era del ciclo del 1 de octubre
    expect(textos().some(t => t.includes('1 de octubre'))).toBe(false);
  });

  it('"Tu mercadería": lo vendido de lo preparado, con su barra y su porcentaje', async () => {
    await sembrarCicloActual();
    const { tocar, textos, textoDe, colorDe, estiloDe, existe } = await montarApp();
    await tocar('tab-resumen');

    expect(textos()).toContain('Tu mercadería');
    // Anticucho: 38 de 40 = 95 %. Rachi: 11 de 16 = 69 %.
    expect(textoDe('mercaderia-p-anticucho-texto')).toBe('Anticucho — vendiste 38 de 40 porciones');
    expect(textoDe('mercaderia-p-rachi-texto')).toBe('Rachi — vendiste 11 de 16 porciones');
    expect(textoDe('mercaderia-p-anticucho-porcentaje')).toBe('95%');
    expect(textoDe('mercaderia-p-rachi-porcentaje')).toBe('69%');
    expect(estiloDe('mercaderia-p-anticucho-barra').width).toBe('95%');
    expect(estiloDe('mercaderia-p-rachi-barra').width).toBe('69%');
    expect(existe('mercaderia-p-pancita')).toBe(false); // no se preparó pancita
    // Verde si vendió el 70 % o más; naranja de relleno por debajo, jamás de texto.
    expect(estiloDe('mercaderia-p-anticucho-barra').backgroundColor).toBe(colors.success);
    expect(estiloDe('mercaderia-p-rachi-barra').backgroundColor).toBe(colors.accent);
    expect(colorDe('mercaderia-p-anticucho-porcentaje')).toBe(colors.success);
    expect(colorDe('mercaderia-p-rachi-porcentaje')).not.toBe(colors.accent);
  });

  it('al pie, lo que más te sobró en soles, con el nombre en minúscula', async () => {
    await sembrarCicloActual();
    const { tocar, textoDe } = await montarApp();
    await tocar('tab-resumen');

    // Rachi: 5 × S/ 7.60 = S/ 38.00, más que los 2 anticuchos (S/ 16.40).
    expect(textoDe('resumen-sobrante')).toBe('Te sobró S/ 38.00 en rachi');
  });

  it('si no sobró nada, no hay línea de sobrante', async () => {
    await sembrar('2026-10-06', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
    });
    const { tocar, existe, textoDe } = await montarApp();
    await tocar('tab-resumen');

    expect(existe('resumen-sobrante')).toBe(false);
    expect(textoDe('mercaderia-p-anticucho-porcentaje')).toBe('100%');
  });

  it('un ciclo que todavía no recupera su capital: te queda en rojo y cuánto falta', async () => {
    await sembrar('2026-10-06', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: 150 }],
    });
    const { tocar, textoDe, colorDe, estiloDe } = await montarApp();
    await tocar('tab-resumen');

    expect(textoDe('resumen-te-queda')).toBe('-S/ 50.00');
    expect(colorDe('resumen-te-queda')).toBe(colors.danger);
    expect(textoDe('resumen-capital-texto')).toBe('Te falta S/ 50.00 para recuperar tu capital');
    // Sin ganancia: toda la barra es capital.
    expect(textoDe('resumen-ganancia')).toBe('Resultado positivo S/ 0.00');
    expect(estiloDe('resumen-barra-capital').width).toBe('100%');
    expect(estiloDe('resumen-barra-ganancia').width).toBe('0%');
  });

  it('sin gastos no hay capital: ni línea de capital ni segmento rojo', async () => {
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
    });
    const { tocar, textoDe, existe, estiloDe } = await montarApp();
    await tocar('tab-resumen');

    expect(existe('resumen-capital-texto')).toBe(false);
    expect(textoDe('resumen-capital')).toBe('Capital S/ 0.00');
    expect(estiloDe('resumen-barra-capital').width).toBe('0%');
    expect(estiloDe('resumen-barra-ganancia').width).toBe('100%');
  });

  it('con ganancia en cero pero con capital, la barra es toda de capital', async () => {
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: 100 }],
    });
    // Venta S/ 100.00 − capital S/ 100.00: te queda 0, pero el capital sí existe.
    const { tocar, existe, estiloDe } = await montarApp();
    await tocar('tab-resumen');

    expect(existe('resumen-barra')).toBe(true);
    expect(estiloDe('resumen-barra-capital').width).toBe('100%');
  });

  it('si capital y ganancia suman cero, no hay barra', async () => {
    // Una sola línea con todo sobrante: nada vendido, ningún gasto.
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 5, sobrantes: 5 }],
    });
    const { tocar, existe, textoDe } = await montarApp();
    await tocar('tab-resumen');

    expect(textoDe('resumen-te-queda')).toBe('S/ 0.00');
    expect(existe('resumen-barra')).toBe(false);
    expect(textoDe('resumen-capital')).toBe('Capital S/ 0.00');
  });

  it('el Resumen se actualiza al editar o borrar un día', async () => {
    await sembrarCicloActual();
    const { tocar, textoDe } = await montarApp();

    await tocar('tab-historial');
    await tocar('fila-c-2026-10-06-0');
    await tocar('hoja-borrar');
    await tocar('confirmar-borrar');

    await tocar('tab-resumen');
    // Sin el día 6: venta S/ 279.00, capital S/ 220.00.
    expect(textoDe('resumen-capital')).toBe('Capital S/ 220.00');
    expect(textoDe('resumen-te-queda')).toBe('S/ 59.00');
  });
});

// ---------------------------------------------------------------------------------------------
// Sprint-05 · oleada C: Resumen compara el ciclo actual con el anterior (decisión D42, escenario 9).
// ---------------------------------------------------------------------------------------------

describe('Resumen: comparación con el ciclo anterior', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  // Anticucho a S/ 10.00 la porción. El ciclo anterior (del 14) vendió 30 porciones: S/ 300.00,
  // menos S/ 86.00 de mercadería → te queda S/ 214.00. El actual (del 28) vende `porciones`.
  const sembrarAnterior = () =>
    sembrar('2026-09-14', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 30, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: 86 }],
    });
  const sembrarActual = (porciones: number, gasto: number) =>
    sembrar('2026-09-28', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: porciones, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: gasto }],
    });

  it('ganó más: dice cuánto más, con el monto del ciclo anterior debajo (escenario 9)', async () => {
    await sembrarAnterior();
    await sembrarActual(40, 138); // S/ 400.00 − S/ 138.00 = S/ 262.00
    const { tocar, textoDe } = await montarApp();
    await tocar('tab-resumen');

    expect(textoDe('resumen-te-queda')).toBe('S/ 262.00');
    expect(textoDe('resumen-comparacion')).toBe(
      'Resultado registrado S/ 48.00 más que el ciclo pasado',
    );
    expect(textoDe('resumen-comparacion-anterior')).toBe(
      'Resultado registrado anterior: S/ 214.00',
    );
  });

  it('ganó menos: lo dice con palabras, el monto sigue ahí y el texto va en letra oscura', async () => {
    await sembrarAnterior();
    await sembrarActual(20, 100); // S/ 200.00 − S/ 100.00 = S/ 100.00
    const { tocar, textoDe, colorDe, colorDelIcono } = await montarApp();
    await tocar('tab-resumen');

    expect(textoDe('resumen-comparacion')).toBe(
      'Resultado registrado S/ 114.00 menos que el ciclo pasado',
    );
    expect(textoDe('resumen-comparacion-anterior')).toBe(
      'Resultado registrado anterior: S/ 214.00',
    );
    expect(colorDe('resumen-comparacion')).toBe(colors.text);
    // El color acompaña, no es la única señal: el ícono baja a rojo.
    expect(colorDelIcono('resumen-comparacion-icono')).toBe(colors.danger);
  });

  it('ganó más: el ícono sube y va en verde, con el texto en letra oscura', async () => {
    await sembrarAnterior();
    await sembrarActual(40, 138);
    const { tocar, colorDe, colorDelIcono } = await montarApp();
    await tocar('tab-resumen');

    expect(colorDelIcono('resumen-comparacion-icono')).toBe(colors.success);
    expect(colorDe('resumen-comparacion')).toBe(colors.text);
    expect(colorDe('resumen-comparacion-anterior')).not.toBe(colors.accent);
  });

  it('igual: dice que ganó lo mismo, y el ícono va en verde', async () => {
    await sembrarAnterior();
    await sembrarActual(30, 86); // S/ 300.00 − S/ 86.00 = S/ 214.00, igual que el anterior
    const { tocar, textoDe, colorDelIcono } = await montarApp();
    await tocar('tab-resumen');

    expect(textoDe('resumen-comparacion')).toBe('Resultado registrado igual al ciclo pasado');
    expect(textoDe('resumen-comparacion-anterior')).toBe(
      'Resultado registrado anterior: S/ 214.00',
    );
    expect(colorDelIcono('resumen-comparacion-icono')).toBe(colors.success);
  });

  it('si el ciclo anterior cerró en pérdida, el monto lleva su signo menos', async () => {
    await sembrar('2026-09-14', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: 120 }],
    }); // S/ 100.00 − S/ 120.00 = −S/ 20.00
    await sembrarActual(40, 138);
    const { tocar, textoDe } = await montarApp();
    await tocar('tab-resumen');

    expect(textoDe('resumen-comparacion-anterior')).toBe(
      'Resultado registrado anterior: -S/ 20.00',
    );
    expect(textoDe('resumen-comparacion')).toBe(
      'Resultado registrado S/ 282.00 más que el ciclo pasado',
    );
  });

  it('con tres ciclos compara el último con el penúltimo, no con el primero', async () => {
    await sembrar('2026-09-01', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 100, sobrantes: 0 }],
    }); // S/ 1,000.00: el primero, que no debe contar
    await sembrarAnterior();
    await sembrarActual(40, 138);
    const { tocar, textoDe } = await montarApp();
    await tocar('tab-resumen');

    expect(textoDe('resumen-comparacion')).toBe(
      'Resultado registrado S/ 48.00 más que el ciclo pasado',
    );
    expect(textoDe('resumen-comparacion-anterior')).toBe(
      'Resultado registrado anterior: S/ 214.00',
    );
  });

  it('con un solo ciclo no hay comparación', async () => {
    await sembrarActual(40, 138);
    const { tocar, existe, textos } = await montarApp();
    await tocar('tab-resumen');

    expect(existe('resumen-te-queda')).toBe(true);
    expect(existe('resumen-comparacion')).toBe(false);
    expect(existe('resumen-comparacion-anterior')).toBe(false);
    expect(existe('resumen-comparacion-icono')).toBe(false);
    expect(textos().some(t => t.includes('ciclo pasado'))).toBe(false);
  });

  it('sin cierres tampoco', async () => {
    const { tocar, existe } = await montarApp();
    await tocar('tab-resumen');

    expect(existe('resumen-comparacion')).toBe(false);
  });

  it('va entre la tarjeta del ciclo y "Tu mercadería"', async () => {
    await sembrarAnterior();
    await sembrarActual(40, 138);
    const { tocar, enOrden } = await montarApp();
    await tocar('tab-resumen');

    expect(
      enOrden([
        'resumen-te-queda',
        'resumen-comparacion',
        'mercaderia-p-anticucho',
        'resumen-que-me-deja',
      ]),
    ).toEqual([
      'resumen-te-queda',
      'resumen-comparacion',
      'mercaderia-p-anticucho',
      'resumen-que-me-deja',
    ]);
  });

  it('los testID de siempre siguen: te queda, capital, ganancia y el botón a "Qué me deja cada uno"', async () => {
    await sembrarAnterior();
    await sembrarActual(40, 138);
    const { tocar, existe, textoDe } = await montarApp();
    await tocar('tab-resumen');

    expect(textoDe('resumen-capital')).toBe('Capital S/ 138.00');
    expect(textoDe('resumen-ganancia')).toBe('Resultado positivo S/ 262.00');
    expect(existe('resumen-que-me-deja')).toBe(true);
  });
});
