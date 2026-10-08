/**
 * Pruebas de apoyo de la pantalla "Qué me deja cada uno" (no son escenarios del SPEC; el recorrido
 * con los datos de ejemplo es spec05_e12). La app real, por testID, como lo haría una persona.
 * Los cierres se siembran con fechas relativas a hoy porque la pantalla mira los últimos 30 días.
 */

import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { nuevoCierre } from '@dominio/cierre';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, DatosCierre } from '@dominio/tipos';
import { guardarCierre } from '@storage/repositorio';

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  // El arranque (leer el almacenamiento, pedir la semilla) termina en segundo plano.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
  montada = app;

  const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
  const tocar = (testID: string) =>
    act(async () => {
      const nodo = app.root.findAll(
        n => n.props.testID === testID && typeof n.props.onPress === 'function',
      )[0];
      if (!nodo) throw new Error(`No hay nada con testID "${testID}" que responda a onPress`);
      await nodo.props.onPress();
    });
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const textos = () => app.root.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  // Solo lo que dice esta pantalla: Resumen sigue montado debajo, en el stack.
  const textosDeLaPantalla = () => {
    const pantalla = app.root.findAll(n => n.props.testID === 'queme-pantalla')[0];
    if (!pantalla) throw new Error('No hay nada con testID "queme-pantalla"');
    return pantalla.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  };
  const textoNodo = (testID: string) => {
    const encontrado = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!encontrado) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return encontrado;
  };
  const textoDe = (testID: string) => textoCompleto(textoNodo(testID));
  const colorDe = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style).color;
  const tamanoDe = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style).fontSize;
  const vista = (testID: string) => {
    const encontrada = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!encontrada) throw new Error(`No hay ninguna vista con testID "${testID}"`);
    return encontrada;
  };
  const anchoDe = (testID: string) => StyleSheet.flatten(vista(testID).props.style).width;
  const tarjetas = () =>
    app.root
      .findAll(n => esHost(n, 'View') && String(n.props.testID ?? '').startsWith('queme-tarjeta-'))
      .map(n => String(n.props.testID).replace('queme-tarjeta-', ''));
  const enTarjeta = (productoId: string, testID: string) =>
    vista(`queme-tarjeta-${productoId}`).findAll(n => n.props.testID === testID).length > 0;

  return {
    tocar,
    existe,
    textos,
    textosDeLaPantalla,
    textoDe,
    colorDe,
    tamanoDe,
    vista,
    anchoDe,
    tarjetas,
    enTarjeta,
  };
};

const ahora = new Date('2026-10-07T12:00:00-05:00');
const hoy = () => fechaLocal(new Date());
const haceDias = (n: number) => restarDias(hoy(), n);

// Siembra un cierre con fecha e id explícitos ANTES de montar la app.
const sembrar = async (
  fecha: string,
  lineas: DatosCierre['lineas'],
  abreCiclo = false,
): Promise<Cierre> => {
  const cierre: Cierre = {
    ...nuevoCierre(
      { fecha, lineas, montoYape: 0, gastos: [], abreCiclo },
      PRODUCTOS_POR_DEFECTO,
      null,
      ahora,
    ),
    id: `c-${fecha}`,
  };
  await guardarCierre(cierre);
  return cierre;
};

// Precios por defecto: anticucho deja S/ 1.80 · pancita 1.00 · rachi 1.40 · chicha 0.40 por porción.
// Dos ciclos en los últimos 30 días. Vendidas y ganancia:
//   anticucho 30 → S/ 54.00 · pancita 50 → S/ 50.00 · chicha 40 vasos → S/ 16.00 · rachi 10 → S/ 14.00
// Pancita es la que más se vende (50), anticucho la que más deja por porción (S/ 1.80) y también
// la de más ganancia total; chicha (16) queda antes que rachi (14), al revés del orden por defecto.
const sembrarDosCiclos = async () => {
  await sembrar(
    haceDias(3),
    [
      { productoId: 'p-anticucho', preparadas: 30, sobrantes: 0 },
      { productoId: 'p-pancita', preparadas: 50, sobrantes: 0 },
    ],
    true,
  );
  await sembrar(
    haceDias(1),
    [
      { productoId: 'p-rachi', preparadas: 12, sobrantes: 2 },
      { productoId: 'p-chicha', preparadas: 40, sobrantes: 0 },
    ],
    true,
  );
};

const abrirPantalla = async (app: Awaited<ReturnType<typeof montarApp>>) => {
  await app.tocar('tab-resumen');
  await app.tocar('resumen-que-me-deja');
};

describe('Qué me deja cada uno', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
  });

  it('el botón de Resumen abre la pantalla con su título y el periodo en palabras', async () => {
    await sembrarDosCiclos();
    const app = await montarApp();

    await app.tocar('tab-resumen');
    expect(app.existe('resumen-que-me-deja')).toBe(true);
    expect(app.textos()).toContain('Qué me deja cada uno');
    await app.tocar('resumen-que-me-deja');

    expect(app.textos()).toContain('Qué me deja cada uno');
    expect(app.textoDe('queme-periodo')).toBe('Últimos 30 días · 2 ciclos');
  });

  it('un solo ciclo se dice en singular', async () => {
    await sembrar(haceDias(2), [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }], true);
    await sembrar(haceDias(1), [{ productoId: 'p-pancita', preparadas: 10, sobrantes: 0 }]);
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.textoDe('queme-periodo')).toBe('Últimos 30 días · 1 ciclo');
  });

  it('el periodo son los últimos 30 días: el día 30 cuenta y el 31 no', async () => {
    await sembrar(haceDias(31), [{ productoId: 'p-pancita', preparadas: 99, sobrantes: 0 }], true);
    await sembrar(
      haceDias(30),
      [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      true,
    );
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.tarjetas()).toEqual(['p-anticucho']);
    expect(app.textoDe('queme-periodo')).toBe('Últimos 30 días · 1 ciclo');
  });

  it('sin cierres en el periodo: mensaje con la voz de Freddy y "Cerrar mi día" que lleva a la pestaña', async () => {
    await sembrar(
      haceDias(45),
      [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      true,
    );
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.existe('queme-vacio')).toBe(true);
    expect(app.tarjetas()).toEqual([]);
    expect(app.existe('queme-insight')).toBe(false);
    expect(app.textos()).toContain('Cerrar mi día');

    await app.tocar('queme-cerrar-dia');
    // Ya está en la pestaña "Cerrar mi día", no en la pantalla de la que salió.
    expect(app.existe('queme-vacio')).toBe(false);
    expect(app.textos()).toContain('Guardar mi día');
  });

  it('sin ningún cierre también muestra el estado vacío', async () => {
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.existe('queme-vacio')).toBe(true);
    expect(app.existe('queme-atras')).toBe(true);
  });

  it('muestra el insight con su texto exacto, en 18 px y sin el naranja como color de texto', async () => {
    await sembrarDosCiclos();
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.existe('queme-insight')).toBe(true);
    expect(app.textoDe('queme-insight-texto')).toBe(
      'La pancita se vende más, pero el anticucho te deja S/ 0.80 más por porción.',
    );
    expect(app.tamanoDe('queme-insight-texto')).toBe(18);
    expect(app.colorDe('queme-insight-texto')).not.toBe('#FFA400');
  });

  it('una tarjeta por producto, ordenada por ganancia de mayor a menor', async () => {
    await sembrarDosCiclos();
    const app = await montarApp();
    await abrirPantalla(app);

    // anticucho 54.00 · pancita 50.00 · chicha 16.00 · rachi 14.00
    expect(app.tarjetas()).toEqual(['p-anticucho', 'p-pancita', 'p-chicha', 'p-rachi']);
    expect(app.textoDe('queme-ganancia-p-anticucho')).toBe('S/ 54.00');
    expect(app.textoDe('queme-ganancia-p-pancita')).toBe('S/ 50.00');
    expect(app.textoDe('queme-ganancia-p-chicha')).toBe('S/ 16.00');
    expect(app.textoDe('queme-ganancia-p-rachi')).toBe('S/ 14.00');
    // La cifra grande es la ganancia, en verde.
    expect(app.colorDe('queme-ganancia-p-anticucho')).toBe('#0F7A4F');
    expect(app.tamanoDe('queme-ganancia-p-anticucho')).toBeGreaterThanOrEqual(20);
  });

  it('"El que más vendes" y "El que más te deja" caen en productos distintos', async () => {
    await sembrarDosCiclos();
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.textoDe('queme-etiqueta-vendes-p-pancita')).toBe('El que más vendes');
    expect(app.textoDe('queme-etiqueta-deja-p-anticucho')).toBe('El que más te deja');
    for (const id of ['p-anticucho', 'p-chicha', 'p-rachi']) {
      expect(app.enTarjeta(id, `queme-etiqueta-vendes-${id}`)).toBe(false);
    }
    for (const id of ['p-pancita', 'p-chicha', 'p-rachi']) {
      expect(app.enTarjeta(id, `queme-etiqueta-deja-${id}`)).toBe(false);
    }
    expect(app.enTarjeta('p-pancita', 'queme-etiqueta-vendes-p-pancita')).toBe(true);
    expect(app.enTarjeta('p-anticucho', 'queme-etiqueta-deja-p-anticucho')).toBe(true);
    // Letra oscura sobre fondo suave: el naranja nunca es el color del texto.
    expect(app.colorDe('queme-etiqueta-vendes-p-pancita')).toBe('#1A1016');
    expect(app.colorDe('queme-etiqueta-deja-p-anticucho')).toBe('#1A1016');
    expect(app.tamanoDe('queme-etiqueta-vendes-p-pancita')).toBeGreaterThanOrEqual(14);
  });

  it('si el más vendido es también el que más deja: sin insight y las dos etiquetas en esa tarjeta', async () => {
    await sembrar(
      haceDias(2),
      [
        { productoId: 'p-anticucho', preparadas: 50, sobrantes: 0 },
        { productoId: 'p-pancita', preparadas: 10, sobrantes: 0 },
      ],
      true,
    );
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.existe('queme-insight')).toBe(false);
    expect(app.tarjetas()).toEqual(['p-anticucho', 'p-pancita']);
    expect(app.enTarjeta('p-anticucho', 'queme-etiqueta-vendes-p-anticucho')).toBe(true);
    expect(app.enTarjeta('p-anticucho', 'queme-etiqueta-deja-p-anticucho')).toBe(true);
    expect(app.existe('queme-etiqueta-vendes-p-pancita')).toBe(false);
    expect(app.existe('queme-etiqueta-deja-p-pancita')).toBe(false);
  });

  it('las dos barras de cada producto comparten escala: el mayor de cada tipo llega al 100 %', async () => {
    await sembrarDosCiclos();
    const app = await montarApp();
    await abrirPantalla(app);

    // Se vende (porciones): pancita 50 · chicha 40 · anticucho 30 · rachi 10 → sobre 50.
    expect(app.anchoDe('queme-barra-vende-p-pancita')).toBe('100%');
    expect(app.anchoDe('queme-barra-vende-p-chicha')).toBe('80%');
    expect(app.anchoDe('queme-barra-vende-p-anticucho')).toBe('60%');
    expect(app.anchoDe('queme-barra-vende-p-rachi')).toBe('20%');
    // Te deja (soles): anticucho 54 · pancita 50 · chicha 16 · rachi 14 → sobre 54.
    expect(app.anchoDe('queme-barra-deja-p-anticucho')).toBe('100%');
    expect(app.anchoDe('queme-barra-deja-p-pancita')).toBe('93%');
    expect(app.anchoDe('queme-barra-deja-p-chicha')).toBe('30%');
    expect(app.anchoDe('queme-barra-deja-p-rachi')).toBe('26%');
  });

  it('cada barra dice su cifra en palabras y la tarjeta su detalle, con "vasos" para la chicha', async () => {
    await sembrarDosCiclos();
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.textoDe('queme-detalle-p-anticucho')).toBe('30 porciones · S/ 1.80 por porción');
    expect(app.textoDe('queme-detalle-p-pancita')).toBe('50 porciones · S/ 1.00 por porción');
    expect(app.textoDe('queme-detalle-p-rachi')).toBe('10 porciones · S/ 1.40 por porción');
    expect(app.textoDe('queme-detalle-p-chicha')).toBe('40 vasos · S/ 0.40 por vaso');
    // Las etiquetas de las barras están como texto.
    expect(app.textosDeLaPantalla().filter(t => t === 'Se vende')).toHaveLength(4);
    expect(app.textosDeLaPantalla().filter(t => t === 'Te deja')).toHaveLength(4);
    expect(app.textoDe('queme-cifra-vende-p-pancita')).toBe('50 porciones');
    expect(app.textoDe('queme-cifra-vende-p-chicha')).toBe('40 vasos');
    expect(app.textoDe('queme-cifra-deja-p-anticucho')).toBe('S/ 54.00');
  });

  it('ningún porcentaje aparece como texto, y la nota al pie va centrada', async () => {
    await sembrarDosCiclos();
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.textosDeLaPantalla().filter(t => t.includes('%'))).toEqual([]);
    expect(app.textoDe('queme-nota')).toBe(
      'Calculado con lo que registraste. Mientras más cierres tus días, más preciso.',
    );
    expect(app.tamanoDe('queme-nota')).toBe(14);
  });

  it('ni las palabras prohibidas ni un mensaje técnico llegan a la pantalla', async () => {
    await sembrarDosCiclos();
    const app = await montarApp();
    await abrirPantalla(app);

    const prohibidas =
      /margen|balance|utilidad|SKU|rotaci[oó]n|\bROI\b|Error|undefined|\bNaN\b|Infinity/i;
    const textos = app.textosDeLaPantalla();
    expect(textos.length).toBeGreaterThan(10);
    expect(textos.filter(t => prohibidas.test(t))).toEqual([]);
  });

  it('una sola forma de volver: "Atrás" regresa a Resumen', async () => {
    await sembrarDosCiclos();
    const app = await montarApp();
    await abrirPantalla(app);

    expect(app.textosDeLaPantalla().filter(t => t === 'Atrás')).toHaveLength(1);
    expect(app.existe('queme-atras')).toBe(true);
    await app.tocar('queme-atras');

    expect(app.existe('queme-periodo')).toBe(false);
    expect(app.existe('resumen-que-me-deja')).toBe(true);
  });
});
