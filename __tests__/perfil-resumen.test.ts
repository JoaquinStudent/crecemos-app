import {
  resumenBorrar,
  resumenDatos,
  resumenPagos,
  resumenProductos,
  resumenRecordatorio,
} from '@dominio/perfilResumen';

describe('resúmenes de las opciones del Perfil', () => {
  it('Mis datos: nombre y negocio, lo que haya, o una invitación', () => {
    expect(resumenDatos({ nombre: 'Freddy', negocio: 'Anticuchos' })).toBe('Freddy · Anticuchos');
    expect(resumenDatos({ nombre: 'Freddy', negocio: '' })).toBe('Freddy');
    expect(resumenDatos({ nombre: ' ', negocio: 'Anticuchos' })).toBe('Anticuchos');
    expect(resumenDatos({ nombre: '', negocio: '' })).toBe('Completa tus datos');
  });

  it('Cómo me pagan: Yape activado (con o sin número) o solo efectivo', () => {
    expect(resumenPagos({ aceptaYape: true, yapeNumero: '987654321' })).toBe('Yape activado');
    expect(resumenPagos({ aceptaYape: true })).toBe('Yape activado · sin número');
    expect(resumenPagos({ aceptaYape: false, yapeNumero: '987654321' })).toBe('Solo efectivo');
  });

  it('Recordatorio: la hora si está activo, "Apagado" si no', () => {
    expect(resumenRecordatorio({})).toBe('Apagado');
    expect(resumenRecordatorio({ recordatorioActivo: true })).toBe('Activado · 9:30 p. m.');
    expect(resumenRecordatorio({ recordatorioActivo: true, recordatorioHora: '22:30' })).toBe(
      'Activado · 10:30 p. m.',
    );
  });

  it('Mis productos: solo cuenta los activos', () => {
    expect(resumenProductos([])).toBe('Sin productos activos');
    expect(resumenProductos([{ activo: true }])).toBe('1 producto activo');
    expect(resumenProductos([{ activo: true }, { activo: false }, { activo: true }])).toBe('2 productos activos');
  });

  it('Borrar datos: días de ejemplo, o que no hay nada', () => {
    expect(resumenBorrar({ dias: 3, productos: 4 })).toBe('3 días de ejemplo');
    expect(resumenBorrar({ dias: 1, productos: 0 })).toBe('1 día de ejemplo');
    expect(resumenBorrar({ dias: 0, productos: 2 })).toBe('2 productos de ejemplo');
    expect(resumenBorrar({ dias: 0, productos: 0 })).toBe('No hay datos de ejemplo');
  });
});
