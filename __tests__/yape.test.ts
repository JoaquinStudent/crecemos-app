/** Ayudas puras de "Anotar un yape": hora, total del día, agrupar y datos viejos. */
import {
  agrupar,
  formatoHora,
  horaLocal,
  normalizarYapes,
  totalDelDia,
  validarYape,
  yapesDeFecha,
  YapeAnotado,
} from '@dominio/yape';

const y = (id: string, fecha: string, hora: string, monto: number): YapeAnotado => ({
  id,
  fecha,
  hora,
  monto,
});

describe('yape: hora', () => {
  it('horaLocal da HH:mm de la hora local con ceros', () => {
    expect(horaLocal(new Date(2026, 9, 12, 7, 5))).toBe('07:05');
    expect(horaLocal(new Date(2026, 9, 12, 19, 42))).toBe('19:42');
  });

  it('formatoHora usa a. m. / p. m. y 12 en vez de 0', () => {
    expect(formatoHora('19:42')).toBe('7:42 p. m.');
    expect(formatoHora('07:05')).toBe('7:05 a. m.');
    expect(formatoHora('00:05')).toBe('12:05 a. m.');
    expect(formatoHora('12:00')).toBe('12:00 p. m.');
    expect(formatoHora('25:00')).toBe('25:00');
    expect(formatoHora('rara')).toBe('rara');
  });
});

describe('yape: total y agrupar', () => {
  const lista = [
    y('3', '2026-10-12', '18:30', 4.1),
    y('1', '2026-10-12', '09:15', 12),
    y('2', '2026-10-11', '20:00', 30),
  ];

  it('los de una fecha van del más temprano al más tarde', () => {
    expect(yapesDeFecha(lista, '2026-10-12').map(x => x.id)).toEqual(['1', '3']);
    expect(yapesDeFecha(lista, '2026-10-10')).toEqual([]);
  });

  it('el total del día suma sin errores de decimales', () => {
    expect(totalDelDia(lista, '2026-10-12')).toBe(16.1);
    expect(totalDelDia([y('a', 'f', '10:00', 0.1), y('b', 'f', '10:01', 0.2)], 'f')).toBe(0.3);
    expect(totalDelDia(lista, '2026-01-01')).toBe(0);
  });

  it('agrupa por fecha, la más reciente primero, con su total', () => {
    expect(agrupar(lista).map(g => [g.fecha, g.yapes.length, g.total])).toEqual([
      ['2026-10-12', 2, 16.1],
      ['2026-10-11', 1, 30],
    ]);
    expect(agrupar([])).toEqual([]);
  });
});

describe('yape: validar y normalizar', () => {
  it('el monto tiene que ser mayor que cero y razonable', () => {
    expect(validarYape(12).ok).toBe(true);
    expect(validarYape(0)).toMatchObject({ ok: false, errores: { monto: expect.any(String) } });
    expect(validarYape(NaN).ok).toBe(false);
    expect(validarYape(-1).ok).toBe(false);
    expect(validarYape(1e9).ok).toBe(false);
  });

  it('descarta lo dañado y conserva lo bueno', () => {
    expect(normalizarYapes(null)).toEqual([]);
    expect(normalizarYapes({ no: 'lista' })).toEqual([]);
    expect(
      normalizarYapes([
        y('1', '2026-10-12', '09:15', 12),
        { id: '2', fecha: 'ayer', hora: '09:15', monto: 3 },
        { id: '3', fecha: '2026-10-12', hora: '9:15', monto: 3 },
        { id: '4', fecha: '2026-10-12', hora: '09:15', monto: -3 },
        null,
        'x',
      ]),
    ).toEqual([y('1', '2026-10-12', '09:15', 12)]);
  });
});
