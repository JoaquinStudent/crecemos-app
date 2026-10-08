// src/services/foto.ts
// Elige la foto de perfil con el selector nativo (galería o cámara). Sin red: la foto nunca sale
// del teléfono. Nunca lanza y nunca deja pasar un texto técnico a la pantalla.
import {
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
  type ImageLibraryOptions,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { armarFotoUri, validarFoto } from '@dominio/foto';

export type MotivoFoto = 'CANCELADA' | 'SIN_PERMISO' | 'SIN_CAMARA' | 'INVALIDA' | 'NO_SE_PUDO';

export type ResultadoFoto =
  | { ok: true; fotoUri: string }
  | { ok: false; motivo: MotivoFoto; mensaje?: string };

/** La foto se reduce al elegirla: 256 px y calidad 0.7 pesan ~27 KB, bajo el tope de 60 KB. */
const OPCIONES_FOTO = {
  mediaType: 'photo',
  maxWidth: 256,
  maxHeight: 256,
  quality: 0.7,
  includeBase64: true,
  selectionLimit: 1,
} as const satisfies ImageLibraryOptions;

const OPCIONES_CAMARA: CameraOptions = {
  ...OPCIONES_FOTO,
  cameraType: 'front',
  saveToPhotos: false,
};

const MENSAJES: Record<MotivoFoto, string> = {
  CANCELADA: '',
  SIN_PERMISO: 'Para tomar una foto necesito permiso de la cámara. Lo activas en Ajustes.',
  SIN_CAMARA: 'Este teléfono no puede abrir la cámara. Elige una foto de la galería.',
  INVALIDA: 'Esa no parece una foto. Elige otra.',
  NO_SE_PUDO: 'No pudimos abrir tus fotos. Inténtalo otra vez.',
};

/** El texto con voz de Freddy para cada motivo. Cancelar no dice nada. */
export const mensajeFoto = (motivo: MotivoFoto): string => MENSAJES[motivo];

const falla = (motivo: Exclude<MotivoFoto, 'INVALIDA'>): ResultadoFoto => ({ ok: false, motivo });

const traducir = (respuesta: ImagePickerResponse | undefined): ResultadoFoto => {
  if (respuesta?.didCancel) return falla('CANCELADA');
  if (respuesta?.errorCode === 'permission') return falla('SIN_PERMISO');
  if (respuesta?.errorCode === 'camera_unavailable') return falla('SIN_CAMARA');
  const asset = respuesta?.assets?.[0];
  if (respuesta?.errorCode || !asset?.base64) return falla('NO_SE_PUDO');
  const fotoUri = armarFotoUri(asset.base64, asset.type);
  const validacion = validarFoto(fotoUri);
  if (!validacion.ok) {
    return { ok: false, motivo: 'INVALIDA', mensaje: validacion.errores.foto };
  }
  return { ok: true, fotoUri };
};

export const elegirFoto = async (origen: 'galeria' | 'camara'): Promise<ResultadoFoto> => {
  try {
    const respuesta =
      origen === 'camara'
        ? await launchCamera(OPCIONES_CAMARA)
        : await launchImageLibrary(OPCIONES_FOTO);
    return traducir(respuesta);
  } catch {
    return falla('NO_SE_PUDO');
  }
};
