/**
 * Pruebas de apoyo de la foto de perfil en pantalla (no son escenarios del SPEC; el escenario
 * de guardar y reabrir es spec07_e2). La app real, por testID, como lo haría una persona. El
 * selector nativo de fotos se simula con los mocks de `jest.setup.js`.
 */

import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import App from '../App';
import { CrecemosProvider, useCrecemos } from '@context/CrecemosProvider';
import { armarFotoUri, FOTO_MAX_BYTES } from '@dominio/foto';
import type { Perfil } from '@dominio/tipos';
import { guardarPerfil, obtenerPerfil } from '@storage/repositorio';

/** Base64 de `bytes` bytes (todo ceros): el largo y el relleno `=` son los de una foto real. */
const base64DeBytes = (bytes: number): string => {
  const grupos = Math.ceil(bytes / 3);
  const relleno = grupos * 3 - bytes;
  return 'A'.repeat(grupos * 4 - relleno) + '='.repeat(relleno);
};
const BASE64_A = base64DeBytes(20 * 1024);
const BASE64_B = base64DeBytes(10 * 1024 + 1);
const FOTO_A = armarFotoUri(BASE64_A, 'image/jpg');
const FOTO_B = armarFotoUri(BASE64_B, 'image/jpg');

const galeria = jest.mocked(launchImageLibrary);
const camara = jest.mocked(launchCamera);

const perfilDe = (extra: Partial<Perfil> = {}): Perfil => ({
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  aceptaYape: true,
  yapeAjeno: false,
  actualizadoEn: '2026-10-07T12:00:00-05:00',
  ...extra,
});

const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');

let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarApp = async () => {
  await act(async () => {
    montada = ReactTestRenderer.create(createElement(App));
  });
  // La app queda lista y la semilla (sin red) se resuelve en segundo plano.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
};
const desmontarApp = async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
};
const raiz = (): ReactTestInstance => {
  if (!montada) throw new Error('La app no está montada');
  return (montada as ReactTestRenderer.ReactTestRenderer).root;
};
const tocar = (testID: string) =>
  act(async () => {
    const nodo = raiz().findAll(
      n => n.props.testID === testID && typeof n.props.onPress === 'function',
    )[0];
    if (!nodo) throw new Error(`No hay nada con testID "${testID}" que responda a onPress`);
    await nodo.props.onPress();
  });
const existe = (testID: string): boolean =>
  raiz().findAll(n => n.props.testID === testID).length > 0;
const textos = (): string[] =>
  raiz()
    .findAll(n => (n.type as unknown) === 'Text')
    .map(textoCompleto);
const textoDe = (testID: string): string => {
  const nodo = raiz().findAll(n => (n.type as unknown) === 'Text' && n.props.testID === testID)[0];
  if (!nodo) throw new Error(`No hay ningún texto con testID "${testID}"`);
  return textoCompleto(nodo);
};
const imagenDe = (testID: string): ReactTestInstance => {
  const nodo = raiz().findAll(n => n.props.testID === testID && n.props.source !== undefined)[0];
  if (!nodo) throw new Error(`No hay ninguna imagen con testID "${testID}"`);
  return nodo;
};
const tituloDelBoton = (testID: string): string => {
  const nodo = raiz().findAll(n => n.props.testID === testID && n.props.accessibilityLabel)[0];
  if (!nodo) throw new Error(`No hay ningún botón con testID "${testID}"`);
  return nodo.props.accessibilityLabel as string;
};

const guardadoCrudo = async (): Promise<string | null> =>
  createAsyncStorage('crecemos').getItem('@crecemos/perfil');

const palabrasTecnicas =
  /\b(error|exception|undefined|null|permission|camera_unavailable|others|base64|nan|data:image)\b/i;

/** Abre Perfil con un perfil guardado (con o sin foto). */
const abrirPerfil = async (perfil: Perfil) => {
  await guardarPerfil(perfil);
  await montarApp();
  await tocar('abrir-perfil');
};

describe('Foto de perfil en pantalla', () => {
  beforeEach(() => {
    clearAllMockStorages();
    galeria.mockReset();
    camara.mockReset();
    galeria.mockResolvedValue({ didCancel: true });
    camara.mockResolvedValue({ didCancel: true });
  });
  afterEach(async () => {
    await desmontarApp();
  });

  describe('sin foto', () => {
    it('el Perfil ofrece "Elegir de la galería" y "Tomar foto", con texto', async () => {
      await abrirPerfil(perfilDe());

      expect(existe('perfil-foto-galeria')).toBe(true);
      expect(existe('perfil-foto-camara')).toBe(true);
      expect(tituloDelBoton('perfil-foto-galeria')).toBe('Elegir de la galería');
      expect(tituloDelBoton('perfil-foto-camara')).toBe('Tomar foto');
      expect(existe('perfil-foto-cambiar')).toBe(false);
      expect(existe('perfil-foto-quitar')).toBe(false);
      // Sin foto: la inicial de siempre, con su testID de siempre.
      expect(textoDe('perfil-iniciales')).toBe('F');
      expect(existe('perfil-avatar-foto')).toBe(false);
    });

    it('elegir de la galería guarda la foto al instante y cambia el avatar sin salir', async () => {
      galeria.mockResolvedValueOnce({ assets: [{ base64: BASE64_A, type: 'image/jpg' }] });
      await abrirPerfil(perfilDe());

      await tocar('perfil-foto-galeria');

      expect(galeria).toHaveBeenCalledTimes(1);
      expect(camara).not.toHaveBeenCalled();
      expect(existe('perfil-avatar-foto')).toBe(true);
      expect(existe('perfil-iniciales')).toBe(false);
      expect(imagenDe('perfil-avatar-foto').props.source).toEqual({ uri: FOTO_A });
      expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_A);
      expect(existe('perfil-foto-error')).toBe(false);
    });

    it('tomar foto guarda la foto de la cámara', async () => {
      camara.mockResolvedValueOnce({ assets: [{ base64: BASE64_A, type: 'image/jpg' }] });
      await abrirPerfil(perfilDe());

      await tocar('perfil-foto-camara');

      expect(camara).toHaveBeenCalledTimes(1);
      expect(galeria).not.toHaveBeenCalled();
      expect(imagenDe('perfil-avatar-foto').props.source).toEqual({ uri: FOTO_A });
      expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_A);
    });

    it('cancelar la selección no muestra nada ni cambia nada', async () => {
      await abrirPerfil(perfilDe());
      const antes = await guardadoCrudo();

      await tocar('perfil-foto-galeria');
      await tocar('perfil-foto-camara');

      expect(galeria).toHaveBeenCalledTimes(1);
      expect(camara).toHaveBeenCalledTimes(1);
      expect(existe('perfil-foto-error')).toBe(false);
      expect(existe('perfil-avatar-foto')).toBe(false);
      expect(textoDe('perfil-iniciales')).toBe('F');
      expect(await guardadoCrudo()).toBe(antes);
    });

    it.each([
      [
        'sin permiso de la cámara',
        'camara',
        { errorCode: 'permission' as const },
        'Para tomar una foto necesito permiso de la cámara. Lo activas en Ajustes.',
      ],
      [
        'sin cámara',
        'camara',
        { errorCode: 'camera_unavailable' as const },
        'Este teléfono no puede abrir la cámara. Elige una foto de la galería.',
      ],
      [
        'un fallo del selector de la galería',
        'galeria',
        { errorCode: 'others' as const, errorMessage: 'PHPicker failed 0x42' },
        'No pudimos abrir tus fotos. Inténtalo otra vez.',
      ],
    ])(
      '%s muestra un mensaje amable y no cambia nada',
      async (_nombre, origen, respuesta, texto) => {
        (origen === 'camara' ? camara : galeria).mockResolvedValueOnce(respuesta);
        await abrirPerfil(perfilDe());
        const antes = await guardadoCrudo();

        await tocar(origen === 'camara' ? 'perfil-foto-camara' : 'perfil-foto-galeria');

        expect(textoDe('perfil-foto-error')).toBe(texto);
        expect(existe('perfil-avatar-foto')).toBe(false);
        expect(await guardadoCrudo()).toBe(antes);
        // Ningún texto técnico llega a la pantalla.
        for (const t of textos()) expect(palabrasTecnicas.test(t)).toBe(false);
        expect(textos().join(' ')).not.toContain('PHPicker');
      },
    );

    it('un selector que rechaza muestra el mensaje amable', async () => {
      galeria.mockRejectedValueOnce(new Error('boom'));
      await abrirPerfil(perfilDe());

      await tocar('perfil-foto-galeria');

      expect(textoDe('perfil-foto-error')).toBe('No pudimos abrir tus fotos. Inténtalo otra vez.');
    });

    it('una foto muy pesada muestra su mensaje y no se guarda', async () => {
      galeria.mockResolvedValueOnce({
        assets: [{ base64: base64DeBytes(FOTO_MAX_BYTES + 1), type: 'image/jpeg' }],
      });
      await abrirPerfil(perfilDe());

      await tocar('perfil-foto-galeria');

      expect(textoDe('perfil-foto-error')).toBe('Esa foto es muy pesada. Elige otra.');
      expect(existe('perfil-avatar-foto')).toBe(false);
      expect((await obtenerPerfil())?.fotoUri).toBeUndefined();
    });

    it('el mensaje de error se va cuando la siguiente foto sale bien', async () => {
      galeria.mockRejectedValueOnce(new Error('boom'));
      galeria.mockResolvedValueOnce({ assets: [{ base64: BASE64_A, type: 'image/jpg' }] });
      await abrirPerfil(perfilDe());

      await tocar('perfil-foto-galeria');
      expect(existe('perfil-foto-error')).toBe(true);
      await tocar('perfil-foto-galeria');

      expect(existe('perfil-foto-error')).toBe(false);
      expect(existe('perfil-avatar-foto')).toBe(true);
    });

    it('un error se va si la siguiente vez se cancela', async () => {
      galeria.mockRejectedValueOnce(new Error('boom'));
      await abrirPerfil(perfilDe());

      await tocar('perfil-foto-galeria');
      expect(existe('perfil-foto-error')).toBe(true);
      await tocar('perfil-foto-galeria'); // cancela (mock por defecto)

      expect(existe('perfil-foto-error')).toBe(false);
    });

    it('mientras abre el selector, un segundo toque no lo abre otra vez', async () => {
      let terminar!: (r: { didCancel: true }) => void;
      galeria.mockImplementationOnce(
        () =>
          new Promise(resolver => {
            terminar = resolver;
          }),
      );
      await abrirPerfil(perfilDe());

      // Se toca sin esperar (como dos toques seguidos) y luego se resuelve el primero.
      await act(async () => {
        const nodo = raiz().findAll(
          n => n.props.testID === 'perfil-foto-galeria' && typeof n.props.onPress === 'function',
        )[0];
        nodo.props.onPress();
        nodo.props.onPress();
        const camaraNodo = raiz().findAll(
          n => n.props.testID === 'perfil-foto-camara' && typeof n.props.onPress === 'function',
        )[0];
        camaraNodo.props.onPress();
      });

      expect(galeria).toHaveBeenCalledTimes(1);
      expect(camara).not.toHaveBeenCalled();

      await act(async () => {
        terminar({ didCancel: true });
      });
      // Libre otra vez.
      await tocar('perfil-foto-galeria');
      expect(galeria).toHaveBeenCalledTimes(2);
    });
  });

  describe('con foto', () => {
    const conFoto = () => perfilDe({ fotoUri: FOTO_A });

    it('el Perfil ofrece "Cambiar foto" y "Quitar foto", con texto', async () => {
      await abrirPerfil(conFoto());

      expect(tituloDelBoton('perfil-foto-cambiar')).toBe('Cambiar foto');
      expect(tituloDelBoton('perfil-foto-quitar')).toBe('Quitar foto');
      expect(existe('perfil-foto-galeria')).toBe(false);
      expect(existe('perfil-foto-camara')).toBe(false);
      expect(existe('perfil-avatar-foto')).toBe(true);
      expect(existe('perfil-iniciales')).toBe(false);
    });

    it('"Cambiar foto" abre una elección en línea (sin Modal) y "Cancelar" la cierra', async () => {
      await abrirPerfil(conFoto());
      expect(existe('perfil-foto-cambiar-galeria')).toBe(false);

      await tocar('perfil-foto-cambiar');

      expect(tituloDelBoton('perfil-foto-cambiar-galeria')).toBe('Elegir de la galería');
      expect(tituloDelBoton('perfil-foto-cambiar-camara')).toBe('Tomar foto');
      expect(tituloDelBoton('perfil-foto-cambiar-cancelar')).toBe('Cancelar');
      expect(raiz().findAll(n => (n.type as unknown) === 'Modal')).toHaveLength(0);

      await tocar('perfil-foto-cambiar-cancelar');

      expect(existe('perfil-foto-cambiar-galeria')).toBe(false);
      expect(existe('perfil-foto-cambiar')).toBe(true);
      expect(galeria).not.toHaveBeenCalled();
      expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_A);
    });

    it('cambiar la foto desde la galería reemplaza la anterior y cierra la elección', async () => {
      galeria.mockResolvedValueOnce({ assets: [{ base64: BASE64_B, type: 'image/jpg' }] });
      await abrirPerfil(conFoto());

      await tocar('perfil-foto-cambiar');
      await tocar('perfil-foto-cambiar-galeria');

      expect(imagenDe('perfil-avatar-foto').props.source).toEqual({ uri: FOTO_B });
      expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_B);
      expect(existe('perfil-foto-cambiar-galeria')).toBe(false);
    });

    it('cambiar la foto con la cámara también reemplaza la anterior', async () => {
      camara.mockResolvedValueOnce({ assets: [{ base64: BASE64_B, type: 'image/jpg' }] });
      await abrirPerfil(conFoto());

      await tocar('perfil-foto-cambiar');
      await tocar('perfil-foto-cambiar-camara');

      expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_B);
    });

    it('si al cambiar se cancela el selector, se queda la foto de antes', async () => {
      await abrirPerfil(conFoto());

      await tocar('perfil-foto-cambiar');
      await tocar('perfil-foto-cambiar-galeria');

      expect(existe('perfil-foto-error')).toBe(false);
      expect(imagenDe('perfil-avatar-foto').props.source).toEqual({ uri: FOTO_A });
      expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_A);
    });

    it('si al cambiar falla, avisa con el mensaje amable y se queda la foto de antes', async () => {
      camara.mockResolvedValueOnce({ errorCode: 'permission' });
      await abrirPerfil(conFoto());

      await tocar('perfil-foto-cambiar');
      await tocar('perfil-foto-cambiar-camara');

      expect(textoDe('perfil-foto-error')).toBe(
        'Para tomar una foto necesito permiso de la cámara. Lo activas en Ajustes.',
      );
      expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_A);
    });

    it('"Quitar foto" pide confirmar diciendo la consecuencia, en línea', async () => {
      await abrirPerfil(conFoto());
      expect(existe('perfil-foto-quitar-si')).toBe(false);

      await tocar('perfil-foto-quitar');

      expect(textos()).toContain('¿Quitar tu foto? Se va a ver tu inicial.');
      expect(tituloDelBoton('perfil-foto-quitar-si')).toBe('Sí, quitar');
      expect(tituloDelBoton('perfil-foto-quitar-no')).toBe('No, dejarla');
      expect(raiz().findAll(n => (n.type as unknown) === 'Modal')).toHaveLength(0);
      // Todavía no cambió nada.
      expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_A);
      expect(existe('perfil-avatar-foto')).toBe(true);
    });

    it('"No, dejarla" no cambia nada y cierra la pregunta', async () => {
      await abrirPerfil(conFoto());
      const antes = await guardadoCrudo();

      await tocar('perfil-foto-quitar');
      await tocar('perfil-foto-quitar-no');

      expect(existe('perfil-foto-quitar-si')).toBe(false);
      expect(textos()).not.toContain('¿Quitar tu foto? Se va a ver tu inicial.');
      expect(existe('perfil-avatar-foto')).toBe(true);
      expect(await guardadoCrudo()).toBe(antes);
    });

    it('"Sí, quitar" vuelve a la inicial y borra fotoUri del perfil guardado', async () => {
      await abrirPerfil(conFoto());

      await tocar('perfil-foto-quitar');
      await tocar('perfil-foto-quitar-si');

      expect(existe('perfil-avatar-foto')).toBe(false);
      expect(textoDe('perfil-iniciales')).toBe('F');
      // Vuelven los botones de "sin foto" y se va la pregunta.
      expect(existe('perfil-foto-galeria')).toBe(true);
      expect(existe('perfil-foto-quitar-si')).toBe(false);
      const guardado = await obtenerPerfil();
      expect(guardado).not.toBeNull();
      expect('fotoUri' in (guardado as Perfil)).toBe(false);
      expect(await guardadoCrudo()).not.toContain('fotoUri');
      // Lo demás del perfil sigue igual.
      expect(guardado?.nombre).toBe('Freddy');
      expect(guardado?.negocio).toBe('Anticuchos Freddy');
    });

    it('quitar la foto y elegir otra después funciona', async () => {
      galeria.mockResolvedValueOnce({ assets: [{ base64: BASE64_B, type: 'image/jpg' }] });
      await abrirPerfil(conFoto());

      await tocar('perfil-foto-quitar');
      await tocar('perfil-foto-quitar-si');
      await tocar('perfil-foto-galeria');

      expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_B);
    });

    it('un error anterior no se queda en pantalla al pedir quitar la foto', async () => {
      camara.mockResolvedValueOnce({ errorCode: 'permission' });
      await abrirPerfil(conFoto());
      await tocar('perfil-foto-cambiar');
      await tocar('perfil-foto-cambiar-camara');
      expect(existe('perfil-foto-error')).toBe(true);

      await tocar('perfil-foto-quitar');

      expect(existe('perfil-foto-error')).toBe(false);
    });
  });

  describe('persistencia y otras pantallas', () => {
    it('la foto persiste tras reiniciar la app', async () => {
      galeria.mockResolvedValueOnce({ assets: [{ base64: BASE64_A, type: 'image/jpg' }] });
      await abrirPerfil(perfilDe());
      await tocar('perfil-foto-galeria');
      await desmontarApp();

      await montarApp();
      await tocar('abrir-perfil');

      expect(imagenDe('perfil-avatar-foto').props.source).toEqual({ uri: FOTO_A });
      expect(tituloDelBoton('perfil-foto-quitar')).toBe('Quitar foto');
    });

    it('Inicio muestra la foto en el avatar y conserva su etiqueta "Mi perfil"', async () => {
      await guardarPerfil(perfilDe({ fotoUri: FOTO_A }));
      await montarApp();

      expect(imagenDe('inicio-avatar-foto').props.source).toEqual({ uri: FOTO_A });
      expect(existe('inicio-avatar-iniciales')).toBe(false);
      expect(textos()).toContain('Mi perfil');
      const boton = raiz().findAll(
        n => n.props.testID === 'abrir-perfil' && typeof n.props.onPress === 'function',
      )[0];
      expect(boton.props.accessibilityLabel).toBe('Mi perfil');
    });

    it('Inicio vuelve a la inicial tras quitar la foto', async () => {
      await abrirPerfil(perfilDe({ fotoUri: FOTO_A }));
      await tocar('perfil-foto-quitar');
      await tocar('perfil-foto-quitar-si');
      await tocar('perfil-atras');

      expect(textoDe('inicio-avatar-iniciales')).toBe('F');
      expect(existe('inicio-avatar-foto')).toBe(false);
    });

    it('la foto elegida en Perfil se ve en Inicio al volver, sin reiniciar', async () => {
      galeria.mockResolvedValueOnce({ assets: [{ base64: BASE64_A, type: 'image/jpg' }] });
      await abrirPerfil(perfilDe());
      await tocar('perfil-foto-galeria');
      await tocar('perfil-atras');

      expect(existe('inicio-avatar-foto')).toBe(true);
    });

    it('una foto inválida ya guardada cae a la inicial sin romper ninguna pantalla', async () => {
      await guardarPerfil(perfilDe({ fotoUri: 'esto no es una foto' }));
      await montarApp();

      expect(textoDe('inicio-avatar-iniciales')).toBe('F');
      expect(existe('inicio-avatar-foto')).toBe(false);

      await tocar('abrir-perfil');

      expect(textoDe('perfil-iniciales')).toBe('F');
      expect(existe('perfil-avatar-foto')).toBe(false);
      // Sin foto válida se ofrecen los botones de "sin foto".
      expect(existe('perfil-foto-galeria')).toBe(true);
    });

    it('una foto demasiado pesada ya guardada también cae a la inicial', async () => {
      const pesada = armarFotoUri(base64DeBytes(FOTO_MAX_BYTES + 100), 'image/jpeg');
      await guardarPerfil(perfilDe({ fotoUri: pesada }));
      await montarApp();

      expect(textoDe('inicio-avatar-iniciales')).toBe('F');
    });

    it('si la imagen falla al cargar (onError), el avatar cae a la inicial', async () => {
      await abrirPerfil(perfilDe({ fotoUri: FOTO_A }));
      expect(existe('perfil-avatar-foto')).toBe(true);

      await act(async () => {
        imagenDe('perfil-avatar-foto').props.onError({ nativeEvent: { error: 'x' } });
      });

      expect(existe('perfil-avatar-foto')).toBe(false);
      expect(textoDe('perfil-iniciales')).toBe('F');
    });

    it('si falla la imagen de Inicio, Inicio cae a la inicial', async () => {
      await guardarPerfil(perfilDe({ fotoUri: FOTO_A }));
      await montarApp();

      await act(async () => {
        imagenDe('inicio-avatar-foto').props.onError({ nativeEvent: { error: 'x' } });
      });

      expect(existe('inicio-avatar-foto')).toBe(false);
      expect(textoDe('inicio-avatar-iniciales')).toBe('F');
    });

    it('la foto lleva su etiqueta de accesibilidad y es circular', async () => {
      await abrirPerfil(perfilDe({ fotoUri: FOTO_A }));

      const imagen = imagenDe('perfil-avatar-foto');
      expect(imagen.props.accessibilityLabel).toBe('Foto de perfil');
      expect(imagen.props.resizeMode).toBe('cover');
      const estilo = aplanarEstilo(imagen.props.style);
      expect(estilo.width).toBe(96);
      expect(estilo.height).toBe(96);
      expect(estilo.borderRadius).toBeGreaterThanOrEqual(48);
    });

    it('la foto de Inicio mide 48 dp', async () => {
      await guardarPerfil(perfilDe({ fotoUri: FOTO_A }));
      await montarApp();

      const estilo = aplanarEstilo(imagenDe('inicio-avatar-foto').props.style);
      expect(estilo.width).toBe(48);
      expect(estilo.height).toBe(48);
    });

    it('sin foto, ningún texto de la pantalla es técnico', async () => {
      await abrirPerfil(perfilDe());

      for (const t of textos()) expect(palabrasTecnicas.test(t)).toBe(false);
    });

    it('todos los botones de la foto miden al menos 48 dp', async () => {
      // El alto sale del estilo ya resuelto del botón (el de la vista nativa con ese testID).
      const alto = (id: string): number => {
        const alturas = raiz()
          .findAll(n => n.props.testID === id && n.props.style !== undefined)
          .map(n => {
            const estilo = aplanarEstilo(
              typeof n.props.style === 'function'
                ? n.props.style({ pressed: false })
                : n.props.style,
            );
            return Number(estilo.height ?? estilo.minHeight);
          })
          .filter(h => !Number.isNaN(h));
        if (alturas.length === 0) throw new Error(`No hay alto para "${id}"`);
        return Math.max(...alturas);
      };
      await abrirPerfil(perfilDe());
      expect(alto('perfil-foto-galeria')).toBeGreaterThanOrEqual(48);
      expect(alto('perfil-foto-camara')).toBeGreaterThanOrEqual(48);
      await desmontarApp();

      await abrirPerfil(perfilDe({ fotoUri: FOTO_A }));
      expect(alto('perfil-foto-cambiar')).toBeGreaterThanOrEqual(48);
      expect(alto('perfil-foto-quitar')).toBeGreaterThanOrEqual(48);
      await tocar('perfil-foto-quitar');
      expect(alto('perfil-foto-quitar-si')).toBeGreaterThanOrEqual(48);
      expect(alto('perfil-foto-quitar-no')).toBeGreaterThanOrEqual(48);
    });
  });
});

/** Aplana un estilo de React Native (arreglos anidados, falsos y nulos) a un solo objeto. */
function aplanarEstilo(estilo: unknown): Record<string, unknown> {
  if (Array.isArray(estilo)) {
    return estilo.reduce<Record<string, unknown>>(
      (total, e) => ({ ...total, ...aplanarEstilo(e) }),
      {},
    );
  }
  return estilo && typeof estilo === 'object' ? (estilo as Record<string, unknown>) : {};
}

describe('CrecemosProvider: guardarFoto y quitarFoto', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(async () => {
    await desmontarApp();
  });

  const montarProvider = async () => {
    let contexto!: ReturnType<typeof useCrecemos>;
    const Sonda = () => {
      contexto = useCrecemos();
      return null;
    };
    await act(async () => {
      montada = ReactTestRenderer.create(
        createElement(CrecemosProvider, null, createElement(Sonda)),
      );
    });
    return () => contexto;
  };

  it('guardarFoto con una foto válida la guarda en el perfil y devuelve ok', async () => {
    await guardarPerfil(perfilDe());
    const contexto = await montarProvider();

    let resultado: unknown;
    await act(async () => {
      resultado = await contexto().guardarFoto(FOTO_A);
    });

    expect(resultado).toEqual({ ok: true });
    expect(contexto().perfil.fotoUri).toBe(FOTO_A);
    expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_A);
    expect((await obtenerPerfil())?.nombre).toBe('Freddy');
  });

  it('guardarFoto con una foto inválida devuelve su error y no cambia nada', async () => {
    await guardarPerfil(perfilDe({ fotoUri: FOTO_A }));
    const contexto = await montarProvider();
    const antes = await guardadoCrudo();

    let sinFormato: unknown;
    let pesada: unknown;
    await act(async () => {
      sinFormato = await contexto().guardarFoto('hola');
      pesada = await contexto().guardarFoto(
        armarFotoUri(base64DeBytes(FOTO_MAX_BYTES + 1), 'image/jpeg'),
      );
    });

    expect(sinFormato).toEqual({
      ok: false,
      errores: { foto: 'Esa no parece una foto. Elige otra.' },
    });
    expect(pesada).toEqual({
      ok: false,
      errores: { foto: 'Esa foto es muy pesada. Elige otra.' },
    });
    expect(contexto().perfil.fotoUri).toBe(FOTO_A);
    expect(await guardadoCrudo()).toBe(antes);
  });

  it('guardarFoto sin perfil guardado crea el perfil con la foto', async () => {
    const contexto = await montarProvider();

    await act(async () => {
      await contexto().guardarFoto(FOTO_A);
    });

    expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_A);
  });

  it('quitarFoto borra el campo del JSON guardado (no queda undefined ni null)', async () => {
    await guardarPerfil(perfilDe({ fotoUri: FOTO_A, yapeNumero: '987654321' }));
    const contexto = await montarProvider();

    await act(async () => {
      await contexto().quitarFoto();
    });

    expect('fotoUri' in contexto().perfil).toBe(false);
    expect(await guardadoCrudo()).not.toContain('fotoUri');
    const guardado = await obtenerPerfil();
    expect('fotoUri' in (guardado as Perfil)).toBe(false);
    expect(guardado?.yapeNumero).toBe('987654321');
    expect(guardado?.actualizadoEn).not.toBe('2026-10-07T12:00:00-05:00');
  });

  it('quitarFoto sin foto no rompe y deja el perfil sin el campo', async () => {
    await guardarPerfil(perfilDe());
    const contexto = await montarProvider();

    await act(async () => {
      await contexto().quitarFoto();
    });

    expect(await guardadoCrudo()).not.toContain('fotoUri');
  });

  it('guardarPerfil de otro dato conserva la foto', async () => {
    await guardarPerfil(perfilDe({ fotoUri: FOTO_A }));
    const contexto = await montarProvider();

    await act(async () => {
      await contexto().guardarPerfil({ negocio: 'Otro nombre' });
    });

    expect((await obtenerPerfil())?.fotoUri).toBe(FOTO_A);
  });
});
