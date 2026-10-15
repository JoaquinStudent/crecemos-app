/**
 * @jest-environment node
 *
 * Pruebas de apoyo del filtro de periodo (los escenarios del SPEC-15 son spec15_e1 y spec15_e2):
 * meses raros, entradas que no se deben mutar y la fecha de corte de las señales.
 */
import {
  etiquetaMes,
  etiquetaMesCorta,
  fechaDeCorte,
  FILTRO_TODO,
  mesesConCierres,
  periodoDe,
  puedeEmitirReporte,
  senalesDelPeriodo,
} from '@analisis/periodo';
import type { Cierre, FechaNegocio } from '@dominio/tipos';

const cierre = (fecha: FechaNegocio): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [
    {
      productoId: 'p-a',
      nombre: 'A',
      preparadas: 10,
      sobrantes: 0,
      precioUnitario: 10,
      costoUnitario: 8,
    },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: [{ categoria: 'mercaderia', monto: 20 }],
  abreCiclo: false,
  creadoEn: '2026-10-15T12:00:00-05:00',
  actualizadoEn: '2026-10-15T12:00:00-05:00',
});

const HOY = '2026-10-15';

describe('etiquetas de mes', () => {
  it('dicen el mes en palabras y con su año', () => {
    expect(etiquetaMes('2026-09')).toBe('Septiembre 2026');
    expect(etiquetaMes('2027-01')).toBe('Enero 2027');
    expect(etiquetaMesCorta('2026-09')).toBe('Sep 2026');
    expect(etiquetaMesCorta('2026-05')).toBe('May 2026');
  });
});

describe('periodoDe · casos raros', () => {
  it('un mes que no existe se trata como todo el historial', () => {
    const c = [cierre('2026-09-02')];
    expect(periodoDe({ tipo: 'mes', mes: '2026-13' }, HOY, c).etiqueta).toBe('Todo tu historial');
    expect(periodoDe({ tipo: 'mes', mes: 'septiembre' }, HOY, c).cierres).toHaveLength(1);
    expect(periodoDe({ tipo: 'rango', desde: '2026-00', hasta: '2026-09' }, HOY, c).etiqueta).toBe(
      'Todo tu historial',
    );
  });

  it('los meses de 28, 29, 30 y 31 días terminan en su último día', () => {
    const ultimo = (mes: string) => periodoDe({ tipo: 'mes', mes }, '2030-12-31', []).hasta;
    expect(ultimo('2027-02')).toBe('2027-02-28');
    expect(ultimo('2028-02')).toBe('2028-02-29');
    expect(ultimo('2026-04')).toBe('2026-04-30');
    expect(ultimo('2026-01')).toBe('2026-01-31');
    expect(ultimo('2026-12')).toBe('2026-12-31');
  });

  it('el mismo cierre no se cuenta dos veces ni sale de su mes', () => {
    const c = [cierre('2026-09-30'), cierre('2026-10-01'), cierre('2026-08-31')];
    const septiembre = periodoDe({ tipo: 'mes', mes: '2026-09' }, HOY, c);
    expect(septiembre.cierres.map(x => x.fecha)).toEqual(['2026-09-30']);
  });

  it('devuelve los cierres en orden cronológico aunque lleguen desordenados', () => {
    const c = [cierre('2026-10-03'), cierre('2026-09-02'), cierre('2026-10-01')];
    expect(periodoDe(FILTRO_TODO, HOY, c).cierres.map(x => x.fecha)).toEqual([
      '2026-09-02',
      '2026-10-01',
      '2026-10-03',
    ]);
  });

  it('no muta los cierres que recibe', () => {
    const c = Object.freeze([cierre('2026-10-03'), cierre('2026-09-02')]) as Cierre[];
    expect(() => periodoDe(FILTRO_TODO, HOY, c)).not.toThrow();
    expect(c.map(x => x.fecha)).toEqual(['2026-10-03', '2026-09-02']);
  });

  it('con cierres solo de ayer, "este mes" el día 1 queda vacío pero no lanza', () => {
    const p = periodoDe({ tipo: 'esteMes' }, '2026-10-01', [cierre('2026-09-30')]);
    expect(p.cierres).toEqual([]);
    expect(puedeEmitirReporte(p)).toBe(false);
    expect([p.desde, p.hasta]).toEqual(['2026-10-01', '2026-10-01']);
  });

  it('un rango que llega al mes en curso está en curso; uno que terminó, no', () => {
    expect(periodoDe({ tipo: 'rango', desde: '2026-07', hasta: '2026-10' }, HOY, []).enCurso).toBe(
      true,
    );
    expect(periodoDe({ tipo: 'rango', desde: '2026-07', hasta: '2026-09' }, HOY, []).enCurso).toBe(
      false,
    );
  });
});

describe('mesesConCierres', () => {
  it('no repite meses, ordena del más reciente y deja fuera lo posterior a hoy', () => {
    const c = [
      cierre('2026-08-03'),
      cierre('2026-08-30'),
      cierre('2026-10-02'),
      cierre('2026-10-16'), // mañana
      cierre('2025-12-31'),
    ];
    expect(mesesConCierres(c, HOY)).toEqual(['2026-10', '2026-08', '2025-12']);
  });
});

describe('fechaDeCorte y senalesDelPeriodo', () => {
  const cierres = [cierre('2026-08-12'), cierre('2026-09-03'), cierre('2026-09-17')];

  it('si el periodo llega a hoy, el corte es hoy; si terminó, el día siguiente a su fin', () => {
    expect(fechaDeCorte(periodoDe(FILTRO_TODO, HOY, cierres), HOY)).toBe(HOY);
    expect(fechaDeCorte(periodoDe({ tipo: 'mesPasado' }, HOY, cierres), HOY)).toBe('2026-10-01');
    expect(
      fechaDeCorte(periodoDe({ tipo: 'mes', mes: '2026-12' }, '2027-01-01', []), '2027-01-01'),
    ).toBe('2027-01-01');
    // El corte de un diciembre cruza al año siguiente.
    expect(
      fechaDeCorte(periodoDe({ tipo: 'mes', mes: '2026-12' }, '2027-03-01', []), '2027-03-01'),
    ).toBe('2027-01-01');
  });

  it('las señales de un mes de hace un año no quedan en cero por la ventana de 90 días', () => {
    const viejo = [cierre('2025-03-04'), cierre('2025-03-18')];
    const hoy = '2026-10-15';
    const s = senalesDelPeriodo(viejo, periodoDe({ tipo: 'mes', mes: '2025-03' }, hoy, viejo), hoy);
    expect(s.diasRegistrados).toBe(2);
    expect(s.mesesCompletos).toBe(1);
    expect(s.ventaPromedioMensual).toBe(200);
  });

  it('un periodo vacío no lanza y conserva el aviso del registro total', () => {
    const s = senalesDelPeriodo(cierres, periodoDe({ tipo: 'esteMes' }, HOY, cierres), HOY);
    expect(s.diasRegistrados).toBe(0);
    expect(s.mesesCompletos).toBe(0);
    expect(s.enConstruccion).toBe(true);
    expect(s.diasFaltantes).toBe(27);
  });
});
