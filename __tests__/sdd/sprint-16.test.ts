/**
 * @jest-environment node
 *
 * Tests del Sprint-16. Generados desde sdd/spec/Sprint-16-voz-y-nube/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * Parte A (quitar la voz): auditorías de archivos. Parte B (reporte en la nube): el Worker con R2 y
 * `fetch` simulados, y el servicio de la app. La app montada (e3, e11 a e14) está en
 * sprint-16-pantalla.test.tsx. Nunca se toca la red ni una clave.
 */

/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import worker, {
  DIAS_DE_VIDA_DEL_ENLACE,
  MAX_CUERPO_BYTES_SUBIDA,
  MAX_PDF_BYTES,
  nuevoIdReporte,
} from '../../servidor/worker.js';
import {
  DIAS_ENLACE_REPORTE,
  MAX_PDF_BYTES_SUBIDA,
  subirReporte,
  TEXTO_SIN_INTERNET,
} from '@services/jev';

const RAIZ = join(__dirname, '..', '..');
const leer = (...partes: string[]) => readFileSync(join(RAIZ, ...partes), 'utf8');

const archivosDe = (dir: string): string[] =>
  readdirSync(dir).flatMap(nombre => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivosDe(ruta) : [ruta];
  });

// --- Parte A · Quitar la voz --------------------------------------------------------------------

describe('Sprint-16 · quitar la voz', () => {
  // @spec16_e2 — La voz y el analizador ya no existen en el código
  it('spec16_e2 la voz y el analizador ya no existen en el codigo ni en la configuracion', () => {
    // Given: el repositorio
    // When: se buscan la librería de voz, sus archivos, sus permisos y su código nativo copiado
    // Then: no queda nada de eso
    const fuentes = archivosDe(join(RAIZ, 'src')).filter(f => /\.(ts|tsx)$/.test(f));
    for (const f of fuentes) {
      const texto = readFileSync(f, 'utf8');
      expect({ f: relative(RAIZ, f), usa: /@react-native-voice|@services\/voz|useDictadoVoz|contarDia/.test(texto) }).toEqual({
        f: relative(RAIZ, f),
        usa: false,
      });
    }
    for (const ruta of [
      'src/services/voz.ts',
      'src/hooks/useDictadoVoz.ts',
      'src/analisis/contarDia.ts',
      'android/app/src/main/java/com/wenkesj',
    ]) {
      expect(existsSync(join(RAIZ, ruta))).toBe(false);
    }
    const paquete = JSON.parse(leer('package.json'));
    expect(Object.keys({ ...paquete.dependencies, ...paquete.devDependencies })).not.toContain(
      '@react-native-voice/voice',
    );
    expect(leer('android/app/src/main/AndroidManifest.xml')).not.toMatch(
      /RECORD_AUDIO|RecognitionService/,
    );
    expect(leer('android/app/src/main/java/com/cuadramosapp/MainApplication.kt')).not.toMatch(/Voice/);
    expect(leer('react-native.config.js')).not.toMatch(/voice/i);
    expect(leer('jest.setup.js')).not.toMatch(/voice/i);
    // Sin micrófono no hay por qué pedirlo: Info.plist no lleva sus cadenas de uso.
    expect(leer('ios/CuadramosApp/Info.plist')).not.toMatch(
      /NSMicrophoneUsageDescription|NSSpeechRecognitionUsageDescription/,
    );
  });
});

// --- Parte B · El Worker ------------------------------------------------------------------------

const URL_WORKER = 'https://asistente.ejemplo.test/';
const CLAVE = 'clave-de-prueba-que-no-existe-0123456789';

/** Un R2 de mentira en memoria: guarda lo que se le da y lleva la cuenta de las llamadas. */
const r2Falso = () => {
  const objetos = new Map<string, { bytes: Uint8Array; opciones: any }>();
  return {
    objetos,
    put: jest.fn(async (id: string, bytes: Uint8Array, opciones: any) => {
      objetos.set(id, { bytes, opciones });
    }),
    get: jest.fn(async (id: string) => {
      const o = objetos.get(id);
      return o
        ? { body: new Blob([o.bytes as any]).stream(), customMetadata: o.opciones.customMetadata }
        : null;
    }),
    delete: jest.fn(async (id: string) => {
      objetos.delete(id);
    }),
  };
};

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n').toString('base64');
const subida = (cuerpo: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_WORKER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
const pedir = (id: string, metodo = 'GET') =>
  new Request(`https://asistente.ejemplo.test/r/${id}`, { method: metodo });

describe('Sprint-16 · el Worker guarda y sirve el reporte', () => {
  let openrouter: jest.Mock;
  beforeEach(() => {
    openrouter = jest.fn();
    global.fetch = openrouter as unknown as typeof fetch;
  });

  // @spec16_e4 — Sube un PDF válido y devuelve id, url y caducidad
  it('spec16_e4 sube un PDF valido y devuelve id url y caducidad', async () => {
    // Given: un PDF pequeño en base64 y un R2 vacío (sin ninguna clave de proveedor en el entorno)
    const REPORTES = r2Falso();
    // When: se sube con el nombre que quiera ponerle quien llama
    const antes = Date.now();
    const r = await worker.fetch(subida({ tipo: 'subirReporte', pdf: PDF, nombre: '../../evil.pdf' }), {
      REPORTES,
    });
    // Then: responde id de 32 hexadecimales, la url /r/<id> de ESTE Worker y una caducidad a 30 días
    expect(r.status).toBe(200);
    const json = (await r.json()) as { id: string; url: string; caduca: string };
    expect(json.id).toMatch(/^[0-9a-f]{32}$/);
    expect(json.url).toBe(`https://asistente.ejemplo.test/r/${json.id}`);
    const dias = (Date.parse(json.caduca) - antes) / 86400000;
    expect(DIAS_DE_VIDA_DEL_ENLACE).toBe(30);
    expect(dias).toBeGreaterThan(29.99);
    expect(dias).toBeLessThan(30.01);
    // Y el objeto se guardó con el id (el nombre que llegó se ignora), como PDF y con su caducidad
    const guardado = REPORTES.objetos.get(json.id)!;
    expect([...REPORTES.objetos.keys()]).toEqual([json.id]);
    expect(Buffer.from(guardado.bytes).subarray(0, 5).toString()).toBe('%PDF-');
    expect(guardado.opciones.httpMetadata.contentType).toBe('application/pdf');
    expect(guardado.opciones.customMetadata.caduca).toBe(json.caduca);
    expect(openrouter).not.toHaveBeenCalled();
  });

  // @spec16_e5 — Rechaza lo que no es un PDF razonable
  it('spec16_e5 rechaza lo vacio lo que no empieza por %PDF- lo de mas de 1 MiB y el base64 invalido', async () => {
    // Given: un R2 vacío
    const REPORTES = r2Falso();
    const grande = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(MAX_PDF_BYTES)]).toString('base64');
    const casos: [string, unknown, number, string][] = [
      ['sin pdf', { tipo: 'subirReporte' }, 400, 'PDF_INVALIDO'],
      ['vacío', { tipo: 'subirReporte', pdf: '' }, 400, 'PDF_INVALIDO'],
      ['no es texto', { tipo: 'subirReporte', pdf: 123 }, 400, 'PDF_INVALIDO'],
      ['base64 con símbolos raros', { tipo: 'subirReporte', pdf: 'JVBERi0x@@@' }, 400, 'PDF_INVALIDO'],
      ['base64 de largo imposible', { tipo: 'subirReporte', pdf: 'JVBERi0xL' }, 400, 'PDF_INVALIDO'],
      [
        'no empieza por %PDF-',
        { tipo: 'subirReporte', pdf: Buffer.from('<html>hola</html>').toString('base64') },
        415,
        'NO_ES_PDF',
      ],
      [
        'empieza por %PDF pero sin el guion',
        { tipo: 'subirReporte', pdf: Buffer.from('%PDF1.4 ...').toString('base64') },
        415,
        'NO_ES_PDF',
      ],
      ['pesa más de 1 MiB', { tipo: 'subirReporte', pdf: grande }, 413, 'PDF_GRANDE'],
    ];
    for (const [nombre, cuerpo, status, codigo] of casos) {
      // When: se intenta subir
      const r = await worker.fetch(subida(cuerpo), { REPORTES });
      // Then: se rechaza con su código, sin ningún detalle técnico, y no se guarda nada
      expect([nombre, r.status, await r.text()]).toEqual([nombre, status, `{"error":"${codigo}"}`]);
    }
    expect(REPORTES.put).not.toHaveBeenCalled();
    // Y un PDF justo de 1 MiB sí entra (el tope es inclusivo) con el cuerpo más grande permitido
    const justo = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(MAX_PDF_BYTES - 5)]).toString('base64');
    const ok = await worker.fetch(
      subida({ tipo: 'subirReporte', pdf: justo }, { 'Content-Length': String(justo.length + 60) }),
      { REPORTES },
    );
    expect(ok.status).toBe(200);
    expect(justo.length + 60).toBeLessThan(MAX_CUERPO_BYTES_SUBIDA);
  });

  it('spec16_e5 el tope de lectura grande es solo de esta ruta y sin R2 no hay subida', async () => {
    // Given: un cuerpo grande que declara su tamaño pero NO es una subida
    const REPORTES = r2Falso();
    const grande = JSON.stringify({ tipo: 'interpretar', texto: 'a'.repeat(20000) });
    // When: se envía al chat
    const r = await worker.fetch(subida(grande, { 'Content-Length': String(grande.length) }), {
      OPENROUTER_API_KEY: CLAVE,
      REPORTES,
    });
    // Then: se rechaza por grande, como siempre
    expect(r.status).toBe(413);
    expect(openrouter).not.toHaveBeenCalled();
    // Y sin el binding de R2 la subida responde NO_CONFIGURADO, sin detalles
    const sinR2 = await worker.fetch(subida({ tipo: 'subirReporte', pdf: PDF }), {});
    expect([sinR2.status, await sinR2.text()]).toEqual([500, '{"error":"NO_CONFIGURADO"}']);
  });

  // @spec16_e6 — GET /r/<id> sirve el PDF
  it('spec16_e6 GET r id sirve el PDF para ver o para descargar', async () => {
    // Given: un reporte recién subido
    const REPORTES = r2Falso();
    const { id } = (await (await worker.fetch(subida({ tipo: 'subirReporte', pdf: PDF }), { REPORTES })).json()) as {
      id: string;
    };
    // When: se pide su enlace
    const r = await worker.fetch(pedir(id), { REPORTES });
    // Then: devuelve los mismos bytes como PDF en línea, sin caché y sin indexar
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(r.headers.get('content-disposition')).toBe('inline; filename="reporte-crecemos.pdf"');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-robots-tag')).toMatch(/noindex/);
    expect(Buffer.from(await r.arrayBuffer()).toString('base64')).toBe(PDF);
    // Y con ?descargar=1 es descarga; cualquier otro parámetro se ignora y el nombre lo fija el Worker
    const descarga = await worker.fetch(pedir(`${id}?descargar=1`), { REPORTES });
    expect(descarga.status).toBe(200);
    expect(descarga.headers.get('content-disposition')).toBe('attachment; filename="reporte-crecemos.pdf"');
    for (const extra of ['?descargar=0', '?descargar=si', '?filename=evil.pdf', '?descargar=1&filename=evil.pdf&x=%00']) {
      const r2 = await worker.fetch(pedir(`${id}${extra}`), { REPORTES });
      expect(r2.status).toBe(200);
      const cd = r2.headers.get('content-disposition');
      expect(cd).toBe(
        extra.startsWith('?descargar=1')
          ? 'attachment; filename="reporte-crecemos.pdf"'
          : 'inline; filename="reporte-crecemos.pdf"',
      );
    }
    // Y solo se lee con GET
    const otro = await worker.fetch(pedir(id, 'DELETE'), { REPORTES });
    expect(otro.status).toBe(405);
    expect(REPORTES.objetos.has(id)).toBe(true);
  });

  // @spec16_e7 — Vencido o inexistente: 404 amable, y el vencido se borra
  it('spec16_e7 un enlace vencido o inexistente da 404 amable y el vencido se borra', async () => {
    // Given: un reporte vigente, uno vencido, uno sin fecha legible y un id que nunca existió
    const REPORTES = r2Falso();
    const guardar = (id: string, caduca: string) =>
      REPORTES.put(id, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), { customMetadata: { caduca } });
    const vigente = 'a'.repeat(32);
    const vencido = 'b'.repeat(32);
    const sinFecha = 'c'.repeat(32);
    await guardar(vigente, new Date(Date.now() + 60000).toISOString());
    await guardar(vencido, new Date(Date.now() - 1000).toISOString());
    await guardar(sinFecha, 'cualquier cosa');
    // When: se piden
    const respuestas = await Promise.all(
      [vigente, vencido, sinFecha, 'd'.repeat(32), 'corto', 'a/b', 'A'.repeat(32)].map(id =>
        worker.fetch(pedir(id), { REPORTES }),
      ),
    );
    // Then: el vigente se sirve; todo lo demás da el MISMO 404 amable (no revela si existió o venció)
    expect(respuestas[0].status).toBe(200);
    const noDisponibles = respuestas.slice(1);
    for (const r of noDisponibles) {
      expect(r.status).toBe(404);
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(await r.text()).toBe('Este enlace ya no está disponible.');
    }
    // Y los vencidos (con fecha pasada o sin fecha legible) se borraron; el vigente sigue
    expect(REPORTES.objetos.has(vencido)).toBe(false);
    expect(REPORTES.objetos.has(sinFecha)).toBe(false);
    expect(REPORTES.objetos.has(vigente)).toBe(true);
  });

  // @spec16_e8 — El id es largo y aleatorio
  it('spec16_e8 el id tiene 128 bits aleatorios y no se repite', () => {
    // Given: mil ids nuevos
    const ids = Array.from({ length: 1000 }, () => nuevoIdReporte());
    // When: se revisan
    // Then: todos son 32 hexadecimales distintos y nacen de crypto.getRandomValues
    expect(ids.every(id => /^[0-9a-f]{32}$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(1000);
    const codigo = leer('servidor/worker.js');
    expect(codigo).toMatch(/crypto\.getRandomValues/);
    expect(codigo).not.toMatch(/Math\.random/);
  });

  // @spec16_e9 — Subir no usa clave y tiene su límite propio
  it('spec16_e9 subir no usa ninguna clave y tiene su limite por IP mas estricto', async () => {
    // Given: un entorno SIN clave de OpenRouter y un límite de subida que se agota
    const REPORTES = r2Falso();
    const limit = jest.fn().mockResolvedValueOnce({ success: true }).mockResolvedValue({ success: false });
    // When: se sube dos veces
    const primera = await worker.fetch(subida({ tipo: 'subirReporte', pdf: PDF }), {
      REPORTES,
      LIMITE_SUBIDA: { limit },
    });
    const segunda = await worker.fetch(subida({ tipo: 'subirReporte', pdf: PDF }), {
      REPORTES,
      LIMITE_SUBIDA: { limit },
    });
    // Then: la primera pasa sin clave; la segunda recibe 429 y no guarda nada más
    expect(primera.status).toBe(200);
    expect([segunda.status, await segunda.text()]).toEqual([429, '{"error":"DEMASIADAS_PETICIONES"}']);
    expect(REPORTES.put).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith({ key: 'desconocida' });
    // Y el chat sigue exigiendo su clave
    const chat = await worker.fetch(subida({ tipo: 'interpretar', texto: 'hola' }), {});
    expect(chat.status).toBe(500);
    // La configuración declara el bucket, el binding y el límite de subida más estricto que el general
    const toml = leer('servidor/wrangler.toml');
    expect(toml).toMatch(/binding = "REPORTES"/);
    expect(toml).toMatch(/bucket_name = "crecemos-reportes"/);
    const limites = [...toml.matchAll(/name = "(\w+)"[\s\S]*?limit = (\d+)/g)].map(m => [m[1], Number(m[2])]);
    const porNombre = Object.fromEntries(limites);
    expect(porNombre.LIMITE_SUBIDA).toBeLessThan(porNombre.LIMITE);
    // Y la app y el Worker cuentan los mismos días
    expect(DIAS_ENLACE_REPORTE).toBe(DIAS_DE_VIDA_DEL_ENLACE);
    expect(MAX_PDF_BYTES_SUBIDA).toBe(MAX_PDF_BYTES);
  });
});

// --- Parte B · El servicio de la app ------------------------------------------------------------

const JSON_OK = (id: string, base = 'https://asistente.ejemplo.test') => ({
  id,
  url: `${base}/r/${id}`,
  caduca: new Date(Date.now() + 7 * 86400000).toISOString(),
});
const ID = '0123456789abcdef0123456789abcdef';
const respuestaJson = (cuerpo: unknown, status = 200) =>
  ({ ok: status < 400, status, text: async () => JSON.stringify(cuerpo) }) as unknown as Response;

describe('Sprint-16 · la app sube el reporte por la puerta del Worker', () => {
  // @spec16_e10 — Un encabezado, un intento, 8 s, nunca lanza, nada técnico
  it('spec16_e10 subirReporte manda un solo encabezado un intento y nunca lanza', async () => {
    // Given: un Worker que responde bien
    const f = jest.fn(async () => respuestaJson(JSON_OK(ID)));
    // When: se sube
    const r = await subirReporte(f as unknown as typeof fetch, 'https://asistente.ejemplo.test/', PDF);
    // Then: un POST con solo Content-Type y el cuerpo exacto {tipo, pdf}; un intento
    expect(r).toMatchObject({ ok: true, enlace: { id: ID, url: `https://asistente.ejemplo.test/r/${ID}` } });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://asistente.ejemplo.test/');
    expect(init.method).toBe('POST');
    expect(Object.keys(init.headers as object)).toEqual(['Content-Type']);
    expect(JSON.parse(init.body as string)).toEqual({ tipo: 'subirReporte', pdf: PDF });

    // Y ante cada falla devuelve un código (que la pantalla traduce), sin lanzar y sin reintentar
    const malas: [string, () => Promise<Response>, string][] = [
      ['sin red', () => Promise.reject(new TypeError('Network request failed')), 'SIN_RED'],
      ['429', async () => respuestaJson({ error: 'DEMASIADAS_PETICIONES' }, 429), 'LIMITE'],
      ['502', async () => respuestaJson({ error: 'NO_DISPONIBLE' }, 502), 'SERVIDOR'],
      ['url ajena', async () => respuestaJson({ ...JSON_OK(ID), url: 'https://otro.test/r/' + ID }), 'RESPUESTA_INVALIDA'],
      ['id corto', async () => respuestaJson(JSON_OK('abc')), 'RESPUESTA_INVALIDA'],
      ['sin fecha', async () => respuestaJson({ ...JSON_OK(ID), caduca: 'ayer' }), 'RESPUESTA_INVALIDA'],
      ['no es JSON', async () => ({ ok: true, status: 200, text: async () => '<html>' }) as unknown as Response, 'RESPUESTA_INVALIDA'],
    ];
    for (const [nombre, impl, codigo] of malas) {
      const g = jest.fn(impl);
      const m = await subirReporte(g as unknown as typeof fetch, 'https://asistente.ejemplo.test', PDF);
      expect([nombre, m]).toEqual([nombre, { ok: false, error: codigo }]);
      expect(g).toHaveBeenCalledTimes(1);
    }
    // Un PDF de más de 1 MiB ni siquiera sale del teléfono
    const h = jest.fn();
    const enorme = Buffer.alloc(MAX_PDF_BYTES_SUBIDA + 10).toString('base64');
    expect(await subirReporte(h as unknown as typeof fetch, 'https://asistente.ejemplo.test', enorme)).toEqual({
      ok: false,
      error: 'PDF_GRANDE',
    });
    expect(h).not.toHaveBeenCalled();
  });

  it('spec16_e10 a los 8 segundos se corta y se trata como sin red', async () => {
    // Given: un Worker que nunca contesta y un reloj falso
    jest.useFakeTimers();
    try {
      const f = jest.fn(
        (_u: string, init: RequestInit) =>
          new Promise<Response>((_res, rej) => {
            (init.signal as AbortSignal).addEventListener('abort', () => rej(new Error('abortado')));
          }),
      );
      // When: pasan 8 segundos
      const pendiente = subirReporte(f as unknown as typeof fetch, 'https://asistente.ejemplo.test', PDF);
      await jest.advanceTimersByTimeAsync(7999);
      expect(f).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(2);
      // Then: se corta, con un solo intento
      expect(await pendiente).toEqual({ ok: false, error: 'TIEMPO_AGOTADO' });
      expect(f).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  // @spec16_e15 — Una sola puerta a la red
  it('spec16_e15 fetch sigue solo en seed y jev, sin console y sin dependencias nuevas', () => {
    // Given: todo el código de src/
    const fuentes = archivosDe(join(RAIZ, 'src')).filter(f => /\.(ts|tsx)$/.test(f));
    // When: se buscan llamadas de red y console
    const conRed = fuentes
      .filter(f => /(?<![\w.])fetch(Fn)?\s*\(|XMLHttpRequest|\baxios\b|WebSocket/.test(readFileSync(f, 'utf8')))
      .map(f => relative(RAIZ, f))
      .sort();
    const conConsole = fuentes.filter(f => /\bconsole\./.test(readFileSync(f, 'utf8')));
    // Then: la red vive solo en seed.ts y jev.ts; el servicio de la nube no llama a fetch
    expect(conRed).toEqual(['src/services/jev.ts', 'src/services/seed.ts']);
    expect(conConsole).toEqual([]);
    expect(leer('src/services/reporteNube.ts')).not.toMatch(/(?<![\w.])fetch(Fn)?\s*\(/);
    // Y no hay dependencias nuevas: solo la de voz salió
    const paquete = JSON.parse(leer('package.json'));
    expect(Object.keys(paquete.dependencies)).not.toEqual(expect.arrayContaining(['aws-sdk', 'axios']));
    expect(TEXTO_SIN_INTERNET).toMatch(/^Necesitas internet/);
  });
});
