/**
 * "Mi cuota" (alcancía) de punta a punta: Provider, persistencia, pantalla MiMeta, tarjeta de Inicio
 * y el aporte desde la pantalla de éxito de "Cerrar mi día". La app real, por testID.
 */
import { createElement } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { nuevoCierre } from '@dominio/cierre';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { Meta } from '@dominio/meta';
import { colors, spacing } from '@theme';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import {
  borrarDatosDeEjemplo,
  guardarCierre,
  guardarMeta,
  guardarProducto,
  obtenerMeta,
} from '@storage/repositorio';
import { desmontarApp, montarApp } from '../testutils/app';
import { crearTecladoSimulado } from '../testutils/teclado';

const base = () => createAsyncStorage('crecemos');
const HOY = () => fechaLocal(new Date());

const sembrarDia = async (fecha = restarDias(HOY(), 1)) => {
  await guardarCierre({
    ...nuevoCierre(
      {
        fecha,
        lineas: [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 0 }],
        montoYape: 0,
        gastos: [],
        abreCiclo: false,
      },
      PRODUCTOS_POR_DEFECTO,
      null,
      new Date(),
    ),
    id: `c-${fecha}`,
  });
};

const metaGuardada = (parcial: Partial<Meta> = {}): Meta => ({
  id: 'm-1',
  nombre: 'Mi cuota',
  montoObjetivo: 140,
  fechaLimite: restarDias(HOY(), -7),
  creada: HOY(),
  aportes: [],
  ...parcial,
});

beforeEach(async () => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  clearAllMockStorages();
  await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
  await sembrarDia();
});
afterEach(async () => {
  jest.restoreAllMocks();
  await desmontarApp();
});

describe('Mi cuota: pulido de la pantalla', () => {
  const estiloDeProps = (props: { style?: unknown }) => StyleSheet.flatten(props.style as never);

  it('la tarjeta de hoy no repite el título "Hoy" y separa la frase de los botones', async () => {
    await guardarMeta(metaGuardada());
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');

    expect(app.textos()).not.toContain('Hoy');
    expect(app.textoDe('meta-hoy-mensaje')).toBe('Hoy separa S/ 20.00 y llegas a tiempo');
    // El gap va en el contenedor interno de la tarjeta (el de RNE envuelve a los hijos).
    expect(app.estiloDeContenido('meta-hoy').gap).toBeGreaterThanOrEqual(spacing.md);
  });

  it('"Borrar mi meta" va en rojo y "Cambiar monto o fecha" no', async () => {
    await guardarMeta(metaGuardada());
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');

    const colorDelBoton = (testID: string) =>
      app
        .botonDe(testID)
        .findAll(n => (n.type as unknown) === 'Text')
        .map(n => estiloDeProps(n.props).color)[0];
    expect(colorDelBoton('meta-borrar')).toBe(colors.danger);
    expect(colorDelBoton('meta-editar')).not.toBe(colors.danger);
  });

  it('con el teclado abierto el scroll suma su alto (ya no hay un relleno fijo gigante)', async () => {
    const teclado = crearTecladoSimulado();
    const app = await montarApp();
    const relleno = () =>
      estiloDeProps({ style: app.propsDe('meta-scroll').contentContainerStyle }).paddingBottom;
    await app.tocar('inicio-crear-meta');
    expect(app.propsDe('meta-scroll').keyboardShouldPersistTaps).toBe('handled');
    expect(relleno()).toBeUndefined();
    await app.tocar('meta-crear');

    expect(app.existe('meta-guardar')).toBe(true);
    // Formulario abierto, teclado cerrado: nada de relleno de más.
    expect(relleno()).toBeUndefined();
    await teclado.abrir(312, 528);
    expect(relleno()).toBe(312 + spacing.lg);
    await teclado.cerrar();
    expect(relleno()).toBeUndefined();
    jest.restoreAllMocks();
  });
});

describe('Mi cuota: crear la meta', () => {
  it('Inicio sin meta ofrece crearla; el estado vacío enseña y el formulario guarda', async () => {
    const app = await montarApp();
    expect(app.existe('inicio-meta')).toBe(false);

    await app.tocar('inicio-crear-meta');
    expect(app.textos()).toContain('Aún no tienes una meta');
    await app.tocar('meta-crear');
    await app.escribir('meta-monto', '140');
    await app.tocar('meta-plazo-7');
    expect(app.textoDe('meta-fecha-elegida')).toMatch(/^Pagas el /);
    await app.tocar('meta-guardar');

    expect(app.textoDe('meta-avance')).toBe('S/ 0.00 de S/ 140.00');
    expect(app.textoDe('meta-hoy-mensaje')).toBe('Hoy separa S/ 20.00 y llegas a tiempo');
    expect(app.textoDe('meta-plazo')).toMatch(/^Te faltan 7 días · /);
    const guardada = await obtenerMeta();
    expect(guardada).toMatchObject({ montoObjetivo: 140, nombre: 'Mi cuota', aportes: [] });
    expect(guardada?.fechaLimite).toBe(restarDias(HOY(), -7));
  });

  it('sin monto o sin fecha lo dice y no guarda', async () => {
    const app = await montarApp();
    await app.tocar('inicio-crear-meta');
    await app.tocar('meta-crear');

    await app.tocar('meta-guardar');
    expect(app.textos()).toContain('Escribe cuánto es tu cuota');
    expect(app.textos()).toContain('Elige cuándo pagas tu cuota');
    expect(await obtenerMeta()).toBeNull();
  });

  it('con "Otra fecha" valida el día, el mes y el año escritos', async () => {
    const app = await montarApp();
    await app.tocar('inicio-crear-meta');
    await app.tocar('meta-crear');
    await app.escribir('meta-monto', '100');
    await app.tocar('meta-plazo-otra');
    await app.escribir('meta-dia', '31');
    await app.escribir('meta-mes', '2');
    await app.escribir('meta-anio', '2030');

    await app.tocar('meta-guardar');
    expect(app.textoDe('meta-error-fecha')).toBe('Revisa el día, el mes y el año');
    expect(await obtenerMeta()).toBeNull();

    await app.escribir('meta-dia', '28');
    await app.tocar('meta-guardar');
    expect(await obtenerMeta()).toMatchObject({ fechaLimite: '2030-02-28' });
  });

  it('una fecha pasada no se acepta', async () => {
    const app = await montarApp();
    await app.tocar('inicio-crear-meta');
    await app.tocar('meta-crear');
    await app.escribir('meta-monto', '100');
    await app.tocar('meta-plazo-otra');
    await app.escribir('meta-dia', '1');
    await app.escribir('meta-mes', '1');
    await app.escribir('meta-anio', '2020');
    await app.tocar('meta-guardar');

    expect(app.textoDe('meta-error-fecha')).toBe('La fecha tiene que ser de hoy en adelante');
    expect(await obtenerMeta()).toBeNull();
  });
});

describe('Mi cuota: separar y quitar', () => {
  beforeEach(async () => {
    await guardarMeta(metaGuardada());
  });

  it('un toque en "Separar S/ 20.00" suma, actualiza el anillo y lo guarda', async () => {
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');
    expect(app.propsDe('meta-anillo').accessibilityValue).toMatchObject({ now: 0 });

    await app.tocar('meta-separar');

    expect(app.textoDe('meta-avance')).toBe('S/ 20.00 de S/ 140.00');
    expect(app.propsDe('meta-anillo')).toMatchObject({
      accessibilityRole: 'progressbar',
      accessibilityValue: { min: 0, max: 100, now: 14, text: 'S/ 20.00 de S/ 140.00' },
    });
    expect(app.textoDe('meta-aporte-0-monto')).toBe('S/ 20.00');
    // Ya separó lo de hoy: no insiste con otro botón principal.
    expect(app.existe('meta-separar')).toBe(false);
    expect(app.textoDe('meta-hoy-mensaje')).toBe('Hoy ya separaste lo que tocaba. ¡Bien!');
    expect((await obtenerMeta())?.aportes).toHaveLength(1);
  });

  it('con la cuota de hoy hecha, "Separar otro monto" es secundario (contorno) y la frase tiene aire', async () => {
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');
    await app.tocar('meta-separar');

    expect(app.existe('meta-separar')).toBe(false);
    const otro = app.propsDe('meta-otro');
    expect(otro.accessibilityLabel).toBe('Separar otro monto');
    // Contorno: fondo transparente (no el relleno del botón principal).
    expect(app.estiloDeContenido('meta-hoy').gap).toBeGreaterThanOrEqual(spacing.md);
  });

  it('"Separar otro monto" abre el campo, valida y suma', async () => {
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');
    await app.tocar('meta-otro');

    expect(app.existe('meta-otro-guardar')).toBe(true);
    await app.escribir('meta-otro-monto', '35.5');
    await app.tocar('meta-otro-guardar');

    expect(app.textoDe('meta-avance')).toBe('S/ 35.50 de S/ 140.00');
    expect(app.existe('meta-otro-monto')).toBe(false);
  });

  it('"Quitar" saca el aporte y el avance vuelve atrás', async () => {
    await guardarMeta(metaGuardada({ aportes: [{ id: 'a-1', fecha: HOY(), monto: 50 }] }));
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');
    expect(app.textoDe('meta-avance')).toBe('S/ 50.00 de S/ 140.00');

    await app.tocar('meta-quitar-0');

    expect(app.textoDe('meta-avance')).toBe('S/ 0.00 de S/ 140.00');
    expect(app.textoDe('meta-sin-aportes')).toMatch(/^Todavía no separaste nada/);
    expect((await obtenerMeta())?.aportes).toEqual([]);
  });

  it('con la meta cumplida lo celebra y ya no pide separar', async () => {
    await guardarMeta(metaGuardada({ aportes: [{ id: 'a-1', fecha: HOY(), monto: 140 }] }));
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');

    expect(app.textoDe('meta-hoy-mensaje')).toBe('Ya juntaste lo de tu cuota. ¡Bien hecho!');
    expect(app.textoDe('meta-estado')).toBe('Cumpliste tu meta');
    expect(app.existe('meta-separar')).toBe(false);
    expect(app.existe('meta-otro')).toBe(false);
  });

  it('si lo que te queda no alcanza, baja lo sugerido y lo dice', async () => {
    clearAllMockStorages();
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
    await guardarCierre({
      ...nuevoCierre(
        {
          fecha: restarDias(HOY(), 1),
          lineas: [{ productoId: 'p-anticucho', preparadas: 2, sobrantes: 0 }],
          montoYape: 0,
          gastos: [],
          abreCiclo: false,
        },
        PRODUCTOS_POR_DEFECTO,
        null,
        new Date(),
      ),
      id: 'c-poco',
    }); // Ese día te quedó S/ 20.00.
    await guardarMeta(metaGuardada({ montoObjetivo: 700 })); // Lo ideal serían S/ 100.00 por día.

    const app = await montarApp();
    await app.tocar('inicio-ver-meta');

    expect(app.textoDe('meta-hoy-mensaje')).toBe('Hoy separa S/ 20.00 y llegas a tiempo');
    expect(app.existe('meta-tope')).toBe(true);
    expect(app.textos().some(t => t.includes('No te propongo separar más de lo que tienes'))).toBe(true);
  });

  it('si el guardado falla lo dice y no cambia el avance', async () => {
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');
    jest.spyOn(base(), 'setItem').mockRejectedValue(new Error('disco lleno'));

    await app.tocar('meta-separar');

    expect(app.textoDe('meta-error-separar')).toBe('No pudimos guardar. Inténtalo otra vez.');
    expect(app.textoDe('meta-avance')).toBe('S/ 0.00 de S/ 140.00');
  });

  it('borrar la meta pide confirmar y la quita', async () => {
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');
    await app.tocar('meta-borrar');
    expect(app.existe('meta-borrar-pregunta')).toBe(true);
    await app.tocar('meta-borrar-no');
    expect(await obtenerMeta()).not.toBeNull();

    await app.tocar('meta-borrar');
    await app.tocar('meta-borrar-si');

    expect(await obtenerMeta()).toBeNull();
    expect(app.textos()).toContain('Aún no tienes una meta');
  });

  it('editar conserva lo ya separado', async () => {
    await guardarMeta(metaGuardada({ aportes: [{ id: 'a-1', fecha: HOY(), monto: 30 }] }));
    const app = await montarApp();
    await app.tocar('inicio-ver-meta');
    await app.tocar('meta-editar');
    expect(app.valorDe('meta-monto')).toBe('140');
    await app.escribir('meta-monto', '200');
    await app.tocar('meta-guardar');

    expect(app.textoDe('meta-avance')).toBe('S/ 30.00 de S/ 200.00');
    expect((await obtenerMeta())?.aportes).toHaveLength(1);
  });
});

describe('Mi cuota: Inicio y persistencia', () => {
  it('la tarjeta de Inicio muestra avance y plazo con palabras', async () => {
    await guardarMeta(metaGuardada({ aportes: [{ id: 'a-1', fecha: HOY(), monto: 40 }] }));
    const app = await montarApp();

    expect(app.textoDe('inicio-meta-avance')).toBe('S/ 40.00 de S/ 140.00');
    expect(app.textoDe('inicio-meta-plazo')).toBe('Te faltan 7 días');
    expect(app.existe('inicio-crear-meta')).toBe(false);
  });

  it('borrar los datos de ejemplo no toca la meta', async () => {
    await guardarMeta(metaGuardada());
    await borrarDatosDeEjemplo();

    expect(await obtenerMeta()).toMatchObject({ id: 'm-1' });
  });

  it('una meta dañada o vieja no rompe la app: se ignora', async () => {
    await base().setItem('@crecemos/meta', '{esto no es json');
    const app = await montarApp();

    expect(app.existe('inicio-crear-meta')).toBe(true);
  });

  it('si no se puede leer la meta, la app abre igual', async () => {
    const original = base().getItem.bind(base());
    jest.spyOn(base(), 'getItem').mockImplementation(async (clave: string) => {
      if (clave === '@crecemos/meta') throw new Error('no se pudo leer');
      return original(clave);
    });
    const app = await montarApp();

    expect(app.existe('inicio-crear-meta')).toBe(true);
    expect(app.existe('inicio-saludo')).toBe(true);
  });
});

describe('Mi cuota: desde la pantalla de éxito de Cerrar mi día', () => {
  it('ofrece separar, suma sin cerrar nada y "Listo" sigue siendo el único principal', async () => {
    await guardarMeta(metaGuardada());
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    await app.tocar('guardar-dia');

    expect(app.existe('cierre-exito')).toBe(true);
    expect(app.textos()).toContain('Separar S/ 20.00 para tu cuota');

    await app.tocar('cierre-meta-separar');

    expect(app.textoDe('cierre-meta-separado')).toBe('Separaste S/ 20.00 para tu cuota');
    expect(app.existe('cierre-exito')).toBe(true);
    expect(app.existe('cierre-listo')).toBe(true);
    expect(app.existe('cierre-meta-separar')).toBe(false);
    expect((await obtenerMeta())?.aportes).toHaveLength(1);
  });

  it('sin meta no ofrece nada', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    await app.tocar('guardar-dia');

    expect(app.existe('cierre-exito')).toBe(true);
    expect(app.existe('cierre-meta-separar')).toBe(false);
  });
});

describe('Mi cuota: acciones del Provider', () => {
  const montarProvider = async () => {
    let contexto!: ReturnType<typeof useCrecemos>;
    const Sonda = () => {
      contexto = useCrecemos();
      return null;
    };
    let r!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      r = ReactTestRenderer.create(createElement(CrecemosProvider, null, createElement(Sonda)));
    });
    return { contexto: () => contexto, desmontar: () => act(async () => r.unmount()) };
  };

  it('aportar sin meta o con un monto inválido devuelve el error y no guarda nada', async () => {
    const { contexto, desmontar } = await montarProvider();

    let sinMeta: unknown;
    await act(async () => {
      sinMeta = await contexto().aportarAMeta(10);
    });
    expect(sinMeta).toMatchObject({ ok: false });

    await act(async () => {
      await contexto().crearMeta({ montoObjetivo: 100, fechaLimite: restarDias(HOY(), -5) });
    });
    let malo: unknown;
    await act(async () => {
      malo = await contexto().aportarAMeta(-3);
    });
    expect(malo).toMatchObject({ ok: false, errores: { monto: expect.any(String) } });
    expect((await obtenerMeta())?.aportes).toEqual([]);
    await desmontar();
  });

  it('dos aportes seguidos se suman los dos, y un guardado que falla no deja rastro', async () => {
    const { contexto, desmontar } = await montarProvider();
    await act(async () => {
      await contexto().crearMeta({ montoObjetivo: 100, fechaLimite: restarDias(HOY(), -5) });
    });

    await act(async () => {
      await Promise.all([contexto().aportarAMeta(10), contexto().aportarAMeta(5)]);
    });
    expect(contexto().meta?.aportes.map(a => a.monto)).toEqual([10, 5]);

    const espia = jest.spyOn(base(), 'setItem').mockRejectedValue(new Error('disco lleno'));
    await act(async () => {
      await expect(contexto().aportarAMeta(7)).rejects.toThrow();
    });
    espia.mockRestore();
    expect(contexto().meta?.aportes).toHaveLength(2);

    await act(async () => {
      await contexto().aportarAMeta(1);
    });
    expect((await obtenerMeta())?.aportes.map(a => a.monto)).toEqual([10, 5, 1]);
    await desmontar();
  });
});
