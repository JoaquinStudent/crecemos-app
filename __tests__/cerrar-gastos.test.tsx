/** P0 #3 de la auditoría: los gastos agregados en "Cerrar mi día" se pueden quitar. */
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarProducto, listarCierres } from '@storage/repositorio';
import { desmontarApp, montarApp, textoCompleto } from '../testutils/app';

describe('Cerrar mi día: quitar un gasto agregado', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
  });
  afterEach(desmontarApp);

  const agregar = async (app: Awaited<ReturnType<typeof montarApp>>, monto: string) => {
    await app.escribir('monto-gasto', monto);
    await app.tocar('agregar-gasto');
  };

  it('cada gasto trae un botón "Quitar" con texto y una etiqueta que dice cuál es', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await agregar(app, '15');

    expect(textoCompleto(app.botonDe('quitar-gasto-0'))).toBe('Quitar');
    expect(app.botonDe('quitar-gasto-0').props.accessibilityLabel).toBe(
      'Quitar el gasto de Mercadería, S/ 15.00',
    );
  });

  it('quitar el del medio deja los otros dos, en orden', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await agregar(app, '10');
    await agregar(app, '20');
    await agregar(app, '30');

    await app.tocar('quitar-gasto-1');

    expect(app.textoDe('gasto-0-monto')).toBe('− S/ 10.00');
    expect(app.textoDe('gasto-1-monto')).toBe('− S/ 30.00');
    expect(app.existe('gasto-2')).toBe(false);
  });

  it('lo quitado no se guarda en el cierre', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.escribir('preparadas-p-anticucho', '10');
    await agregar(app, '10');
    await agregar(app, '99');
    await app.tocar('quitar-gasto-1');
    await app.tocar('guardar-dia');

    const [cierre] = await listarCierres();
    expect(cierre.gastos).toEqual([{ categoria: 'mercaderia', monto: 10 }]);
  });
});
