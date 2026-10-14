/**
 * P0 #1 de la auditoría: "Cerrar mi día" no pisa en silencio el cierre de hoy.
 * Si hoy ya está cerrado, la pestaña lo precarga en modo edición y avisa.
 */
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { fechaLocal } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarProducto, listarCierres } from '@storage/repositorio';
import { desmontarApp, montarApp, textoCompleto } from '../testutils/app';

describe('Cerrar mi día cuando hoy ya está cerrado', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
  });
  afterEach(desmontarApp);

  it('sin cierre de hoy no hay aviso y el formulario está vacío', async () => {
    const { tocar, existe, valorDe } = await montarApp();
    await tocar('tab-cerrar-dia');

    expect(existe('cerrar-ya-cerraste')).toBe(false);
    expect(valorDe('preparadas-p-anticucho')).toBe('');
  });

  it('con hoy cerrado precarga ese cierre y muestra el aviso', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    await app.escribir('sobrantes-p-anticucho', '2');
    await app.tocar('guardar-dia');
    await app.tocar('cierre-listo');

    await app.tocar('tab-cerrar-dia');

    expect(app.textos()).toContain('Ya cerraste hoy. Estás editando ese cierre.');
    expect(app.valorDe('preparadas-p-anticucho')).toBe('20');
    expect(app.valorDe('sobrantes-p-anticucho')).toBe('2');
    expect(textoCompleto(app.botonDe('guardar-dia'))).toBe('Guardar los cambios');
  });

  it('guardar edita el cierre de hoy: sigue habiendo uno solo, con el mismo id', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    await app.escribir('sobrantes-p-anticucho', '2');
    await app.tocar('guardar-dia');
    await app.tocar('cierre-listo');
    const [primero] = await listarCierres();

    await app.tocar('tab-cerrar-dia');
    await app.escribir('sobrantes-p-anticucho', '5');
    await app.tocar('guardar-dia');

    const cierres = await listarCierres();
    expect(cierres).toHaveLength(1);
    expect(cierres[0].fecha).toBe(fechaLocal(new Date()));
    expect(cierres[0].id).toBe(primero.id);
    expect(cierres[0].lineas[0]).toMatchObject({ preparadas: 20, sobrantes: 5 });
  });

  it('un formulario en blanco no reemplaza el cierre de hoy', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '20');
    await app.tocar('guardar-dia');
    await app.tocar('cierre-listo');

    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '');
    await app.tocar('guardar-dia'); // sin ventas ni gastos: la validación lo rechaza

    const cierres = await listarCierres();
    expect(cierres).toHaveLength(1);
    expect(cierres[0].lineas[0].preparadas).toBe(20);
  });
});
