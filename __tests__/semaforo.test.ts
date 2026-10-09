/**
 * Pruebas de apoyo del semáforo de Jev (no son escenarios del SPEC; e15 y e16 viven en
 * `sdd/sprint-08.test.ts`): los bordes de cada vocabulario de señales, qué intenciones se juzgan,
 * que con datos insuficientes no hay señales, la lectura del juicio y que nada muta.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { fechaLocal } from '@dominio/fecha';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type {
  Cierre,
  Consulta,
  ContextoAnalisis,
  FechaNegocio,
  Gasto,
  Hecho,
  IntencionId,
  LineaCierre,
  Producto,
} from '@dominio/tipos';
import { INTENCIONES, responderConsulta, UMBRAL_CONFIANZA } from '@analisis/intenciones';
import {
  armarHechoParaJuicio,
  CAIDA_FUERTE_SOLES,
  CIERRES_DIA_SUFICIENTES,
  DIAS_COBRO_RECIENTE,
  ETIQUETA_SEMAFORO,
  esJuzgable,
  INTENCIONES_JUZGABLES,
  interpretarJuicio,
  PCT_BRECHA_MEDIA,
  PCT_BRECHA_PEQUENA,
  PCT_CAIDA_FUERTE,
  PCT_HOLGURA_MEDIA,
  PCT_HOLGURA_POCA,
  PCT_MAGNITUD_MEDIA,
  PCT_MAGNITUD_PEQUENA,
  PCT_SOBRA_POCO,
  senalesDeJuicio,
  SIMBOLO_SEMAFORO,
} from '@analisis/semaforo';
import { CAIDA_PRECIO_SOLES, DIAS_COBRO_VENCIDO, UMBRAL_COBRO_SOLES } from '@analisis/reglas';

const ahora = new Date('2026-10-07T12:00:00-05:00');
const HOY: FechaNegocio = '2026-10-07';

const linea = (
  nombre: string,
  preparadas: number,
  sobrantes: number,
  precioUnitario: number,
  costoUnitario: number,
): LineaCierre => ({
  productoId: `p-${nombre.toLowerCase()}`,
  nombre,
  preparadas,
  sobrantes,
  precioUnitario,
  costoUnitario,
});

interface Opciones {
  lineas?: LineaCierre[];
  gastos?: Gasto[];
  abreCiclo?: boolean;
  montoYape?: number;
  yapePendiente?: boolean;
  cobradoEn?: FechaNegocio;
}

const cierreDe = (fecha: FechaNegocio, o: Opciones = {}): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: o.lineas ?? [],
  montoYape: o.montoYape ?? 0,
  yapePendiente: o.yapePendiente ?? false,
  cobradoEn: o.cobradoEn,
  gastos: o.gastos ?? [],
  abreCiclo: o.abreCiclo ?? false,
  creadoEn: ahora.toISOString(),
  actualizadoEn: ahora.toISOString(),
});

const producto = (
  nombre: string,
  precioVenta: number,
  costoUnitario: number,
  extra: Partial<Producto> = {},
): Producto => ({
  id: `p-${nombre.toLowerCase()}`,
  nombre,
  unidad: 'porcion',
  precioVenta,
  costoUnitario,
  actualizadoEn: '2026-09-01',
  activo: true,
  ...extra,
});

const ctxDe = (
  cierres: Cierre[],
  productos: Producto[] = [],
  hoy: FechaNegocio = HOY,
): ContextoAnalisis => ({ cierres, productos, hoy });

const consultaDe = (intencion: IntencionId, productoId?: string): Consulta => ({
  intencion,
  confianza: 0.9,
  ...(productoId ? { producto: productoId } : {}),
});

const congelar = <T>(valor: T): T => {
  if (valor && typeof valor === 'object') {
    Object.values(valor as object).forEach(congelar);
    Object.freeze(valor);
  }
  return valor;
};

// --- Armadores de datos con resultado conocido -------------------------------------------------

/** Un ciclo de un día: venta 300 (30 porciones a S/ 10) y los gastos que se pidan. */
const cicloDe = (fecha: FechaNegocio, gasto: number, venta = 300): Cierre =>
  cierreDe(fecha, {
    abreCiclo: true,
    lineas: [linea('Anticucho', venta / 10, 0, 10, 8)],
    gastos: [{ categoria: 'mercaderia', monto: gasto }],
  });

/** Dos ciclos: el anterior deja S/ 100 ("te queda") y el actual deja `teQueda`. */
const cambioDeCiclo = (teQueda: number): ContextoAnalisis =>
  ctxDe([cicloDe('2026-09-14', 200), cicloDe('2026-09-28', 300 - teQueda)]);

const dia = (fecha: FechaNegocio, ganancia: number): Cierre =>
  cierreDe(fecha, { lineas: [linea('Anticucho', ganancia, 0, 1, 0)] });

// 5 semanas de miércoles a sábado: 5 cierres de cada día.
const SEMANAS = [
  ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
  ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'],
  ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'],
  ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'],
  ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'],
];
/** El miércoles gana `miercoles` y los otros tres días `resto`: general = (miércoles + 3 × resto) / 4. */
const semanas = (miercoles: number, resto: number): ContextoAnalisis =>
  ctxDe(
    SEMANAS.flatMap((fechas, s) =>
      fechas.map((f, i) => ({
        ...dia(f, i === 0 ? miercoles : resto),
        abreCiclo: (s === 0 && i === 0) || (s === 3 && i === 0),
      })),
    ),
  );

const pendiente = (fecha: FechaNegocio, monto: number, o: Opciones = {}): Cierre =>
  cierreDe(fecha, {
    lineas: [linea('Anticucho', 20, 0, 10, 8)],
    montoYape: monto,
    yapePendiente: true,
    ...o,
  });

/** Un ciclo cerrado con gastos de S/ 300 y la venta pedida, y después el ciclo actual. */
const cierreDeCiclo = (venta: number): ContextoAnalisis =>
  ctxDe([
    cierreDe('2026-09-20', {
      abreCiclo: true,
      lineas: [linea('Anticucho', venta / 10, 0, 10, 8)],
      gastos: [{ categoria: 'mercaderia', monto: 300 }],
    }),
    cierreDe('2026-10-01', { abreCiclo: true, lineas: [linea('Anticucho', 10, 0, 10, 8)] }),
  ]);

/** Rachi en dos ciclos de 100 porciones: sobraron `antes` y `ahora`. */
const rachiEnDosCiclos = (antes: number, ahora_: number): ContextoAnalisis =>
  ctxDe([
    cierreDe('2026-09-14', { abreCiclo: true, lineas: [linea('Rachi', 100, antes, 9, 7.6)] }),
    cierreDe('2026-09-28', { abreCiclo: true, lineas: [linea('Rachi', 100, ahora_, 9, 7.6)] }),
  ]);

/** El anticucho se vendía a S/ 10 con costo `costoAntes` el 2026-07-09 (90 días); hoy cuesta `costoHoy`. */
const precioCambiado = (
  costoAntes: number,
  costoHoy: number,
  extra: Partial<Producto> = {},
): ContextoAnalisis =>
  ctxDe(
    [cierreDe('2026-07-09', { lineas: [linea('Anticucho', 20, 0, 10, costoAntes)] })],
    [producto('Anticucho', 10, costoHoy, extra)],
  );

const senales = (c: Consulta, ctx: ContextoAnalisis) => senalesDeJuicio(c, ctx);

describe('el semáforo', () => {
  it('cada color dice su palabra y tiene su clave de símbolo, distinta', () => {
    expect(ETIQUETA_SEMAFORO).toEqual({ bien: 'Bien', ojo: 'Ojo', urgente: 'Urgente' });
    expect(Object.keys(SIMBOLO_SEMAFORO).sort()).toEqual(['bien', 'ojo', 'urgente']);
    expect(new Set(Object.values(SIMBOLO_SEMAFORO)).size).toBe(3);
    expect(SIMBOLO_SEMAFORO).toEqual({ bien: 'check', ojo: 'alerta', urgente: 'sirena' });
  });

  it('las palabras no usan jerga', () => {
    for (const palabra of Object.values(ETIQUETA_SEMAFORO)) {
      expect(palabra).not.toMatch(/\b(Jev|IA|alerta|riesgo|KPI)\b/i);
    }
  });
});

describe('esJuzgable', () => {
  const JUZGABLES: IntencionId[] = [
    'compararCiclo',
    'cuantoPorCobrar',
    'cuantoSacarParaLaCasa',
    'cuantoPreparar',
    'revisarPrecio',
    'peorDia',
  ];

  it('las doce intenciones: seis se juzgan y seis no', () => {
    expect(INTENCIONES).toHaveLength(12);
    for (const i of INTENCIONES) {
      expect([i.id, esJuzgable(i.id)]).toEqual([i.id, JUZGABLES.includes(i.id)]);
    }
    expect(INTENCIONES.filter(i => esJuzgable(i.id))).toHaveLength(6);
  });

  it('la lista de intenciones juzgables es exactamente esa', () => {
    expect([...INTENCIONES_JUZGABLES].sort()).toEqual([...JUZGABLES].sort());
  });

  it('las que no se juzgan no tienen señales aunque haya datos', () => {
    const ctx = semanas(4, 10);
    for (const id of [
      'ventaDelDia',
      'mejorDia',
      'productoQueMasDeja',
      'productoQueMasSeVende',
      'cuandoRecupereCapital',
      'noEntendi',
    ] as const) {
      expect(senales(consultaDe(id), ctx)).toBeNull();
    }
  });
});

describe('señales sin datos suficientes: null', () => {
  const vacio = ctxDe([]);

  it('sin ningún día cerrado, ninguna intención juzgable tiene señales', () => {
    for (const id of INTENCIONES_JUZGABLES) {
      expect(senales(consultaDe(id, 'p-rachi'), vacio)).toBeNull();
    }
  });

  it('compararCiclo: con un solo ciclo', () => {
    expect(senales(consultaDe('compararCiclo'), ctxDe([cicloDe('2026-09-28', 200)]))).toBeNull();
  });

  it('cuantoSacarParaLaCasa y cuantoPreparar: con menos de dos ciclos', () => {
    const uno = ctxDe([cicloDe('2026-09-28', 200)]);
    expect(senales(consultaDe('cuantoSacarParaLaCasa'), uno)).toBeNull();
    expect(senales(consultaDe('cuantoPreparar', 'p-anticucho'), uno)).toBeNull();
  });

  it('cuantoPorCobrar: nada por cobrar, o ya cobrado', () => {
    expect(senales(consultaDe('cuantoPorCobrar'), ctxDe([cicloDe('2026-09-28', 200)]))).toBeNull();
    const cobrado = pendiente('2026-10-01', 80, { cobradoEn: '2026-10-03' });
    expect(senales(consultaDe('cuantoPorCobrar'), ctxDe([cobrado]))).toBeNull();
  });

  it('peorDia: pocos días, o ningún día por debajo del promedio', () => {
    expect(senales(consultaDe('peorDia'), ctxDe(semanas(4, 10).cierres.slice(0, 12)))).toBeNull();
    expect(senales(consultaDe('peorDia'), semanas(10, 10))).toBeNull();
  });

  it('cuantoPreparar y revisarPrecio: sin producto o con uno que la app no tiene', () => {
    const dos = rachiEnDosCiclos(5, 5);
    expect(senales(consultaDe('cuantoPreparar'), dos)).toBeNull();
    expect(senales(consultaDe('revisarPrecio'), precioCambiado(8.2, 8.8))).toBeNull();
    expect(senales(consultaDe('revisarPrecio', 'p-rachi'), precioCambiado(8.2, 8.8))).toBeNull();
    expect(
      senales(
        consultaDe('revisarPrecio', 'p-anticucho'),
        precioCambiado(8.2, 8.8, { activo: false }),
      ),
    ).toBeNull();
  });
});

describe('compararCiclo: tendencia y magnitud', () => {
  it('los umbrales tienen nombre', () => {
    expect([PCT_MAGNITUD_PEQUENA, PCT_MAGNITUD_MEDIA]).toEqual([5, 20]);
  });

  it.each([
    [105, 'sube', 'pequena'], // +5 %: el borde es pequeña
    [106, 'sube', 'media'], // +6 %
    [120, 'sube', 'media'], // +20 %: el borde es media
    [121, 'sube', 'grande'], // +21 %
    [200, 'sube', 'grande'],
    [95, 'baja', 'pequena'], // −5 %
    [94, 'baja', 'media'],
    [80, 'baja', 'media'], // −20 %
    [79, 'baja', 'grande'],
    [100, 'igual', 'pequena'],
  ])('el te queda pasa de 100 a %s: %s, %s', (teQueda, tendencia, magnitud) => {
    expect(senales(consultaDe('compararCiclo'), cambioDeCiclo(teQueda))).toEqual({
      tendencia,
      magnitud,
    });
  });

  it('191 contra 269 (−29 %) es baja y grande', () => {
    const ctx = ctxDe([cicloDe('2026-09-14', 31, 300), cicloDe('2026-09-28', 109, 300)]);
    expect(senales(consultaDe('compararCiclo'), ctx)).toEqual({
      tendencia: 'baja',
      magnitud: 'grande',
    });
  });

  it('desde un ciclo que dejó 0, cualquier cambio es grande', () => {
    const desdeCero = (gasto: number) =>
      ctxDe([cicloDe('2026-09-14', 300), cicloDe('2026-09-28', gasto)]);
    expect(senales(consultaDe('compararCiclo'), desdeCero(299))).toEqual({
      tendencia: 'sube',
      magnitud: 'grande',
    });
    expect(senales(consultaDe('compararCiclo'), desdeCero(301))).toEqual({
      tendencia: 'baja',
      magnitud: 'grande',
    });
    expect(senales(consultaDe('compararCiclo'), desdeCero(300))).toEqual({
      tendencia: 'igual',
      magnitud: 'pequena',
    });
  });

  it('desde un ciclo en pérdida el porcentaje es contra el valor absoluto', () => {
    // Anterior −100 (gasto 400), actual 0: sube 100 %
    const ctx = ctxDe([cicloDe('2026-09-14', 400), cicloDe('2026-09-28', 300)]);
    expect(senales(consultaDe('compararCiclo'), ctx)).toEqual({
      tendencia: 'sube',
      magnitud: 'grande',
    });
  });

  it('coincide con la frase: "menos" es baja, "más" es sube, "igual" es igual', () => {
    for (const [teQueda, palabra, tendencia] of [
      [150, 'más', 'sube'],
      [50, 'menos', 'baja'],
      [100, 'igual', 'igual'],
    ] as const) {
      const ctx = cambioDeCiclo(teQueda);
      expect(responderConsulta(consultaDe('compararCiclo'), ctx).frase).toContain(palabra);
      expect(senales(consultaDe('compararCiclo'), ctx)?.tendencia).toBe(tendencia);
    }
  });
});

describe('peorDia: brecha y datos', () => {
  it('los umbrales tienen nombre', () => {
    expect([PCT_BRECHA_PEQUENA, PCT_BRECHA_MEDIA, CIERRES_DIA_SUFICIENTES]).toEqual([10, 25, 4]);
  });

  it.each([
    // miércoles, resto → brecha = (resto − miércoles) × 3/4 sobre el promedio general
    [270, 310, 'pequena'], // justo 10 %
    [269, 310, 'media'], // 10.26 %
    [90, 130, 'media'], // justo 25 %
    [89, 130, 'grande'], // 25.68 %
    [0, 100, 'grande'],
  ])('el miércoles gana %s y los demás %s: brecha %s', (miercoles, resto, brecha) => {
    expect(senales(consultaDe('peorDia'), semanas(miercoles, resto))).toEqual({
      brecha,
      datos: 'suficientes',
    });
  });

  it('con 2 o 3 cierres de ese día los datos son pocos; con 4, suficientes', () => {
    // El miércoles solo tiene `n` cierres; el jueves tiene 5 y 28 días separan al primero del último.
    const conMiercoles = (n: number) =>
      ctxDe([
        ...['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-30'].slice(0, n).map(f => dia(f, 4)),
        ...['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24', '2026-10-01'].map(f =>
          dia(f, 10),
        ),
        dia('2026-09-04', 10),
      ]);
    expect(senales(consultaDe('peorDia'), conMiercoles(2))?.datos).toBe('pocos');
    expect(senales(consultaDe('peorDia'), conMiercoles(3))?.datos).toBe('pocos');
    expect(senales(consultaDe('peorDia'), conMiercoles(4))?.datos).toBe('suficientes');
  });
});

describe('cuantoPorCobrar: plazo y monto', () => {
  it('los umbrales tienen nombre y son los de la regla de cobro', () => {
    expect([DIAS_COBRO_RECIENTE, DIAS_COBRO_VENCIDO, UMBRAL_COBRO_SOLES]).toEqual([3, 7, 100]);
  });

  it.each([
    ['2026-10-07', 'reciente'], // hoy
    ['2026-10-04', 'reciente'], // 3 días
    ['2026-10-03', 'normal'], // 4 días
    ['2026-09-30', 'normal'], // 7 días
    ['2026-09-29', 'vencido'], // 8 días
  ])('el pago más antiguo es del %s: %s', (desde, plazo) => {
    expect(senales(consultaDe('cuantoPorCobrar'), ctxDe([pendiente(desde, 50)]))).toMatchObject({
      plazo,
    });
  });

  it('S/ 100.00 es bajo; S/ 100.01 es alto', () => {
    expect(senales(consultaDe('cuantoPorCobrar'), ctxDe([pendiente('2026-10-06', 100)]))).toEqual({
      plazo: 'reciente',
      monto: 'bajo',
    });
    expect(
      senales(consultaDe('cuantoPorCobrar'), ctxDe([pendiente('2026-10-06', 100.01)])),
    ).toEqual({
      plazo: 'reciente',
      monto: 'alto',
    });
  });

  it('suma lo pendiente y mira el pago más antiguo (escenario 4)', () => {
    const ctx = ctxDe([pendiente('2026-09-29', 70), pendiente('2026-10-02', 50)]);
    expect(senales(consultaDe('cuantoPorCobrar'), ctx)).toEqual({
      plazo: 'vencido',
      monto: 'alto',
    });
  });
});

describe('cuantoSacarParaLaCasa: resultado y holgura', () => {
  it('los umbrales tienen nombre', () => {
    expect([PCT_HOLGURA_POCA, PCT_HOLGURA_MEDIA]).toEqual([10, 30]);
  });

  it.each([
    [330, 'ganancia', 'poca'], // gana 30 sobre un capital de 300: justo 10 %
    [340, 'ganancia', 'media'], // 13 %
    [390, 'ganancia', 'media'], // justo 30 %
    [400, 'ganancia', 'mucha'], // 33 %
    [300, 'justo', 'poca'],
    [200, 'perdida', 'poca'],
  ])('el ciclo vendió %s sobre un capital de 300: %s, %s', (venta, resultado, holgura) => {
    expect(senales(consultaDe('cuantoSacarParaLaCasa'), cierreDeCiclo(venta))).toEqual({
      resultado,
      holgura,
    });
  });

  it('un ciclo sin gastos que vendió es ganancia con mucha holgura', () => {
    const ctx = ctxDe([
      cierreDe('2026-09-20', { abreCiclo: true, lineas: [linea('Anticucho', 10, 0, 10, 8)] }),
      cierreDe('2026-10-01', { abreCiclo: true }),
    ]);
    expect(senales(consultaDe('cuantoSacarParaLaCasa'), ctx)).toEqual({
      resultado: 'ganancia',
      holgura: 'mucha',
    });
  });

  it('un ciclo sin venta ni gastos queda justo', () => {
    const ctx = ctxDe([
      cierreDe('2026-09-20', { abreCiclo: true }),
      cierreDe('2026-10-01', { abreCiclo: true }),
    ]);
    expect(senales(consultaDe('cuantoSacarParaLaCasa'), ctx)).toEqual({
      resultado: 'justo',
      holgura: 'poca',
    });
  });
});

describe('cuantoPreparar: sobra y repite', () => {
  it('los umbrales tienen nombre', () => {
    expect(PCT_SOBRA_POCO).toBe(10);
  });

  it.each([
    [10, 10, 'poco', 'si'], // 10 % en cada ciclo: el borde es poco
    [11, 11, 'mucho', 'si'],
    [2, 2, 'poco', 'no'], // sobró en los dos, pero menos de 3 porciones
    [3, 3, 'poco', 'si'],
    [20, 3, 'poco', 'si'], // manda el ciclo en que menos sobró
    [50, 12, 'mucho', 'si'],
    [0, 40, 'nada', 'no'],
    [40, 0, 'nada', 'no'],
    [0, 0, 'nada', 'no'],
  ])('sobraron %s y %s de 100: sobra %s, repite %s', (antes, ahora_, sobra, repite) => {
    expect(
      senales(consultaDe('cuantoPreparar', 'p-rachi'), rachiEnDosCiclos(antes, ahora_)),
    ).toEqual({
      sobra,
      repite,
    });
  });

  it('un producto que no se preparó en esos ciclos no sobra', () => {
    expect(senales(consultaDe('cuantoPreparar', 'p-pancita'), rachiEnDosCiclos(10, 10))).toEqual({
      sobra: 'nada',
      repite: 'no',
    });
  });
});

describe('revisarPrecio: caída y plazo', () => {
  it('los umbrales tienen nombre', () => {
    expect([CAIDA_PRECIO_SOLES, CAIDA_FUERTE_SOLES, PCT_CAIDA_FUERTE]).toEqual([0.3, 1, 30]);
  });

  it.each([
    [8.2, 8.2, 'ninguna'],
    [8.2, 8.4, 'ninguna'], // cae S/ 0.20: menos que el umbral de la regla
    [8.2, 8.5, 'leve'], // cae S/ 0.30 (16 %): el borde de la regla
    [8, 8.5, 'leve'], // cae S/ 0.50 (25 %)
    [8, 8.59, 'leve'], // 29.5 %
    [8, 8.6, 'fuerte'], // cae S/ 0.60: justo 30 % del margen anterior
    [4, 4.9, 'leve'], // cae S/ 0.90 pero es 15 % del margen
    [4, 5, 'fuerte'], // cae S/ 1.00: el borde en soles
    [8.2, 7.9, 'ninguna'], // hoy deja más que antes
  ])('el costo pasa de %s a %s: caída %s', (antes, hoy, caida) => {
    expect(
      senales(consultaDe('revisarPrecio', 'p-anticucho'), precioCambiado(antes, hoy)),
    ).toMatchObject({ caida });
  });

  it('el plazo mira cuánto hace que no cambia el precio: hasta 90 días o más', () => {
    const conFecha = (actualizadoEn: string) =>
      senales(
        consultaDe('revisarPrecio', 'p-anticucho'),
        precioCambiado(8.2, 8.8, { actualizadoEn }),
      );
    expect(conFecha('2026-07-09')).toEqual({ caida: 'fuerte', plazo: '90dias' }); // 90 días
    expect(conFecha('2026-07-08')).toEqual({ caida: 'fuerte', plazo: 'mas' }); // 91 días
    expect(conFecha('2026-10-01')).toMatchObject({ plazo: '90dias' });
  });

  it('juzga solo el producto preguntado', () => {
    const ctx = ctxDe(
      [
        cierreDe('2026-07-09', {
          lineas: [linea('Anticucho', 20, 0, 10, 8.2), linea('Pancita', 20, 0, 9, 6)],
        }),
      ],
      [producto('Anticucho', 10, 8.2), producto('Pancita', 9, 8)],
    );
    expect(senales(consultaDe('revisarPrecio', 'p-anticucho'), ctx)).toMatchObject({
      caida: 'ninguna',
    });
    expect(senales(consultaDe('revisarPrecio', 'p-pancita'), ctx)).toMatchObject({
      caida: 'fuerte',
    });
  });

  it('coincide con la frase: si la frase dice "menos que en", hay caída', () => {
    for (const costoHoy of [8.2, 8.5, 8.8]) {
      const ctx = precioCambiado(8.2, costoHoy);
      const frase = responderConsulta(consultaDe('revisarPrecio', 'p-anticucho'), ctx).frase;
      const caida = senales(consultaDe('revisarPrecio', 'p-anticucho'), ctx)?.caida;
      expect(frase.includes('bajó')).toBe(caida !== 'ninguna');
    }
  });
});

describe('armarHechoParaJuicio', () => {
  const hecho: Hecho = {
    intencion: 'compararCiclo',
    frase: 'Ganaste S/ 78.00 menos que el ciclo pasado.',
    cifras: ['78.00'],
  };

  it('es exactamente la intención, la frase, las cifras y las señales', () => {
    expect(armarHechoParaJuicio(hecho, { tendencia: 'baja', magnitud: 'grande' })).toEqual({
      intencion: 'compararCiclo',
      frase: 'Ganaste S/ 78.00 menos que el ciclo pasado.',
      cifras: ['78.00'],
      senales: { tendencia: 'baja', magnitud: 'grande' },
    });
  });

  it('no deja pasar ninguna otra llave que traiga el hecho', () => {
    const colado = {
      ...hecho,
      perfil: { nombre: 'Freddy' },
      yapeNumero: '987654321',
      cierres: [{ id: 'c1' }],
    };
    const cuerpo = armarHechoParaJuicio(colado as Hecho, { tendencia: 'baja', magnitud: 'grande' });
    expect(Object.keys(cuerpo).sort()).toEqual(['cifras', 'frase', 'intencion', 'senales']);
    expect(JSON.stringify(cuerpo)).not.toMatch(/Freddy|987654321|c1/);
  });

  it('copia: cambiar el resultado no cambia el hecho ni las señales', () => {
    const origen = { tendencia: 'baja', magnitud: 'grande' };
    const cuerpo = armarHechoParaJuicio(hecho, origen);
    cuerpo.cifras.push('999');
    cuerpo.senales.tendencia = 'sube';
    expect(hecho.cifras).toEqual(['78.00']);
    expect(origen.tendencia).toBe('baja');
  });

  it('con todo congelado no lanza', () => {
    expect(() =>
      armarHechoParaJuicio(
        congelar({ ...hecho, cifras: ['78.00'] }),
        congelar({ tendencia: 'baja' }),
      ),
    ).not.toThrow();
  });
});

describe('interpretarJuicio', () => {
  it.each(['bien', 'ojo', 'urgente'])('lee "%s"', semaforo => {
    expect(interpretarJuicio({ semaforo, confianza: 0.8 })).toEqual({ semaforo, confianza: 0.8 });
  });

  it('la confianza mínima es la misma del clasificador: 0.6', () => {
    expect(UMBRAL_CONFIANZA).toBe(0.6);
    expect(interpretarJuicio({ semaforo: 'ojo', confianza: 0.6 })).toEqual({
      semaforo: 'ojo',
      confianza: 0.6,
    });
    expect(interpretarJuicio({ semaforo: 'ojo', confianza: 1 })?.confianza).toBe(1);
  });

  it('con poca confianza no hay juicio: 0.59 y 0.3 y 0', () => {
    for (const confianza of [0.59, 0.3, 0]) {
      expect(interpretarJuicio({ semaforo: 'urgente', confianza })).toBeNull();
    }
  });

  it('un semáforo que no es uno de los tres: null', () => {
    for (const semaforo of [
      'rojo',
      'verde',
      'Ojo',
      'OJO',
      '',
      'amarillo',
      7,
      null,
      undefined,
      ['ojo'],
    ]) {
      expect(interpretarJuicio({ semaforo, confianza: 0.9 })).toBeNull();
    }
  });

  it('falta un campo: null', () => {
    expect(interpretarJuicio({ confianza: 0.9 })).toBeNull();
    expect(interpretarJuicio({ semaforo: 'ojo' })).toBeNull();
    expect(interpretarJuicio({})).toBeNull();
  });

  it('una confianza fuera de 0 a 1 o que no es un número: null', () => {
    for (const confianza of [1.2, -0.1, 'alta', '0.9', NaN, Infinity, null]) {
      expect(interpretarJuicio({ semaforo: 'ojo', confianza })).toBeNull();
    }
  });

  it('lo que no es un objeto: null', () => {
    for (const x of [null, undefined, 'ojo', 7, true, [], [{ semaforo: 'ojo', confianza: 0.9 }]]) {
      expect(interpretarJuicio(x)).toBeNull();
    }
  });

  it('ignora los campos que sobran (el modelo que respondió, por ejemplo)', () => {
    expect(interpretarJuicio({ semaforo: 'bien', confianza: 0.9, modelo: 'otro' })).toEqual({
      semaforo: 'bien',
      confianza: 0.9,
    });
  });

  it('no muta la respuesta', () => {
    const r = congelar({ semaforo: 'ojo', confianza: 0.8 });
    expect(() => interpretarJuicio(r)).not.toThrow();
    expect(r.semaforo).toBe('ojo');
  });
});

describe('las señales no mutan lo que reciben', () => {
  it('con todo congelado, las seis intenciones juzgables no lanzan y dan lo mismo dos veces', () => {
    const ctx = ctxDe(
      [
        cierreDe('2026-07-09', { abreCiclo: true, lineas: [linea('Anticucho', 20, 0, 10, 8.2)] }),
        ...semanas(4, 10).cierres,
        pendiente('2026-09-29', 120, { abreCiclo: true }),
        cierreDe('2026-09-28', { abreCiclo: true, lineas: [linea('Rachi', 30, 5, 9, 7.6)] }),
      ],
      [producto('Anticucho', 10, 8.8), producto('Rachi', 9, 7.6)],
    );
    const antes = JSON.stringify(ctx);
    congelar(ctx);
    for (const id of INTENCIONES_JUZGABLES) {
      const consulta = congelar(consultaDe(id, 'p-rachi'));
      const a = senalesDeJuicio(consulta, ctx);
      expect(senalesDeJuicio(consulta, ctx)).toEqual(a);
    }
    expect(JSON.stringify(ctx)).toBe(antes);
  });
});

describe('recorrido con la semilla real', () => {
  const semilla = () => {
    const r = validarSemilla(
      JSON.parse(readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8')),
    );
    if (!r.ok) throw new Error('La semilla real no valida');
    return r.semilla;
  };
  const hoy = new Date(2026, 9, 20, 12); // martes 20 de octubre, el Demo Day
  const { cierres, productos } = materializarSemilla(semilla(), hoy);
  const ctx = ctxDe(cierres, productos, fechaLocal(hoy));

  const consultas: Consulta[] = [
    consultaDe('compararCiclo'),
    consultaDe('cuantoPorCobrar'),
    consultaDe('cuantoSacarParaLaCasa'),
    consultaDe('cuantoPreparar', 'p-rachi'),
    consultaDe('revisarPrecio', 'p-anticucho'),
    consultaDe('peorDia'),
  ];

  it('las seis intenciones juzgables devuelven señales y viajan sin nada de Freddy', () => {
    for (const consulta of consultas) {
      const s = senalesDeJuicio(consulta, ctx);
      expect(s).not.toBeNull();
      const cuerpo = armarHechoParaJuicio(responderConsulta(consulta, ctx), s ?? {});
      expect(Object.keys(cuerpo).sort()).toEqual(['cifras', 'frase', 'intencion', 'senales']);
      // Las señales son palabras de un vocabulario cerrado, nunca un número
      for (const valor of Object.values(cuerpo.senales)) expect(valor).toMatch(/^[a-z0-9]+$/);
      expect(JSON.stringify(cuerpo.senales)).not.toMatch(/\d{3}/);
    }
  });

  it('el 20 de octubre las señales dicen esto', () => {
    const dice = (c: Consulta) => senalesDeJuicio(c, ctx);
    expect(dice(consultas[0])).toEqual({ tendencia: 'baja', magnitud: 'grande' });
    expect(dice(consultas[1])).toEqual({ plazo: 'vencido', monto: 'alto' });
    expect(dice(consultas[2])).toEqual({ resultado: 'ganancia', holgura: 'mucha' });
    expect(dice(consultas[3])).toEqual({ sobra: 'mucho', repite: 'si' });
    // Los precios de la semilla se cambiaron hace 84 días: todavía dentro de los 90
    expect(dice(consultas[4])).toEqual({ caida: 'leve', plazo: '90dias' });
    expect(dice(consultas[5])).toEqual({ brecha: 'grande', datos: 'suficientes' });
  });

  it('las doce intenciones de la semilla: solo las seis juzgables traen señales', () => {
    for (const i of INTENCIONES) {
      const s = senalesDeJuicio(consultaDe(i.id, 'p-rachi'), ctx);
      expect(s !== null).toBe(esJuzgable(i.id));
    }
  });
});
