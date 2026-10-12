import {
  cantidadConUnidad,
  pluralizarUnidad,
  singularUnidad,
  unidadSegunCantidad,
} from '@dominio/unidades';

describe('unidades', () => {
  it('singular', () => {
    expect(singularUnidad('porcion')).toBe('porción');
    expect(singularUnidad('vaso')).toBe('vaso');
    expect(singularUnidad('  ')).toBe('unidad');
    expect(singularUnidad(undefined)).toBe('unidad');
  });

  it('plural en español, sin "unidads" ni "pans"', () => {
    expect(pluralizarUnidad('porcion')).toBe('porciones');
    expect(pluralizarUnidad('vaso')).toBe('vasos');
    expect(pluralizarUnidad('unidad')).toBe('unidades');
    expect(pluralizarUnidad('pan')).toBe('panes');
    expect(pluralizarUnidad('ración')).toBe('raciones');
    expect(pluralizarUnidad('lápiz')).toBe('lápices');
    expect(pluralizarUnidad('platos')).toBe('platos');
    expect(pluralizarUnidad('')).toBe('unidades');
  });

  it('según la cantidad', () => {
    expect(unidadSegunCantidad(1, 'pan')).toBe('pan');
    expect(unidadSegunCantidad(0, 'pan')).toBe('panes');
    expect(cantidadConUnidad(1, 'porcion')).toBe('1 porción');
    expect(cantidadConUnidad(12, 'porcion')).toBe('12 porciones');
    expect(cantidadConUnidad(3, 'vaso')).toBe('3 vasos');
    expect(cantidadConUnidad(2, 'unidad')).toBe('2 unidades');
  });
});
