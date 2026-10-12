/**
 * El recordatorio diario ("¿Cerramos tu día?"): la decisión pura de cuándo avisar y cuándo callar,
 * el cartel de Inicio, las horas y la lectura tolerante de perfiles viejos.
 */
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { PERFIL_POR_DEFECTO } from '@dominio/perfil';
import {
  ajustesDeRecordatorio,
  decidirRecordatorio,
  etiquetaDeHora,
  HORA_RECORDATORIO_POR_DEFECTO,
  minutosDeHora,
  mostrarAvisoDeCierre,
  OPCIONES_HORA_RECORDATORIO,
  textoAvisoDeCierre,
} from '@dominio/recordatorio';
import type { Perfil } from '@dominio/tipos';
import {
  avisaConLaAppCerrada,
  cancelarAvisos,
  pedirPermisoDeAvisos,
  permisoDeAvisos,
  programarAvisos,
} from '@services/recordatorio';
import { guardarPerfil, obtenerPerfil } from '@storage/repositorio';

const m = (hora: string) => minutosDeHora(hora);
const base = {
  activo: true,
  hora: '21:30',
  permiso: 'concedido' as const,
  cerradoHoy: false,
  hoy: '2026-10-13',
  minutosAhora: m('18:00'),
};

describe('horas del recordatorio', () => {
  it('las tres opciones se leen como las diría Freddy', () => {
    expect(OPCIONES_HORA_RECORDATORIO.map(o => o.etiqueta)).toEqual([
      '8:30 p. m.',
      '9:30 p. m.',
      '10:30 p. m.',
    ]);
    for (const o of OPCIONES_HORA_RECORDATORIO) expect(etiquetaDeHora(o.valor)).toBe(o.etiqueta);
    expect(HORA_RECORDATORIO_POR_DEFECTO).toBe('21:30');
  });

  it('etiqueta las horas de la mañana y la medianoche', () => {
    expect(etiquetaDeHora('00:05')).toBe('12:05 a. m.');
    expect(etiquetaDeHora('09:00')).toBe('9:00 a. m.');
    expect(etiquetaDeHora('12:00')).toBe('12:00 p. m.');
  });
});

describe('decidirRecordatorio', () => {
  it('apagado, cancela', () => {
    expect(decidirRecordatorio({ ...base, activo: false })).toEqual({
      accion: 'cancelar',
      motivo: 'apagado',
    });
  });

  it('prendido pero sin permiso (negado o sin decidir), cancela', () => {
    for (const permiso of ['denegado', 'sin-decidir'] as const) {
      expect(decidirRecordatorio({ ...base, permiso })).toEqual({
        accion: 'cancelar',
        motivo: 'sin-permiso',
      });
    }
  });

  it('antes de la hora y con hoy sin cerrar, el primer aviso es hoy', () => {
    expect(decidirRecordatorio(base)).toEqual({
      accion: 'programar',
      hora: '21:30',
      primerAviso: { fecha: '2026-10-13', hora: '21:30' },
    });
  });

  it('si hoy ya está cerrado, salta a mañana', () => {
    const d = decidirRecordatorio({ ...base, cerradoHoy: true });
    expect(d).toMatchObject({ accion: 'programar', primerAviso: { fecha: '2026-10-14' } });
  });

  it('si la hora de hoy ya pasó, salta a mañana (y justo a la hora también)', () => {
    for (const minutosAhora of [m('21:30'), m('23:00')]) {
      const d = decidirRecordatorio({ ...base, minutosAhora });
      expect(d).toMatchObject({ accion: 'programar', primerAviso: { fecha: '2026-10-14' } });
    }
  });

  it('mañana cruza fin de mes y de año', () => {
    const fin = decidirRecordatorio({ ...base, hoy: '2026-12-31', cerradoHoy: true });
    expect(fin).toMatchObject({ primerAviso: { fecha: '2027-01-01' } });
  });

  it('usa la hora elegida', () => {
    const d = decidirRecordatorio({ ...base, hora: '22:30', minutosAhora: m('22:00') });
    expect(d).toMatchObject({ hora: '22:30', primerAviso: { fecha: '2026-10-13', hora: '22:30' } });
  });
});

describe('mostrarAvisoDeCierre (el cartel de Inicio)', () => {
  it('solo después de la hora y con hoy sin cerrar', () => {
    expect(mostrarAvisoDeCierre({ ...base, minutosAhora: m('21:29') })).toBe(false);
    expect(mostrarAvisoDeCierre({ ...base, minutosAhora: m('21:30') })).toBe(true);
    expect(mostrarAvisoDeCierre({ ...base, minutosAhora: m('23:59') })).toBe(true);
  });

  it('callado si está apagado o si hoy ya cerraste', () => {
    const tarde = { ...base, minutosAhora: m('22:00') };
    expect(mostrarAvisoDeCierre({ ...tarde, activo: false })).toBe(false);
    expect(mostrarAvisoDeCierre({ ...tarde, cerradoHoy: true })).toBe(false);
  });

  it('el texto dice la hora elegida en palabras', () => {
    expect(textoAvisoDeCierre('21:30')).toBe('Son más de las 9:30 p. m. y aún no cierras tu día');
    expect(textoAvisoDeCierre('20:30')).toBe('Son más de las 8:30 p. m. y aún no cierras tu día');
  });
});

describe('perfiles viejos y valores ilegibles', () => {
  const sinCampos = (): Perfil => ({ ...PERFIL_POR_DEFECTO, nombre: 'Freddy' });

  it('un perfil sin el campo queda apagado y a las 9:30 p. m.', () => {
    expect(ajustesDeRecordatorio(sinCampos())).toEqual({ activo: false, hora: '21:30' });
  });

  it('una hora ilegible vuelve a la de por defecto y un "activo" raro no prende nada', () => {
    const raro = { ...sinCampos(), recordatorioHora: '25:99', recordatorioActivo: 'si' } as unknown as Perfil;
    expect(ajustesDeRecordatorio(raro)).toEqual({ activo: false, hora: '21:30' });
    expect(ajustesDeRecordatorio({ ...sinCampos(), recordatorioHora: 'tarde' })).toMatchObject({
      hora: '21:30',
    });
  });

  it('respeta lo guardado', () => {
    expect(
      ajustesDeRecordatorio({ ...sinCampos(), recordatorioActivo: true, recordatorioHora: '22:30' }),
    ).toEqual({ activo: true, hora: '22:30' });
  });

  it('un perfil guardado antes de existir el recordatorio se lee tal cual, sin tocarlo', async () => {
    clearAllMockStorages();
    const viejo = { nombre: 'Freddy', negocio: 'Anticuchos', aceptaYape: true, yapeAjeno: false, actualizadoEn: 'x' };
    await guardarPerfil(viejo);
    const leido = await obtenerPerfil();
    expect(leido).toEqual(viejo);
    expect(ajustesDeRecordatorio(leido!)).toEqual({ activo: false, hora: '21:30' });
  });
});

describe('servicio de avisos dentro de la app', () => {
  it('no necesita permiso y no programa nada fuera de la app', async () => {
    expect(avisaConLaAppCerrada()).toBe(false);
    expect(await permisoDeAvisos()).toBe('concedido');
    expect(await pedirPermisoDeAvisos()).toBe('concedido');
    await expect(
      programarAvisos({
        accion: 'programar',
        hora: '21:30',
        primerAviso: { fecha: '2026-10-13', hora: '21:30' },
      }),
    ).resolves.toBeUndefined();
    await expect(cancelarAvisos()).resolves.toBeUndefined();
  });
});
