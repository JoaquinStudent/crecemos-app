/**
 * Pruebas de apoyo de la foto de perfil (no son escenarios del SPEC): bordes del tamaño, formatos,
 * el avatar y quitar la foto. Puro: sin pantalla ni almacenamiento.
 */

import {
  armarFotoUri,
  avatarDe,
  FOTO_MAX_BYTES,
  MENSAJES_FOTO,
  quitarFoto,
  validarFoto,
} from '@dominio/foto';
import type { Perfil } from '@dominio/tipos';

/** Base64 de `bytes` bytes (todo ceros): el largo y el relleno `=` son los de una foto real. */
const base64DeBytes = (bytes: number): string => {
  const grupos = Math.ceil(bytes / 3);
  const relleno = grupos * 3 - bytes;
  return 'A'.repeat(grupos * 4 - relleno) + '='.repeat(relleno);
};
const fotoDe = (bytes: number, tipo = 'image/jpeg'): string =>
  `data:${tipo};base64,${base64DeBytes(bytes)}`;

const perfilDe = (extra: Partial<Perfil> = {}): Perfil => ({
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  aceptaYape: true,
  yapeAjeno: false,
  actualizadoEn: '2026-10-07T12:00:00-05:00',
  ...extra,
});

const NO_ES_FOTO = { ok: false, errores: { foto: 'Esa no parece una foto. Elige otra.' } };
const PESADA = { ok: false, errores: { foto: 'Esa foto es muy pesada. Elige otra.' } };

describe('FOTO_MAX_BYTES', () => {
  it('son 60 KB', () => {
    expect(FOTO_MAX_BYTES).toBe(61440);
  });

  it('los mensajes son los del SPEC', () => {
    expect(MENSAJES_FOTO.noEsFoto).toBe('Esa no parece una foto. Elige otra.');
    expect(MENSAJES_FOTO.pesada).toBe('Esa foto es muy pesada. Elige otra.');
  });
});

describe('validarFoto · tamaño', () => {
  it('justo 60 KB pasa', () => {
    expect(validarFoto(fotoDe(61440))).toEqual({ ok: true });
  });

  it('60 KB + 1 byte no pasa (el relleno "==" no engaña)', () => {
    const foto = fotoDe(61441);
    expect(foto.endsWith('==')).toBe(true);
    expect(validarFoto(foto)).toEqual(PESADA);
  });

  it('un byte menos de 60 KB pasa (relleno "=")', () => {
    const foto = fotoDe(61439);
    expect(foto.endsWith('=')).toBe(true);
    expect(validarFoto(foto)).toEqual({ ok: true });
  });

  it('61442 bytes (relleno de un "=") tampoco pasan', () => {
    // 61442 bytes → 81924 caracteres con un "=" al final: 61443 − 1 = 61442 > 61440.
    const foto = fotoDe(61442);
    expect(foto.endsWith('=') && !foto.endsWith('==')).toBe(true);
    expect(validarFoto(foto)).toEqual(PESADA);
  });

  it('una foto de 20 KB pasa y una de 1 byte también', () => {
    expect(validarFoto(fotoDe(20 * 1024))).toEqual({ ok: true });
    expect(validarFoto(fotoDe(1))).toEqual({ ok: true });
  });
});

describe('validarFoto · formato', () => {
  it('image/jpg (lo que devuelve la librería de selección) es válido', () => {
    expect(validarFoto(fotoDe(1000, 'image/jpg'))).toEqual({ ok: true });
  });

  it('image/png y image/webp son válidos: se exige image/, no jpeg', () => {
    expect(validarFoto(fotoDe(1000, 'image/png'))).toEqual({ ok: true });
    expect(validarFoto(fotoDe(1000, 'image/webp'))).toEqual({ ok: true });
  });

  it('un texto vacío no parece una foto', () => {
    expect(validarFoto('')).toEqual(NO_ES_FOTO);
  });

  it('un texto cualquiera, una ruta de archivo y una dirección web no parecen una foto', () => {
    expect(validarFoto('hola')).toEqual(NO_ES_FOTO);
    expect(validarFoto('file:///fotos/freddy.jpg')).toEqual(NO_ES_FOTO);
    expect(validarFoto('https://ejemplo.pe/freddy.jpg')).toEqual(NO_ES_FOTO);
  });

  it('otro tipo de data URI (texto, pdf) no es una foto', () => {
    expect(validarFoto('data:text/plain;base64,AAAA')).toEqual(NO_ES_FOTO);
    expect(validarFoto('data:application/pdf;base64,AAAA')).toEqual(NO_ES_FOTO);
  });

  it('sin ";base64," no es una foto', () => {
    expect(validarFoto('data:image/jpeg,AAAA')).toEqual(NO_ES_FOTO);
    expect(validarFoto('data:image/jpeg;AAAA')).toEqual(NO_ES_FOTO);
  });

  it('con el formato pero sin contenido no es una foto', () => {
    expect(validarFoto('data:image/jpeg;base64,')).toEqual(NO_ES_FOTO);
  });

  it('un texto sin formato pero enorme se rechaza por no ser una foto, no por pesado', () => {
    expect(validarFoto('x'.repeat(200000))).toEqual(NO_ES_FOTO);
  });
});

describe('armarFotoUri', () => {
  it('sin tipo usa image/jpeg', () => {
    expect(armarFotoUri('QUJD')).toBe('data:image/jpeg;base64,QUJD');
  });

  it('normaliza image/jpg a image/jpeg', () => {
    expect(armarFotoUri('QUJD', 'image/jpg')).toBe('data:image/jpeg;base64,QUJD');
  });

  it('respeta image/png', () => {
    expect(armarFotoUri('QUJD', 'image/png')).toBe('data:image/png;base64,QUJD');
  });

  it('quita saltos de línea y espacios del base64', () => {
    expect(armarFotoUri('QU\nJD \r\n RA==\t')).toBe('data:image/jpeg;base64,QUJDRA==');
  });

  it('un tipo que no es de imagen o vacío cae en image/jpeg', () => {
    expect(armarFotoUri('QUJD', '')).toBe('data:image/jpeg;base64,QUJD');
    expect(armarFotoUri('QUJD', 'application/pdf')).toBe('data:image/jpeg;base64,QUJD');
  });

  it('lo que arma pasa validarFoto', () => {
    expect(validarFoto(armarFotoUri(base64DeBytes(5000), 'image/jpg'))).toEqual({ ok: true });
  });
});

describe('avatarDe', () => {
  it('con una foto válida muestra la foto', () => {
    const uri = fotoDe(3000);
    expect(avatarDe(perfilDe({ fotoUri: uri }))).toEqual({ tipo: 'foto', uri });
  });

  it('sin foto muestra la inicial del nombre', () => {
    expect(avatarDe(perfilDe())).toEqual({ tipo: 'iniciales', texto: 'F' });
  });

  it('con una foto inválida cae a la inicial', () => {
    expect(avatarDe(perfilDe({ fotoUri: 'file:///fotos/freddy.jpg' }))).toEqual({
      tipo: 'iniciales',
      texto: 'F',
    });
    expect(avatarDe(perfilDe({ fotoUri: fotoDe(70000) }))).toEqual({
      tipo: 'iniciales',
      texto: 'F',
    });
    expect(avatarDe(perfilDe({ fotoUri: '' }))).toEqual({ tipo: 'iniciales', texto: 'F' });
  });

  it('con perfil null da "?"', () => {
    expect(avatarDe(null)).toEqual({ tipo: 'iniciales', texto: '?' });
  });

  it('con nombre vacío da "?" y con minúscula da mayúscula', () => {
    expect(avatarDe(perfilDe({ nombre: '' }))).toEqual({ tipo: 'iniciales', texto: '?' });
    expect(avatarDe(perfilDe({ nombre: 'marta' }))).toEqual({ tipo: 'iniciales', texto: 'M' });
  });
});

describe('quitarFoto', () => {
  it('devuelve el perfil sin foto y conserva todo lo demás', () => {
    const original = perfilDe({ fotoUri: fotoDe(3000), yapeNumero: '987654321' });
    const sin = quitarFoto(original);
    expect('fotoUri' in sin).toBe(false);
    expect(sin).toEqual(perfilDe({ yapeNumero: '987654321' }));
  });

  it('no muta el original', () => {
    const uri = fotoDe(3000);
    const original = Object.freeze(perfilDe({ fotoUri: uri }));
    const sin = quitarFoto(original);
    expect(sin).not.toBe(original);
    expect(original.fotoUri).toBe(uri);
  });

  it('un perfil que ya no tiene foto sigue sin foto', () => {
    const sin = quitarFoto(perfilDe());
    expect('fotoUri' in sin).toBe(false);
    expect(avatarDe(sin)).toEqual({ tipo: 'iniciales', texto: 'F' });
  });
});
