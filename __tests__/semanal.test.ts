/**
 * Pruebas del resumen semanal ("Tu semana"): la semana lunes a domingo anterior a `hoy`, sus
 * cifras, el mejor y el peor día, la comparación en soles y la política de datos de ejemplo.
 */
import { nuevoCierre } from '@dominio/cierre';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, Origen } from '@dominio/tipos';
import {
  lunesDeLaSemana,
  mostrarTuSemana,
  resumenSemanaPasada,
  textoMejorDia,
  textoPeorDia,
} from '@analisis/semanal';

// El anticucho de PRODUCTOS_POR_DEFECTO se vende a S/ 10.00: n porciones = n × 10 de venta.
const dia = (fecha: string, porciones: number, gasto = 0, origen?: Origen): Cierre => ({
  ...nuevoCierre(
    {
      fecha,
      lineas: [{ productoId: 'p-anticucho', preparadas: porciones, sobrantes: 0 }],
      montoYape: 0,
      gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
      abreCiclo: false,
    },
    PRODUCTOS_POR_DEFECTO,
    null,
    new Date('2026-01-01T12:00:00-05:00'),
  ),
  id: `c-${fecha}`,
  ...(origen ? { origen } : {}),
});

// 2026-10-12 es lunes. La semana pasada: lunes 5 a domingo 11 de octubre.
describe('lunesDeLaSemana y mostrarTuSemana', () => {
  it('encuentra el lunes de cada día, incluido el domingo', () => {
    expect(lunesDeLaSemana('2026-10-12')).toBe('2026-10-12');
    expect(lunesDeLaSemana('2026-10-14')).toBe('2026-10-12');
    expect(lunesDeLaSemana('2026-10-18')).toBe('2026-10-12'); // domingo
    expect(lunesDeLaSemana('2026-10-11')).toBe('2026-10-05'); // domingo anterior
  });

  it('la tarjeta se muestra de lunes a miércoles y no jueves a domingo', () => {
    const dias = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
    expect(dias.map(mostrarTuSemana)).toEqual([true, true, true, false, false, false, false]);
  });
});

describe('resumenSemanaPasada', () => {
  it('suma ventas, gastos y "te quedó" de lunes a domingo, sin contar la semana en curso', () => {
    const cierres = [
      dia('2026-10-05', 10, 20), // 100 - 20 = 80
      dia('2026-10-07', 20), // 200
      dia('2026-10-11', 5, 10), // 50 - 10 = 40
      dia('2026-10-12', 99), // hoy: no entra
      dia('2026-10-04', 99), // domingo anterior: no entra
    ];
    const r = resumenSemanaPasada(cierres, '2026-10-12')!;
    expect(r.desde).toBe('2026-10-05');
    expect(r.hasta).toBe('2026-10-11');
    expect(r.vendido).toBe(350);
    expect(r.gastado).toBe(30);
    expect(r.teQueda).toBe(320);
    expect(r.diasRegistrados).toBe(3);
    expect(r.soloEjemplo).toBe(false);
  });

  it('el mismo resultado de martes o de miércoles: la semana pasada no cambia durante la semana', () => {
    const cierres = [dia('2026-10-05', 1), dia('2026-10-06', 2), dia('2026-10-07', 3)];
    const lunes = resumenSemanaPasada(cierres, '2026-10-12');
    expect(resumenSemanaPasada(cierres, '2026-10-14')).toEqual(lunes);
  });

  it('con menos de 3 días registrados no hay resumen', () => {
    expect(resumenSemanaPasada([dia('2026-10-05', 1), dia('2026-10-06', 1)], '2026-10-12')).toBeNull();
    expect(resumenSemanaPasada([], '2026-10-12')).toBeNull();
  });

  it('una semana parcial con exactamente 3 de 7 días ya cuenta', () => {
    const r = resumenSemanaPasada(
      [dia('2026-10-05', 1), dia('2026-10-09', 1), dia('2026-10-11', 1)],
      '2026-10-12',
    );
    expect(r?.diasRegistrados).toBe(3);
  });

  it('cruza el cambio de mes: la semana del 28 de septiembre al 4 de octubre', () => {
    const cierres = [dia('2026-09-28', 1), dia('2026-09-30', 2), dia('2026-10-04', 3)];
    const r = resumenSemanaPasada(cierres, '2026-10-05')!;
    expect(r.desde).toBe('2026-09-28');
    expect(r.hasta).toBe('2026-10-04');
    expect(r.vendido).toBe(60);
  });

  it('cruza el cambio de año: la semana del 28 de diciembre al 3 de enero', () => {
    // 2026-12-28 es lunes.
    const cierres = [dia('2026-12-28', 1), dia('2026-12-31', 2), dia('2027-01-03', 3)];
    const r = resumenSemanaPasada(cierres, '2027-01-04')!;
    expect(r.desde).toBe('2026-12-28');
    expect(r.hasta).toBe('2027-01-03');
    expect(r.diasRegistrados).toBe(3);
  });

  it('el mejor día y el peor día salen del "te quedó" de cada día, con el nombre del día', () => {
    const r = resumenSemanaPasada(
      [dia('2026-10-05', 10), dia('2026-10-10', 30), dia('2026-10-08', 2)],
      '2026-10-12',
    )!;
    expect(r.mejorDia).toMatchObject({ dia: 'sábado', teQueda: 300 });
    expect(r.peorDia).toMatchObject({ dia: 'jueves', teQueda: 20 });
    expect(textoMejorDia(r.mejorDia!)).toBe('El sábado fue tu mejor día: te quedó S/ 300.00');
    expect(textoPeorDia(r.peorDia!)).toBe('El jueves fue el más flojo: te quedó S/ 20.00');
  });

  it('en un empate de mejor día gana el más temprano de la semana', () => {
    const r = resumenSemanaPasada(
      [dia('2026-10-09', 20), dia('2026-10-06', 20), dia('2026-10-07', 5)],
      '2026-10-12',
    )!;
    expect(r.mejorDia).toMatchObject({ fecha: '2026-10-06', dia: 'martes' });
  });

  it('si todos los días quedan igual no inventa mejor ni peor día', () => {
    const r = resumenSemanaPasada(
      [dia('2026-10-05', 10), dia('2026-10-06', 10), dia('2026-10-07', 10)],
      '2026-10-12',
    )!;
    expect(r.mejorDia).toBeUndefined();
    expect(r.peorDia).toBeUndefined();
  });

  it('un día en negativo se dice con palabras, sin signos raros', () => {
    const r = resumenSemanaPasada(
      [dia('2026-10-05', 10), dia('2026-10-06', 10), dia('2026-10-07', 0, 15)],
      '2026-10-12',
    )!;
    expect(textoPeorDia(r.peorDia!)).toBe(
      'El miércoles fue el más flojo: gastaste S/ 15.00 más de lo que vendiste',
    );
  });

  it('compara con la semana anterior en soles, nunca en porcentaje', () => {
    const cierres = [
      dia('2026-09-28', 10), // semana anterior: 100 + 100 = 200
      dia('2026-09-30', 10),
      dia('2026-10-05', 10), // semana pasada: 100 + 100 + 85 = 285
      dia('2026-10-06', 10),
      dia('2026-10-07', 8.5),
    ];
    const r = resumenSemanaPasada(cierres, '2026-10-12')!;
    expect(r.comparacion).toEqual({ diferencia: 85, texto: 'S/ 85.00 más que la semana anterior' });
    expect(r.comparacion!.texto).not.toMatch(/%/);
  });

  it('dice más, menos o igual según la diferencia', () => {
    const mas = resumenSemanaPasada(
      [dia('2026-09-28', 20), dia('2026-10-05', 10), dia('2026-10-06', 10), dia('2026-10-07', 10)],
      '2026-10-12',
    )!;
    expect(mas.comparacion!.texto).toBe('S/ 100.00 más que la semana anterior');
    const menos = resumenSemanaPasada(
      [dia('2026-09-28', 40), dia('2026-10-05', 10), dia('2026-10-06', 10), dia('2026-10-07', 10)],
      '2026-10-12',
    )!;
    expect(menos.comparacion!.texto).toBe('S/ 100.00 menos que la semana anterior');
    const igual = resumenSemanaPasada(
      [dia('2026-09-28', 30), dia('2026-10-05', 10), dia('2026-10-06', 10), dia('2026-10-07', 10)],
      '2026-10-12',
    )!;
    expect(igual.comparacion!.texto).toBe('Igual que la semana anterior');
  });

  it('sin días en la semana anterior omite la comparación', () => {
    const r = resumenSemanaPasada(
      [dia('2026-10-05', 1), dia('2026-10-06', 1), dia('2026-10-07', 1)],
      '2026-10-12',
    )!;
    expect(r.comparacion).toBeUndefined();
  });

  describe('datos de ejemplo', () => {
    it('si todo es de ejemplo, resume con el aviso soloEjemplo', () => {
      const r = resumenSemanaPasada(
        [
          dia('2026-10-05', 10, 0, 'ejemplo'),
          dia('2026-10-06', 10, 0, 'ejemplo'),
          dia('2026-10-07', 10, 0, 'ejemplo'),
        ],
        '2026-10-12',
      )!;
      expect(r.soloEjemplo).toBe(true);
      expect(r.teQueda).toBe(300);
    });

    it('si hay días propios, los de ejemplo no inflan las cifras reales', () => {
      const r = resumenSemanaPasada(
        [
          dia('2026-10-05', 10),
          dia('2026-10-06', 10),
          dia('2026-10-07', 10),
          dia('2026-10-08', 100, 0, 'ejemplo'),
          dia('2026-09-29', 500, 0, 'ejemplo'),
        ],
        '2026-10-12',
      )!;
      expect(r.soloEjemplo).toBe(false);
      expect(r.teQueda).toBe(300);
      expect(r.diasRegistrados).toBe(3);
      expect(r.comparacion).toBeUndefined(); // la semana anterior solo tenía ejemplo
    });

    it('los días de ejemplo no completan los 3 días mínimos de una semana propia', () => {
      const r = resumenSemanaPasada(
        [
          dia('2026-10-05', 10),
          dia('2026-10-06', 10),
          dia('2026-10-07', 10, 0, 'ejemplo'),
          dia('2026-10-08', 10, 0, 'ejemplo'),
        ],
        '2026-10-12',
      );
      expect(r).toBeNull();
    });
  });
});
