/**
 * La marca `@crecemos/recorrido-visto`: lectura tolerante (si leer falla, NO se muestra) y
 * escritura por el repositorio.
 */
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import {
  marcarRecorridoVisto,
  olvidarRecorridoVisto,
  recorridoVisto,
} from '@storage/repositorio';
import { soltarRecorridoReal, usarRecorridoReal } from '../testutils/recorrido';

describe('Repositorio: recorrido visto', () => {
  beforeEach(() => {
    clearAllMockStorages();
    usarRecorridoReal();
  });
  afterEach(() => {
    soltarRecorridoReal();
    jest.restoreAllMocks();
  });

  it('en Jest viene visto por defecto, para no tapar las demás pruebas', async () => {
    soltarRecorridoReal();
    expect(await recorridoVisto()).toBe(true);
  });

  it('sin nada guardado (lectura correcta) no lo vio', async () => {
    expect(await recorridoVisto()).toBe(false);
  });

  it('marcarlo y olvidarlo se ven en la lectura', async () => {
    await marcarRecorridoVisto();
    expect(await recorridoVisto()).toBe(true);
    await olvidarRecorridoVisto();
    expect(await recorridoVisto()).toBe(false);
  });

  it('guarda bajo la clave acordada', async () => {
    await marcarRecorridoVisto();
    expect(await createAsyncStorage('crecemos').getItem('@crecemos/recorrido-visto')).toBe('true');
  });

  it('si leer falla, lo da por visto: nunca muestra el recorrido a ciegas', async () => {
    jest.spyOn(createAsyncStorage('crecemos'), 'getItem').mockRejectedValue(new Error('disco roto'));
    expect(await recorridoVisto()).toBe(true);
  });

  it('un valor ilegible también cuenta como visto (hay algo guardado)', async () => {
    await createAsyncStorage('crecemos').setItem('@crecemos/recorrido-visto', '{{');
    expect(await recorridoVisto()).toBe(true);
  });
});
