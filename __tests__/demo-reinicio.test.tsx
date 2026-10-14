/**
 * Reinicio reproducible de la demo: instalación nueva → cargar ejemplo → ver Inicio completo →
 * Perfil → Borrar datos de ejemplo → vacío → volver a cargar. La app real, por testID.
 *
 * Política de meta y yapes: cargar el ejemplo NO crea ninguno de los dos, y borrar el ejemplo NO
 * toca los que la persona haya anotado (son siempre suyos).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { AccessibilityInfo } from 'react-native';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import {
  guardarMeta,
  guardarYapes,
  listarCierres,
  listarProductos,
  listarYapes,
  obtenerMeta,
  semillaCargada,
} from '@storage/repositorio';
import { desmontarApp, montarApp } from '../testutils/app';

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

const SEMILLA = readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8');
const fetchPorDefecto = global.fetch;

beforeEach(() => {
  (AccessibilityInfo.isReduceMotionEnabled as jest.Mock).mockResolvedValue(true);
  clearAllMockStorages();
  // Miércoles 7 de octubre de 2026 (hora de Lima): "Tu semana" está en su ventana (lunes a miércoles).
  jest.useFakeTimers({ now: new Date('2026-10-07T12:00:00-05:00'), doNotFake: [...OTROS_RELOJES] });
  global.fetch = jest.fn(
    async () => ({ ok: true, status: 200, text: async () => SEMILLA } as unknown as Response),
  ) as unknown as typeof fetch;
});

afterEach(async () => {
  await desmontarApp();
  jest.useRealTimers();
  global.fetch = fetchPorDefecto;
});

describe('Demo reproducible: cargar, borrar y volver a cargar el ejemplo', () => {
  it('recorre el ciclo completo y deja a la persona con lo suyo intacto', async () => {
    const app = await montarApp();

    // 1. Instalación nueva: Inicio vacío, con la invitación a cargar el ejemplo.
    expect(app.existe('inicio-cargar-ejemplo')).toBe(true);
    for (const id of ['inicio-ciclo', 'inicio-manana', 'inicio-semana']) {
      expect(app.existe(id)).toBe(false);
    }

    // 2. Cargar el ejemplo: aparecen el hero del ciclo, Para mañana (con sugerencias) y Tu semana.
    await app.tocar('inicio-cargar-ejemplo');
    expect(app.existe('inicio-ciclo')).toBe(true);
    expect(app.existe('inicio-ciclo-te-queda')).toBe(true);
    expect(app.existe('inicio-manana')).toBe(true);
    expect(app.cuantos('inicio-manana-p-')).toBeGreaterThan(0);
    expect(app.existe('inicio-manana-p-anticucho-porciones')).toBe(true);
    expect(app.existe('inicio-semana')).toBe(true);
    expect(app.existe('inicio-semana-ejemplo')).toBe(true); // rótulo "Datos de ejemplo"
    expect(app.existe('inicio-cargar-ejemplo')).toBe(false);
    expect((await listarCierres()).length).toBeGreaterThan(50);
    expect(await semillaCargada()).toBe(true);
    // Cargar el ejemplo no inventa meta ni yapes.
    expect(await obtenerMeta()).toBeNull();
    expect(await listarYapes()).toEqual([]);

    // La persona anota lo suyo (meta y un yape) mientras tiene el ejemplo.
    await guardarMeta({
      id: 'm-1',
      nombre: 'Mi cuota',
      montoObjetivo: 300,
      fechaLimite: '2026-10-31',
      creada: '2026-10-07',
      aportes: [],
    });
    await guardarYapes([{ id: 'y-1', fecha: '2026-10-07', hora: '10:00', monto: 12 }]);

    // 3. Perfil → Borrar datos de ejemplo.
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-borrar');
    await app.tocar('borrar-ejemplo');
    await app.tocar('borrar-ejemplo-si');
    expect(await listarCierres()).toEqual([]);
    expect(await listarProductos()).toEqual([]);
    expect(await semillaCargada()).toBe(false);
    // Lo propio sigue ahí.
    expect((await obtenerMeta())?.montoObjetivo).toBe(300);
    expect(await listarYapes()).toHaveLength(1);

    // 4. De vuelta en Inicio: estado vacío otra vez, listo para repetir la demo.
    await app.tocar('seccion-atras');
    await app.tocar('perfil-atras');
    expect(app.existe('inicio-ciclo')).toBe(false);
    expect(app.existe('inicio-manana')).toBe(false);
    expect(app.existe('inicio-semana')).toBe(false);
    expect(app.existe('inicio-cargar-ejemplo')).toBe(true);

    // 5. Volver a cargar: la demo queda igual que la primera vez.
    await app.tocar('inicio-cargar-ejemplo');
    expect(app.existe('inicio-ciclo')).toBe(true);
    expect(app.existe('inicio-manana')).toBe(true);
    expect(app.cuantos('inicio-manana-p-')).toBeGreaterThan(0);
    expect(app.existe('inicio-semana')).toBe(true);
    expect((await listarCierres()).length).toBeGreaterThan(50);
    expect((await obtenerMeta())?.montoObjetivo).toBe(300);
  });
});
