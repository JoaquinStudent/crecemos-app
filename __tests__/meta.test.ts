/** Dominio de "Mi cuota" (alcancía): sugerido diario, tope, estado y límites. Todo puro, `hoy` por parámetro. */
import { fechaDesdePartes, finDeMes } from '@dominio/fecha';
import {
  aporteSugeridoDiario,
  diasRestantes,
  estado,
  faltante,
  Meta,
  normalizarMeta,
  plazosRapidos,
  progreso,
  sugerenciaDeHoy,
  textoPlazo,
  totalAportado,
  validarAporte,
  validarMeta,
} from '@dominio/meta';

const HOY = '2026-10-12';

const meta = (parcial: Partial<Meta> = {}): Meta => ({
  id: 'm-1',
  nombre: 'Mi cuota',
  montoObjetivo: 140,
  fechaLimite: '2026-10-19', // 7 días
  creada: HOY,
  aportes: [],
  ...parcial,
});

const aporte = (monto: number, fecha = HOY, id = `a-${monto}-${fecha}`) => ({ id, fecha, monto });

describe('meta: sugerido diario', () => {
  it('reparte lo que falta entre los días que quedan', () => {
    expect(diasRestantes(meta(), HOY)).toBe(7);
    expect(aporteSugeridoDiario(meta(), HOY)).toBe(20);
  });

  it('redondea hacia arriba a S/ 0.50', () => {
    expect(aporteSugeridoDiario(meta({ montoObjetivo: 100 }), HOY)).toBe(14.5); // 14.28 → 14.50
    expect(aporteSugeridoDiario(meta({ montoObjetivo: 141 }), HOY)).toBe(20.5); // 20.14 → 20.50
  });

  it('con lo ya separado, reparte lo que falta', () => {
    const m = meta({ aportes: [aporte(40, '2026-10-10')] });
    expect(faltante(m)).toBe(100);
    expect(aporteSugeridoDiario(m, HOY)).toBe(14.5);
  });

  it('si hoy ya separó lo que tocaba, no insiste (0)', () => {
    const m = meta({ aportes: [aporte(20)] });
    expect(aporteSugeridoDiario(m, HOY)).toBe(0);
  });

  it('si hoy separó menos de lo que tocaba, sugiere la diferencia', () => {
    const m = meta({ aportes: [aporte(5)] });
    expect(aporteSugeridoDiario(m, HOY)).toBe(15);
  });

  it('con 0 días (vence hoy) cuenta 1: sugiere todo lo que falta', () => {
    const m = meta({ fechaLimite: HOY });
    expect(diasRestantes(m, HOY)).toBe(0);
    expect(aporteSugeridoDiario(m, HOY)).toBe(140);
  });

  it('con fecha pasada tampoco divide entre cero ni entre negativo', () => {
    const m = meta({ fechaLimite: '2026-10-01' });
    expect(diasRestantes(m, HOY)).toBe(0);
    expect(aporteSugeridoDiario(m, HOY)).toBe(140);
  });

  it('nunca sugiere más de lo que falta aunque el redondeo se pase', () => {
    const m = meta({ montoObjetivo: 10.2, fechaLimite: HOY });
    expect(aporteSugeridoDiario(m, HOY)).toBe(10.2);
  });

  it('con la meta cumplida no sugiere nada', () => {
    const m = meta({ aportes: [aporte(140)] });
    expect(aporteSugeridoDiario(m, HOY)).toBe(0);
  });
});

describe('meta: tope por lo que te queda', () => {
  it('sin cierres no hay tope', () => {
    expect(sugerenciaDeHoy(meta(), HOY, undefined)).toEqual({ monto: 20, limitadoPorTeQueda: false });
  });

  it('si te queda más que lo sugerido, sugiere lo mismo', () => {
    expect(sugerenciaDeHoy(meta(), HOY, 80)).toEqual({ monto: 20, limitadoPorTeQueda: false });
  });

  it('si te queda menos, baja al medio sol de abajo y lo avisa', () => {
    expect(sugerenciaDeHoy(meta(), HOY, 12.8)).toEqual({ monto: 12.5, limitadoPorTeQueda: true });
  });

  it('si no te quedó nada (o quedó en negativo), sugiere 0', () => {
    expect(sugerenciaDeHoy(meta(), HOY, 0)).toEqual({ monto: 0, limitadoPorTeQueda: true });
    expect(sugerenciaDeHoy(meta(), HOY, -15)).toEqual({ monto: 0, limitadoPorTeQueda: true });
  });
});

describe('meta: progreso y estado', () => {
  it('progreso entre 0 y 1, y se recorta al pasarse', () => {
    expect(progreso(meta())).toBe(0);
    expect(progreso(meta({ aportes: [aporte(70)] }))).toBe(0.5);
    expect(progreso(meta({ aportes: [aporte(500)] }))).toBe(1);
    expect(progreso(meta({ montoObjetivo: 0 }))).toBe(0);
    expect(totalAportado(meta({ aportes: [aporte(0.1), aporte(0.2, HOY, 'x')] }))).toBe(0.3);
  });

  it('cumplida cuando junta lo de la cuota, aunque se pase', () => {
    expect(estado(meta({ aportes: [aporte(140)] }), HOY)).toBe('cumplida');
    expect(estado(meta({ aportes: [aporte(200)] }), '2026-12-01')).toBe('cumplida');
  });

  it('al día el mismo día que la crea', () => {
    expect(estado(meta(), HOY)).toBe('al día');
  });

  it('vas atrasado si lo separado está por debajo de lo que tocaba', () => {
    expect(estado(meta(), '2026-10-15')).toBe('vas atrasado'); // 3 de 7 días y 0 separado
    expect(estado(meta({ aportes: [aporte(60, '2026-10-14')] }), '2026-10-15')).toBe('al día'); // toca 60
  });

  it('vas atrasado si pasó la fecha y no la cumplió', () => {
    expect(estado(meta({ aportes: [aporte(100)] }), '2026-10-20')).toBe('vas atrasado');
  });

  it('el texto del plazo usa palabras de todos los días', () => {
    expect(textoPlazo(meta(), HOY)).toBe('Te faltan 7 días');
    expect(textoPlazo(meta({ fechaLimite: '2026-10-13' }), HOY)).toBe('Te falta 1 día');
    expect(textoPlazo(meta({ fechaLimite: HOY }), HOY)).toBe('Hoy es el día');
    expect(textoPlazo(meta({ fechaLimite: '2026-10-01' }), HOY)).toBe('La fecha ya pasó');
    expect(textoPlazo(meta({ aportes: [aporte(140)] }), HOY)).toBe('¡Meta cumplida!');
  });
});

describe('meta: validación, fechas y datos viejos', () => {
  it('valida el monto y que la fecha no sea pasada', () => {
    expect(validarMeta({ montoObjetivo: 120, fechaLimite: HOY }, HOY)).toEqual({ ok: true });
    expect(validarMeta({ montoObjetivo: 0, fechaLimite: HOY }, HOY)).toMatchObject({
      ok: false,
      errores: { montoObjetivo: expect.any(String) },
    });
    expect(validarMeta({ montoObjetivo: 120, fechaLimite: '2026-10-11' }, HOY)).toMatchObject({
      ok: false,
      errores: { fechaLimite: 'La fecha tiene que ser de hoy en adelante' },
    });
    expect(validarMeta({ montoObjetivo: NaN, fechaLimite: 'mañana' }, HOY)).toMatchObject({
      ok: false,
      errores: { montoObjetivo: expect.any(String), fechaLimite: expect.any(String) },
    });
    expect(validarAporte(0).ok).toBe(false);
    expect(validarAporte(5).ok).toBe(true);
  });

  it('fin de mes, plazos rápidos y fechas escritas a mano', () => {
    expect(finDeMes('2026-02-10')).toBe('2026-02-28');
    expect(finDeMes('2028-02-10')).toBe('2028-02-29');
    expect(plazosRapidos(HOY).map(p => [p.value, p.fecha])).toEqual([
      ['7', '2026-10-19'],
      ['15', '2026-10-27'],
      ['finDeMes', '2026-10-31'],
    ]);
    // El último día del mes ya no ofrece "Fin de mes" (sería hoy).
    expect(plazosRapidos('2026-10-31').map(p => p.value)).toEqual(['7', '15']);
    expect(fechaDesdePartes(5, 11, 2026)).toBe('2026-11-05');
    expect(fechaDesdePartes(31, 2, 2026)).toBeNull();
    expect(fechaDesdePartes(1, 13, 2026)).toBeNull();
    expect(fechaDesdePartes(1, 1, 26)).toBeNull();
  });

  it('normalizarMeta tolera datos viejos o dañados', () => {
    expect(normalizarMeta(null)).toBeNull();
    expect(normalizarMeta('basura')).toBeNull();
    expect(normalizarMeta({ id: 'x', montoObjetivo: -5, fechaLimite: HOY })).toBeNull();
    const sinAportes = normalizarMeta({ id: 'x', montoObjetivo: 100, fechaLimite: HOY });
    expect(sinAportes).toMatchObject({ nombre: 'Mi cuota', aportes: [], creada: HOY });
    const mezcla = normalizarMeta({
      ...meta(),
      aportes: [aporte(10), { id: 'mal', fecha: 'ayer', monto: 5 }, null, { id: 'z', fecha: HOY, monto: 'x' }],
    });
    expect(mezcla?.aportes).toHaveLength(1);
  });
});
