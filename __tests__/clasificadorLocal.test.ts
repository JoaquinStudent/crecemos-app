// Pruebas del clasificador local: las doce intenciones sin red, con frases de vendedor peruano,
// sin tildes, con mayúsculas y con faltas comunes.
import { clasificarLocal, extraerDia } from '@analisis/clasificadorLocal';
import { INTENCIONES, PREGUNTAS_SUGERIDAS, UMBRAL_CONFIANZA } from '@analisis/intenciones';
import { normalizarTexto } from '@analisis/texto';
import type { IntencionId } from '@dominio/tipos';

const FRASES: Array<[IntencionId, string[]]> = [
  [
    'ventaDelDia',
    [
      '¿Cuánto vendí ayer?',
      'cuanto vendi hoy',
      'CUÁNTO VENDÍ EL SÁBADO',
      'cuanto gane anteayer',
      'cómo me fue ayer',
      'cuanto vendi el lunes?',
      'dime mi venta de hoy',
    ],
  ],
  [
    'mejorDia',
    [
      '¿Qué día me va mejor?',
      'cual es mi mejor dia',
      'que dia vendo mas',
      'qué día gano más',
      'dia que mas vendo',
      'cual es mi dia fuerte',
    ],
  ],
  [
    'peorDia',
    [
      '¿Qué día me va peor?',
      'cual es mi peor dia',
      'que dia vendo menos',
      'cual es mi dia mas flojo',
      'dia que menos gano',
      'que dia me va mal',
    ],
  ],
  [
    'productoQueMasDeja',
    [
      '¿Cuál me deja más?',
      'que producto me deja mas',
      'con cual gano mas',
      'cual es el mas rentable',
      'que plato me deja mas ganancia',
      'cual me deja mas plata',
    ],
  ],
  [
    'productoQueMasSeVende',
    [
      '¿Cuál se vende más?',
      'que producto se vende mas',
      'cual es el mas vendido',
      'el que mas vendo',
      'cual vendo mas',
      'que es lo que mas se vende',
    ],
  ],
  [
    'cuantoPorCobrar',
    [
      '¿Cuánto me deben?',
      'cuanto me deben todavia',
      'me deben plata',
      'cuanto tengo por cobrar',
      'cuanto falta cobrar de yape',
      'quien me debe',
      'tengo yapes pendientes',
    ],
  ],
  [
    'cuantoSacarParaLaCasa',
    [
      '¿Cuánto puedo sacar para la casa?',
      'cuanto saco para la casa',
      'cuanto me puedo llevar a la casa',
      'cuanto puedo retirar',
      'cuanto me puedo pagar',
      'cuanto puedo sacar sin tocar el capital',
    ],
  ],
  [
    'cuantoPreparar',
    [
      '¿Qué debería preparar mañana?',
      'que preparo manana',
      'cuanto preparo para manana',
      'cuanto debo comprar',
      'qué compro mañana',
      'cuantas porciones preparo',
      'cuanto cocino manana',
    ],
  ],
  [
    'compararCiclo',
    [
      '¿Cómo voy contra el ciclo pasado?',
      'como voy en este ciclo',
      'comparado con el ciclo anterior',
      'voy mejor que el ciclo pasado',
      'como me fue en el ciclo',
      'como voy contra el ciclo anterior',
    ],
  ],
  [
    'revisarPrecio',
    [
      '¿Debo revisar un precio?',
      'debo subir el precio',
      'me conviene subir el precio',
      'tengo que cambiar un precio',
      'revisar precios',
      'el precio del anticucho deberia subir',
    ],
  ],
  [
    'cuandoRecupereCapital',
    [
      '¿Cuándo recuperé mi capital?',
      'ya recupere mi capital',
      'cuando recupero lo que invertí',
      'cuando empiezo a ganar',
      'ya recupere la inversion',
      'como va mi capital',
    ],
  ],
  [
    'resumenMesPasado',
    [
      '¿Cómo me fue el mes pasado?',
      'como me fue el mes pasado',
      'cuanto vendi el mes pasado',
      'cómo cerré el mes',
      'ventas del mes pasado',
      'cómo me fue en el mes anterior',
    ],
  ],
  [
    'resumenMesActual',
    [
      '¿Cómo voy este mes?',
      'como voy este mes',
      'cuanto vendi este mes',
      'ventas del mes',
      'cómo me va este mes',
      'cuánto llevo este mes',
    ],
  ],
];

describe('clasificarLocal: las doce intenciones', () => {
  for (const [intencion, frases] of FRASES) {
    it(`${intencion}: al menos 5 formas de preguntarlo`, () => {
      expect(frases.length).toBeGreaterThanOrEqual(5);
      for (const frase of frases) {
        const c = clasificarLocal(frase, '2026-10-07');
        expect({ frase, intencion: c.intencion }).toEqual({ frase, intencion });
        expect(c.confianza).toBeGreaterThanOrEqual(UMBRAL_CONFIANZA);
        expect(c.confianza).toBeLessThanOrEqual(1);
      }
    });
  }

  it('cubre todas las intenciones reales menos noEntendi', () => {
    const cubiertas = FRASES.map(([id]) => id).sort();
    const reales = INTENCIONES.map(i => i.id)
      .filter(id => id !== 'noEntendi')
      .sort();
    expect(cubiertas).toEqual(reales);
  });

  it('cada pregunta sugerida cae en su propia intención', () => {
    for (const i of INTENCIONES) {
      if (i.sugerida === null) continue;
      expect({ q: i.sugerida, id: clasificarLocal(i.sugerida).intencion }).toEqual({
        q: i.sugerida,
        id: i.id,
      });
    }
    expect(PREGUNTAS_SUGERIDAS.length).toBeGreaterThan(0);
  });

  it('da lo mismo con mayúsculas, sin tildes y con signos', () => {
    const a = clasificarLocal('¿¿CUÁNTO   me DEBEN??');
    const b = clasificarLocal('cuanto me deben');
    expect(a).toEqual(b);
  });
});

describe('clasificarLocal: umbral y ambigüedad', () => {
  it('usa el mismo umbral 0,6 que el servidor', () => {
    expect(UMBRAL_CONFIANZA).toBe(0.6);
  });

  it.each([
    '',
    '   ',
    'hola',
    'qué hora es',
    'cuéntame un chiste',
    'asdf qwer',
    'el clima de mañana en Lima',
  ])('«%s» no es del negocio: noEntendi con poca confianza', texto => {
    const c = clasificarLocal(texto);
    expect(c.intencion).toBe('noEntendi');
    expect(c.confianza).toBeLessThan(UMBRAL_CONFIANZA);
    expect(c.dia).toBeUndefined();
  });

  it('una pista débil sola («yape») no alcanza', () => {
    const c = clasificarLocal('yape');
    expect(c.intencion).toBe('noEntendi');
    expect(c.confianza).toBeLessThan(UMBRAL_CONFIANZA);
  });

  it('una pregunta que mezcla dos intenciones por igual es ambigua', () => {
    const c = clasificarLocal('cuanto me deben y cuanto puedo sacar para la casa');
    expect(c.intencion).toBe('noEntendi');
  });

  it('no falla con entradas raras', () => {
    expect(clasificarLocal(undefined as unknown as string).intencion).toBe('noEntendi');
    expect(clasificarLocal('x'.repeat(5000)).intencion).toBe('noEntendi');
    expect(clasificarLocal('💸💸💸').intencion).toBe('noEntendi');
  });

  it('es determinista', () => {
    expect(clasificarLocal('cuanto vendi ayer')).toEqual(clasificarLocal('cuanto vendi ayer'));
  });
});

describe('extraerDia', () => {
  it.each([
    ['cuanto vendi hoy', 'hoy'],
    ['cuánto vendí ayer', 'ayer'],
    ['cuanto vendi el lunes', 'lunes'],
    ['cuanto vendi el martes', 'martes'],
    ['cuanto vendi el miércoles', 'miercoles'],
    ['cuanto vendi el jueves', 'jueves'],
    ['cuanto vendi el viernes', 'viernes'],
    ['cuanto vendi el sábado', 'sabado'],
    ['cuanto vendi el domingo', 'domingo'],
    ['cuanto vendi los sabados', 'sabado'],
    ['cuanto vendi anoche', 'hoy'],
    ['cuanto me deben', 'ninguno'],
  ] as const)('«%s» → %s', (texto, dia) => {
    expect(extraerDia(texto, '2026-10-07')).toBe(
      dia === 'hoy' && texto.includes('anoche') ? 'ayer' : dia,
    );
  });

  it('anteayer se vuelve el día de la semana que fue (hoy miércoles 7/10 → lunes)', () => {
    expect(extraerDia('cuanto vendi anteayer', '2026-10-07')).toBe('lunes');
    expect(extraerDia('cuanto vendi antes de ayer', '2026-10-07')).toBe('lunes');
    expect(extraerDia('cuanto vendi antier', '2026-10-07')).toBe('lunes');
  });

  it('sin saber qué día es hoy, anteayer es ninguno', () => {
    expect(extraerDia('cuanto vendi anteayer')).toBe('ninguno');
  });

  it('gana el día que aparece primero', () => {
    expect(extraerDia('ayer o el lunes?')).toBe('ayer');
  });

  it('clasificarLocal devuelve el día en ventaDelDia', () => {
    expect(clasificarLocal('cuanto vendi ayer')).toMatchObject({
      intencion: 'ventaDelDia',
      dia: 'ayer',
    });
    expect(clasificarLocal('cuanto vendi el sabado')).toMatchObject({ dia: 'sabado' });
    expect(clasificarLocal('cuanto vendi anteayer', '2026-10-07')).toMatchObject({ dia: 'lunes' });
    expect(clasificarLocal('cuanto me deben')).toMatchObject({ dia: 'ninguno' });
  });
});

describe('normalizarTexto (compartido con la charla y el seguimiento)', () => {
  it('quita tildes, signos y mayúsculas y reduce letras repetidas', () => {
    expect(normalizarTexto('¡¿Cuánto   VENDÍ?!')).toBe('cuanto vendi');
    expect(normalizarTexto('holaaaa')).toBe('hola');
    expect(normalizarTexto('mañana')).toBe('manana');
  });
});
