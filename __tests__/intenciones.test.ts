/**
 * Pruebas de apoyo del chat "Preguntarle a mis datos" (no son escenarios del SPEC; e1–e4 y e9
 * viven en `sdd/sprint-08.test.ts`): las doce intenciones con datos que las activan y con datos
 * insuficientes, la lectura de la respuesta del clasificador, que `cifras` sale de la propia frase
 * y que la regla del día flojo no cambió al compartir su medición con el chat.
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
  DiaConsulta,
  FechaNegocio,
  Gasto,
  IntencionId,
  LineaCierre,
  Producto,
} from '@dominio/tipos';
import {
  DIAS_CONSULTA,
  INTENCIONES,
  interpretarRespuesta,
  PREGUNTAS_SUGERIDAS,
  responderConsulta,
  UMBRAL_CONFIANZA,
} from '@analisis/intenciones';
import {
  diaMasFlojo,
  evaluarReglas,
  mejorDiaDeLaSemana,
  peorDiaDeLaSemana,
  REGLAS,
} from '@analisis/reglas';
import { extraerCifras } from '@analisis/validarRedaccion';

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

const consultaDe = (
  intencion: IntencionId,
  extra: { producto?: string; dia?: DiaConsulta } = {},
): Consulta => ({ intencion, confianza: 0.9, ...extra });

const frase = (consulta: Consulta, ctx: ContextoAnalisis): string =>
  responderConsulta(consulta, ctx).frase;

const congelar = <T>(valor: T): T => {
  if (valor && typeof valor === 'object') {
    Object.values(valor as object).forEach(congelar);
    Object.freeze(valor);
  }
  return valor;
};

// Un día que gana exactamente `ganancia` soles (porciones a precio 1 y costo 0).
const diaGana = (fecha: FechaNegocio, ganancia: number, o: Opciones = {}): Cierre =>
  cierreDe(fecha, { lineas: [linea('Anticucho', ganancia, 0, 1, 0)], ...o });

// 5 semanas de miércoles a sábado (20 cierres), con la ganancia de cada día de la semana.
const SEMANAS = [
  ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
  ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'],
  ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'],
  ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'],
  ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'],
];
const semanasCon = (ganancias: [number, number, number, number]): Cierre[] =>
  SEMANAS.flatMap((dias, semana) =>
    dias.map((fecha, i) =>
      diaGana(fecha, ganancias[i], {
        abreCiclo: (semana === 0 && i === 0) || (semana === 3 && i === 0),
      }),
    ),
  );

describe('INTENCIONES', () => {
  it('son las doce, en este orden', () => {
    expect(INTENCIONES.map(i => i.id)).toEqual([
      'ventaDelDia',
      'mejorDia',
      'peorDia',
      'productoQueMasDeja',
      'productoQueMasSeVende',
      'cuantoPorCobrar',
      'cuantoSacarParaLaCasa',
      'cuantoPreparar',
      'compararCiclo',
      'revisarPrecio',
      'cuandoRecupereCapital',
      'noEntendi',
    ]);
  });

  it('cada una trae una descripción para el clasificador y su pregunta sugerida', () => {
    for (const i of INTENCIONES) {
      expect(i.descripcion.length).toBeGreaterThan(10);
      expect(i.descripcion.length).toBeLessThanOrEqual(120);
    }
    expect(INTENCIONES.filter(i => i.sugerida === null).map(i => i.id)).toEqual(['noEntendi']);
    expect(INTENCIONES.find(i => i.id === 'ventaDelDia')?.sugerida).toBe('¿Cuánto vendí ayer?');
    expect(INTENCIONES.find(i => i.id === 'cuandoRecupereCapital')?.sugerida).toBe(
      '¿Cuándo recuperé mi capital?',
    );
  });

  it('las descripciones no repiten palabras de jerga de modelo ni de la plantilla de Freddy', () => {
    for (const i of INTENCIONES) {
      expect(i.descripcion).not.toMatch(/\b(balance|margen|utilidad|SKU|ROI|token|prompt)\b/i);
    }
  });

  it('las preguntas sugeridas son seis, distintas, y salen de las intenciones', () => {
    expect(PREGUNTAS_SUGERIDAS).toHaveLength(6);
    expect(new Set(PREGUNTAS_SUGERIDAS).size).toBe(6);
    const sugeridas = INTENCIONES.map(i => i.sugerida);
    for (const p of PREGUNTAS_SUGERIDAS) expect(sugeridas).toContain(p);
    expect(PREGUNTAS_SUGERIDAS).toContain('¿Qué día me va peor?');
  });

  it('el umbral es 0.6 y hay diez valores de día', () => {
    expect(UMBRAL_CONFIANZA).toBe(0.6);
    expect(DIAS_CONSULTA).toEqual([
      'hoy',
      'ayer',
      'lunes',
      'martes',
      'miercoles',
      'jueves',
      'viernes',
      'sabado',
      'domingo',
      'ninguno',
    ]);
  });
});

describe('interpretarRespuesta', () => {
  const valida = { intencion: 'ventaDelDia', producto: 'ninguno', dia: 'ayer', confianza: 0.95 };

  it('lee una respuesta válida', () => {
    expect(interpretarRespuesta(valida)).toEqual({
      intencion: 'ventaDelDia',
      dia: 'ayer',
      confianza: 0.95,
    });
  });

  it('"ninguno" en el producto es sin producto', () => {
    const c = interpretarRespuesta(valida);
    expect(c).not.toBeNull();
    expect(c).not.toHaveProperty('producto');
  });

  it('traduce el producto a su id', () => {
    for (const p of ['anticucho', 'pancita', 'rachi', 'chicha']) {
      expect(
        interpretarRespuesta({
          ...valida,
          intencion: 'cuantoPreparar',
          producto: p,
          dia: 'ninguno',
        }),
      ).toEqual({
        intencion: 'cuantoPreparar',
        producto: `p-${p}`,
        dia: 'ninguno',
        confianza: 0.95,
      });
    }
  });

  it('acepta las doce intenciones y los diez días', () => {
    for (const i of INTENCIONES) {
      expect(interpretarRespuesta({ ...valida, intencion: i.id })?.intencion).toBe(i.id);
    }
    for (const d of DIAS_CONSULTA) {
      expect(interpretarRespuesta({ ...valida, dia: d })?.dia).toBe(d);
    }
  });

  it('ignora los campos que sobran', () => {
    expect(interpretarRespuesta({ ...valida, comentario: 'hola' })).toEqual({
      intencion: 'ventaDelDia',
      dia: 'ayer',
      confianza: 0.95,
    });
  });

  it.each(['intencion', 'producto', 'dia', 'confianza'])('falta el campo %s: null', campo => {
    const sin: Record<string, unknown> = { ...valida };
    delete sin[campo];
    expect(interpretarRespuesta(sin)).toBeNull();
  });

  it('una intención inventada: null', () => {
    expect(interpretarRespuesta({ ...valida, intencion: 'ventaDeLaSemana' })).toBeNull();
    expect(interpretarRespuesta({ ...valida, intencion: '' })).toBeNull();
    expect(interpretarRespuesta({ ...valida, intencion: 7 })).toBeNull();
  });

  it('un producto inventado: null', () => {
    expect(interpretarRespuesta({ ...valida, producto: 'mondongo' })).toBeNull();
    expect(interpretarRespuesta({ ...valida, producto: 'p-rachi' })).toBeNull();
    expect(interpretarRespuesta({ ...valida, producto: 'Rachi' })).toBeNull();
  });

  it('un día que no está en la lista: null', () => {
    expect(interpretarRespuesta({ ...valida, dia: 'anteayer' })).toBeNull();
    expect(interpretarRespuesta({ ...valida, dia: 'miércoles' })).toBeNull();
    expect(interpretarRespuesta({ ...valida, dia: 'Lunes' })).toBeNull();
  });

  it('confianza 0.59: no entendió; 0.6 y más: respeta la intención', () => {
    expect(interpretarRespuesta({ ...valida, confianza: 0.59 })).toEqual({
      intencion: 'noEntendi',
      confianza: 0.59,
    });
    expect(interpretarRespuesta({ ...valida, confianza: 0.6 })).toEqual({
      intencion: 'ventaDelDia',
      dia: 'ayer',
      confianza: 0.6,
    });
    expect(interpretarRespuesta({ ...valida, confianza: 1 })?.intencion).toBe('ventaDelDia');
  });

  it('con poca confianza, y sin producto ni día (escenario 5)', () => {
    const c = interpretarRespuesta({
      ...valida,
      intencion: 'peorDia',
      producto: 'rachi',
      confianza: 0.4,
    });
    expect(c).toStrictEqual({ intencion: 'noEntendi', confianza: 0.4 });
    expect(interpretarRespuesta({ ...valida, confianza: 0 })).toStrictEqual({
      intencion: 'noEntendi',
      confianza: 0,
    });
  });

  it('una confianza fuera de 0 a 1 o que no es un número: null', () => {
    expect(interpretarRespuesta({ ...valida, confianza: 1.2 })).toBeNull();
    expect(interpretarRespuesta({ ...valida, confianza: -0.1 })).toBeNull();
    expect(interpretarRespuesta({ ...valida, confianza: 'alta' })).toBeNull();
    expect(interpretarRespuesta({ ...valida, confianza: '0.9' })).toBeNull();
    expect(interpretarRespuesta({ ...valida, confianza: NaN })).toBeNull();
    expect(interpretarRespuesta({ ...valida, confianza: Infinity })).toBeNull();
    expect(interpretarRespuesta({ ...valida, confianza: null })).toBeNull();
  });

  it('lo que no es un objeto: null', () => {
    for (const x of [null, undefined, 'ventaDelDia', 7, true, [], [valida]]) {
      expect(interpretarRespuesta(x)).toBeNull();
    }
  });

  it('con "noEntendi" y mucha confianza conserva su producto y día', () => {
    expect(
      interpretarRespuesta({
        intencion: 'noEntendi',
        producto: 'ninguno',
        dia: 'ninguno',
        confianza: 0.9,
      }),
    ).toEqual({ intencion: 'noEntendi', dia: 'ninguno', confianza: 0.9 });
  });
});

describe('ventaDelDia', () => {
  const cierres = [
    cierreDe('2026-09-29', { lineas: [linea('Anticucho', 10, 0, 10, 8)] }), // martes, S/ 100
    cierreDe('2026-10-06', {
      lineas: [linea('Anticucho', 7, 0, 10, 8), linea('Pancita', 15, 0, 9, 8)],
    }), // martes, S/ 205
    cierreDe('2026-10-07', { lineas: [linea('Pancita', 10, 0, 9, 8)] }), // miércoles, S/ 90
  ];

  it('ayer', () => {
    expect(frase(consultaDe('ventaDelDia', { dia: 'ayer' }), ctxDe(cierres))).toBe(
      'Ayer, martes 6 de octubre, vendiste S/ 205.00.',
    );
  });

  it('hoy', () => {
    expect(frase(consultaDe('ventaDelDia', { dia: 'hoy' }), ctxDe(cierres))).toBe(
      'Hoy, miércoles 7 de octubre, vendiste S/ 90.00.',
    );
  });

  it('un día de la semana: el más reciente con cierre', () => {
    expect(frase(consultaDe('ventaDelDia', { dia: 'martes' }), ctxDe(cierres))).toBe(
      'El martes 6 de octubre vendiste S/ 205.00.',
    );
    expect(frase(consultaDe('ventaDelDia', { dia: 'miercoles' }), ctxDe(cierres))).toBe(
      'El miércoles 7 de octubre vendiste S/ 90.00.',
    );
  });

  it('un día de la semana que solo tuvo cierre hace semanas', () => {
    expect(frase(consultaDe('ventaDelDia', { dia: 'martes' }), ctxDe([cierres[0]]))).toBe(
      'El martes 29 de septiembre vendiste S/ 100.00.',
    );
  });

  it('sin día: el último día con cierre', () => {
    expect(frase(consultaDe('ventaDelDia', { dia: 'ninguno' }), ctxDe(cierres))).toBe(
      'El miércoles 7 de octubre vendiste S/ 90.00.',
    );
    expect(frase(consultaDe('ventaDelDia'), ctxDe([cierres[0], cierres[1]]))).toBe(
      'El martes 6 de octubre vendiste S/ 205.00.',
    );
  });

  it('un día de la semana sin cierre no tiene cifras', () => {
    const h = responderConsulta(consultaDe('ventaDelDia', { dia: 'lunes' }), ctxDe(cierres));
    expect(h.frase).toBe('El lunes no tienes ningún día cerrado.');
    expect(h.cifras).toEqual([]);
    expect(frase(consultaDe('ventaDelDia', { dia: 'sabado' }), ctxDe(cierres))).toBe(
      'El sábado no tienes ningún día cerrado.',
    );
  });

  it('ayer u hoy sin cierre, y sin ningún día cerrado', () => {
    expect(frase(consultaDe('ventaDelDia', { dia: 'ayer' }), ctxDe([cierres[0]]))).toBe(
      'Ayer no cerraste tu día.',
    );
    expect(frase(consultaDe('ventaDelDia', { dia: 'hoy' }), ctxDe([cierres[0]]))).toBe(
      'Hoy todavía no cerraste tu día.',
    );
    expect(frase(consultaDe('ventaDelDia', { dia: 'ninguno' }), ctxDe([]))).toBe(
      'Todavía no tienes ningún día cerrado.',
    );
  });

  it('ignora los cierres posteriores a hoy', () => {
    const futuro = cierreDe('2026-10-13', { lineas: [linea('Anticucho', 99, 0, 10, 8)] });
    expect(frase(consultaDe('ventaDelDia', { dia: 'martes' }), ctxDe([...cierres, futuro]))).toBe(
      'El martes 6 de octubre vendiste S/ 205.00.',
    );
    expect(frase(consultaDe('ventaDelDia', { dia: 'ninguno' }), ctxDe([...cierres, futuro]))).toBe(
      'El miércoles 7 de octubre vendiste S/ 90.00.',
    );
  });

  it('las cifras son el día del mes y el monto', () => {
    expect(
      responderConsulta(consultaDe('ventaDelDia', { dia: 'ayer' }), ctxDe(cierres)).cifras,
    ).toEqual(['6', '205.00']);
  });
});

describe('peorDia y mejorDia', () => {
  // Miércoles 4, jueves 10, viernes 10, sábado 16: promedio general 10.
  const cierres = semanasCon([4, 10, 10, 16]);

  it('el peor día: el que más baja del promedio', () => {
    expect(frase(consultaDe('peorDia'), ctxDe(cierres))).toBe(
      'Los miércoles son tu día más flojo: ganas S/ 6.00 menos que tu promedio.',
    );
  });

  it('el mejor día: simétrico', () => {
    expect(frase(consultaDe('mejorDia'), ctxDe(cierres))).toBe(
      'Los sábados son tu mejor día: ganas S/ 6.00 más que tu promedio.',
    );
  });

  it('el peor día se responde aunque no llegue al 20 % que exige la recomendación', () => {
    // Miércoles 9, el resto 10: promedio 9.75, solo 7.7 % por debajo.
    const parejo = semanasCon([9, 10, 10, 10]);
    expect(diaMasFlojo(ctxDe(parejo))).toBeNull();
    expect(frase(consultaDe('peorDia'), ctxDe(parejo))).toBe(
      'Los miércoles son tu día más flojo: ganas S/ 0.75 menos que tu promedio.',
    );
  });

  it('con pocos datos pide cerrar más días', () => {
    const pocos =
      'Todavía no tengo suficientes días para saberlo. Cierra más días y vuelve a preguntar.';
    expect(frase(consultaDe('peorDia'), ctxDe([]))).toBe(pocos);
    expect(frase(consultaDe('mejorDia'), ctxDe([]))).toBe(pocos);
    // Menos de 28 días entre el primero y el último cierre
    expect(frase(consultaDe('peorDia'), ctxDe(cierres.slice(0, 12)))).toBe(pocos);
    // Cada día de la semana con un solo cierre
    const unaSemana = cierres.slice(0, 4);
    expect(frase(consultaDe('mejorDia'), ctxDe(unaSemana))).toBe(pocos);
  });

  it('con 28 días de registro pero un solo cierre por día de la semana, tampoco juzga', () => {
    const sueltos = [
      diaGana('2026-09-02', 4),
      diaGana('2026-09-10', 10),
      diaGana('2026-10-02', 16),
    ];
    expect(frase(consultaDe('peorDia'), ctxDe(sueltos))).toContain(
      'Todavía no tengo suficientes días',
    );
  });

  it('si todos los días ganan lo mismo no hay peor ni mejor día', () => {
    const iguales = semanasCon([10, 10, 10, 10]);
    expect(frase(consultaDe('peorDia'), ctxDe(iguales))).toContain(
      'Todavía no tengo suficientes días',
    );
    expect(frase(consultaDe('mejorDia'), ctxDe(iguales))).toContain(
      'Todavía no tengo suficientes días',
    );
  });

  it('sin ganancia promedio positiva no hay con qué comparar', () => {
    expect(frase(consultaDe('peorDia'), ctxDe(semanasCon([0, 0, 0, 0])))).toContain(
      'Todavía no tengo suficientes días',
    );
  });

  it('las cifras de los días de la semana son solo el monto', () => {
    expect(responderConsulta(consultaDe('peorDia'), ctxDe(cierres)).cifras).toEqual(['6.00']);
  });

  it('el chat y la regla comparten la medición', () => {
    // Mismo escenario que spec05_e8: miércoles 40, resto 100, promedio 85.
    const e8 = SEMANAS.flatMap((dias, semana) =>
      dias.map((fecha, i) =>
        cierreDe(fecha, {
          abreCiclo: (semana === 0 && i === 0) || (semana === 3 && i === 0),
          lineas: [linea('Anticucho', i === 0 ? 4 : 10, 0, 10, 0)],
        }),
      ),
    );
    expect(diaMasFlojo(ctxDe(e8))).toEqual({ dia: 3, diferencia: 45 });
    expect(peorDiaDeLaSemana(ctxDe(e8))).toEqual({ dia: 3, diferencia: 45 });
    expect(mejorDiaDeLaSemana(ctxDe(e8))).toEqual({ dia: 4, diferencia: 15 });
  });
});

describe('productoQueMasDeja y productoQueMasSeVende', () => {
  // Octubre: pancita 410 porciones que dejan 1.00 y anticucho 270 que dejan 1.80.
  const octubre = [
    cierreDe('2026-10-01', {
      lineas: [linea('Pancita', 220, 20, 9, 8), linea('Anticucho', 150, 10, 10, 8.2)],
    }),
    cierreDe('2026-10-02', {
      lineas: [linea('Pancita', 150, 0, 9, 8), linea('Anticucho', 130, 0, 10, 8.2)],
    }),
    cierreDe('2026-10-03', { lineas: [linea('Pancita', 60, 0, 9, 8)] }),
  ];
  const POCO = 'Todavía no tengo suficientes ventas para compararlos.';

  it('el que más se vende', () => {
    expect(frase(consultaDe('productoQueMasSeVende'), ctxDe(octubre))).toBe(
      'La pancita es la que más se vende: 410 porciones en los últimos 30 días.',
    );
  });

  it('el que más deja, con la ganancia por porción y en total', () => {
    const h = responderConsulta(consultaDe('productoQueMasDeja'), ctxDe(octubre));
    expect(h.frase).toBe(
      'El anticucho es el que más te deja: S/ 1.80 por porción, S/ 486.00 en total.',
    );
    expect(h.cifras).toEqual(['1.80', '486.00']);
  });

  it('cuenta los últimos 30 días: el día 30 entra y el 31 no', () => {
    const dentro = cierreDe('2026-09-07', { lineas: [linea('Pancita', 1000, 0, 9, 8)] }); // hace 30 días
    const fuera = cierreDe('2026-09-06', { lineas: [linea('Pancita', 5000, 0, 9, 8)] }); // hace 31 días
    expect(frase(consultaDe('productoQueMasSeVende'), ctxDe([...octubre, dentro, fuera]))).toBe(
      'La pancita es la que más se vende: 1,410 porciones en los últimos 30 días.',
    );
  });

  it('un producto en vasos dice vasos', () => {
    const cierres = [
      cierreDe('2026-10-01', {
        lineas: [linea('Chicha', 300, 0, 2, 1.6), linea('Anticucho', 20, 0, 10, 8.2)],
      }),
    ];
    const productos = [
      producto('Chicha', 2, 1.6, { unidad: 'vaso' }),
      producto('Anticucho', 10, 8.2),
    ];
    expect(frase(consultaDe('productoQueMasSeVende'), ctxDe(cierres, productos))).toBe(
      'La chicha es la que más se vende: 300 vasos en los últimos 30 días.',
    );
    expect(frase(consultaDe('productoQueMasDeja'), ctxDe(cierres, productos))).toBe(
      'El anticucho es el que más te deja: S/ 1.80 por porción, S/ 36.00 en total.',
    );
  });

  it('en singular cuando es uno', () => {
    const cierres = [
      cierreDe('2026-10-01', {
        lineas: [linea('Rachi', 1, 0, 9, 7.6), linea('Anticucho', 1, 1, 10, 8.2)],
      }),
      cierreDe('2026-10-02', {
        lineas: [linea('Pancita', 1, 0, 9, 8), linea('Anticucho', 1, 1, 10, 8.2)],
      }),
    ];
    // Rachi 1 y Pancita 1 empatan en ventas; deja más el rachi (1.40 contra 1.00)
    expect(frase(consultaDe('productoQueMasSeVende'), ctxDe(cierres))).toBe(
      'El rachi es el que más se vende: 1 porción en los últimos 30 días.',
    );
  });

  it('con un solo producto con ventas, o sin ventas, no compara', () => {
    const uno = [cierreDe('2026-10-01', { lineas: [linea('Pancita', 100, 0, 9, 8)] })];
    for (const id of ['productoQueMasDeja', 'productoQueMasSeVende'] as const) {
      expect(frase(consultaDe(id), ctxDe(uno))).toBe(POCO);
      expect(frase(consultaDe(id), ctxDe([]))).toBe(POCO);
    }
    const sinVender = [
      cierreDe('2026-10-01', {
        lineas: [linea('Pancita', 10, 10, 9, 8), linea('Anticucho', 10, 10, 10, 8)],
      }),
    ];
    expect(frase(consultaDe('productoQueMasDeja'), ctxDe(sinVender))).toBe(POCO);
    // Un producto que no vendió nada no cuenta como "otro producto"
    const unoYUnoSin = [
      cierreDe('2026-10-01', {
        lineas: [linea('Pancita', 10, 0, 9, 8), linea('Anticucho', 10, 10, 10, 8)],
      }),
    ];
    expect(frase(consultaDe('productoQueMasDeja'), ctxDe(unoYUnoSin))).toBe(POCO);
  });

  it('mismo producto que más se vende y que más deja: lo dice igual', () => {
    const cierres = [
      cierreDe('2026-10-01', {
        lineas: [linea('Anticucho', 100, 0, 10, 8), linea('Pancita', 50, 0, 9, 8)],
      }),
    ];
    expect(frase(consultaDe('productoQueMasDeja'), ctxDe(cierres))).toBe(
      'El anticucho es el que más te deja: S/ 2.00 por porción, S/ 200.00 en total.',
    );
    expect(frase(consultaDe('productoQueMasSeVende'), ctxDe(cierres))).toBe(
      'El anticucho es el que más se vende: 100 porciones en los últimos 30 días.',
    );
  });
});

describe('cuantoPorCobrar', () => {
  const pendiente = (fecha: FechaNegocio, monto: number, o: Opciones = {}) =>
    cierreDe(fecha, {
      lineas: [linea('Anticucho', 20, 0, 10, 8)],
      montoYape: monto,
      yapePendiente: true,
      ...o,
    });

  it('suma lo pendiente desde el pago más antiguo', () => {
    const h = responderConsulta(
      consultaDe('cuantoPorCobrar'),
      ctxDe([pendiente('2026-09-29', 70), pendiente('2026-10-02', 50)]),
    );
    expect(h.frase).toBe('Tienes S/ 120.00 por cobrar desde el 29 de septiembre.');
    expect(h.cifras).toEqual(['120.00', '29']);
  });

  it('también cuando es poco y reciente: la pregunta la hizo él', () => {
    expect(frase(consultaDe('cuantoPorCobrar'), ctxDe([pendiente('2026-10-06', 20)]))).toBe(
      'Tienes S/ 20.00 por cobrar desde el 6 de octubre.',
    );
  });

  it('con nada por cobrar', () => {
    const h = responderConsulta(consultaDe('cuantoPorCobrar'), ctxDe([]));
    expect(h.frase).toBe('No tienes nada por cobrar.');
    expect(h.cifras).toEqual([]);
    expect(
      frase(
        consultaDe('cuantoPorCobrar'),
        ctxDe([pendiente('2026-10-01', 80, { cobradoEn: '2026-10-03' })]),
      ),
    ).toBe('No tienes nada por cobrar.');
  });
});

describe('cuantoSacarParaLaCasa', () => {
  const ciclos = (venta: number, gastos: number): Cierre[] => [
    cierreDe('2026-09-20', {
      abreCiclo: true,
      lineas: [linea('Anticucho', venta / 10, 0, 10, 8)],
      gastos: [{ categoria: 'mercaderia', monto: gastos }],
    }),
    cierreDe('2026-10-01', { abreCiclo: true, lineas: [linea('Anticucho', 10, 0, 10, 8)] }),
  ];

  it('con ganancia en el último ciclo cerrado', () => {
    const h = responderConsulta(consultaDe('cuantoSacarParaLaCasa'), ctxDe(ciclos(400, 232)));
    expect(h.frase).toBe('Puedes sacar S/ 168.00 para la casa sin tocar tu capital.');
    expect(h.cifras).toEqual(['168.00']);
  });

  it('sin ganancia', () => {
    const h = responderConsulta(consultaDe('cuantoSacarParaLaCasa'), ctxDe(ciclos(200, 244)));
    expect(h.frase).toBe(
      'Este ciclo no te dejó ganancia. Mejor no saques plata del negocio todavía.',
    );
    expect(h.cifras).toEqual([]);
  });

  it('con menos de dos ciclos', () => {
    const esperado =
      'Todavía no cierras un ciclo completo. Cuando compres mercadería otra vez, te lo calculo.';
    expect(frase(consultaDe('cuantoSacarParaLaCasa'), ctxDe([ciclos(400, 200)[0]]))).toBe(esperado);
    expect(frase(consultaDe('cuantoSacarParaLaCasa'), ctxDe([]))).toBe(esperado);
  });
});

describe('cuantoPreparar', () => {
  const rachi = (fecha: FechaNegocio, sobrantes: number, abreCiclo = false) =>
    cierreDe(fecha, { abreCiclo, lineas: [linea('Rachi', 30, sobrantes, 9, 7.6)] });

  it('le sobró en los dos últimos ciclos: baja la menor cifra', () => {
    // Penúltimo ciclo 2 + 3 = 5 sobrantes, último 4 + 2 = 6
    const cierres = [
      rachi('2026-09-14', 2, true),
      rachi('2026-09-15', 3),
      rachi('2026-09-28', 4, true),
      rachi('2026-09-29', 2),
    ];
    const h = responderConsulta(
      consultaDe('cuantoPreparar', { producto: 'p-rachi' }),
      ctxDe(cierres),
    );
    expect(h.frase).toBe('Te sobró rachi dos ciclos seguidos. Prepara 5 porciones menos.');
    expect(h.cifras).toEqual(['5']);
  });

  it('es la misma frase que la recomendación de la regla', () => {
    const cierres = [
      rachi('2026-09-14', 2, true),
      rachi('2026-09-15', 3),
      rachi('2026-09-28', 4, true),
      rachi('2026-09-29', 2),
    ];
    const ctx = ctxDe(cierres, [producto('Rachi', 9, 7.6)]);
    const regla = evaluarReglas(ctx).find(r => r.reglaId === 'preparar');
    expect(frase(consultaDe('cuantoPreparar', { producto: 'p-rachi' }), ctx)).toBe(regla?.mensaje);
  });

  it('un sobrante chico igual se dice, y en singular', () => {
    const cierres = [rachi('2026-09-14', 1, true), rachi('2026-09-28', 2, true)];
    expect(frase(consultaDe('cuantoPreparar', { producto: 'p-rachi' }), ctxDe(cierres))).toBe(
      'Te sobró rachi dos ciclos seguidos. Prepara 1 porción menos.',
    );
  });

  it('el vaso dice vasos', () => {
    const chicha = (fecha: FechaNegocio, sobrantes: number, abreCiclo = false) =>
      cierreDe(fecha, { abreCiclo, lineas: [linea('Chicha', 40, sobrantes, 2, 1.6)] });
    const ctx = ctxDe(
      [chicha('2026-09-14', 8, true), chicha('2026-09-28', 6, true)],
      [producto('Chicha', 2, 1.6, { unidad: 'vaso' })],
    );
    expect(frase(consultaDe('cuantoPreparar', { producto: 'p-chicha' }), ctx)).toBe(
      'Te sobró chicha dos ciclos seguidos. Prepara 6 vasos menos.',
    );
  });

  it('si no sobra en alguno de los dos ciclos, le alcanza', () => {
    const cierres = [rachi('2026-09-14', 0, true), rachi('2026-09-28', 6, true)];
    const h = responderConsulta(
      consultaDe('cuantoPreparar', { producto: 'p-rachi' }),
      ctxDe(cierres),
    );
    expect(h.frase).toBe(
      'Con lo que preparas de rachi te alcanza: en los últimos dos ciclos no te sobró nada.',
    );
    expect(h.cifras).toEqual([]);
  });

  it('un producto que no se preparó en esos ciclos también le alcanza', () => {
    const cierres = [rachi('2026-09-14', 4, true), rachi('2026-09-28', 4, true)];
    expect(frase(consultaDe('cuantoPreparar', { producto: 'p-pancita' }), ctxDe(cierres))).toBe(
      'Con lo que preparas de pancita te alcanza: en los últimos dos ciclos no te sobró nada.',
    );
  });

  it('sin producto, lo pide', () => {
    const cierres = [rachi('2026-09-14', 4, true), rachi('2026-09-28', 4, true)];
    const h = responderConsulta(consultaDe('cuantoPreparar'), ctxDe(cierres));
    expect(h.frase).toBe('¿De cuál producto? Por ejemplo: rachi.');
    expect(h.cifras).toEqual([]);
  });

  it('con menos de dos ciclos', () => {
    expect(
      frase(
        consultaDe('cuantoPreparar', { producto: 'p-rachi' }),
        ctxDe([rachi('2026-09-14', 4, true)]),
      ),
    ).toBe(
      'Todavía no cierras un ciclo completo. Cuando compres mercadería otra vez, te lo calculo.',
    );
  });
});

describe('compararCiclo', () => {
  const dia = (fecha: FechaNegocio, venta: number, gasto: number) =>
    cierreDe(fecha, {
      abreCiclo: true,
      lineas: [linea('Anticucho', venta / 10, 0, 10, 8)],
      gastos: [{ categoria: 'mercaderia', monto: gasto }],
    });

  it('más que el ciclo pasado', () => {
    // Anterior: 300 − 86 = 214. Actual: 400 − 138 = 262.
    const h = responderConsulta(
      consultaDe('compararCiclo'),
      ctxDe([dia('2026-09-14', 300, 86), dia('2026-09-28', 400, 138)]),
    );
    expect(h.frase).toBe('Ganaste S/ 48.00 más que el ciclo pasado.');
    expect(h.cifras).toEqual(['48.00']);
  });

  it('menos y lo mismo', () => {
    expect(
      frase(
        consultaDe('compararCiclo'),
        ctxDe([dia('2026-09-14', 400, 138), dia('2026-09-28', 300, 86)]),
      ),
    ).toBe('Ganaste S/ 48.00 menos que el ciclo pasado.');
    expect(
      frase(
        consultaDe('compararCiclo'),
        ctxDe([dia('2026-09-14', 300, 86), dia('2026-09-28', 300, 86)]),
      ),
    ).toBe('Ganaste lo mismo que el ciclo pasado.');
  });

  it('con un solo ciclo, o ninguno', () => {
    expect(frase(consultaDe('compararCiclo'), ctxDe([dia('2026-09-14', 300, 86)]))).toBe(
      'Todavía tienes un solo ciclo, no hay con qué comparar.',
    );
    expect(frase(consultaDe('compararCiclo'), ctxDe([]))).toBe(
      'Todavía no tienes ningún día cerrado.',
    );
  });
});

describe('revisarPrecio', () => {
  it('el "te deja" cayó: es la frase de la regla', () => {
    // Anticucho: precio 10 y costo 8.20 el 2026-07-09 (deja 1.80); hoy costo 8.80 (deja 1.20)
    const cierres = [
      cierreDe('2026-07-09', { abreCiclo: true, lineas: [linea('Anticucho', 20, 0, 10, 8.2)] }),
      cierreDe('2026-09-20', { abreCiclo: true, lineas: [linea('Anticucho', 20, 0, 10, 8.8)] }),
    ];
    const ctx = ctxDe(cierres, [producto('Anticucho', 10, 8.8)]);
    const h = responderConsulta(consultaDe('revisarPrecio', { producto: 'p-anticucho' }), ctx);
    expect(h.frase).toBe('Tu anticucho te deja S/ 0.60 menos que en julio. ¿Revisas el precio?');
    expect(h.cifras).toEqual(['0.60']);
    expect(h.frase).toBe(evaluarReglas(ctx).find(r => r.reglaId === 'precio')?.mensaje);
  });

  it('juzga solo el producto preguntado, aunque otro haya caído más', () => {
    const cierres = [
      cierreDe('2026-07-09', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 20, 0, 10, 8.2), linea('Pancita', 20, 0, 9, 6)],
      }),
    ];
    const productos = [producto('Anticucho', 10, 8.2), producto('Pancita', 9, 8)];
    expect(
      frase(consultaDe('revisarPrecio', { producto: 'p-anticucho' }), ctxDe(cierres, productos)),
    ).toBe('El precio del anticucho está bien: te deja S/ 1.80 por porción.');
    expect(
      frase(consultaDe('revisarPrecio', { producto: 'p-pancita' }), ctxDe(cierres, productos)),
    ).toBe('Tu pancita te deja S/ 2.00 menos que en julio. ¿Revisas el precio?');
  });

  it('si no cayó, dice cuánto deja hoy', () => {
    const cierres = [cierreDe('2026-07-09', { lineas: [linea('Anticucho', 20, 0, 10, 8.2)] })];
    const h = responderConsulta(
      consultaDe('revisarPrecio', { producto: 'p-anticucho' }),
      ctxDe(cierres, [producto('Anticucho', 10, 8.2)]),
    );
    expect(h.frase).toBe('El precio del anticucho está bien: te deja S/ 1.80 por porción.');
    expect(h.cifras).toEqual(['1.80']);
  });

  it('sin historia para comparar también está bien', () => {
    expect(
      frase(
        consultaDe('revisarPrecio', { producto: 'p-chicha' }),
        ctxDe([], [producto('Chicha', 2, 1.6, { unidad: 'vaso' })]),
      ),
    ).toBe('El precio de la chicha está bien: te deja S/ 0.40 por porción.');
  });

  it('una caída menor a S/ 0.30 no cuenta', () => {
    const cierres = [cierreDe('2026-07-09', { lineas: [linea('Anticucho', 20, 0, 10, 8.2)] })];
    expect(
      frase(
        consultaDe('revisarPrecio', { producto: 'p-anticucho' }),
        ctxDe(cierres, [producto('Anticucho', 10, 8.4)]),
      ),
    ).toBe('El precio del anticucho está bien: te deja S/ 1.60 por porción.');
  });

  it('sin producto, o con uno que la app no tiene, lo pide', () => {
    const pide = '¿De cuál producto? Por ejemplo: anticucho.';
    expect(frase(consultaDe('revisarPrecio'), ctxDe([], [producto('Anticucho', 10, 8.2)]))).toBe(
      pide,
    );
    expect(
      frase(
        consultaDe('revisarPrecio', { producto: 'p-rachi' }),
        ctxDe([], [producto('Anticucho', 10, 8.2)]),
      ),
    ).toBe(pide);
    expect(
      frase(
        consultaDe('revisarPrecio', { producto: 'p-anticucho' }),
        ctxDe([], [producto('Anticucho', 10, 8.2, { activo: false })]),
      ),
    ).toBe(pide);
  });
});

describe('cuandoRecupereCapital', () => {
  it('recuperó su capital', () => {
    // Capital S/ 100 y venta S/ 100 el mismo día: lo recuperó el martes 6 de octubre
    const cierres = [
      cierreDe('2026-10-06', {
        lineas: [linea('Anticucho', 10, 0, 10, 8)],
        gastos: [{ categoria: 'mercaderia', monto: 100 }],
      }),
    ];
    const h = responderConsulta(consultaDe('cuandoRecupereCapital'), ctxDe(cierres));
    expect(h.frase).toBe('Recuperaste tu capital el martes 6 de octubre.');
    expect(h.cifras).toEqual(['6']);
  });

  it('todavía le falta', () => {
    const cierres = [
      cierreDe('2026-10-06', {
        lineas: [linea('Pancita', 4, 0, 9, 8)],
        gastos: [{ categoria: 'mercaderia', monto: 100 }],
      }),
    ];
    const h = responderConsulta(consultaDe('cuandoRecupereCapital'), ctxDe(cierres));
    expect(h.frase).toBe('Te falta S/ 64.00 para recuperar tu capital.');
    expect(h.cifras).toEqual(['64.00']);
  });

  it('habla del último ciclo', () => {
    const cierres = [
      cierreDe('2026-09-20', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 30, 0, 10, 8)],
        gastos: [{ categoria: 'mercaderia', monto: 100 }],
      }),
      cierreDe('2026-10-06', {
        abreCiclo: true,
        lineas: [linea('Pancita', 4, 0, 9, 8)],
        gastos: [{ categoria: 'mercaderia', monto: 100 }],
      }),
    ];
    expect(frase(consultaDe('cuandoRecupereCapital'), ctxDe(cierres))).toBe(
      'Te falta S/ 64.00 para recuperar tu capital.',
    );
  });

  it('sin ningún día cerrado', () => {
    expect(frase(consultaDe('cuandoRecupereCapital'), ctxDe([]))).toBe(
      'Todavía no tienes ningún día cerrado.',
    );
  });
});

describe('noEntendi', () => {
  it('pide una de las preguntas sugeridas y no trae cifras', () => {
    const h = responderConsulta({ intencion: 'noEntendi', confianza: 0.4 }, ctxDe([]));
    expect(h).toEqual({
      intencion: 'noEntendi',
      frase: 'No entendí tu pregunta. Prueba con una de estas:',
      cifras: [],
    });
  });

  it('una intención desconocida en tiempo de ejecución tampoco lanza', () => {
    const rara = { intencion: 'inventada', confianza: 0.9 } as unknown as Consulta;
    expect(responderConsulta(rara, ctxDe([])).intencion).toBe('noEntendi');
  });
});

describe('cifras', () => {
  const productos = [
    producto('Anticucho', 10, 8.8),
    producto('Rachi', 9, 7.6),
    producto('Chicha', 2, 1.6, { unidad: 'vaso' }),
  ];
  const cierres = [
    cierreDe('2026-07-09', { abreCiclo: true, lineas: [linea('Anticucho', 20, 0, 10, 8.2)] }),
    ...semanasCon([4, 10, 10, 16]).map(c => ({ ...c, id: `${c.id}-s` })),
    cierreDe('2026-09-14', {
      abreCiclo: true,
      lineas: [linea('Rachi', 30, 4, 9, 7.6), linea('Anticucho', 20, 0, 10, 8.8)],
      montoYape: 120,
      yapePendiente: true,
      gastos: [{ categoria: 'mercaderia', monto: 100 }],
    }),
    cierreDe('2026-09-28', {
      abreCiclo: true,
      lineas: [linea('Rachi', 30, 5, 9, 7.6), linea('Anticucho', 20, 0, 10, 8.8)],
      gastos: [{ categoria: 'mercaderia', monto: 100 }],
    }),
  ];
  const ctx = ctxDe(cierres, productos);

  it('en todas las intenciones sale de la propia frase', () => {
    for (const i of INTENCIONES) {
      for (const dia of ['ayer', 'hoy', 'martes', 'ninguno'] as const) {
        for (const p of [undefined, 'p-rachi', 'p-anticucho', 'p-chicha']) {
          const h = responderConsulta(consultaDe(i.id, { dia, producto: p }), ctx);
          expect(h.intencion).toBe(i.id);
          expect(h.cifras).toEqual(extraerCifras(h.frase));
        }
      }
    }
  });

  it('con datos, las intenciones con cifras traen al menos una', () => {
    const conCifras: IntencionId[] = [
      'mejorDia',
      'peorDia',
      'productoQueMasDeja',
      'productoQueMasSeVende',
      'cuantoPorCobrar',
      'cuantoSacarParaLaCasa',
      'compararCiclo',
      'cuandoRecupereCapital',
    ];
    for (const id of conCifras) {
      expect(responderConsulta(consultaDe(id), ctx).cifras.length).toBeGreaterThan(0);
    }
  });

  it('ninguna frase usa jerga ni menciona un servicio', () => {
    for (const i of INTENCIONES) {
      const h = responderConsulta(consultaDe(i.id, { dia: 'ayer', producto: 'p-rachi' }), ctx);
      expect(h.frase).not.toMatch(
        /\b(balance|margen|utilidad|transacción|SKU|ROI|Jev|DeepSeek|IA)\b/i,
      );
    }
  });
});

describe('no mutan lo que reciben', () => {
  it('con todo congelado, ninguna intención lanza y el resultado no cambia', () => {
    const productos = [producto('Anticucho', 10, 8.8), producto('Rachi', 9, 7.6)];
    const cierres = [
      cierreDe('2026-07-09', { abreCiclo: true, lineas: [linea('Anticucho', 20, 0, 10, 8.2)] }),
      ...semanasCon([4, 10, 10, 16]),
      cierreDe('2026-09-28', {
        abreCiclo: true,
        lineas: [linea('Rachi', 30, 5, 9, 7.6)],
        montoYape: 120,
        yapePendiente: true,
        gastos: [{ categoria: 'mercaderia', monto: 100 }],
      }),
    ];
    const ctx = ctxDe(cierres, productos);
    const antes = JSON.stringify(ctx);
    congelar(ctx);
    for (const i of INTENCIONES) {
      const consulta = congelar(consultaDe(i.id, { dia: 'martes', producto: 'p-rachi' }));
      const a = responderConsulta(consulta, ctx);
      expect(responderConsulta(consulta, ctx)).toEqual(a);
    }
    expect(JSON.stringify(ctx)).toBe(antes);
  });

  it('interpretarRespuesta no muta la respuesta', () => {
    const r = congelar({ intencion: 'peorDia', producto: 'rachi', dia: 'ninguno', confianza: 0.9 });
    expect(() => interpretarRespuesta(r)).not.toThrow();
    expect(r.producto).toBe('rachi');
  });
});

describe('la regla del día flojo no cambió al compartir su medición', () => {
  // Resultado de cada regla (null = no aplica) con la semilla real, medido ANTES de refactorizar
  // `reglas.ts`: seis reglas, de `cobro` a `comparacion`. Si el refactor cambia una sola frase, falla.
  const COMUN = [
    'Tu anticucho te deja S/ 0.40 menos que en julio. ¿Revisas el precio?',
    'Te sobró rachi dos ciclos seguidos. Prepara 10 porciones menos.',
    'Puedes sacar S/ 269.00 para la casa sin tocar tu capital.',
    'Los miércoles ganas S/ 18.13 menos que tu promedio.',
    'Ganaste S/ 78.00 menos que el ciclo pasado',
  ];
  const ANTES: Record<string, string[]> = {
    '2026-10-07': ['Tienes S/ 427.00 por cobrar desde el 29 de septiembre.', ...COMUN],
    '2026-10-14': ['Tienes S/ 427.00 por cobrar desde el 6 de octubre.', ...COMUN],
    '2026-10-21': ['Tienes S/ 427.00 por cobrar desde el 13 de octubre.', ...COMUN],
    '2026-10-28': ['Tienes S/ 427.00 por cobrar desde el 20 de octubre.', ...COMUN],
  };

  const semilla = () => {
    const r = validarSemilla(
      JSON.parse(readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8')),
    );
    if (!r.ok) throw new Error('La semilla real no valida');
    return r.semilla;
  };

  it.each(Object.keys(ANTES))('las seis reglas dicen lo de siempre con hoy = %s', dia => {
    const [anio, mes, d] = dia.split('-').map(Number);
    const fecha = new Date(anio, mes - 1, d, 12);
    const { cierres, productos } = materializarSemilla(semilla(), fecha);
    const c = ctxDe(cierres, productos, fechaLocal(fecha));
    expect(REGLAS.map(r => (r.aplica(c) ? r.mensaje(c) : null))).toEqual(ANTES[dia]);
  });

  it('diaMasFlojo mide la ganancia del día, con 28 días y 2 cierres por día', () => {
    const e8 = semanasCon([4, 10, 10, 10]);
    expect(diaMasFlojo(ctxDe(e8))).toEqual({ dia: 3, diferencia: 4.5 });
    expect(diaMasFlojo(ctxDe(e8.slice(0, 12)))).toBeNull();
    expect(diaMasFlojo(ctxDe([]))).toBeNull();
    // El mejor día del chat no pide el 20 %: el jueves está S/ 1.50 sobre el promedio de 8.50
    expect(mejorDiaDeLaSemana(ctxDe(e8))).toEqual({ dia: 4, diferencia: 1.5 });
    expect(mejorDiaDeLaSemana(ctxDe([]))).toBeNull();
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
    consultaDe('ventaDelDia', { dia: 'ninguno' }),
    consultaDe('mejorDia'),
    consultaDe('peorDia'),
    consultaDe('productoQueMasDeja'),
    consultaDe('productoQueMasSeVende'),
    consultaDe('cuantoPorCobrar'),
    consultaDe('cuantoSacarParaLaCasa'),
    consultaDe('cuantoPreparar', { producto: 'p-rachi' }),
    consultaDe('compararCiclo'),
    consultaDe('revisarPrecio', { producto: 'p-anticucho' }),
    consultaDe('cuandoRecupereCapital'),
  ];

  it('las once intenciones con datos devuelven una frase con cifras y ninguna lanza', () => {
    for (const consulta of consultas) {
      const h = responderConsulta(consulta, ctx);
      expect(h.intencion).toBe(consulta.intencion);
      expect(h.frase.length).toBeGreaterThan(10);
      expect(h.cifras.length).toBeGreaterThan(0);
      expect(h.cifras).toEqual(extraerCifras(h.frase));
    }
  });

  it('coincide con lo que dice Inicio el 20 de octubre', () => {
    const regla = (id: string) => evaluarReglas(ctx).find(r => r.reglaId === id)?.mensaje;
    const dice = (c: Consulta) => frase(c, ctx);
    expect(dice(consultaDe('cuantoPorCobrar'))).toBe(
      'Tienes S/ 427.00 por cobrar desde el 6 de octubre.',
    );
    expect(dice(consultaDe('cuantoPorCobrar'))).toBe(regla('cobro'));
    expect(dice(consultaDe('revisarPrecio', { producto: 'p-anticucho' }))).toBe(regla('precio'));
    expect(dice(consultaDe('cuantoSacarParaLaCasa'))).toBe(
      'Puedes sacar S/ 269.00 para la casa sin tocar tu capital.',
    );
    expect(dice(consultaDe('cuantoPreparar', { producto: 'p-rachi' }))).toBe(
      'Te sobró rachi dos ciclos seguidos. Prepara 10 porciones menos.',
    );
    expect(dice(consultaDe('peorDia'))).toBe(
      'Los miércoles son tu día más flojo: ganas S/ 18.13 menos que tu promedio.',
    );
    expect(dice(consultaDe('compararCiclo'))).toBe('Ganaste S/ 78.00 menos que el ciclo pasado.');
  });

  it('los días con y sin cierre responden sin error técnico', () => {
    for (const dia of DIAS_CONSULTA) {
      const h = responderConsulta(consultaDe('ventaDelDia', { dia }), ctx);
      expect(h.frase).toMatch(/^[A-ZÁÉÍÓÚ¿].*[.:]$/);
      expect(h.frase).not.toMatch(/undefined|NaN|null|Error/);
    }
  });
});
