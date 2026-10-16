/**
 * @jest-environment node
 *
 * Tests del Sprint-17. Generados desde sdd/spec/Sprint-17-chat-ejemplo/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * Aquí viven el resumen agregado (cantidades, ejemplo, textos de monto), el Worker, los prompts, las
 * respuestas calculadas y el servicio. La pantalla (etiqueta, aviso de privacidad y el e2e) está en
 * `sprint-17-pantalla.test.tsx`. El servidor del chat y OpenRouter son `fetch` simulados.
 */

/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { extraerCifras } from '@analisis/cifras';
import { responderConsulta } from '@analisis/intenciones';
import {
  armarResumenNegocio,
  cifrasDelResumen,
  MAX_CARACTERES_RESUMEN,
} from '@analisis/resumenNegocio';
import { validarConversacion, normalizarMontos } from '@analisis/validarRedaccion';
import { fechaLocal } from '@dominio/fecha';
import { formatoSoles } from '@dominio/formato';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { Cierre, ContextoAnalisis, LineaCierre } from '@dominio/tipos';
import { consultar, reiniciarEstadoDeRed } from '@services/jev';
import worker, { PROMPT_CONVERSAR, PROMPT_REDACTAR } from '../../servidor/worker.js';

const RAIZ = join(__dirname, '..', '..');
const leer = (...partes: string[]) => readFileSync(join(RAIZ, ...partes), 'utf8');
const archivosDe = (dir: string): string[] =>
  readdirSync(dir).flatMap(nombre => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivosDe(ruta) : [ruta];
  });

const HOY = '2026-10-14';
const URL_PRUEBA = 'https://asistente.ejemplo.test';
const instante = '2026-10-14T12:00:00-05:00';

const linea = (
  nombre: string,
  preparadas: number,
  precio: number,
  costo: number,
  sobrantes = 0,
): LineaCierre => ({
  productoId: `p-${nombre.toLowerCase()}`,
  nombre,
  preparadas,
  sobrantes,
  precioUnitario: precio,
  costoUnitario: costo,
});
const cierreDe = (fecha: string, lineas: LineaCierre[], extra: Partial<Cierre> = {}): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas,
  montoYape: 0,
  yapePendiente: false,
  gastos: [],
  abreCiclo: false,
  creadoEn: instante,
  actualizadoEn: instante,
  ...extra,
});

/**
 * Agosto: muchas porciones baratas (80 + 15 + 40 = 135 porciones, S/ 390.00).
 * Septiembre: pocas porciones caras (10 + 8 = 18 porciones, S/ 900.00).
 * Octubre (hoy es el 14): 12 porciones. Un cierre posterior a hoy que no cuenta.
 */
const CIERRES: Cierre[] = [
  cierreDe('2026-08-03', [linea('Chicha', 80, 2, 1), linea('Anticucho', 20, 10, 8, 5)]),
  cierreDe('2026-08-20', [linea('Chicha', 40, 2, 1)]),
  cierreDe('2026-09-05', [linea('Parrilla', 10, 50, 30)]),
  cierreDe('2026-09-19', [linea('Parrilla', 8, 50, 30)]),
  cierreDe('2026-10-06', [linea('Anticucho', 12, 10, 8)]),
  cierreDe('2026-10-20', [linea('Anticucho', 99, 10, 8)]),
];
const CTX: ContextoAnalisis = { cierres: CIERRES, productos: [], hoy: HOY };

const sumaVendidas = (cierres: Cierre[], prefijo: string): number =>
  cierres
    .filter(c => c.fecha.startsWith(prefijo) && c.fecha <= HOY)
    .reduce((t, c) => t + c.lineas.reduce((s, l) => s + (l.preparadas - l.sobrantes), 0), 0);

const comoEjemplo = (c: Cierre): Cierre => ({ ...c, origen: 'ejemplo' });

// --- Un servidor del chat simulado -----------------------------------------------------------------

const respuesta = (cuerpo: unknown, ok = true, status = 200) =>
  ({ ok, status, text: async () => JSON.stringify(cuerpo) } as unknown as Response);
const comoFetch = (f: unknown) => f as typeof fetch;
type Tipo = 'interpretar' | 'redactar' | 'juzgar' | 'conversar';
const servidor = (contesta: Partial<Record<Tipo, () => Promise<Response>>>) =>
  jest.fn(async (_url: string, init: { body?: string }) => {
    const tipo = JSON.parse(init.body ?? '{}').tipo as Tipo;
    const camino = contesta[tipo];
    if (!camino) throw new TypeError('Network request failed');
    return camino();
  });
const cuerpos = (f: jest.Mock): Array<Record<string, unknown>> =>
  (f.mock.calls as unknown as Array<[string, { body?: string }]>).map(([, init]) =>
    JSON.parse(init.body ?? '{}'),
  );
const cuerpoDe = (f: jest.Mock, tipo: Tipo): Record<string, any> => {
  const encontrado = cuerpos(f).find(c => c.tipo === tipo);
  if (!encontrado) throw new Error(`No se pidió "${tipo}"`);
  return encontrado as Record<string, any>;
};
const clasificacion = (intencion: string, dia = 'ninguno', confianza = 0.95) => ({
  intencion,
  producto: 'ninguno',
  dia,
  confianza,
});

// --- El Worker con OpenRouter simulado --------------------------------------------------------------

const llamarWorker = async (
  cuerpo: unknown,
  texto = 'Vas bien.',
): Promise<{ status: number; modelo: jest.Mock }> => {
  const modelo = jest
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ texto }) } }] })),
    );
  const original = global.fetch;
  global.fetch = modelo as unknown as typeof fetch;
  try {
    const r = await worker.fetch(
      new Request(`${URL_PRUEBA}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      }),
      { OPENROUTER_API_KEY: 'clave-de-prueba' },
    );
    return { status: r.status, modelo };
  } finally {
    global.fetch = original;
  }
};

beforeEach(() => reiniciarEstadoDeRed());

describe('SPEC-17: el chat cuenta cantidades, avisa el ejemplo y escribe las cifras como la app', () => {
  // @spec17_e1 — El resumen suma las porciones de cada mes
  it('spec17_e1 el resumen suma las porciones de cada mes', () => {
    // Given: cierres de tres meses, con sobrantes y un cierre posterior a hoy
    // When: se arma el resumen
    // Then: cada mes trae porciones = preparadas menos sobrantes de todos sus cierres (calculado aparte)
    const resumen = armarResumenNegocio(CTX);
    const porMes = Object.fromEntries(resumen.meses.map(m => [m.mes, m.porciones]));
    expect(porMes).toEqual({
      'agosto 2026': sumaVendidas(CIERRES, '2026-08'),
      'septiembre 2026': sumaVendidas(CIERRES, '2026-09'),
      'octubre 2026': sumaVendidas(CIERRES, '2026-10'),
    });
    expect(porMes['agosto 2026']).toBe(135);
    // El cierre del 20 de octubre (posterior a hoy) no suma.
    expect(porMes['octubre 2026']).toBe(12);
    // Sin cierres no hay meses ni porciones inventadas.
    expect(armarResumenNegocio({ cierres: [], productos: [], hoy: HOY }).meses).toEqual([]);
  });

  // @spec17_e2 — El resumen distingue el mes con más productos del mes con más dinero
  it('spec17_e2 el resumen distingue el mes con mas productos del mes con mas dinero', () => {
    // Given: agosto vende más porciones y septiembre más soles
    // When: se arma el resumen
    // Then: el mes de más porciones no es el de más ventas y ambos números están a la vista
    const { meses } = armarResumenNegocio(CTX);
    const masPorciones = [...meses].sort((a, b) => b.porciones - a.porciones)[0];
    const masVentas = [...meses].sort((a, b) => b.ventas - a.ventas)[0];
    expect(masPorciones.mes).toBe('agosto 2026');
    expect(masVentas.mes).toBe('septiembre 2026');
    expect(masPorciones.ventas).toBe(390);
    expect(masVentas.porciones).toBe(18);
  });

  // @spec17_e3 — El resumen marca el ejemplo por mes y en la raíz
  it('spec17_e3 el resumen marca el ejemplo por mes y en la raiz', () => {
    // Given: agosto con un día de ejemplo y otro propio, septiembre y octubre propios
    const conEjemplo: Cierre[] = CIERRES.map(c => (c.fecha === '2026-08-03' ? comoEjemplo(c) : c));
    // When: se arma el resumen
    const resumen = armarResumenNegocio({ ...CTX, cierres: conEjemplo });
    // Then: solo agosto lleva ejemplo; la raíz lo dice y cuenta el día
    expect(resumen.incluyeEjemplo).toBe(true);
    expect(resumen.diasDeEjemplo).toBe(1);
    const agosto = resumen.meses.find(m => m.mes === 'agosto 2026');
    expect(agosto?.ejemplo).toBe(true);
    for (const m of resumen.meses.filter(x => x.mes !== 'agosto 2026')) {
      expect(m).not.toHaveProperty('ejemplo');
    }
    // Dos cierres de ejemplo el mismo día cuentan un solo día; los posteriores a hoy no cuentan.
    const repetido = [
      ...conEjemplo,
      { ...comoEjemplo(CIERRES[0]), id: 'otro' },
      comoEjemplo(CIERRES[5]),
    ];
    expect(armarResumenNegocio({ ...CTX, cierres: repetido }).diasDeEjemplo).toBe(1);

    // Sin ejemplo: falso, cero y ninguna llave en los meses.
    const propio = armarResumenNegocio(CTX);
    expect(propio.incluyeEjemplo).toBe(false);
    expect(propio.diasDeEjemplo).toBe(0);
    for (const m of propio.meses) expect(m).not.toHaveProperty('ejemplo');
  });

  // @spec17_e4 — El resumen nuevo sigue sin fechas ni datos personales y cabe en el tope
  it('spec17_e4 el resumen nuevo no trae fechas ni datos personales y cabe en el tope', () => {
    // Given: la semilla de ejemplo (75 cierres) y un perfil que el resumen no puede ver
    // When: se arma el resumen
    // Then: forma cerrada, sin fechas ni ids ni datos personales, dentro del tope
    const validada = validarSemilla(JSON.parse(leer('seed', 'semilla.json')));
    if (!validada.ok) throw new Error('La semilla real no valida');
    const ahora = new Date(2026, 9, 14, 12);
    const { cierres, productos } = materializarSemilla(validada.semilla, ahora);
    const perfil = {
      nombre: 'Freddy Quispe',
      negocio: 'Anticuchos El Buen Sabor',
      ubicacion: 'Mercado de Surquillo',
      yapeNumero: '987654321',
      yapeTitular: 'Rosa',
    };
    const resumen = armarResumenNegocio({
      cierres,
      productos,
      hoy: fechaLocal(ahora),
      perfil,
    } as ContextoAnalisis);
    const texto = JSON.stringify(resumen);

    expect(Object.keys(resumen).sort()).toEqual(
      ['ciclo', 'diasDeEjemplo', 'diasDeLaSemana', 'hoy', 'incluyeEjemplo', 'meses', 'productos'],
    );
    expect(resumen.incluyeEjemplo).toBe(true);
    expect(resumen.diasDeEjemplo).toBeGreaterThan(0);
    for (const m of resumen.meses) {
      expect(Object.keys(m).sort()).toEqual(
        [
          'dias',
          'gastos',
          'gastosTexto',
          'mes',
          'porciones',
          'resultado',
          'resultadoTexto',
          'ventas',
          'ventasTexto',
        ]
          .concat(m.enCurso ? ['enCurso'] : [])
          .concat(m.ejemplo ? ['ejemplo'] : [])
          .sort(),
      );
    }
    for (const p of resumen.productos) {
      expect(Object.keys(p).sort()).toEqual(['nombre', 'porciones', 'venta', 'ventaTexto']);
    }
    for (const privado of ['Freddy', 'Quispe', 'Buen Sabor', 'Surquillo', '987654321', 'Rosa', 'Yape']) {
      expect(texto).not.toContain(privado);
    }
    expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    for (const c of cierres) {
      expect(texto).not.toContain(c.id);
      expect(texto).not.toContain(c.fecha);
    }
    expect(texto.length).toBeLessThanOrEqual(MAX_CARACTERES_RESUMEN);
    expect(MAX_CARACTERES_RESUMEN).toBe(2800);
    // Aun con muchos productos y los seis meses, el recorte mantiene el tope.
    const muchos: Cierre[] = [];
    for (let m = 5; m <= 10; m++) {
      const lineas = Array.from({ length: 14 }, (_, k) => linea(`Producto largo número ${k}`, 50 + k, 12.5, 7.25));
      muchos.push(cierreDe(`2026-${String(m).padStart(2, '0')}-0${m % 9 + 1}`, lineas, { origen: 'ejemplo' }));
    }
    const grande = armarResumenNegocio({ cierres: muchos, productos: [], hoy: HOY });
    expect(JSON.stringify(grande).length).toBeLessThanOrEqual(MAX_CARACTERES_RESUMEN);
  });

  // @spec17_e5 — Cada monto trae su texto con el formato de la app
  it('spec17_e5 cada monto trae su texto con el formato de la app', () => {
    // Given: un resumen con meses, productos, días de la semana, ciclo y hoy
    const cierres: Cierre[] = [];
    for (let d = 1; d <= 28; d++) {
      const fecha = `2026-09-${String(d).padStart(2, '0')}`;
      cierres.push(cierreDe(fecha, [linea('Anticucho', 300 + d, 12.35, 8)], { abreCiclo: d === 1 }));
    }
    cierres.push(cierreDe(HOY, [linea('Anticucho', 50, 12.35, 8)]));
    const resumen = armarResumenNegocio({ cierres, productos: [], hoy: HOY });
    // When: se lee cada monto
    // Then: su hermano es formatoSoles del número
    expect(resumen.meses.length).toBeGreaterThan(0);
    for (const m of resumen.meses) {
      expect(m.ventasTexto).toBe(formatoSoles(m.ventas));
      expect(m.gastosTexto).toBe(formatoSoles(m.gastos));
      expect(m.resultadoTexto).toBe(formatoSoles(m.resultado));
    }
    expect(resumen.meses[0].ventasTexto).toMatch(/^S\/ \d{1,3}(,\d{3})*\.\d{2}$/);
    for (const p of resumen.productos) expect(p.ventaTexto).toBe(formatoSoles(p.venta));
    expect(resumen.ciclo).not.toBeNull();
    expect(resumen.ciclo?.ventasTexto).toBe(formatoSoles(resumen.ciclo?.ventas ?? NaN));
    expect(resumen.ciclo?.gastosTexto).toBe(formatoSoles(resumen.ciclo?.gastos ?? NaN));
    expect(resumen.ciclo?.resultadoTexto).toBe(formatoSoles(resumen.ciclo?.resultado ?? NaN));
    expect(resumen.hoy.ventasTexto).toBe(formatoSoles(resumen.hoy.ventas));
    expect(resumen.hoy.gastosTexto).toBe(formatoSoles(resumen.hoy.gastos));
    expect(resumen.hoy.resultadoTexto).toBe(formatoSoles(resumen.hoy.resultado));
    const dias = resumen.diasDeLaSemana;
    if (dias?.mejor) expect(dias.mejor.gananciaPromedioTexto).toBe(formatoSoles(dias.mejor.gananciaPromedio));
    // Las cifras del resumen incluyen el texto formateado ("8726.00" a partir de "S/ 8,726.00").
    const septiembre = resumen.meses.find(m => m.mes === 'septiembre 2026');
    expect(cifrasDelResumen(resumen)).toContain(extraerCifras(septiembre?.ventasTexto ?? '')[0]);
  });

  // @spec17_e6 — El Worker acepta la forma nueva y la vieja, y rechaza la malformada
  it('spec17_e6 el worker acepta la forma nueva y la vieja y rechaza la malformada', async () => {
    // Given: el resumen nuevo (con ejemplo) y el viejo (sin ninguna llave nueva)
    const nuevo = armarResumenNegocio({ ...CTX, cierres: CIERRES.map(comoEjemplo) });
    const viejo = {
      meses: [{ mes: 'octubre 2026', ventas: 120, gastos: 0, resultado: 120, dias: 1 }],
      productos: [{ nombre: 'Anticucho', porciones: 12, venta: 120 }],
      diasDeLaSemana: null,
      ciclo: null,
      hoy: { ventas: 0, gastos: 0, resultado: 0, cerrado: false },
    };
    const conversar = (resumen: unknown) => ({ tipo: 'conversar', texto: 'hola', hilo: [], resumen });

    // Then: los dos válidos dan 200 y el modelo recibe el resumen tal cual
    const a = await llamarWorker(conversar(nuevo));
    expect(a.status).toBe(200);
    expect(a.modelo).toHaveBeenCalledTimes(1);
    const enviado: string = JSON.parse((a.modelo.mock.calls[0][1] as { body: string }).body).messages[1]
      .content;
    expect(enviado).toContain(`Resumen del negocio:\n${JSON.stringify(nuevo)}`);
    expect((await llamarWorker(conversar(viejo))).status).toBe(200);

    // Y los malformados dan 400 sin llamar al modelo.
    const conMes = (cambio: Record<string, unknown>) => ({
      ...nuevo,
      meses: [{ ...nuevo.meses[0], ...cambio }, ...nuevo.meses.slice(1)],
    });
    const malos: unknown[] = [
      conMes({ porciones: -3 }),
      conMes({ porciones: '12' }),
      conMes({ porciones: 1.5 }),
      conMes({ ventasTexto: 'S/20918' }),
      conMes({ ventasTexto: 'ocho mil' }),
      conMes({ ejemplo: false }),
      conMes({ desconocida: 1 }),
      { ...nuevo, incluyeEjemplo: 'si' },
      { ...nuevo, diasDeEjemplo: -1 },
      { ...nuevo, extra: true },
      { ...nuevo, productos: [{ ...nuevo.productos[0], ventaTexto: 'S/ 12' }] },
    ];
    for (const malo of malos) {
      const r = await llamarWorker(conversar(malo));
      expect(r.status).toBe(400);
      expect(r.modelo).not.toHaveBeenCalled();
    }
    // El hecho de redactar: ejemplo solo vale `true`.
    const redactar = (hecho: Record<string, unknown>) => ({
      tipo: 'redactar',
      pregunta: '¿cuánto vendí ayer?',
      hilo: [],
      hecho: { intencion: 'ventaDelDia', frase: 'Ayer vendiste S/ 205.00.', cifras: ['205.00'], ...hecho },
    });
    expect((await llamarWorker(redactar({ ejemplo: true }), 'Ayer vendiste S/ 205.00.')).status).toBe(200);
    expect((await llamarWorker(redactar({}), 'Ayer vendiste S/ 205.00.')).status).toBe(200);
    for (const malo of [false, 'si', 1]) {
      const r = await llamarWorker(redactar({ ejemplo: malo }));
      expect(r.status).toBe(400);
      expect(r.modelo).not.toHaveBeenCalled();
    }
    // El tope del Worker es el de la app (una sola cifra, coherente).
    expect(leer('servidor', 'worker.js')).toContain(`const MAX_RESUMEN = ${MAX_CARACTERES_RESUMEN};`);
  });

  // @spec17_e7 — Los prompts distinguen cantidad de dinero y avisan el ejemplo
  it('spec17_e7 los prompts distinguen cantidad de dinero y avisan el ejemplo', async () => {
    // Given: los prompts del sistema
    // Then: conversar usa porciones para cantidad y ventas para dinero, aclara lo ambiguo, copia los textos
    expect(PROMPT_CONVERSAR).toMatch(/"porciones"/);
    expect(PROMPT_CONVERSAR).toMatch(/cantidad[^\n]*"porciones"|"porciones"[^\n]*cantidad/i);
    expect(PROMPT_CONVERSAR).toMatch(/dinero[^\n]*"ventas"|"ventas"[^\n]*dinero/i);
    expect(PROMPT_CONVERSAR).toMatch(/más productos/);
    expect(PROMPT_CONVERSAR).toMatch(/ambigu|aclara|ambos/i);
    expect(PROMPT_CONVERSAR).toMatch(/ventasTexto/);
    expect(PROMPT_CONVERSAR).toMatch(/tal cual/);
    // y menciona el ejemplo sin afirmar nunca que es real
    expect(PROMPT_CONVERSAR).toMatch(/incluyeEjemplo/);
    expect(PROMPT_CONVERSAR).toMatch(/datos de ejemplo/i);
    expect(PROMPT_CONVERSAR).toMatch(/nunca[^\n]*(reales|real)/i);
    expect(PROMPT_CONVERSAR).toMatch(/¿esto es real\?/);
    // redactar hace lo mismo con el aviso del hecho
    expect(PROMPT_REDACTAR).toMatch(/datos de ejemplo/i);
    expect(PROMPT_REDACTAR).toMatch(/nunca[^\n]*(reales|real)/i);
    expect(PROMPT_REDACTAR).toMatch(/¿esto es real\?/);

    // El usuario del modelo en redactar incluye el aviso solo cuando el hecho es de ejemplo.
    const pedido = async (ejemplo: boolean) => {
      const { modelo } = await llamarWorker(
        {
          tipo: 'redactar',
          pregunta: '¿cuánto vendí ayer?',
          hilo: [],
          hecho: {
            intencion: 'ventaDelDia',
            frase: 'Ayer vendiste S/ 205.00.',
            cifras: ['205.00'],
            ...(ejemplo ? { ejemplo: true } : {}),
          },
        },
        'Ayer vendiste S/ 205.00.',
      );
      return JSON.parse((modelo.mock.calls[0][1] as { body: string }).body).messages[1]
        .content as string;
    };
    expect(await pedido(true)).toMatch(/datos de ejemplo/i);
    expect(await pedido(false)).not.toMatch(/ejemplo/i);
  });

  // @spec17_e8 — Una respuesta calculada sabe si usó cierres de ejemplo
  it('spec17_e8 una respuesta calculada sabe si uso cierres de ejemplo', () => {
    // Given: ayer de ejemplo, el resto de septiembre propio y una semana de ejemplo en agosto
    const ayer = '2026-10-13';
    const cierres: Cierre[] = [
      cierreDe('2026-08-11', [linea('Anticucho', 30, 10, 8)], { origen: 'ejemplo' }),
      cierreDe('2026-09-10', [linea('Anticucho', 20, 10, 8)]),
      cierreDe('2026-09-24', [linea('Pancita', 10, 9, 8)]),
      cierreDe(ayer, [linea('Anticucho', 7, 10, 8.2)], { origen: 'ejemplo' }),
    ];
    const ctx: ContextoAnalisis = { cierres, productos: [], hoy: HOY };
    // When / Then
    const ayerR = responderConsulta({ intencion: 'ventaDelDia', dia: 'ayer', confianza: 1 }, ctx);
    expect(ayerR.ejemplo).toBe(true);
    expect(ayerR.frase).toBe('Ayer, martes 13 de octubre, vendiste S/ 70.00.');
    expect(ayerR.cifras).toEqual(['13', '70.00']);

    // Hoy no cerraste: no usa ningún cierre.
    const hoyR = responderConsulta({ intencion: 'ventaDelDia', dia: 'hoy', confianza: 1 }, ctx);
    expect(hoyR).not.toHaveProperty('ejemplo');

    // El mes pasado (septiembre) es propio, pero se compara con agosto, que tiene un día de ejemplo: marca.
    // "Este mes" (octubre) tiene un día de ejemplo.
    const pasado = responderConsulta({ intencion: 'resumenMesPasado', confianza: 1 }, ctx);
    expect(pasado.ejemplo).toBe(true);
    const agostoPropio = {
      ...ctx,
      cierres: cierres.map(c => (c.fecha === '2026-08-11' ? { ...c, origen: 'propio' as const } : c)),
    };
    expect(
      responderConsulta({ intencion: 'resumenMesPasado', confianza: 1 }, agostoPropio),
    ).not.toHaveProperty('ejemplo');
    const actual = responderConsulta({ intencion: 'resumenMesActual', confianza: 1 }, ctx);
    expect(actual.ejemplo).toBe(true);

    // Un solo cierre de ejemplo entre todos: lo que mira todo el historial lo marca.
    const sinEjemplo = { ...ctx, cierres: cierres.filter(c => c.origen !== 'ejemplo') };
    for (const consulta of [
      { intencion: 'productoQueMasSeVende' as const, confianza: 1 },
      { intencion: 'compararCiclo' as const, confianza: 1 },
    ]) {
      expect(responderConsulta(consulta, sinEjemplo)).not.toHaveProperty('ejemplo');
    }
    // Productos: los últimos 30 días incluyen el cierre de ayer (ejemplo) y el de septiembre.
    expect(
      responderConsulta({ intencion: 'productoQueMasSeVende', confianza: 1 }, ctx).ejemplo,
    ).toBe(true);
    // El cierre de ejemplo de agosto queda fuera de los 30 días: no marca a los productos.
    const soloAgosto: ContextoAnalisis = {
      ...ctx,
      cierres: [cierres[0], cierres[1], cierres[2]],
    };
    expect(
      responderConsulta({ intencion: 'productoQueMasSeVende', confianza: 1 }, soloAgosto),
    ).not.toHaveProperty('ejemplo');
    // Lo que mira todo el historial sí ve el cierre de agosto.
    expect(
      responderConsulta({ intencion: 'compararCiclo', confianza: 1 }, soloAgosto).ejemplo,
    ).toBe(true);
    // Las frases y las cifras no cambiaron por marcar el ejemplo.
    expect(extraerCifras(ayerR.frase)).toEqual(ayerR.cifras);
  });

  // @spec17_e9 — consultar lleva el aviso de ejemplo y se lo cuenta al modelo
  it('spec17_e9 consultar lleva el aviso de ejemplo y se lo cuenta al modelo', async () => {
    const ayer = '2026-10-13';
    const ctxDe = (origen: 'ejemplo' | 'propio'): ContextoAnalisis => ({
      cierres: [cierreDe(ayer, [linea('Anticucho', 7, 10, 8.2), linea('Pancita', 15, 9, 8)], { origen })],
      productos: [],
      hoy: HOY,
    });
    const redacta = async () => respuesta({ texto: 'Ayer, martes 13 de octubre, te entraron S/ 205.00.' });

    // Redactada, con ejemplo: el hecho lo trae y a redactar viaja `ejemplo: true`.
    const f = servidor({
      interpretar: async () => respuesta(clasificacion('ventaDelDia', 'ayer')),
      redactar: redacta,
    });
    const r = await consultar(comoFetch(f), URL_PRUEBA, '¿cuánto vendí ayer?', ctxDe('ejemplo'));
    expect(r).toMatchObject({ tipo: 'respuesta', redactada: true });
    expect(r.tipo === 'respuesta' && r.hecho.ejemplo).toBe(true);
    expect(cuerpoDe(f, 'redactar').hecho).toEqual({
      intencion: 'ventaDelDia',
      frase: 'Ayer, martes 13 de octubre, vendiste S/ 205.00.',
      cifras: ['13', '205.00'],
      ejemplo: true,
    });

    // Con cierres propios la llave no existe ni en la respuesta ni en lo que viaja.
    const g = servidor({
      interpretar: async () => respuesta(clasificacion('ventaDelDia', 'ayer')),
      redactar: redacta,
    });
    const propia = await consultar(comoFetch(g), URL_PRUEBA, '¿cuánto vendí ayer?', ctxDe('propio'));
    expect(propia.tipo === 'respuesta' && propia.hecho).not.toHaveProperty('ejemplo');
    expect(Object.keys(cuerpoDe(g, 'redactar').hecho).sort()).toEqual(['cifras', 'frase', 'intencion']);

    // Conversación: el resumen dice incluyeEjemplo y la respuesta lleva el aviso; "hola" no.
    const conversa = servidor({
      interpretar: async () => respuesta(clasificacion('noEntendi', 'ninguno', 0.9)),
      conversar: async () => respuesta({ texto: 'Vas bien este mes.' }),
    });
    const c = await consultar(comoFetch(conversa), URL_PRUEBA, '¿qué opinas de mi mes?', ctxDe('ejemplo'));
    expect(c).toEqual({ tipo: 'conversacion', texto: 'Vas bien este mes.', ejemplo: true });
    expect(cuerpoDe(conversa, 'conversar').resumen.incluyeEjemplo).toBe(true);
    const saludo = await consultar(comoFetch(conversa), URL_PRUEBA, 'hola', ctxDe('ejemplo'));
    expect(saludo).toEqual({ tipo: 'conversacion', texto: 'Vas bien este mes.' });
    const propiaC = await consultar(comoFetch(conversa), URL_PRUEBA, '¿qué opinas de mi mes?', ctxDe('propio'));
    expect(propiaC).toEqual({ tipo: 'conversacion', texto: 'Vas bien este mes.' });

    // Sin internet: la frase fija conserva sinInternet y el aviso.
    const caida = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    const sin = await consultar(comoFetch(caida), URL_PRUEBA, '¿cuánto vendí ayer?', ctxDe('ejemplo'));
    expect(sin).toMatchObject({ tipo: 'respuesta', sinInternet: true, redactada: false });
    expect(sin.tipo === 'respuesta' && sin.hecho.ejemplo).toBe(true);
  });

  // @spec17_e10 — validarConversacion acepta el formato de la app y sigue rechazando lo inventado
  it('spec17_e10 validar conversacion acepta el formato de la app y rechaza lo inventado', () => {
    // Given: un resumen con ventasTexto "S/ 8,726.00"
    const cierres = [cierreDe('2026-09-10', [linea('Anticucho', 872, 10, 8), linea('Chicha', 3, 2, 1)])];
    const resumen = armarResumenNegocio({ cierres, productos: [], hoy: HOY });
    expect(resumen.meses[0].ventasTexto).toBe('S/ 8,726.00');
    const permitidas = cifrasDelResumen(resumen);
    // When / Then
    expect(validarConversacion('En septiembre vendiste S/ 8,726.00.', permitidas)).toEqual({
      ok: true,
      texto: 'En septiembre vendiste S/ 8,726.00.',
    });
    // La forma sin formato también se acepta (mismo número) y sale con el formato de la app.
    expect(validarConversacion('En septiembre vendiste S/8726.', permitidas)).toEqual({
      ok: true,
      texto: 'En septiembre vendiste S/ 8,726.00.',
    });
    expect(validarConversacion('En septiembre vendiste S/ 8,727.00.', permitidas)).toEqual({
      ok: false,
      motivo: 'CIFRA_NUEVA',
    });
    // La forma vieja del resumen (sin textos) se sigue validando con sus números.
    expect(validarConversacion('Vendiste S/ 8726.', ['8726.00'])).toMatchObject({ ok: true });
    expect(validarConversacion('Vendiste S/ 8727.', ['8726.00'])).toEqual({
      ok: false,
      motivo: 'CIFRA_NUEVA',
    });

    // normalizarMontos: solo reescribe montos en soles; no toca años, porcentajes, días ni "mil".
    expect(normalizarMontos('Vendiste S/20918 y gastaste S/ 1500.5.')).toBe(
      'Vendiste S/ 20,918.00 y gastaste S/ 1,500.50.',
    );
    expect(normalizarMontos('Fue S/ 8,726.00 en septiembre 2026, el 15 de octubre, un 12 %.')).toBe(
      'Fue S/ 8,726.00 en septiembre 2026, el 15 de octubre, un 12 %.',
    );
    expect(normalizarMontos('Vendiste S/ 20 mil.')).toBe('Vendiste S/ 20 mil.');
    expect(normalizarMontos('Perdiste -S/ 30 ese día.')).toBe('Perdiste -S/ 30.00 ese día.');
    expect(normalizarMontos('Sin montos.')).toBe('Sin montos.');
  });

  // @spec17_e14 — Lo viejo sigue funcionando
  it('spec17_e14 lo viejo sigue funcionando', async () => {
    const ctx: ContextoAnalisis = {
      cierres: [
        cierreDe('2026-10-13', [linea('Anticucho', 7, 10, 8.2), linea('Pancita', 15, 9, 8)], {
          origen: 'ejemplo',
        }),
      ],
      productos: [],
      hoy: HOY,
    };
    // Semáforo: se pide y se muestra igual, sin ejemplo en lo que viaja (solo señales de una palabra).
    const porCobrar: ContextoAnalisis = {
      ...ctx,
      cierres: [
        cierreDe('2026-10-10', [linea('Anticucho', 5, 10, 8)], {
          origen: 'ejemplo',
          yapePendiente: true,
          montoYape: 50,
        }),
      ],
    };
    const f = servidor({
      interpretar: async () => respuesta(clasificacion('cuantoPorCobrar')),
      juzgar: async () => respuesta({ semaforo: 'ojo', confianza: 0.9 }),
    });
    const conJuicio = await consultar(comoFetch(f), URL_PRUEBA, '¿cuánto me deben?', porCobrar);
    expect(conJuicio).toMatchObject({ tipo: 'respuesta', semaforo: 'ojo' });
    expect(JSON.stringify(cuerpoDe(f, 'juzgar'))).not.toMatch(/ejemplo/);
    expect(JSON.stringify(cuerpos(f))).not.toContain('50');

    // A interpretar solo viaja la pregunta.
    const g = servidor({
      interpretar: async () => respuesta(clasificacion('ventaDelDia', 'ayer')),
      redactar: async () => respuesta({ texto: 'Ayer vendiste S/ 205.00.' }),
    });
    await consultar(comoFetch(g), URL_PRUEBA, '¿cuánto vendí ayer?', ctx);
    expect(cuerpoDe(g, 'interpretar')).toEqual({ tipo: 'interpretar', texto: '¿cuánto vendí ayer?' });

    // El hilo sigue siendo de a lo más cuatro intervenciones.
    const hilo = Array.from({ length: 6 }, (_, i) => ({
      rol: i % 2 === 0 ? ('freddy' as const) : ('asistente' as const),
      texto: `mensaje ${i}`,
    }));
    const h = servidor({
      interpretar: async () => respuesta(clasificacion('noEntendi', 'ninguno', 0.9)),
      conversar: async () => respuesta({ texto: 'Sigue así.' }),
    });
    await consultar(comoFetch(h), URL_PRUEBA, '¿y entonces?', ctx, null, hilo);
    expect(cuerpoDe(h, 'conversar').hilo).toHaveLength(4);
  });

  // @spec17_e15 — Reglas del proyecto y scripts
  it('spec17_e15 reglas del proyecto y scripts aceptan el sprint 17', () => {
    const e2e = leer('scripts', 'e2e.sh');
    expect(e2e).toMatch(/\| 16 \| 17\)/);
    expect(e2e).toContain('<01..17>');
    // El worker no importa nada nuevo.
    expect(leer('servidor', 'worker.js')).not.toMatch(/^import /m);
    // Sin console. ni fetch( fuera de seed.ts y jev.ts.
    const lineasDeSrc = archivosDe(join(RAIZ, 'src')).flatMap(ruta =>
      readFileSync(ruta, 'utf8')
        .split('\n')
        .map(texto => ({ ruta, texto })),
    );
    expect(lineasDeSrc.filter(l => l.texto.includes('console.'))).toEqual([]);
    expect(
      lineasDeSrc.filter(l => l.texto.includes('fetch(') && !/seed\.ts|jev\.ts/.test(l.ruta)),
    ).toEqual([]);
  });
});
