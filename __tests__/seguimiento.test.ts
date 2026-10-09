/**
 * Pruebas de apoyo del seguimiento de la conversación (escenarios 23 y 24 en sprint-08.test.ts):
 * cuándo una pregunta corta hereda la intención, el producto o el día de la anterior, y cuándo no.
 */
import { completarConsulta } from '@analisis/seguimiento';
import type { Consulta, DiaConsulta, IntencionId } from '@dominio/tipos';

const c = (
  intencion: IntencionId,
  extra: { producto?: string; dia?: DiaConsulta } = {},
  confianza = 0.8,
): Consulta => ({ intencion, confianza, ...extra });

const previaPreparar = c('cuantoPreparar', { producto: 'p-anticucho', dia: 'ninguno' });
const previaVenta = c('ventaDelDia', { dia: 'ayer' });

describe('seguimiento: una consulta que Jev no entendió pero trae producto o día', () => {
  it('reutiliza la intención anterior con el producto nuevo', () => {
    const r = completarConsulta(
      c('noEntendi', { producto: 'p-pancita', dia: 'ninguno' }, 0.77),
      previaPreparar,
      '¿y de la pancita?',
    );
    expect(r).toEqual({ intencion: 'cuantoPreparar', producto: 'p-pancita', confianza: 0.77 });
  });

  it('reutiliza la intención anterior con el día nuevo', () => {
    const r = completarConsulta(c('noEntendi', { dia: 'hoy' }), previaVenta, '¿y hoy?');
    expect(r).toMatchObject({ intencion: 'ventaDelDia', dia: 'hoy' });
  });

  it('sin producto ni día nuevos sigue sin entenderse', () => {
    const r = completarConsulta(c('noEntendi', { dia: 'ninguno' }), previaPreparar, 'blablá');
    expect(r.intencion).toBe('noEntendi');
  });

  it('si el dato nuevo no lo usa la intención anterior, sigue sin entenderse', () => {
    const peorDia = c('peorDia');
    expect(
      completarConsulta(c('noEntendi', { producto: 'p-rachi' }), peorDia, '¿y el rachi?').intencion,
    ).toBe('noEntendi');
    expect(
      completarConsulta(c('noEntendi', { dia: 'ayer' }), previaPreparar, '¿y ayer?').intencion,
    ).toBe('noEntendi');
  });

  it.each([
    ['sin previa', undefined],
    ['previa nula', null],
    ['previa que no se entendió', c('noEntendi', { producto: 'p-anticucho' })],
  ])('%s: no hay herencia', (_nombre, previa) => {
    const nueva = c('noEntendi', { producto: 'p-pancita' });
    expect(completarConsulta(nueva, previa, '¿y de la pancita?')).toEqual(nueva);
  });
});

describe('seguimiento: una consulta real a la que le falta un dato', () => {
  it.each([
    ['¿y de la pancita?', true],
    ['y de la pancita', true],
    ['y el rachi', true],
    ['también', true],
    ['¿También de la chicha?', true],
    ['igual para la pancita', true],
    ['¿cuánto preparo?', true], // corta: 2 palabras
    ['¿cuánto debo preparar mañana?', false],
    ['recomiéndame qué comprar más mañana', false],
    ['dime cuánto preparar de todo', false],
  ])('"%s" hereda el producto: %s', (texto, hereda) => {
    const r = completarConsulta(c('cuantoPreparar', { dia: 'ninguno' }), previaPreparar, texto);
    expect(r.producto).toBe(hereda ? 'p-anticucho' : undefined);
  });

  it('hereda el día con un conector, y no con una pregunta completa', () => {
    expect(
      completarConsulta(c('ventaDelDia', { dia: 'ninguno' }), previaVenta, '¿y hoy?').dia,
    ).toBe('ayer');
    expect(
      completarConsulta(
        c('ventaDelDia', { dia: 'ninguno' }),
        previaVenta,
        '¿cuánto vendí en mi último día?',
      ).dia,
    ).toBe('ninguno');
  });

  it('no pisa un dato que la nueva ya trae', () => {
    const r = completarConsulta(
      c('cuantoPreparar', { producto: 'p-pancita' }),
      previaPreparar,
      '¿y de la pancita?',
    );
    expect(r.producto).toBe('p-pancita');
    const d = completarConsulta(c('ventaDelDia', { dia: 'hoy' }), previaVenta, '¿y hoy?');
    expect(d.dia).toBe('hoy');
  });

  it('no hereda si la previa no tenía el dato', () => {
    const r = completarConsulta(c('cuantoPreparar'), c('cuantoPreparar'), '¿y de eso?');
    expect(r.producto).toBeUndefined();
  });

  it('no hereda sin previa ni con una previa que no se entendió', () => {
    const nueva = c('cuantoPreparar');
    expect(completarConsulta(nueva, undefined, '¿y de eso?')).toEqual(nueva);
    expect(
      completarConsulta(nueva, c('noEntendi', { producto: 'p-anticucho' }), '¿y de eso?'),
    ).toEqual(nueva);
  });

  it('no cambia la intención ni la confianza de la nueva, ni muta lo que recibe', () => {
    const nueva = c('revisarPrecio', {}, 0.66);
    const copia = JSON.parse(JSON.stringify(nueva));
    const r = completarConsulta(nueva, previaPreparar, '¿y el precio?');
    expect(r.intencion).toBe('revisarPrecio');
    expect(r.confianza).toBe(0.66);
    expect(r.producto).toBe('p-anticucho');
    expect(nueva).toEqual(copia);
  });

  it('puede heredar un producto de otra intención que también lo usa', () => {
    const r = completarConsulta(c('revisarPrecio'), previaPreparar, '¿y el precio?');
    expect(r.producto).toBe('p-anticucho');
  });
});

describe('seguimiento: las intenciones que no usan producto ni día no heredan nada', () => {
  const sinDatos: IntencionId[] = [
    'mejorDia',
    'peorDia',
    'productoQueMasDeja',
    'productoQueMasSeVende',
    'cuantoPorCobrar',
    'cuantoSacarParaLaCasa',
    'compararCiclo',
    'cuandoRecupereCapital',
  ];
  const previaCompleta = c('cuantoPreparar', { producto: 'p-anticucho', dia: 'ayer' });

  it.each(sinDatos)('%s', intencion => {
    const nueva = c(intencion);
    expect(completarConsulta(nueva, previaCompleta, '¿y eso?')).toEqual(nueva);
  });

  it('el producto no se hereda a una intención que solo usa el día, y al revés', () => {
    expect(
      completarConsulta(c('ventaDelDia', { dia: 'ninguno' }), previaPreparar, '¿y?').producto,
    ).toBeUndefined();
    expect(completarConsulta(c('cuantoPreparar'), previaVenta, '¿y?').dia).toBeUndefined();
  });
});
