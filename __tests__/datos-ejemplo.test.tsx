/**
 * P0 #5 de la auditoría: los datos de ejemplo se distinguen de los propios, se pueden borrar
 * sin tocar lo del usuario y no entran al reporte del banco (salvo que sean lo único que hay).
 */
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { htmlReporte } from '@analisis/htmlReporte';
import { AVISO_EJEMPLO, senalesBanco, textoReporte } from '@analisis/senales';
import { nuevoCierre } from '@dominio/cierre';
import {
  contarDatosDeEjemplo,
  esEjemplo,
  mensajeBorrarEjemplo,
  sinDatosDeEjemplo,
} from '@dominio/origen';
import { PERFIL_POR_DEFECTO } from '@dominio/perfil';
import { materializarSemilla } from '@dominio/semilla';
import type { Cierre, SemillaJSON } from '@dominio/tipos';
import {
  borrarDatosDeEjemplo,
  guardarCierre,
  importarSemilla,
  listarCierres,
  listarProductos,
  semillaCargada,
} from '@storage/repositorio';
import { desmontarApp, montarApp } from '../testutils/app';

const semillaMinima = (): SemillaJSON => ({
  version: 1,
  semilla: 'minima',
  diaSemanaBase: 0,
  productos: [
    { id: 'p-ej', nombre: 'Ejemplo', unidad: 'porcion', precioVenta: 10, costoUnitario: 6, actualizadoDiasAtras: 5 },
  ],
  cierres: [20, 21, 22].map(diasAtras => ({
    diasAtras,
    lineas: [{ productoId: 'p-ej', preparadas: 10, sobrantes: 0, precioUnitario: 10, costoUnitario: 6 }],
    montoYape: 0,
    yapePendiente: false,
    gastos: [],
    abreCiclo: false,
  })),
});

const ahora = new Date('2026-10-07T12:00:00-05:00');
const propio = (fecha: string, productoId = 'p-propio'): Cierre =>
  nuevoCierre(
    { fecha, lineas: [{ productoId, preparadas: 10, sobrantes: 0 }], montoYape: 0, gastos: [] },
    [{ id: productoId, nombre: 'Mío', unidad: 'porcion', precioVenta: 10, costoUnitario: 5, actualizadoEn: fecha, activo: true }],
    null,
    ahora,
  );

describe('Origen de los datos', () => {
  it('la semilla materializada marca todo como ejemplo', () => {
    const { productos, cierres } = materializarSemilla(semillaMinima(), ahora);
    expect(productos.every(p => p.origen === 'ejemplo')).toBe(true);
    expect(cierres.every(c => c.origen === 'ejemplo')).toBe(true);
  });

  it('sin el campo (datos viejos) cuenta como propio', () => {
    expect(esEjemplo(propio('2026-10-01'))).toBe(false);
  });

  it('el mensaje de confirmación dice cuántos días se van', () => {
    expect(mensajeBorrarEjemplo({ dias: 3, productos: 1 })).toBe(
      'Se van a borrar 3 días de ejemplo y 1 producto de ejemplo. Los días y productos que anotaste tú no se tocan.',
    );
    expect(mensajeBorrarEjemplo({ dias: 1, productos: 0 })).toContain('1 día de ejemplo.');
  });

  it('sinDatosDeEjemplo conserva como propio el producto de ejemplo que usa un día propio', () => {
    const { productos, cierres } = materializarSemilla(semillaMinima(), ahora);
    const miDia = propio('2026-10-06', 'p-ej');
    const resto = sinDatosDeEjemplo([...cierres, miDia], productos);

    expect(resto.cierres).toEqual([miDia]);
    expect(resto.productos).toHaveLength(1);
    expect(resto.productos[0].origen).toBe('propio');
    expect(contarDatosDeEjemplo([...cierres, miDia], productos)).toEqual({ dias: 3, productos: 0 });
  });
});

describe('Reporte al banco y datos de ejemplo', () => {
  const hoy = '2026-10-07';
  const ejemplo = materializarSemilla(semillaMinima(), ahora).cierres;

  it('con días propios, el reporte no cuenta los de ejemplo', () => {
    const propios = [propio('2026-10-05'), propio('2026-10-06')];
    const mezcla = senalesBanco([...ejemplo, ...propios], hoy);
    const soloPropios = senalesBanco(propios, hoy);

    expect(mezcla).toEqual(soloPropios);
    expect(mezcla.diasRegistrados).toBe(2);
    expect(mezcla.soloEjemplo).toBeUndefined();
  });

  it('si solo hay datos de ejemplo, el reporte sigue funcionando y lo avisa', () => {
    const senales = senalesBanco(ejemplo, hoy);

    expect(senales.diasRegistrados).toBe(ejemplo.length);
    expect(senales.soloEjemplo).toBe(true);
    expect(textoReporte(senales, PERFIL_POR_DEFECTO)).toContain(AVISO_EJEMPLO);
    expect(htmlReporte(senales, PERFIL_POR_DEFECTO, hoy)).toContain('Datos de ejemplo');
  });

  it('un reporte con datos propios no lleva el aviso', () => {
    const senales = senalesBanco([propio('2026-10-06')], hoy);
    expect(textoReporte(senales, PERFIL_POR_DEFECTO)).not.toContain('ejemplo');
    expect(htmlReporte(senales, PERFIL_POR_DEFECTO, hoy)).not.toContain('Datos de ejemplo');
  });
});

describe('borrarDatosDeEjemplo (repositorio)', () => {
  beforeEach(() => clearAllMockStorages());

  it('quita solo lo de ejemplo, deja lo propio y permite volver a cargar la demostración', async () => {
    await importarSemilla(materializarSemilla(semillaMinima(), ahora), ahora.toISOString());
    const miDia = propio('2026-10-06');
    await guardarCierre(miDia);
    expect(await semillaCargada()).toBe(true);

    const quitado = await borrarDatosDeEjemplo();

    expect(quitado).toMatchObject({ dias: 3, productos: 1 });
    expect(await listarCierres()).toEqual([miDia]);
    expect(await listarProductos()).toEqual([]);
    expect(await semillaCargada()).toBe(false);
  });
});

describe('Perfil: Borrar datos de ejemplo', () => {
  const sembrar = async (conPropio: boolean) => {
    await importarSemilla(materializarSemilla(semillaMinima(), new Date()), new Date().toISOString());
    if (conPropio) await guardarCierre(propio('2026-10-06', 'p-ej'));
  };
  beforeEach(() => clearAllMockStorages());
  afterEach(desmontarApp);

  it('sin datos de ejemplo no hay botón', async () => {
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    expect(app.existe('borrar-ejemplo')).toBe(false);
  });

  it('pide confirmar diciendo cuántos días se van, y recién ahí borra solo lo de ejemplo', async () => {
    await sembrar(true);
    const app = await montarApp();
    await app.tocar('abrir-perfil');

    await app.tocar('borrar-ejemplo');
    expect(app.textoDe('borrar-ejemplo-mensaje')).toContain('Se van a borrar 3 días de ejemplo');
    expect(await listarCierres()).toHaveLength(4); // todavía no se borró nada

    await app.tocar('borrar-ejemplo-si');

    const restantes = await listarCierres();
    expect(restantes).toHaveLength(1);
    expect(restantes[0].fecha).toBe('2026-10-06');
    expect(app.existe('borrar-ejemplo')).toBe(false);
    expect(app.existe('perfil-datos-ejemplo')).toBe(false);
  });

  it('"No, dejarlos" no borra nada', async () => {
    await sembrar(false);
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('borrar-ejemplo');

    await app.tocar('borrar-ejemplo-no');

    expect(await listarCierres()).toHaveLength(3);
    expect(app.existe('borrar-ejemplo')).toBe(true);
  });
});
