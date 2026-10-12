/** Filtros del Historial: una sola fila que se desliza, con ícono y texto en cada chip. */
import fs from 'fs';
import path from 'path';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { nuevoCierre } from '@dominio/cierre';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarCierre } from '@storage/repositorio';
import { desmontarApp, montarApp } from '../../testutils/app';

describe('Historial: filtros con scroll', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    await guardarCierre({
      ...nuevoCierre(
        {
          fecha: '2026-10-06',
          lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 0 }],
          montoYape: 0,
          gastos: [],
          abreCiclo: true,
        },
        PRODUCTOS_POR_DEFECTO,
        null,
        new Date('2026-10-07T12:00:00-05:00'),
      ),
      id: 'c-2026-10-06',
    });
  });
  afterEach(desmontarApp);

  it('los 4 filtros van en un ScrollView horizontal sin indicador, con ícono y texto', async () => {
    const app = await montarApp();
    await app.tocar('tab-historial');
    expect(app.existe('filtro-scroll')).toBe(true);

    for (const [id, etiqueta] of [
      ['filtro-todo', 'Todo'],
      ['filtro-ingresos', 'Ingresos'],
      ['filtro-gastos', 'Gastos'],
      ['filtro-porCobrar', 'Por cobrar'],
    ]) {
      expect(app.textos()).toContain(etiqueta);
      expect(app.existe(id)).toBe(true);
    }
  });

  it('usa layout scroll, se estira al borde y cada filtro lleva su ícono lucide', () => {
    const fuente = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'screens', 'HistorialScreen.tsx'),
      'utf8',
    );
    expect(fuente).toMatch(/layout="scroll"/);
    expect(fuente).toContain('marginHorizontal: -spacing.lg');
    for (const icono of ['List', 'ArrowUp', 'ArrowDown', 'Clock']) {
      expect(fuente).toMatch(new RegExp('icon: ' + icono));
    }
  });

  it('PreguntarScreen reutiliza el chip compartido y ya no define uno propio', () => {
    const fuente = fs.readFileSync(
      path.join(__dirname, '..', '..', 'src', 'screens', 'PreguntarScreen.tsx'),
      'utf8',
    );
    expect(fuente).toContain("@components/molecules/Chip");
    expect(fuente).not.toMatch(/const Chip = /);
  });
});
