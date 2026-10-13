/**
 * El recordatorio en pantalla. Inicio: el cartel "aún no cierras tu día" después de la hora elegida
 * (el aviso dentro de la app). Perfil: el interruptor, las horas, la explicación del permiso y el
 * permiso negado, con el servicio simulado. La app real, por testID.
 */
import { createElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import App from '../App';
import { nuevoCierre } from '@dominio/cierre';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre } from '@dominio/tipos';
import {
  avisaConLaAppCerrada,
  cancelarAvisos,
  pedirPermisoDeAvisos,
  permisoDeAvisos,
  programarAvisos,
} from '@services/recordatorio';
import { guardarCierre, guardarPerfil, obtenerPerfil } from '@storage/repositorio';

jest.mock('@services/recordatorio', () => ({
  avisaConLaAppCerrada: jest.fn(() => false),
  permisoDeAvisos: jest.fn(() => Promise.resolve('concedido')),
  pedirPermisoDeAvisos: jest.fn(() => Promise.resolve('concedido')),
  programarAvisos: jest.fn(() => Promise.resolve()),
  cancelarAvisos: jest.fn(() => Promise.resolve()),
}));

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

const OTROS_RELOJES = [
  'nextTick',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'hrtime',
  'performance',
  'queueMicrotask',
] as const;
/** Congela solo la fecha: "hoy" y la hora son los de la prueba. */
const ahoraEs = (iso: string) =>
  jest.useFakeTimers({ now: new Date(iso), doNotFake: [...OTROS_RELOJES] });

beforeEach(() => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  clearAllMockStorages();
  jest.clearAllMocks();
  (avisaConLaAppCerrada as jest.Mock).mockReturnValue(false);
  (permisoDeAvisos as jest.Mock).mockResolvedValue('concedido');
  (pedirPermisoDeAvisos as jest.Mock).mockResolvedValue('concedido');
});

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
afterEach(async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
  jest.useRealTimers();
});

const montarApp = async () => {
  let app!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    app = ReactTestRenderer.create(createElement(App));
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
  montada = app;
  const esHost = (n: ReactTestInstance, nombre: string) => (n.type as unknown) === nombre;
  const nodo = (testID: string, prop: 'onPress' | 'onValueChange') =>
    app.root.findAll(n => n.props.testID === testID && typeof n.props[prop] === 'function')[0];
  const existe = (testID: string) => app.root.findAll(n => n.props.testID === testID).length > 0;
  const textoDe = (testID: string) => {
    const t = app.root.findAll(n => esHost(n, 'Text') && n.props.testID === testID)[0];
    if (!t) throw new Error(`No hay ningún texto con testID "${testID}"`);
    return textoCompleto(t);
  };
  const tocar = (testID: string) =>
    act(async () => {
      await nodo(testID, 'onPress').props.onPress();
    });
  const cambiarInterruptor = (testID: string, valor: boolean) =>
    act(async () => {
      await nodo(testID, 'onValueChange').props.onValueChange(valor);
    });
  const interruptor = (testID: string) =>
    app.root.findAll(n => n.props.testID === testID && 'value' in n.props)[0];
  return { existe, textoDe, tocar, cambiarInterruptor, interruptor };
};

const sembrarHoy = async (fecha: string): Promise<Cierre> => {
  const cierre: Cierre = {
    ...nuevoCierre(
      {
        fecha,
        lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
        montoYape: 0,
        gastos: [],
        abreCiclo: false,
      },
      PRODUCTOS_POR_DEFECTO,
      null,
      new Date('2026-10-01T12:00:00-05:00'),
    ),
    id: `c-${fecha}`,
  };
  await guardarCierre(cierre);
  return cierre;
};

const perfilConRecordatorio = (extra: Record<string, unknown> = {}) =>
  guardarPerfil({
    nombre: 'Freddy',
    negocio: '',
    aceptaYape: true,
    yapeAjeno: false,
    recordatorioActivo: true,
    actualizadoEn: '2026-10-01T00:00:00.000Z',
    ...extra,
  });

describe('Inicio: aviso "aún no cierras tu día"', () => {
  it('pasada la hora elegida y con hoy sin cerrar, lo dice y ofrece "Cerrar mi día"', async () => {
    ahoraEs('2026-10-13T21:45:00-05:00');
    await sembrarHoy('2026-10-12'); // ayer sí; hoy no
    await perfilConRecordatorio();
    const { existe, textoDe, tocar } = await montarApp();

    expect(textoDe('inicio-aviso-cierre-texto')).toBe(
      'Son más de las 9:30 p. m. y aún no cierras tu día',
    );
    await tocar('inicio-aviso-cierre-boton');
    expect(existe('guardar-dia')).toBe(true);
  });

  it('antes de la hora no aparece', async () => {
    ahoraEs('2026-10-13T20:00:00-05:00');
    await sembrarHoy('2026-10-12');
    await perfilConRecordatorio();
    const { existe } = await montarApp();

    expect(existe('inicio-aviso-cierre')).toBe(false);
  });

  it('con otra hora elegida espera a esa hora', async () => {
    ahoraEs('2026-10-13T21:45:00-05:00');
    await sembrarHoy('2026-10-12');
    await perfilConRecordatorio({ recordatorioHora: '22:30' });
    const { existe } = await montarApp();

    expect(existe('inicio-aviso-cierre')).toBe(false);
  });

  it('si hoy ya está cerrado no aparece', async () => {
    ahoraEs('2026-10-13T22:00:00-05:00');
    await sembrarHoy('2026-10-13');
    await perfilConRecordatorio();
    const { existe } = await montarApp();

    expect(existe('inicio-aviso-cierre')).toBe(false);
  });

  it('apagado (o en un perfil viejo sin el campo) no aparece nunca', async () => {
    ahoraEs('2026-10-13T23:00:00-05:00');
    await sembrarHoy('2026-10-12');
    await guardarPerfil({
      nombre: 'Freddy',
      negocio: '',
      aceptaYape: true,
      yapeAjeno: false,
      actualizadoEn: '2026-10-01T00:00:00.000Z',
    });
    const { existe } = await montarApp();

    expect(existe('inicio-aviso-cierre')).toBe(false);
  });

  it('manda el plan al servicio: hoy si falta la hora, mañana si ya cerraste', async () => {
    ahoraEs('2026-10-13T18:00:00-05:00');
    await sembrarHoy('2026-10-12');
    await perfilConRecordatorio();
    await montarApp();
    expect(programarAvisos).toHaveBeenLastCalledWith(
      expect.objectContaining({ primerAviso: { fecha: '2026-10-13', hora: '21:30' } }),
    );
  });

  it('con hoy ya cerrado el primer aviso es mañana', async () => {
    ahoraEs('2026-10-13T18:00:00-05:00');
    await sembrarHoy('2026-10-13');
    await perfilConRecordatorio();
    await montarApp();
    expect(programarAvisos).toHaveBeenLastCalledWith(
      expect.objectContaining({ primerAviso: { fecha: '2026-10-14', hora: '21:30' } }),
    );
  });

  it('apagado cancela el aviso y sin permiso también', async () => {
    ahoraEs('2026-10-13T18:00:00-05:00');
    await sembrarHoy('2026-10-12');
    await montarApp();
    expect(cancelarAvisos).toHaveBeenCalled();
    expect(programarAvisos).not.toHaveBeenCalled();
  });

  it('prendido pero sin permiso en el sistema, cancela y no programa', async () => {
    ahoraEs('2026-10-13T18:00:00-05:00');
    (permisoDeAvisos as jest.Mock).mockResolvedValue('denegado');
    await sembrarHoy('2026-10-12');
    await perfilConRecordatorio();
    await montarApp();
    expect(cancelarAvisos).toHaveBeenCalled();
    expect(programarAvisos).not.toHaveBeenCalled();
  });
});

describe('Perfil: Recordatorio diario', () => {
  const irAPerfil = async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-recordatorio');
    return app;
  };

  it('viene apagado y, al prender dentro de la app, se guarda sin pedir permisos', async () => {
    const { interruptor, cambiarInterruptor, existe } = await irAPerfil();
    expect(interruptor('switch-recordatorio').props.value).toBe(false);
    expect(existe('recordatorio-hora-21:30')).toBe(false);

    await cambiarInterruptor('switch-recordatorio', true);

    expect(interruptor('switch-recordatorio').props.value).toBe(true);
    expect(existe('recordatorio-permiso-explicacion')).toBe(false);
    expect((await obtenerPerfil())?.recordatorioActivo).toBe(true);
    expect(existe('recordatorio-hora-21:30')).toBe(true);
  });

  it('el menú del Perfil resume el recordatorio con la hora y se actualiza al volver', async () => {
    const { textoDe, tocar, cambiarInterruptor } = await irAPerfil();
    await cambiarInterruptor('switch-recordatorio', true);
    await tocar('recordatorio-hora-22:30');
    await tocar('seccion-atras');
    expect(textoDe('perfil-opcion-recordatorio-resumen')).toBe('Activado · 10:30 p. m.');
  });

  it('elegir otra hora la guarda', async () => {
    const { cambiarInterruptor, tocar } = await irAPerfil();
    await cambiarInterruptor('switch-recordatorio', true);

    await tocar('recordatorio-hora-22:30');

    expect((await obtenerPerfil())?.recordatorioHora).toBe('22:30');
  });

  it('apagarlo lo guarda apagado y conserva la hora', async () => {
    const { cambiarInterruptor, tocar, interruptor } = await irAPerfil();
    await cambiarInterruptor('switch-recordatorio', true);
    await tocar('recordatorio-hora-20:30');

    await cambiarInterruptor('switch-recordatorio', false);

    expect(interruptor('switch-recordatorio').props.value).toBe(false);
    expect(await obtenerPerfil()).toMatchObject({ recordatorioActivo: false, recordatorioHora: '20:30' });
  });

  describe('con avisos del sistema (permiso)', () => {
    beforeEach(() => (avisaConLaAppCerrada as jest.Mock).mockReturnValue(true));

    it('al prender explica por qué pide permiso y todavía no lo pide ni guarda', async () => {
      const { cambiarInterruptor, existe, interruptor } = await irAPerfil();

      await cambiarInterruptor('switch-recordatorio', true);

      expect(existe('recordatorio-permiso-explicacion')).toBe(true);
      expect(pedirPermisoDeAvisos).not.toHaveBeenCalled();
      expect(interruptor('switch-recordatorio').props.value).toBe(false);
      expect((await obtenerPerfil())?.recordatorioActivo).toBeUndefined();
    });

    it('si acepta, pide el permiso, lo prende y lo guarda', async () => {
      const { cambiarInterruptor, tocar, existe, interruptor } = await irAPerfil();
      await cambiarInterruptor('switch-recordatorio', true);

      await tocar('recordatorio-permiso-si');

      expect(pedirPermisoDeAvisos).toHaveBeenCalledTimes(1);
      expect(interruptor('switch-recordatorio').props.value).toBe(true);
      expect(existe('recordatorio-permiso-explicacion')).toBe(false);
      expect((await obtenerPerfil())?.recordatorioActivo).toBe(true);
    });

    it('si el sistema niega el permiso lo dice en palabras claras y el interruptor sigue apagado', async () => {
      (pedirPermisoDeAvisos as jest.Mock).mockResolvedValue('denegado');
      const { cambiarInterruptor, tocar, textoDe, interruptor } = await irAPerfil();
      await cambiarInterruptor('switch-recordatorio', true);

      await tocar('recordatorio-permiso-si');

      expect(textoDe('recordatorio-permiso-negado')).toMatch(/permiso para avisarte está apagado/);
      expect(interruptor('switch-recordatorio').props.value).toBe(false);
      expect((await obtenerPerfil())?.recordatorioActivo).toBeUndefined();
    });

    it('"Ahora no" cierra la explicación sin pedir nada', async () => {
      const { cambiarInterruptor, tocar, existe } = await irAPerfil();
      await cambiarInterruptor('switch-recordatorio', true);

      await tocar('recordatorio-permiso-no');

      expect(existe('recordatorio-permiso-explicacion')).toBe(false);
      expect(pedirPermisoDeAvisos).not.toHaveBeenCalled();
    });
  });
});
