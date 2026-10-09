/**
 * Pruebas de apoyo del vigilante de redacciones (no son escenarios del SPEC; el e9 vive en
 * `sdd/sprint-08.test.ts`): la definición única de "cifra", los cinco motivos de descarte y que
 * una redacción con otras palabras pero las mismas cifras sí pasa.
 */

import type { Hecho } from '@dominio/tipos';
import {
  extraerCifras,
  MAX_CARACTERES_REDACCION,
  validarRedaccion,
} from '@analisis/validarRedaccion';

const hechoDe = (frase: string, intencion: Hecho['intencion'] = 'ventaDelDia'): Hecho => ({
  intencion,
  frase,
  cifras: extraerCifras(frase),
});

const venta = (): Hecho => hechoDe('Ayer, martes 6 de octubre, vendiste S/ 205.00.');

describe('extraerCifras', () => {
  it('un monto con miles y decimales sale sin la coma', () => {
    expect(extraerCifras('Vendiste S/ 1,240.00 este mes.')).toEqual(['1240.00']);
    expect(extraerCifras('S/ 1,240,500.50')).toEqual(['1240500.50']);
  });

  it('enteros y decimales sueltos', () => {
    expect(extraerCifras('S/ 1.80 por porción, S/ 486.00 en total.')).toEqual(['1.80', '486.00']);
    expect(extraerCifras('410 porciones')).toEqual(['410']);
    expect(extraerCifras('0.5')).toEqual(['0.5']);
  });

  it('el día del mes de una fecha cuenta como cifra', () => {
    expect(extraerCifras('Ayer, martes 6 de octubre, vendiste S/ 205.00.')).toEqual([
      '6',
      '205.00',
    ]);
    expect(extraerCifras('desde el 29 de septiembre')).toEqual(['29']);
  });

  it('un porcentaje cuenta por su número, con o sin espacio', () => {
    expect(extraerCifras('recuperaste el 64 % de tu capital')).toEqual(['64']);
    expect(extraerCifras('recuperaste el 64% de tu capital')).toEqual(['64']);
  });

  it('el punto final de la oración no es un decimal', () => {
    expect(extraerCifras('Vendiste S/ 205.')).toEqual(['205']);
    expect(extraerCifras('Vendiste 205.00.')).toEqual(['205.00']);
  });

  it('el prefijo de soles pegado o con punto no cambia la cifra', () => {
    expect(extraerCifras('S/205')).toEqual(['205']);
    expect(extraerCifras('S/. 205')).toEqual(['205']);
  });

  it('los ceros a la izquierda se quitan, el signo se ignora', () => {
    expect(extraerCifras('2026-10-06')).toEqual(['2026', '10', '6']);
    expect(extraerCifras('-S/ 5.00')).toEqual(['5.00']);
    expect(extraerCifras('S/ 0.30')).toEqual(['0.30']);
  });

  it('los números en palabras NO son cifras: solo dígitos', () => {
    expect(extraerCifras('doscientos cinco soles, dos ciclos seguidos')).toEqual([]);
  });

  it('sin números devuelve []', () => {
    expect(extraerCifras('')).toEqual([]);
    expect(extraerCifras('No entendí tu pregunta. Prueba con una de estas:')).toEqual([]);
  });
});

describe('validarRedaccion · acepta', () => {
  it('una redacción con las mismas cifras y otras palabras', () => {
    const r = validarRedaccion('El martes 6 de octubre te entraron S/ 205.00 en ventas.', venta());
    expect(r).toEqual({
      ok: true,
      texto: 'El martes 6 de octubre te entraron S/ 205.00 en ventas.',
    });
  });

  it('cambiar una palabra pero no las cifras es válido', () => {
    const hecho = hechoDe(
      'Tienes S/ 120.00 por cobrar desde el 29 de septiembre.',
      'cuantoPorCobrar',
    );
    expect(validarRedaccion('Te deben S/ 120.00 desde el 29 de septiembre.', hecho).ok).toBe(true);
    expect(
      validarRedaccion('Pendiente de cobro: S/ 120.00, desde el 29 de septiembre.', hecho).ok,
    ).toBe(true);
  });

  it('las mismas cifras en otro orden', () => {
    const hecho = hechoDe(
      'El anticucho es el que más te deja: S/ 1.80 por porción, S/ 486.00 en total.',
    );
    const r = validarRedaccion('En total son S/ 486.00 y cada porción te deja S/ 1.80.', hecho);
    expect(r.ok).toBe(true);
  });

  it('cifras iguales escritas distinto: 205.0 ≡ 205.00 ≡ 205', () => {
    const hecho = hechoDe('Vendiste S/ 205.00.');
    expect(validarRedaccion('Vendiste S/ 205.0.', hecho).ok).toBe(true);
    expect(validarRedaccion('Vendiste S/ 205 en el día.', hecho).ok).toBe(true);
    expect(validarRedaccion('Vendiste S/ 205.00.', hecho).ok).toBe(true);
  });

  it('un monto con miles: 1,240.00 ≡ 1240', () => {
    const hecho = hechoDe('Vendiste S/ 1,240.00.');
    expect(validarRedaccion('Vendiste S/ 1240 en total.', hecho).ok).toBe(true);
  });

  it('un porcentaje con o sin espacio', () => {
    const hecho = hechoDe('Recuperaste el 64 % de tu capital.', 'cuandoRecupereCapital');
    expect(validarRedaccion('Ya recuperaste el 64% de tu capital.', hecho).ok).toBe(true);
  });

  it('repetir una cifra del hecho no es una cifra nueva', () => {
    expect(
      validarRedaccion('S/ 205.00. Sí, vendiste S/ 205.00.', hechoDe('Vendiste S/ 205.00.')).ok,
    ).toBe(true);
  });

  it('un hecho sin cifras acepta una redacción sin cifras', () => {
    const hecho = hechoDe('El martes no tienes ningún día cerrado.');
    expect(validarRedaccion('Del martes no hay ningún día cerrado todavía.', hecho).ok).toBe(true);
  });

  it('devuelve el texto recortado y en una sola línea', () => {
    const r = validarRedaccion('  Vendiste\nS/ 205.00   ayer.\n', hechoDe('Vendiste S/ 205.00.'));
    expect(r).toEqual({ ok: true, texto: 'Vendiste S/ 205.00 ayer.' });
  });

  it('mide justo 280 caracteres: pasa', () => {
    const relleno = 'a'.repeat(MAX_CARACTERES_REDACCION - ' S/ 205.00'.length);
    const texto = `${relleno} S/ 205.00`;
    expect(texto).toHaveLength(280);
    expect(validarRedaccion(texto, hechoDe('Vendiste S/ 205.00.')).ok).toBe(true);
  });
});

describe('validarRedaccion · descarta', () => {
  it('VACIA: vacía o solo espacios', () => {
    expect(validarRedaccion('', venta())).toEqual({ ok: false, motivo: 'VACIA' });
    expect(validarRedaccion('  \n\t ', venta())).toEqual({ ok: false, motivo: 'VACIA' });
  });

  it('VACIA: lo que no es texto', () => {
    expect(validarRedaccion(undefined as unknown as string, venta())).toEqual({
      ok: false,
      motivo: 'VACIA',
    });
    expect(validarRedaccion(null as unknown as string, venta())).toEqual({
      ok: false,
      motivo: 'VACIA',
    });
  });

  it('LARGA: 281 caracteres', () => {
    const relleno = 'a'.repeat(MAX_CARACTERES_REDACCION + 1 - ' S/ 205.00'.length);
    const texto = `${relleno} S/ 205.00`;
    expect(texto).toHaveLength(281);
    expect(validarRedaccion(texto, hechoDe('Vendiste S/ 205.00.'))).toEqual({
      ok: false,
      motivo: 'LARGA',
    });
  });

  it('CIFRA_NUEVA: S/ 205 contra S/ 250 (la del escenario 9)', () => {
    const hecho = hechoDe('vendiste S/ 205.00');
    expect(validarRedaccion('Ayer vendiste S/ 250.00', hecho)).toEqual({
      ok: false,
      motivo: 'CIFRA_NUEVA',
    });
    expect(validarRedaccion('Ayer vendiste S/ 250', hecho)).toEqual({
      ok: false,
      motivo: 'CIFRA_NUEVA',
    });
    expect(validarRedaccion('Ayer vendiste S/ 2050', hecho)).toEqual({
      ok: false,
      motivo: 'CIFRA_NUEVA',
    });
  });

  it('CIFRA_NUEVA: aparece un número que el hecho no tiene', () => {
    expect(
      validarRedaccion('Vendiste S/ 205.00 en 3 horas.', hechoDe('Vendiste S/ 205.00.')),
    ).toEqual({
      ok: false,
      motivo: 'CIFRA_NUEVA',
    });
  });

  it('CIFRA_NUEVA: un hecho sin cifras no admite ninguna', () => {
    expect(
      validarRedaccion(
        'Tienes S/ 40.00 por cobrar.',
        hechoDe('No tienes nada por cobrar.', 'cuantoPorCobrar'),
      ),
    ).toEqual({ ok: false, motivo: 'CIFRA_NUEVA' });
  });

  it('CIFRA_FALTA: se perdió una cifra del hecho', () => {
    expect(
      validarRedaccion('Ayer vendiste lo de siempre.', hechoDe('Vendiste S/ 205.00.')),
    ).toEqual({
      ok: false,
      motivo: 'CIFRA_FALTA',
    });
  });

  it('CIFRA_FALTA: la fecha también es una cifra del hecho', () => {
    // El hecho lleva el 6 de octubre; una redacción sin el día del mes pierde esa cifra.
    expect(validarRedaccion('Ayer vendiste S/ 205.00.', venta())).toEqual({
      ok: false,
      motivo: 'CIFRA_FALTA',
    });
  });

  it('CIFRA_FALTA: un número escrito en palabras no sustituye a la cifra', () => {
    expect(
      validarRedaccion('Vendiste doscientos cinco soles.', hechoDe('Vendiste S/ 205.00.')),
    ).toEqual({
      ok: false,
      motivo: 'CIFRA_FALTA',
    });
  });

  it('ENLACE: una dirección web, con o sin http', () => {
    const hecho = hechoDe('Vendiste S/ 205.00.');
    expect(validarRedaccion('Vendiste S/ 205.00. Mira https://ejemplo.com', hecho)).toEqual({
      ok: false,
      motivo: 'ENLACE',
    });
    expect(validarRedaccion('Vendiste S/ 205.00, más en www.ejemplo.pe', hecho)).toEqual({
      ok: false,
      motivo: 'ENLACE',
    });
    expect(validarRedaccion('Vendiste S/ 205.00. Entra a ejemplo.com', hecho)).toEqual({
      ok: false,
      motivo: 'ENLACE',
    });
    expect(validarRedaccion('Vendiste S/ 205.00. http', hecho)).toEqual({
      ok: false,
      motivo: 'ENLACE',
    });
  });

  it('un monto con punto decimal no se confunde con un enlace', () => {
    expect(validarRedaccion('Vendiste S/ 205.00.', hechoDe('Vendiste S/ 205.00.')).ok).toBe(true);
  });

  it('el orden de los motivos: vacía, larga, enlace, nueva y falta', () => {
    const hecho = hechoDe('Vendiste S/ 205.00.');
    const larga = `${'a'.repeat(300)} https://ejemplo.com S/ 999`;
    expect(validarRedaccion(larga, hecho)).toEqual({ ok: false, motivo: 'LARGA' });
    expect(validarRedaccion('https://ejemplo.com S/ 999', hecho)).toEqual({
      ok: false,
      motivo: 'ENLACE',
    });
    expect(validarRedaccion('S/ 999 y nada más', hecho)).toEqual({
      ok: false,
      motivo: 'CIFRA_NUEVA',
    });
  });
});

describe('validarRedaccion · el hecho', () => {
  it('acepta cifras del hecho escritas con su "S/ "', () => {
    const hecho: Hecho = {
      intencion: 'ventaDelDia',
      frase: 'Vendiste S/ 205.00.',
      cifras: ['S/ 205.00'],
    };
    expect(validarRedaccion('Vendiste S/ 205.00.', hecho).ok).toBe(true);
    expect(validarRedaccion('Vendiste S/ 250.00.', hecho).ok).toBe(false);
  });

  it('no muta el hecho', () => {
    const hecho = Object.freeze({
      intencion: 'ventaDelDia' as const,
      frase: 'Vendiste S/ 205.00.',
      cifras: Object.freeze(['205.00']) as unknown as string[],
    });
    expect(() => validarRedaccion('Vendiste S/ 205.00.', hecho)).not.toThrow();
    expect(hecho.cifras).toEqual(['205.00']);
  });
});
