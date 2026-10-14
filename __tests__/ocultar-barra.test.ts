/** La barra inferior se esconde al bajar el scroll y vuelve al subir. */
import { barraVisibleTras, TOPE_SIEMPRE_VISIBLE, UMBRAL_SCROLL } from '@navigation/ocultarBarra';

describe('barraVisibleTras', () => {
  it('se esconde al bajar más que el umbral', () => {
    expect(barraVisibleTras(300, 300 - UMBRAL_SCROLL, true)).toBe(false);
  });

  it('vuelve al subir más que el umbral', () => {
    expect(barraVisibleTras(300, 300 + UMBRAL_SCROLL, false)).toBe(true);
  });

  it('ignora movimientos pequeños: conserva el estado', () => {
    expect(barraVisibleTras(300, 295, true)).toBe(true);
    expect(barraVisibleTras(300, 295, false)).toBe(false);
    expect(barraVisibleTras(295, 300, false)).toBe(false);
  });

  it('cerca del tope siempre se ve', () => {
    expect(barraVisibleTras(TOPE_SIEMPRE_VISIBLE, 0, false)).toBe(true);
    expect(barraVisibleTras(-20, 0, false)).toBe(true);
  });
});
