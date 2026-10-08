/**
 * Pruebas de apoyo del servicio de la foto de perfil (no son escenarios del SPEC): cada resultado
 * de `elegirFoto`, las opciones exactas que se pasan al selector nativo (simulado) y los textos
 * con voz de Freddy. El selector nunca se abre de verdad en Jest.
 */

import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { FOTO_MAX_BYTES } from '@dominio/foto';
import { elegirFoto, mensajeFoto, type MotivoFoto } from '@services/foto';

/** Base64 de `bytes` bytes (todo ceros): el largo y el relleno `=` son los de una foto real. */
const base64DeBytes = (bytes: number): string => {
  const grupos = Math.ceil(bytes / 3);
  const relleno = grupos * 3 - bytes;
  return 'A'.repeat(grupos * 4 - relleno) + '='.repeat(relleno);
};

const galeria = jest.mocked(launchImageLibrary);
const camara = jest.mocked(launchCamera);

const OPCIONES = {
  mediaType: 'photo',
  maxWidth: 256,
  maxHeight: 256,
  quality: 0.7,
  includeBase64: true,
  selectionLimit: 1,
};

const PALABRAS_TECNICAS =
  /\b(error|exception|undefined|null|permission|camera_unavailable|others|code|base64|nan)\b/i;

describe('elegirFoto', () => {
  beforeEach(() => {
    galeria.mockReset();
    camara.mockReset();
    galeria.mockResolvedValue({ didCancel: true });
    camara.mockResolvedValue({ didCancel: true });
  });

  it('galería: devuelve la foto armada como data URI', async () => {
    const base64 = base64DeBytes(20 * 1024);
    galeria.mockResolvedValueOnce({ assets: [{ base64, type: 'image/jpeg' }] });

    const r = await elegirFoto('galeria');

    expect(r).toEqual({ ok: true, fotoUri: `data:image/jpeg;base64,${base64}` });
    expect(camara).not.toHaveBeenCalled();
  });

  it('cámara: devuelve la foto armada como data URI', async () => {
    const base64 = base64DeBytes(10 * 1024);
    camara.mockResolvedValueOnce({ assets: [{ base64, type: 'image/jpeg' }] });

    const r = await elegirFoto('camara');

    expect(r).toEqual({ ok: true, fotoUri: `data:image/jpeg;base64,${base64}` });
    expect(galeria).not.toHaveBeenCalled();
  });

  it('normaliza image/jpg (lo que devuelve la librería) a image/jpeg', async () => {
    galeria.mockResolvedValueOnce({ assets: [{ base64: 'QUJD', type: 'image/jpg' }] });

    expect(await elegirFoto('galeria')).toEqual({
      ok: true,
      fotoUri: 'data:image/jpeg;base64,QUJD',
    });
  });

  it('sin tipo en el asset asume image/jpeg', async () => {
    galeria.mockResolvedValueOnce({ assets: [{ base64: 'QUJD' }] });

    expect(await elegirFoto('galeria')).toEqual({
      ok: true,
      fotoUri: 'data:image/jpeg;base64,QUJD',
    });
  });

  it('galería: pasa al selector exactamente las opciones fijas', async () => {
    await elegirFoto('galeria');

    expect(galeria).toHaveBeenCalledTimes(1);
    expect(galeria).toHaveBeenCalledWith(OPCIONES);
  });

  it('cámara: las mismas opciones, la cámara frontal y sin guardar en el carrete', async () => {
    await elegirFoto('camara');

    expect(camara).toHaveBeenCalledTimes(1);
    expect(camara).toHaveBeenCalledWith({
      ...OPCIONES,
      cameraType: 'front',
      saveToPhotos: false,
    });
  });

  it('cancelar es CANCELADA y no trae mensaje', async () => {
    const g = await elegirFoto('galeria');
    const c = await elegirFoto('camara');

    expect(g).toEqual({ ok: false, motivo: 'CANCELADA' });
    expect(c).toEqual({ ok: false, motivo: 'CANCELADA' });
  });

  it('errorCode permission es SIN_PERMISO', async () => {
    camara.mockResolvedValueOnce({ errorCode: 'permission', errorMessage: 'Permission denied' });

    expect(await elegirFoto('camara')).toEqual({ ok: false, motivo: 'SIN_PERMISO' });
  });

  it('errorCode camera_unavailable es SIN_CAMARA', async () => {
    camara.mockResolvedValueOnce({ errorCode: 'camera_unavailable' });

    expect(await elegirFoto('camara')).toEqual({ ok: false, motivo: 'SIN_CAMARA' });
  });

  it('cualquier otro errorCode es NO_SE_PUDO y su texto técnico no sale', async () => {
    galeria.mockResolvedValueOnce({ errorCode: 'others', errorMessage: 'PHPicker failed 0x42' });

    const r = await elegirFoto('galeria');

    expect(r).toEqual({ ok: false, motivo: 'NO_SE_PUDO' });
    expect(JSON.stringify(r)).not.toContain('PHPicker');
  });

  it('un selector que rechaza es NO_SE_PUDO, sin lanzar', async () => {
    galeria.mockRejectedValueOnce(new Error('boom'));
    camara.mockRejectedValueOnce('texto suelto');

    await expect(elegirFoto('galeria')).resolves.toEqual({ ok: false, motivo: 'NO_SE_PUDO' });
    await expect(elegirFoto('camara')).resolves.toEqual({ ok: false, motivo: 'NO_SE_PUDO' });
  });

  it('un selector que lanza de forma síncrona también es NO_SE_PUDO', async () => {
    galeria.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expect(elegirFoto('galeria')).resolves.toEqual({ ok: false, motivo: 'NO_SE_PUDO' });
  });

  it('una respuesta sin assets, vacía o sin base64 es NO_SE_PUDO', async () => {
    galeria.mockResolvedValueOnce({});
    galeria.mockResolvedValueOnce({ assets: [] });
    galeria.mockResolvedValueOnce({ assets: [{ type: 'image/jpeg' }] });
    galeria.mockResolvedValueOnce(undefined as never);

    for (let i = 0; i < 4; i += 1) {
      expect(await elegirFoto('galeria')).toEqual({ ok: false, motivo: 'NO_SE_PUDO' });
    }
  });

  it('una foto pesada es INVALIDA con su mensaje', async () => {
    galeria.mockResolvedValueOnce({
      assets: [{ base64: base64DeBytes(FOTO_MAX_BYTES + 1), type: 'image/jpeg' }],
    });

    expect(await elegirFoto('galeria')).toEqual({
      ok: false,
      motivo: 'INVALIDA',
      mensaje: 'Esa foto es muy pesada. Elige otra.',
    });
  });

  it('una foto justo en el tope vale', async () => {
    galeria.mockResolvedValueOnce({
      assets: [{ base64: base64DeBytes(FOTO_MAX_BYTES), type: 'image/jpeg' }],
    });

    expect((await elegirFoto('galeria')).ok).toBe(true);
  });

  it('un base64 vacío no es una foto: INVALIDA o NO_SE_PUDO, nunca ok', async () => {
    galeria.mockResolvedValueOnce({ assets: [{ base64: '', type: 'image/jpeg' }] });

    const r = await elegirFoto('galeria');

    expect(r.ok).toBe(false);
  });
});

describe('mensajeFoto', () => {
  const TEXTOS: Record<'SIN_PERMISO' | 'SIN_CAMARA' | 'NO_SE_PUDO', string> = {
    SIN_PERMISO: 'Para tomar una foto necesito permiso de la cámara. Lo activas en Ajustes.',
    SIN_CAMARA: 'Este teléfono no puede abrir la cámara. Elige una foto de la galería.',
    NO_SE_PUDO: 'No pudimos abrir tus fotos. Inténtalo otra vez.',
  };

  it.each(Object.entries(TEXTOS))('%s tiene su texto con voz de Freddy', (motivo, texto) => {
    expect(mensajeFoto(motivo as MotivoFoto)).toBe(texto);
  });

  it('cancelar no tiene mensaje: no se muestra nada', () => {
    expect(mensajeFoto('CANCELADA')).toBe('');
  });

  it('una foto inválida sin mensaje propio cae a un texto amable', () => {
    expect(mensajeFoto('INVALIDA')).toBe('Esa no parece una foto. Elige otra.');
  });

  it('ningún mensaje es técnico', () => {
    const motivos: MotivoFoto[] = [
      'CANCELADA',
      'SIN_PERMISO',
      'SIN_CAMARA',
      'INVALIDA',
      'NO_SE_PUDO',
    ];
    for (const motivo of motivos) {
      expect(PALABRAS_TECNICAS.test(mensajeFoto(motivo))).toBe(false);
    }
  });
});
