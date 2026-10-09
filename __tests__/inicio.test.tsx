/**
 * Pruebas de apoyo de la pantalla Inicio (no son escenarios del SPEC; el recorrido con datos
 * de ejemplo es spec04_e10): saludo, tarjeta del ciclo, "Yape por cobrar", acceso rápido y el
 * estado sin cierres según la semilla. La app real, por testID, como lo haría una persona.
 */

import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { colors } from '@theme';
import { nuevoCierre } from '@dominio/cierre';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { formatoFecha } from '@dominio/formato';
import { PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, DatosCierre, Producto } from '@dominio/tipos';
import * as reglas from '@analisis/reglas';
import { evaluarReglas } from '@analisis/reglas';
import {
  guardarCierre,
  guardarPerfil,
  listarCierres,
  marcarSemillaResuelta,
} from '@storage/repositorio';

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

type Evento = 'onPress';

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
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const textos = () => app.root.findAll(n => esHost(n, 'Text')).map(textoCompleto);
  const textoNodo = (testID: string) => {
    const encontrado = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!encontrado) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return encontrado;
  };
  const textoDe = (testID: string) => textoCompleto(textoNodo(testID));
  const colorDe = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style).color;
  const estiloDe = (testID: string) => {
    const vista = app.root.findAll(n => esHost(n, 'View') && n.props.testID === testID)[0];
    if (!vista) throw new Error(`No hay ninguna vista con testID "${testID}"`);
    return StyleSheet.flatten(vista.props.style);
  };
  const pestanaActiva = (testID: string) =>
    app.root.findAll(n => n.props.testID === testID && n.props.accessibilityState)[0]?.props
      .accessibilityState.selected === true;
  const tamanoDe = (testID: string) => StyleSheet.flatten(textoNodo(testID).props.style).fontSize;
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
  // Las vistas cuyo testID empieza así, en el orden en que están en pantalla.
  const vistasCon = (prefijo: string) =>
    app.root
      .findAll(n => esHost(n, 'View') && String(n.props.testID ?? '').startsWith(prefijo))
      .map(n => String(n.props.testID));

  return {
    tocar,
    existe,
    textos,
    textoDe,
    colorDe,
    estiloDe,
    pestanaActiva,
    tamanoDe,
    enOrden,
    vistasCon,
  };
};

const ahora = new Date('2026-10-07T12:00:00-05:00');
const hoy = () => fechaLocal(new Date());

interface Dia {
  lineas?: DatosCierre['lineas'];
  gastos?: DatosCierre['gastos'];
  montoYape?: number;
  porCobrar?: boolean;
  cobradoEn?: string;
  abreCiclo?: boolean;
  productos?: Producto[];
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
    ...(dia.cobradoEn ? { cobradoEn: dia.cobradoEn } : {}),
  };
  await guardarCierre(cierre);
  return cierre;
};

// Tres días de un mismo ciclo (el domingo 4 lo abre):
//   4 oct · 10 anticuchos (S/ 100.00) − mercadería S/ 60.00                → +S/ 40.00
//   5 oct · 20 anticuchos (S/ 200.00; S/ 46.00 de Yape por cobrar) − carbón S/ 14.00 → +S/ 186.00
//   6 oct · 40 anticuchos + 6 chichas (S/ 412.00) − mercadería S/ 244.00   → +S/ 168.00
// Ciclo: vendiste S/ 712.00, gastaste S/ 318.00, te queda S/ 394.00; recuperó el capital el martes 6.
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

// Un servidor que responde el texto dado, como el de la semilla.
const fetchPorDefecto = global.fetch;
const servidorQueResponde = (cuerpo: string) => {
  const simulado = jest.fn(
    async () => ({ ok: true, status: 200, text: async () => cuerpo } as unknown as Response),
  );
  global.fetch = simulado as unknown as typeof fetch;
  return simulado;
};

// Una semilla mínima y válida: un producto y los cierres que se le pasen.
const semillaMinima = (cierres: unknown[]) =>
  JSON.stringify({
    version: 1,
    semilla: 'prueba',
    diaSemanaBase: 3,
    productos: [
      {
        id: 'p-anticucho',
        nombre: 'Anticucho',
        unidad: 'porcion',
        precioVenta: 10,
        costoUnitario: 8.2,
        actualizadoDiasAtras: 10,
      },
    ],
    cierres,
  });

const MENSAJES_TECNICOS = [
  'SIN_RED',
  'TIEMPO_AGOTADO',
  'SEMILLA_INVALIDA',
  'Network request failed',
  'TypeError',
  'Error',
];
const sinMensajesTecnicos = (textos: string[]) =>
  textos.filter(t => MENSAJES_TECNICOS.some(m => t.includes(m)));

describe('Inicio: saludo', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  it('dice "Hola, <nombre>" y debajo la fecha de hoy en palabras', async () => {
    await guardarPerfil({
      ...PERFIL_POR_DEFECTO,
      nombre: 'Freddy',
      actualizadoEn: ahora.toISOString(),
    });

    const { textoDe } = await montarApp();

    expect(textoDe('inicio-saludo')).toBe('Hola, Freddy');
    expect(textoDe('inicio-fecha')).toBe(formatoFecha(hoy()));
  });

  it('sin nombre dice solo "Hola"', async () => {
    const { textoDe } = await montarApp();

    expect(textoDe('inicio-saludo')).toBe('Hola');
  });

  it('un nombre en blanco también dice solo "Hola"', async () => {
    await guardarPerfil({
      ...PERFIL_POR_DEFECTO,
      nombre: '   ',
      actualizadoEn: ahora.toISOString(),
    });

    const { textoDe } = await montarApp();

    expect(textoDe('inicio-saludo')).toBe('Hola');
  });

  it('el avatar "Mi perfil" sigue ahí, con su etiqueta de texto', async () => {
    const { existe, textos } = await montarApp();

    expect(existe('abrir-perfil')).toBe(true);
    expect(textos()).toContain('Mi perfil');
  });
});

describe('Inicio: tarjeta del ciclo de compra', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  it('muestra día N, cuándo compró, lo que te queda, vendiste y gastaste del ciclo', async () => {
    await sembrarTresDias();

    const { textoDe, colorDe, textos } = await montarApp();

    expect(textoDe('inicio-ciclo-titulo')).toBe('Ciclo de compra · día 3');
    expect(textoDe('inicio-ciclo-compra')).toBe('Compraste el domingo 4 de octubre');
    expect(textoDe('inicio-ciclo-te-queda')).toBe('S/ 394.00');
    expect(colorDe('inicio-ciclo-te-queda')).toBe(colors.success);
    expect(textoDe('inicio-ciclo-vendiste')).toBe('+ S/ 712.00');
    expect(colorDe('inicio-ciclo-vendiste')).toBe(colors.success);
    expect(textoDe('inicio-ciclo-gastaste')).toBe('− S/ 318.00');
    expect(colorDe('inicio-ciclo-gastaste')).toBe(colors.danger);
    expect(textos()).toContain('Resultado registrado');
    expect(textos()).toContain('Vendiste');
    expect(textos()).toContain('Gastaste');
  });

  it('la tarjeta "Tu último día" se mantiene, con su testID', async () => {
    await sembrarTresDias();

    const { textoDe, textos } = await montarApp();

    expect(textoDe('inicio-te-queda')).toBe('S/ 168.00');
    expect(textos()).toContain('Tu último día · Martes 6 de octubre');
  });

  it('con el capital recuperado, la barra va llena y verde, con el texto en letra oscura', async () => {
    await sembrarTresDias();

    const { textoDe, colorDe, estiloDe } = await montarApp();

    expect(textoDe('inicio-ciclo-capital')).toBe('Recuperaste tu capital el martes 6 de octubre');
    expect(colorDe('inicio-ciclo-capital')).toBe(colors.text);
    const relleno = estiloDe('inicio-ciclo-barra-relleno');
    expect(relleno.width).toBe('100%');
    expect(relleno.backgroundColor).toBe(colors.success);
  });

  it('sin recuperar el capital, la barra se llena en proporción y el relleno es el acento', async () => {
    // Vendió S/ 100.00 y el ciclo lleva S/ 160.00 de capital: ya va el 62 %, le faltan S/ 60.00.
    await sembrar('2026-10-06', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: 160 }],
    });

    const { textoDe, colorDe, estiloDe } = await montarApp();

    expect(textoDe('inicio-ciclo-capital')).toBe('Te falta S/ 60.00 para recuperar tu capital');
    // El naranja es solo relleno: el texto siempre va en letra oscura.
    expect(colorDe('inicio-ciclo-capital')).toBe(colors.text);
    expect(colorDe('inicio-ciclo-capital')).not.toBe(colors.accent);
    const relleno = estiloDe('inicio-ciclo-barra-relleno');
    expect(relleno.width).toBe('62%');
    expect(relleno.backgroundColor).toBe(colors.accent);
    expect(textoDe('inicio-ciclo-te-queda')).toBe('-S/ 60.00');
    expect(colorDe('inicio-ciclo-te-queda')).toBe(colors.danger);
  });

  it('un ciclo sin gastos no muestra la barra ni el texto de capital', async () => {
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
    });

    const { existe, textoDe } = await montarApp();

    expect(textoDe('inicio-ciclo-te-queda')).toBe('S/ 100.00');
    expect(existe('inicio-ciclo-barra')).toBe(false);
    expect(existe('inicio-ciclo-barra-relleno')).toBe(false);
    expect(existe('inicio-ciclo-capital')).toBe(false);
  });

  it('si el ciclo no empezó con "Hoy compré mercadería" no dice cuándo compró', async () => {
    await sembrar('2026-10-06', {
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      gastos: [{ categoria: 'carbon', monto: 10 }],
    });

    const { existe, textoDe } = await montarApp();

    expect(textoDe('inicio-ciclo-titulo')).toBe('Ciclo de compra · día 1');
    expect(existe('inicio-ciclo-compra')).toBe(false);
  });

  it('muestra el último ciclo, no los anteriores', async () => {
    await sembrarTresDias();
    // Nueva compra el 7: abre otro ciclo con su propio capital.
    await sembrar('2026-10-07', {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
      gastos: [{ categoria: 'mercaderia', monto: 70 }],
    });

    const { textoDe } = await montarApp();

    expect(textoDe('inicio-ciclo-titulo')).toBe('Ciclo de compra · día 1');
    expect(textoDe('inicio-ciclo-compra')).toBe('Compraste el miércoles 7 de octubre');
    expect(textoDe('inicio-ciclo-te-queda')).toBe('S/ 30.00');
    expect(textoDe('inicio-ciclo-vendiste')).toBe('+ S/ 100.00');
    expect(textoDe('inicio-ciclo-gastaste')).toBe('− S/ 70.00');
  });
});

describe('Inicio: Yape por cobrar', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  const sembrarPendientes = async () => {
    await sembrar('2026-10-04', { montoYape: 100, porCobrar: true });
    await sembrar('2026-10-05', { montoYape: 113, porCobrar: true });
    // Este ya lo cobró: no cuenta.
    await sembrar('2026-10-03', { montoYape: 30, porCobrar: true, cobradoEn: '2026-10-04' });
  };

  it('no aparece si no hay nada por cobrar', async () => {
    await sembrarTresDias();
    // El Yape del 5 ya está cobrado.
    await sembrar('2026-10-05', { montoYape: 46, porCobrar: true, cobradoEn: '2026-10-06' });

    const { existe, textos } = await montarApp();

    expect(existe('inicio-por-cobrar-total')).toBe(false);
    expect(existe('inicio-marcar-cobrado')).toBe(false);
    expect(textos()).not.toContain('Yape por cobrar');
  });

  it('muestra el total y la cantidad de pagos, sin contar los ya cobrados', async () => {
    await sembrarPendientes();

    const { textoDe, textos } = await montarApp();

    expect(textos()).toContain('Yape por cobrar');
    expect(textoDe('inicio-por-cobrar-pagos')).toBe('2 pagos');
    expect(textoDe('inicio-por-cobrar-total')).toBe('S/ 213.00');
  });

  it('con un solo pago dice "1 pago", en singular', async () => {
    await sembrar('2026-10-05', { montoYape: 46, porCobrar: true });

    const { textoDe } = await montarApp();

    expect(textoDe('inicio-por-cobrar-pagos')).toBe('1 pago');
    expect(textoDe('inicio-por-cobrar-total')).toBe('S/ 46.00');
  });

  it('"Marcar como cobrado" pide confirmar diciendo cuánto, sin tocar nada todavía', async () => {
    await sembrarPendientes();
    const { tocar, existe, textoDe, textos } = await montarApp();
    expect(existe('inicio-cobrado-si')).toBe(false);

    await tocar('inicio-marcar-cobrado');

    expect(textoDe('inicio-cobrado-pregunta')).toBe('¿Ya recibiste S/ 213.00 en tu Yape?');
    expect(textos()).toContain('Sí, ya los recibí');
    expect(textos()).toContain('No, todavía');
    expect(existe('inicio-cobrado-si')).toBe(true);
    expect(existe('inicio-cobrado-no')).toBe(true);
    expect((await listarCierres()).filter(c => c.cobradoEn === hoy())).toHaveLength(0);
  });

  it('"No, todavía" vuelve atrás y no cambia nada', async () => {
    await sembrarPendientes();
    const { tocar, existe, textoDe } = await montarApp();
    await tocar('inicio-marcar-cobrado');

    await tocar('inicio-cobrado-no');

    expect(existe('inicio-cobrado-pregunta')).toBe(false);
    expect(existe('inicio-marcar-cobrado')).toBe(true);
    expect(textoDe('inicio-por-cobrar-total')).toBe('S/ 213.00');
    const cierres = await listarCierres();
    expect(cierres.filter(c => c.id !== 'c-2026-10-03').every(c => c.cobradoEn === undefined)).toBe(
      true,
    );
  });

  it('"Sí, ya los recibí" marca todo como cobrado hoy y la tarjeta desaparece', async () => {
    await sembrarPendientes();
    const { tocar, existe, textos } = await montarApp();
    await tocar('inicio-marcar-cobrado');

    await tocar('inicio-cobrado-si');

    expect(existe('inicio-por-cobrar-total')).toBe(false);
    expect(existe('inicio-cobrado-pregunta')).toBe(false);
    expect(textos()).not.toContain('Yape por cobrar');
    const cierres = await listarCierres();
    const porId = Object.fromEntries(cierres.map(c => [c.id, c.cobradoEn]));
    expect(porId['c-2026-10-04']).toBe(hoy());
    expect(porId['c-2026-10-05']).toBe(hoy());
    // El que ya estaba cobrado conserva su fecha.
    expect(porId['c-2026-10-03']).toBe('2026-10-04');
  });

  it('después de cobrar, el botón principal "Cerrar mi día" sigue ahí', async () => {
    await sembrarPendientes();
    const { tocar, existe } = await montarApp();

    await tocar('inicio-marcar-cobrado');
    await tocar('inicio-cobrado-si');

    expect(existe('inicio-cerrar-dia-rapido')).toBe(true);
  });
});

describe('Inicio: acceso rápido', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  it('con cierres, "Cerrar mi día" lleva a la pestaña "Cerrar mi día"', async () => {
    await sembrarTresDias();
    const { tocar, textos, pestanaActiva } = await montarApp();
    expect(textos()).toContain('Cerrar mi día');
    expect(pestanaActiva('tab-inicio')).toBe(true);

    await tocar('inicio-cerrar-dia-rapido');

    expect(pestanaActiva('tab-cerrar-dia')).toBe(true);
  });

  it('con cierres no muestra el estado vacío', async () => {
    await sembrarTresDias();

    const { existe, textos } = await montarApp();

    expect(existe('inicio-cerrar-dia')).toBe(false);
    expect(textos()).not.toContain('Aún no cierras ningún día');
  });

  it('sin cierres, el botón del estado vacío también lleva a "Cerrar mi día"', async () => {
    const { tocar, existe, pestanaActiva } = await montarApp();
    expect(existe('inicio-cerrar-dia-rapido')).toBe(false);

    await tocar('inicio-cerrar-dia');

    expect(pestanaActiva('tab-cerrar-dia')).toBe(true);
  });
});

describe('Inicio: sin cierres y los datos de ejemplo', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  it('sin señal abre vacío, amable, sin mensajes técnicos y con "Cargar datos de ejemplo"', async () => {
    // fetch rechaza por defecto (jest.setup.js): red caída.
    const { existe, textoDe, textos } = await montarApp();

    expect(textos()).toContain('Aún no cierras ningún día');
    expect(existe('inicio-cerrar-dia')).toBe(true);
    expect(textoDe('inicio-semilla-mensaje')).toBe(
      'Puedes probar la app con datos de ejemplo. Se cargarán solo si tocas este botón.',
    );
    expect(textos()).toContain('Cargar datos de ejemplo');
    expect(existe('inicio-cargar-ejemplo')).toBe(true);
    expect(sinMensajesTecnicos(textos())).toEqual([]);
  });

  it('con una semilla inválida dice "No pudimos cargar los datos de ejemplo" y deja reintentar', async () => {
    servidorQueResponde(JSON.stringify({ version: 1, semilla: 'x' }));

    const { tocar, existe, textoDe, textos } = await montarApp();
    await tocar('inicio-cargar-ejemplo');

    expect(textoDe('inicio-semilla-mensaje')).toBe('No pudimos cargar los datos de ejemplo');
    expect(existe('inicio-cargar-ejemplo')).toBe(true);
    expect(sinMensajesTecnicos(textos())).toEqual([]);
  });

  it('mientras descarga dice "Cargando datos de ejemplo…" y no ofrece el botón', async () => {
    let soltar!: (r: Response) => void;
    global.fetch = jest.fn(
      () => new Promise<Response>(resolver => (soltar = resolver)),
    ) as unknown as typeof fetch;

    const { tocar, existe, textoDe } = await montarApp();
    await tocar('inicio-cargar-ejemplo');

    expect(textoDe('inicio-semilla-mensaje')).toBe('Cargando datos de ejemplo…');
    expect(existe('inicio-cargar-ejemplo')).toBe(false);
    // Se cierra la descarga pendiente para no dejar nada colgado.
    await act(async () => soltar({ ok: false, status: 500 } as unknown as Response));
  });

  it('si la semilla ya se resolvió, no hay mensaje ni botón de carga (ni se pide nada)', async () => {
    await marcarSemillaResuelta(ahora.toISOString());
    const servidor = servidorQueResponde(semillaMinima([]));

    const { existe, textos } = await montarApp();

    expect(servidor).not.toHaveBeenCalled();
    expect(existe('inicio-cerrar-dia')).toBe(true);
    expect(existe('inicio-semilla-mensaje')).toBe(false);
    expect(existe('inicio-cargar-ejemplo')).toBe(false);
    expect(textos()).not.toContain('Cargar datos de ejemplo');
  });

  it('con la semilla cargada y sin días (los borró), no vuelve a ofrecer datos de ejemplo', async () => {
    // Semilla válida sin cierres: queda "lista" con 0 cierres, como quien ya borró todo.
    servidorQueResponde(semillaMinima([]));

    const { tocar, existe, textos } = await montarApp();
    await tocar('inicio-cargar-ejemplo');

    expect(existe('inicio-cerrar-dia')).toBe(true);
    expect(existe('inicio-semilla-mensaje')).toBe(false);
    expect(existe('inicio-cargar-ejemplo')).toBe(false);
    expect(textos()).not.toContain('Cargar datos de ejemplo');
  });

  it('"Cargar datos de ejemplo" reintenta y, con señal, llena Inicio', async () => {
    const { tocar, existe, textoDe } = await montarApp();
    expect(existe('inicio-cargar-ejemplo')).toBe(true);
    const semilla = semillaMinima([
      {
        diasAtras: 1,
        lineas: [
          {
            productoId: 'p-anticucho',
            preparadas: 20,
            sobrantes: 2,
            precioUnitario: 10,
            costoUnitario: 8.2,
          },
        ],
        montoYape: 46,
        yapePendiente: true,
        gastos: [{ categoria: 'movilidad', monto: 12 }],
        abreCiclo: true,
      },
    ]);
    const servidor = servidorQueResponde(semilla);

    await tocar('inicio-cargar-ejemplo');

    expect(servidor).toHaveBeenCalledTimes(1);
    // 18 porciones × S/ 10.00 = S/ 180.00 de venta − S/ 12.00 de gasto.
    expect(textoDe('inicio-te-queda')).toBe('S/ 168.00');
    expect(textoDe('inicio-por-cobrar-total')).toBe('S/ 46.00');
    expect(existe('inicio-cargar-ejemplo')).toBe(false);
    expect(existe('inicio-semilla-mensaje')).toBe(false);
    expect(existe('inicio-cerrar-dia')).toBe(false);
    expect(existe('inicio-cerrar-dia-rapido')).toBe(true);
    expect(await listarCierres()).toHaveLength(1);
  });

  it('si el reintento también falla, sigue ofreciendo el botón y sin mensajes técnicos', async () => {
    const { tocar, existe, textos } = await montarApp();

    await tocar('inicio-cargar-ejemplo');

    expect(existe('inicio-cargar-ejemplo')).toBe(true);
    expect(sinMensajesTecnicos(textos())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Sprint-05 · oleada C: el insight, las recomendaciones y el nuevo orden de Inicio.
// Fechas relativas a hoy: el insight mira los últimos 30 días y la regla de precio, 90 días atrás.
// ---------------------------------------------------------------------------------------------

const haceDias = (n: number) => restarDias(hoy(), n);

// Los productos por defecto, pero con otro costo del anticucho (para sembrar un día de hace meses).
const conCostoAnticucho = (costo: number): Producto[] =>
  PRODUCTOS_POR_DEFECTO.map(p => (p.id === 'p-anticucho' ? { ...p, costoUnitario: costo } : p));

// Margen por porción con los precios por defecto: anticucho 1.80 · pancita 1.00 · rachi 1.40.
// Tres ciclos que activan las cinco reglas a la vez (como spec05_e10), con el insight de la
// pancita contra el anticucho (últimos 30 días: pancita 100 · anticucho 60 · rachi 50):
//   hace 100 días · abre ciclo · anticucho a S/ 3.20 por porción (costo 6.80)        → regla precio
//   hace 20 días  · abre ciclo · anticucho 40 · rachi 30 (sobran 6) · mercadería S/ 100.00
//   hace 9 días   · abre ciclo · anticucho 20 · pancita 100 · rachi 30 (sobran 4) · Yape S/ 120.00
//                   por cobrar (regla cobro) · mercadería S/ 100.00
const sembrarTodasLasReglas = async () => {
  await sembrar(haceDias(100), {
    abreCiclo: true,
    productos: conCostoAnticucho(6.8),
    lineas: [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 0 }],
  });
  await sembrar(haceDias(20), {
    abreCiclo: true,
    lineas: [
      { productoId: 'p-anticucho', preparadas: 40, sobrantes: 0 },
      { productoId: 'p-rachi', preparadas: 30, sobrantes: 6 },
    ],
    gastos: [{ categoria: 'mercaderia', monto: 100 }],
  });
  await sembrar(haceDias(9), {
    abreCiclo: true,
    lineas: [
      { productoId: 'p-anticucho', preparadas: 20, sobrantes: 0 },
      { productoId: 'p-pancita', preparadas: 100, sobrantes: 0 },
      { productoId: 'p-rachi', preparadas: 30, sobrantes: 4 },
    ],
    montoYape: 120,
    porCobrar: true,
    gastos: [{ categoria: 'mercaderia', monto: 100 }],
  });
};

// Dos ciclos sin Yape por cobrar ni precios viejos: solo se activan retiro y comparación.
//   hace 5 días · abre ciclo · 20 anticuchos (S/ 200.00) − S/ 100.00 → te queda S/ 100.00
//   hace 1 día  · abre ciclo · 30 anticuchos (S/ 300.00) − S/ 100.00 → te queda S/ 200.00
const sembrarDosCiclosSinAlertas = async () => {
  await sembrar(haceDias(5), {
    abreCiclo: true,
    lineas: [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 0 }],
    gastos: [{ categoria: 'mercaderia', monto: 100 }],
  });
  await sembrar(haceDias(1), {
    abreCiclo: true,
    lineas: [{ productoId: 'p-anticucho', preparadas: 30, sobrantes: 0 }],
    gastos: [{ categoria: 'mercaderia', monto: 100 }],
  });
};

const FRASE_DEL_INSIGHT =
  'La pancita se vende más. La diferencia estimada por unidad del anticucho es S/ 0.80 mayor (precio menos costo estimado).';

describe('Inicio: el orden de las tarjetas', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  it('saludo, ciclo, insight, recomendaciones, Yape por cobrar, tu último día y el botón', async () => {
    await sembrarTodasLasReglas();

    const { enOrden } = await montarApp();

    expect(
      enOrden([
        'inicio-saludo',
        'inicio-ciclo-titulo',
        'inicio-insight',
        'inicio-recomendaciones',
        'inicio-por-cobrar-total',
        'inicio-te-queda',
        'inicio-cerrar-dia-rapido',
      ]),
    ).toEqual([
      'inicio-saludo',
      'inicio-ciclo-titulo',
      'inicio-insight',
      'inicio-recomendaciones',
      'inicio-por-cobrar-total',
      'inicio-te-queda',
      'inicio-cerrar-dia-rapido',
    ]);
  });

  it('"Tu último día" conserva su testID y su valor aunque cambie de lugar', async () => {
    await sembrarTodasLasReglas();

    const { textoDe, textos } = await montarApp();

    // El último día cerrado es el de hace 9 días: 20 anticuchos + 100 pancitas + 26 rachis.
    // Venta S/ 200.00 + S/ 900.00 + S/ 234.00 = S/ 1,334.00 − S/ 100.00 de mercadería.
    expect(textoDe('inicio-te-queda')).toBe('S/ 1,234.00');
    expect(textos().some(t => t.startsWith('Tu último día · '))).toBe(true);
  });

  it('el botón principal sigue siendo uno solo: "Cerrar mi día"', async () => {
    await sembrarTodasLasReglas();

    const { vistasCon, existe } = await montarApp();

    // Ni el insight ni las recomendaciones traen otro botón principal: el enlace es de texto.
    expect(vistasCon('inicio-cerrar-dia')).toEqual(['inicio-cerrar-dia-rapido']);
    expect(existe('inicio-cerrar-dia-rapido')).toBe(true);
  });
});

describe('Inicio: el insight', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
  });

  // Pancita 50 porciones (la que más se vende) y anticucho 30 (la que más deja por porción).
  const sembrarInsight = async () => {
    await sembrar(haceDias(3), {
      abreCiclo: true,
      lineas: [
        { productoId: 'p-anticucho', preparadas: 30, sobrantes: 0 },
        { productoId: 'p-pancita', preparadas: 50, sobrantes: 0 },
      ],
    });
  };

  it('muestra la frase exacta del insight, en 18 px y sin naranja como color de texto', async () => {
    await sembrarInsight();

    const { existe, textoDe, tamanoDe, colorDe } = await montarApp();

    expect(existe('inicio-insight')).toBe(true);
    expect(textoDe('inicio-insight-texto')).toBe(FRASE_DEL_INSIGHT);
    expect(tamanoDe('inicio-insight-texto')).toBe(18);
    expect(colorDe('inicio-insight-texto')).toBe(colors.text);
    expect(colorDe('inicio-insight-texto')).not.toBe(colors.accent);
  });

  it('el fondo es suave y lleva un borde izquierdo de acento: el naranja nunca es el texto', async () => {
    await sembrarInsight();

    const { estiloDe, colorDe } = await montarApp();

    const tarjeta = estiloDe('inicio-insight');
    expect(tarjeta.backgroundColor).toBe(colors.accentSoft);
    expect(tarjeta.borderLeftWidth).toBe(4);
    expect(tarjeta.borderLeftColor).toBe(colors.accent);
    expect(colorDe('inicio-insight-texto')).not.toBe(tarjeta.borderLeftColor);
  });

  it('el enlace "Ver qué me deja cada uno" lleva la flecha y mide al menos 48 dp', async () => {
    await sembrarInsight();

    const { textos, estiloDe, colorDe } = await montarApp();

    expect(textos()).toContain('Ver qué me deja cada uno');
    expect(estiloDe('inicio-ver-que-me-deja').minHeight).toBeGreaterThanOrEqual(48);
    expect(colorDe('inicio-ver-que-me-deja-texto')).not.toBe(colors.accent);
  });

  it('no aparece cuando el más vendido y el que más deja son el mismo producto', async () => {
    // El anticucho se vende más (50) y también deja más por porción: no hay contraste que contar.
    await sembrar(haceDias(3), {
      abreCiclo: true,
      lineas: [
        { productoId: 'p-anticucho', preparadas: 50, sobrantes: 0 },
        { productoId: 'p-pancita', preparadas: 30, sobrantes: 0 },
      ],
    });

    const { existe, textos } = await montarApp();

    expect(existe('inicio-insight')).toBe(false);
    expect(existe('inicio-ver-que-me-deja')).toBe(false);
    expect(textos()).not.toContain('Ver qué me deja cada uno');
  });

  it('no aparece con un solo producto vendido', async () => {
    await sembrar(haceDias(3), {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 30, sobrantes: 0 }],
    });

    const { existe } = await montarApp();

    expect(existe('inicio-insight')).toBe(false);
  });

  it('mira los mismos últimos 30 días que "Qué me deja cada uno": el día 30 cuenta y el 31 no', async () => {
    // Con el día 31 la pancita se llevaría casi todo; sin él no hay contraste que contar.
    await sembrar(haceDias(31), {
      abreCiclo: true,
      lineas: [{ productoId: 'p-pancita', preparadas: 99, sobrantes: 0 }],
    });
    await sembrar(haceDias(30), {
      abreCiclo: true,
      lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
    });
    const { existe } = await montarApp();
    expect(existe('inicio-insight')).toBe(false);
  });

  it('el día 30 sí cuenta para el insight', async () => {
    await sembrar(haceDias(30), {
      abreCiclo: true,
      lineas: [
        { productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 },
        { productoId: 'p-pancita', preparadas: 20, sobrantes: 0 },
      ],
    });

    const { textoDe } = await montarApp();

    expect(textoDe('inicio-insight-texto')).toBe(FRASE_DEL_INSIGHT);
  });

  it('sin cierres no hay insight', async () => {
    const { existe } = await montarApp();

    expect(existe('inicio-insight')).toBe(false);
  });

  it('"Ver qué me deja cada uno" abre esa pantalla, con la misma frase', async () => {
    await sembrarInsight();
    const { tocar, existe, textoDe } = await montarApp();
    expect(existe('queme-pantalla')).toBe(false);

    await tocar('inicio-ver-que-me-deja');

    expect(existe('queme-pantalla')).toBe(true);
    expect(textoDe('queme-insight-texto')).toBe(textoDe('inicio-insight-texto'));
  });

  it('desde esa pantalla, "Atrás" vuelve a Inicio', async () => {
    await sembrarInsight();
    const { tocar, textoDe } = await montarApp();
    await tocar('inicio-ver-que-me-deja');

    await tocar('queme-atras');

    expect(textoDe('inicio-insight-texto')).toBe(FRASE_DEL_INSIGHT);
  });
});

describe('Inicio: las recomendaciones', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    const app = montada;
    montada = null;
    if (app) await act(async () => app.unmount());
    global.fetch = fetchPorDefecto;
    jest.restoreAllMocks();
  });

  const CARTELES = ['Para decidir hoy', 'Cierra 2 ciclos para ver recomendaciones'];

  it('con las cinco reglas activas muestra exactamente 2: cobro y precio, en ese orden', async () => {
    await sembrarTodasLasReglas();

    const { existe, textos, vistasCon } = await montarApp();

    expect(existe('inicio-recomendaciones')).toBe(true);
    expect(textos()).toContain('Para decidir hoy');
    expect(vistasCon('inicio-recomendacion-')).toEqual([
      'inicio-recomendacion-cobro',
      'inicio-recomendacion-precio',
    ]);
    expect(existe('inicio-recomendacion-preparar')).toBe(false);
    expect(existe('inicio-recomendacion-retiro')).toBe(false);
    expect(existe('inicio-recomendacion-comparacion')).toBe(false);
    expect(existe('inicio-sin-recomendaciones')).toBe(false);
  });

  it('cada tarjeta dice el mensaje del motor, con verbo y monto, en 18 px', async () => {
    await sembrarTodasLasReglas();
    const { textoDe, tamanoDe, colorDe } = await montarApp();
    const del = evaluarReglas({
      cierres: await listarCierres(),
      productos: PRODUCTOS_POR_DEFECTO,
      hoy: hoy(),
    });

    expect(del.map(r => r.reglaId)).toEqual(['cobro', 'precio']);
    for (const r of del) {
      expect(textoDe(`inicio-recomendacion-${r.reglaId}-texto`)).toBe(r.mensaje);
      expect(tamanoDe(`inicio-recomendacion-${r.reglaId}-texto`)).toBe(18);
      expect(colorDe(`inicio-recomendacion-${r.reglaId}-texto`)).toBe(colors.text);
    }
    expect(textoDe('inicio-recomendacion-cobro-texto')).toMatch(
      /^Tienes S\/ 120\.00 por cobrar desde el \d+ de \w+\.$/,
    );
    expect(textoDe('inicio-recomendacion-precio-texto')).toMatch(
      /^La diferencia estimada por unidad de Anticucho bajó S\/ 1\.40 desde \w+ \(precio menos costo estimado\)\. Revisa el precio\.$/,
    );
  });

  it('sin cobro ni precio, las que siguen: retiro y comparación, con sus montos', async () => {
    await sembrarDosCiclosSinAlertas();

    const { vistasCon, textoDe } = await montarApp();

    expect(vistasCon('inicio-recomendacion-')).toEqual([
      'inicio-recomendacion-retiro',
      'inicio-recomendacion-comparacion',
    ]);
    expect(textoDe('inicio-recomendacion-retiro-texto')).toBe(
      'El resultado registrado del ciclo fue S/ 100.00. Antes de retirar dinero, revisa los cobros pendientes.',
    );
    expect(textoDe('inicio-recomendacion-comparacion-texto')).toBe(
      'Resultado registrado S/ 100.00 más que el ciclo pasado',
    );
  });

  it('con una sola recomendación activa muestra solo esa tarjeta', async () => {
    // El motor puede devolver una sola: la pantalla muestra solo lo que él devuelve.
    await sembrarDosCiclosSinAlertas();
    const soloUna = jest
      .spyOn(reglas, 'evaluarReglas')
      .mockReturnValue([{ reglaId: 'retiro', prioridad: 4, mensaje: 'Puedes sacar S/ 1.00.' }]);

    const { vistasCon, textoDe } = await montarApp();

    expect(soloUna).toHaveBeenCalled();
    expect(vistasCon('inicio-recomendacion-')).toEqual(['inicio-recomendacion-retiro']);
    expect(textoDe('inicio-recomendacion-retiro-texto')).toBe('Puedes sacar S/ 1.00.');
  });

  it('con un solo ciclo dice "Cierra 2 ciclos para ver recomendaciones" y no inventa ninguna', async () => {
    await sembrarTresDias();

    const { textoDe, existe, vistasCon, tamanoDe } = await montarApp();

    expect(textoDe('inicio-sin-recomendaciones')).toBe('Cierra 2 ciclos para ver recomendaciones');
    expect(tamanoDe('inicio-sin-recomendaciones')).toBeGreaterThanOrEqual(14);
    expect(existe('inicio-recomendaciones')).toBe(false);
    expect(vistasCon('inicio-recomendacion-')).toEqual([]);
  });

  it('sin ningún cierre no muestra nada de este bloque (se ve el estado vacío de siempre)', async () => {
    const { existe, textos } = await montarApp();

    expect(existe('inicio-sin-recomendaciones')).toBe(false);
    expect(existe('inicio-recomendaciones')).toBe(false);
    expect(existe('inicio-insight')).toBe(false);
    for (const cartel of CARTELES) expect(textos()).not.toContain(cartel);
    expect(textos()).toContain('Aún no cierras ningún día');
  });

  it('con 2 ciclos o más ya no pide cerrar 2 ciclos', async () => {
    await sembrarDosCiclosSinAlertas();

    const { existe, textos } = await montarApp();

    expect(existe('inicio-sin-recomendaciones')).toBe(false);
    expect(textos()).not.toContain('Cierra 2 ciclos para ver recomendaciones');
  });

  it('con 2 ciclos o más y ninguna recomendación activa, no muestra nada de este bloque', async () => {
    await sembrarDosCiclosSinAlertas();
    jest.spyOn(reglas, 'evaluarReglas').mockReturnValue([]);

    const { existe, textos, vistasCon } = await montarApp();

    expect(existe('inicio-sin-recomendaciones')).toBe(false);
    expect(existe('inicio-recomendaciones')).toBe(false);
    expect(vistasCon('inicio-recomendacion-')).toEqual([]);
    for (const cartel of CARTELES) expect(textos()).not.toContain(cartel);
  });
});
