/** La definición única de "cifra" (`extraerCifras`). */

import { extraerCifras } from '@analisis/cifras';

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
