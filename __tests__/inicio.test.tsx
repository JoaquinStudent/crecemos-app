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
import { fechaLocal } from '@dominio/fecha';
import { formatoFecha } from '@dominio/formato';
import { PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, DatosCierre } from '@dominio/tipos';
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

  return { tocar, existe, textos, textoDe, colorDe, estiloDe, pestanaActiva };
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
      PRODUCTOS_POR_DEFECTO,
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
    expect(textos()).toContain('Te queda');
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
      'Sin señal no pasa nada: la app funciona igual.',
    );
    expect(textos()).toContain('Cargar datos de ejemplo');
    expect(existe('inicio-cargar-ejemplo')).toBe(true);
    expect(sinMensajesTecnicos(textos())).toEqual([]);
  });

  it('con una semilla inválida dice "No pudimos cargar los datos de ejemplo" y deja reintentar', async () => {
    servidorQueResponde(JSON.stringify({ version: 1, semilla: 'x' }));

    const { existe, textoDe, textos } = await montarApp();

    expect(textoDe('inicio-semilla-mensaje')).toBe('No pudimos cargar los datos de ejemplo');
    expect(existe('inicio-cargar-ejemplo')).toBe(true);
    expect(sinMensajesTecnicos(textos())).toEqual([]);
  });

  it('mientras descarga dice "Cargando datos de ejemplo…" y no ofrece el botón', async () => {
    let soltar!: (r: Response) => void;
    global.fetch = jest.fn(
      () => new Promise<Response>(resolver => (soltar = resolver)),
    ) as unknown as typeof fetch;

    const { existe, textoDe } = await montarApp();

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

    const { existe, textos } = await montarApp();

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
