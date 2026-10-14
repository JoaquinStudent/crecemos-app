/** Cuéntame tu día por voz: el botón Hablar escucha, llena el cierre para revisarlo y nunca guarda. */
import { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarProducto, listarCierres } from '@storage/repositorio';
import * as voz from '@services/voz';
import { desmontarApp, montarApp } from '../testutils/app';

jest.mock('@services/voz', () => ({
  ...jest.requireActual('@services/voz'),
  vozDisponible: jest.fn(() => Promise.resolve(true)),
  empezarAEscuchar: jest.fn(() => Promise.resolve()),
  dejarDeEscuchar: jest.fn(() => Promise.resolve()),
  soltarVoz: jest.fn(() => Promise.resolve()),
}));

const FRASE = 'Preparé 60 anticuchos y me sobraron 5. Yape 120. Gasté 30 de carbón.';
const escucha = () => (voz.empezarAEscuchar as jest.Mock).mock.calls.at(-1)[0] as voz.EscuchaVoz;

describe('Cerrar mi día: Hablar', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    jest.clearAllMocks();
    (voz.vozDisponible as jest.Mock).mockResolvedValue(true);
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
  });
  afterEach(desmontarApp);

  const abrir = async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.tocar('cuentame-abrir');
    return app;
  };

  it('escucha, muestra lo que oye y llena el cierre al terminar, sin guardar', async () => {
    const app = await abrir();
    await app.tocar('cuentame-hablar');
    expect(voz.empezarAEscuchar).toHaveBeenCalledTimes(1);
    expect(app.existe('cuentame-escuchando')).toBe(true);

    await act(async () => escucha().alParcial('Preparé 60 anticuchos'));
    expect(app.valorDe('cuentame-texto')).toBe('Preparé 60 anticuchos');

    await act(async () => {
      escucha().alFinal(FRASE);
      escucha().alTerminar();
    });
    expect(app.existe('cuentame-escuchando')).toBe(false);
    expect(app.valorDe('preparadas-p-anticucho')).toBe('60');
    expect(app.valorDe('sobrantes-p-anticucho')).toBe('5');
    expect(app.valorDe('monto-yape')).toBe('120');
    expect(app.existe('cuentame-entendi')).toBe(true);
    expect(await listarCierres()).toEqual([]);
  });

  it('si el sistema cierra sin resultado final, usa lo último que oyó', async () => {
    const app = await abrir();
    await app.tocar('cuentame-hablar');
    await act(async () => {
      escucha().alParcial('Yape 120');
      escucha().alTerminar();
    });
    expect(app.valorDe('monto-yape')).toBe('120');
  });

  it('segundo toque deja de escuchar', async () => {
    const app = await abrir();
    await app.tocar('cuentame-hablar');
    await app.tocar('cuentame-hablar');
    expect(voz.dejarDeEscuchar).toHaveBeenCalledTimes(1);
  });

  it('sin permiso explica qué hacer y deja escribir', async () => {
    const app = await abrir();
    await app.tocar('cuentame-hablar');
    await act(async () => {
      escucha().alError('permiso');
      escucha().alTerminar();
    });
    expect(app.textoDe('cuentame-error-voz')).toContain('Puedes escribir tu día');
    expect(app.existe('cuentame-escuchando')).toBe(false);
  });

  it('esconde el botón si el teléfono no tiene reconocedor', async () => {
    (voz.vozDisponible as jest.Mock).mockResolvedValue(false);
    const app = await abrir();
    expect(app.existe('cuentame-hablar')).toBe(false);
  });
});

describe('errorDeCodigo', () => {
  const { errorDeCodigo } = jest.requireActual('@services/voz');
  it('traduce los códigos de Android', () => {
    expect(errorDeCodigo('7')).toBe('sin-voz');
    expect(errorDeCodigo('9')).toBe('permiso');
    expect(errorDeCodigo('2')).toBe('sin-servicio');
    expect(errorDeCodigo(undefined)).toBe('otro');
  });
});

describe('Cerrar mi día: Hablar limpia el aviso anterior', () => {
  afterEach(desmontarApp);
  it('al empezar a escuchar ya no queda el "Entendí" del dictado anterior', async () => {
    clearAllMockStorages();
    jest.clearAllMocks();
    (voz.vozDisponible as jest.Mock).mockResolvedValue(true);
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.tocar('cuentame-abrir');
    await app.tocar('cuentame-hablar');
    await act(async () => {
      escucha().alFinal(FRASE);
      escucha().alTerminar();
    });
    expect(app.existe('cuentame-entendi')).toBe(true);
    await app.tocar('cuentame-hablar');
    expect(app.existe('cuentame-entendi')).toBe(false);
  });
});

describe('Cerrar mi día: Cuéntame tu día plegable', () => {
  afterEach(desmontarApp);
  beforeEach(async () => {
    clearAllMockStorages();
    jest.clearAllMocks();
    (voz.vozDisponible as jest.Mock).mockResolvedValue(true);
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
  });

  it('arranca cerrado, con el formulario a la vista, y el botón de arriba lo abre y lo cierra', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    expect(app.existe('cuentame-abrir')).toBe(true);
    expect(app.existe('cuentame-tarjeta')).toBe(false);
    expect(app.existe('preparadas-p-anticucho')).toBe(true);
    await app.tocar('cuentame-abrir');
    expect(app.existe('cuentame-tarjeta')).toBe(true);
    expect(app.existe('preparadas-p-anticucho')).toBe(true);
    await app.tocar('cuentame-abrir');
    expect(app.existe('cuentame-tarjeta')).toBe(false);
  });

  it('al esconderlo mientras escucha, deja de escuchar', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    await app.tocar('cuentame-abrir');
    await app.tocar('cuentame-hablar');
    await app.tocar('cuentame-abrir');
    expect(voz.dejarDeEscuchar).toHaveBeenCalledTimes(1);
  });
});
