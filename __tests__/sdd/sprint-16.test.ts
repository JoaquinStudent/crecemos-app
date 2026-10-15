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
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { claveDelReporte } from '@analisis/claveReporte';
import {
  diasQueQuedan,
  MAX_ENLACES_TEMPORALES,
  MAX_REPORTES_GUARDADOS,
  sanearTitulo,
  tituloSugerido,
  type EntradaReporte,
} from '@dominio/reporteGuardado';
import {
  borrarEnlacesDeReporte,
  entradaDeReporte,
  guardarReporteEnLista,
  listarReportesGuardados,
  quitarReporteDeLista,
  registrarEntradaDeReporte,
} from '@storage/repositorio';
import type { Cierre, Perfil, Producto } from '@dominio/tipos';
import worker, {
  DIAS_DE_VIDA_DEL_ENLACE,
  LIMITE_DIARIO_SUBIDAS,
  MAX_CUERPO_BYTES_SUBIDA,
  MAX_PDF_BYTES,
  MINUTOS_DE_VIDA_DE_LA_RESERVA,
  nuevoIdReporte,
} from '../../servidor/worker.js';
import {
  DIAS_ENLACE_REPORTE,
  MAX_PDF_BYTES_SUBIDA,
  reservarReporte,
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

type Objeto = { bytes: Uint8Array; opciones: any };
/** Un R2 de mentira en memoria: guarda lo que se le da y lleva la cuenta de las llamadas. */
const r2Falso = () => {
  const objetos = new Map<string, Objeto>();
  return {
    objetos,
    put: jest.fn(async (llave: string, cuerpo: Uint8Array | string, opciones: any = {}) => {
      const bytes = typeof cuerpo === 'string' ? new TextEncoder().encode(cuerpo) : cuerpo;
      objetos.set(llave, { bytes, opciones });
    }),
    get: jest.fn(async (llave: string) => {
      const o = objetos.get(llave);
      return o
        ? { body: new Blob([o.bytes as any]).stream(), customMetadata: o.opciones.customMetadata }
        : null;
    }),
    delete: jest.fn(async (llave: string) => {
      objetos.delete(llave);
    }),
  };
};
type R2 = ReturnType<typeof r2Falso>;

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n').toString('base64');
const post = (cuerpo: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_WORKER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
const pedir = (id: string, metodo = 'GET') =>
  new Request(`https://asistente.ejemplo.test/r/${id}`, { method: metodo });
type Enlace = { id: string; url: string; caduca: string };
const reservar = async (REPORTES: R2, extra: object = {}) =>
  worker.fetch(post({ tipo: 'reservarReporte' }), { REPORTES, ...extra });
const subir = (REPORTES: R2, id: string, pdf: unknown = PDF, extra: object = {}) =>
  worker.fetch(post({ tipo: 'subirReporte', id, pdf }), { REPORTES, ...extra });
/** Reserva y sube: el camino feliz. */
const crear = async (REPORTES: R2, pdf: unknown = PDF): Promise<Enlace> => {
  const reserva = (await (await reservar(REPORTES)).json()) as Enlace;
  const r = await subir(REPORTES, reserva.id, pdf);
  expect(r.status).toBe(200);
  return (await r.json()) as Enlace;
};
const AMABLE = 'Este enlace ya no está disponible.';

describe('Sprint-16 · el Worker reserva, guarda y sirve el reporte', () => {
  let openrouter: jest.Mock;
  beforeEach(() => {
    openrouter = jest.fn();
    global.fetch = openrouter as unknown as typeof fetch;
  });

  // @spec16_e4 — Reservar devuelve id, url y caducidad; subir guarda y borra la reserva
  it('spec16_e4 reservar devuelve id url y caducidad y subir guarda el PDF y borra la reserva', async () => {
    // Given: un R2 vacío y un entorno sin clave de proveedor
    const REPORTES = r2Falso();
    // When: se reserva
    const antes = Date.now();
    const r = await reservar(REPORTES);
    // Then: responde id de 32 hexadecimales, la url /r/<id> de ESTE Worker y la caducidad definitiva a 30 días
    expect(r.status).toBe(200);
    const reserva = (await r.json()) as Enlace;
    expect(reserva.id).toMatch(/^[0-9a-f]{32}$/);
    expect(reserva.url).toBe(`https://asistente.ejemplo.test/r/${reserva.id}`);
    const dias = (Date.parse(reserva.caduca) - antes) / 86400000;
    expect(DIAS_DE_VIDA_DEL_ENLACE).toBe(30);
    expect(dias).toBeGreaterThan(29.99);
    expect(dias).toBeLessThan(30.01);
    // And: solo hay una reserva corta (15 minutos) y todavía ningún archivo
    expect([...REPORTES.objetos.keys()]).toEqual([`reservas/${reserva.id}`]);
    const vence = Date.parse(REPORTES.objetos.get(`reservas/${reserva.id}`)!.opciones.customMetadata.venceReserva);
    expect(MINUTOS_DE_VIDA_DE_LA_RESERVA).toBe(15);
    expect((vence - antes) / 60000).toBeGreaterThan(14.9);
    expect((vence - antes) / 60000).toBeLessThan(15.1);

    // When: se sube el PDF a esa reserva (con un nombre ajeno, que se ignora)
    const sube = await worker.fetch(
      post({ tipo: 'subirReporte', id: reserva.id, pdf: PDF, nombre: '../../evil.pdf' }),
      { REPORTES },
    );
    // Then: devuelve el MISMO enlace y la MISMA caducidad que se imprimió; el PDF queda en r/<id> como
    // application/pdf con esa caducidad, y la reserva ya no existe
    expect(sube.status).toBe(200);
    const { token, ...publico } = reserva as Enlace & { token: string };
    expect(await sube.json()).toEqual(publico);
    // And: el token se entregó UNA vez (en la reserva), no aparece en la respuesta de la subida y en R2 solo
    // queda su hash SHA-256
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(token).not.toBe(reserva.id);
    const guardadoR2 = JSON.stringify([...REPORTES.objetos.values()].map(o => o.opciones));
    expect(guardadoR2).not.toContain(token);
    const hash = Buffer.from(await crypto.subtle.digest('SHA-256', Buffer.from(token))).toString('hex');
    expect(REPORTES.objetos.get(`r/${reserva.id}`)!.opciones.customMetadata.hashBorrado).toBe(hash);
    const guardado = REPORTES.objetos.get(`r/${reserva.id}`)!;
    expect(Buffer.from(guardado.bytes).subarray(0, 5).toString()).toBe('%PDF-');
    expect(guardado.opciones.httpMetadata.contentType).toBe('application/pdf');
    expect(guardado.opciones.customMetadata.caduca).toBe(reserva.caduca);
    expect(REPORTES.objetos.has(`reservas/${reserva.id}`)).toBe(false);
    expect(openrouter).not.toHaveBeenCalled();
  });

  // @spec16_e5 — Rechaza lo que no es un PDF razonable
  it('spec16_e5 rechaza lo vacio lo que no empieza por %PDF- lo de mas de 400 KB y el base64 invalido', async () => {
    // Given: una reserva vigente
    const REPORTES = r2Falso();
    const { id } = (await (await reservar(REPORTES)).json()) as Enlace;
    const grande = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(MAX_PDF_BYTES)]).toString('base64');
    const casos: [string, unknown, number, string][] = [
      ['sin pdf', null, 400, 'PDF_INVALIDO'],
      ['vacío', '', 400, 'PDF_INVALIDO'],
      ['no es texto', 123, 400, 'PDF_INVALIDO'],
      ['base64 con símbolos raros', 'JVBERi0x@@@', 400, 'PDF_INVALIDO'],
      ['base64 de largo imposible', 'JVBERi0xL', 400, 'PDF_INVALIDO'],
      ['no empieza por %PDF-', Buffer.from('<html>hola</html>').toString('base64'), 415, 'NO_ES_PDF'],
      ['%PDF sin el guion', Buffer.from('%PDF1.4 ...').toString('base64'), 415, 'NO_ES_PDF'],
      ['pesa más de 400 KB', grande, 413, 'PDF_GRANDE'],
    ];
    for (const [nombre, pdf, status, codigo] of casos) {
      // When: se intenta subir
      const r = await subir(REPORTES, id, pdf);
      // Then: se rechaza con su código, sin ningún detalle técnico, y no se guarda nada
      expect([nombre, r.status, await r.text()]).toEqual([nombre, status, `{"error":"${codigo}"}`]);
    }
    expect([...REPORTES.objetos.keys()]).toEqual([`reservas/${id}`]);
    // And: rechazar un PDF malo NO gasta la reserva; un PDF de exactamente 400 KB sí entra
    expect(MAX_PDF_BYTES).toBe(400 * 1024);
    const justo = Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(MAX_PDF_BYTES - 5)]).toString('base64');
    const ok = await subir(REPORTES, id, justo);
    expect(ok.status).toBe(200);
    expect(justo.length).toBeLessThan(MAX_CUERPO_BYTES_SUBIDA);
  });

  it('spec16_e5 el tope de lectura grande es solo de la subida y sin R2 no hay reserva ni subida', async () => {
    // Given: un cuerpo grande que declara su tamaño pero NO es una subida
    const REPORTES = r2Falso();
    const grande = JSON.stringify({ tipo: 'interpretar', texto: 'a'.repeat(20000) });
    // When: se envía al chat
    const r = await worker.fetch(post(grande, { 'Content-Length': String(grande.length) }), {
      OPENROUTER_API_KEY: CLAVE,
      REPORTES,
    });
    // Then: se rechaza por grande, como siempre
    expect(r.status).toBe(413);
    expect(openrouter).not.toHaveBeenCalled();
    // And: sin el binding de R2 reservar y subir responden NO_CONFIGURADO, sin detalles
    for (const cuerpo of [{ tipo: 'reservarReporte' }, { tipo: 'subirReporte', id: 'a'.repeat(32), pdf: PDF }]) {
      const sinR2 = await worker.fetch(post(cuerpo), {});
      expect([sinR2.status, await sinR2.text()]).toEqual([500, '{"error":"NO_CONFIGURADO"}']);
    }
  });

  // @spec16_e18 — Una reserva sirve una sola vez, y solo si está vigente
  it('spec16_e18 un id sin reserva vencido o ya usado da 404 amable y una reserva sirve una sola vez', async () => {
    // Given: una reserva usada, una vencida y un id que nunca se reservó
    const REPORTES = r2Falso();
    const usada = await crear(REPORTES);
    const vencida = (await (await reservar(REPORTES)).json()) as Enlace;
    REPORTES.objetos.get(`reservas/${vencida.id}`)!.opciones.customMetadata.venceReserva = new Date(
      Date.now() - 1000,
    ).toISOString();
    const nunca = 'e'.repeat(32);
    // When: se intenta subir a cada una (y a ids mal escritos)
    const respuestas = await Promise.all(
      [usada.id, vencida.id, nunca, 'corto', 'A'.repeat(32)].map(id => subir(REPORTES, id)),
    );
    // Then: todas dan el MISMO 404 amable, sin revelar cuál fue el motivo
    for (const r of respuestas) {
      expect(r.status).toBe(404);
      expect(await r.text()).toBe(AMABLE);
    }
    // And: la reserva vencida se limpió y el archivo ya subido no se tocó
    expect(REPORTES.objetos.has(`reservas/${vencida.id}`)).toBe(false);
    expect(REPORTES.objetos.has(`r/${usada.id}`)).toBe(true);
    expect(REPORTES.objetos.has(`r/${nunca}`)).toBe(false);
    expect(REPORTES.objetos.has(`r/${vencida.id}`)).toBe(false);
  });

  // @spec16_e6 — GET /r/<id> sirve el PDF para ver o para descargar, con cabeceras seguras
  it('spec16_e6 GET r id sirve el PDF para ver o para descargar con cabeceras seguras', async () => {
    // Given: un reporte recién subido
    const REPORTES = r2Falso();
    const { id } = await crear(REPORTES);
    // When: se pide su enlace
    const r = await worker.fetch(pedir(id), { REPORTES });
    // Then: devuelve los mismos bytes como PDF en línea, sin caché, sin indexar, sin adivinar el tipo y en sandbox
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(r.headers.get('content-disposition')).toBe('inline; filename="reporte-crecemos.pdf"');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('x-robots-tag')).toMatch(/noindex/);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('content-security-policy')).toBe('sandbox');
    expect(Buffer.from(await r.arrayBuffer()).toString('base64')).toBe(PDF);
    // And: con ?descargar=1 es descarga; cualquier otro parámetro se ignora y el nombre lo fija el Worker
    const descarga = await worker.fetch(pedir(`${id}?descargar=1`), { REPORTES });
    expect(descarga.status).toBe(200);
    expect(descarga.headers.get('content-disposition')).toBe('attachment; filename="reporte-crecemos.pdf"');
    expect(descarga.headers.get('content-security-policy')).toBe('sandbox');
    for (const extra of [
      '?descargar=0',
      '?descargar=si',
      '?filename=evil.pdf',
      '?descargar=1&filename=evil.pdf&x=%00',
    ]) {
      const r2 = await worker.fetch(pedir(`${id}${extra}`), { REPORTES });
      expect(r2.status).toBe(200);
      expect(r2.headers.get('content-disposition')).toBe(
        extra.startsWith('?descargar=1')
          ? 'attachment; filename="reporte-crecemos.pdf"'
          : 'inline; filename="reporte-crecemos.pdf"',
      );
    }
    // And: solo se lee con GET
    const otro = await worker.fetch(pedir(id, 'DELETE'), { REPORTES });
    expect(otro.status).toBe(405);
    expect(REPORTES.objetos.has(`r/${id}`)).toBe(true);
  });

  // @spec16_e7 — Vencido o inexistente: 404 amable, y el vencido se borra
  it('spec16_e7 un enlace vencido o inexistente da 404 amable y el vencido se borra', async () => {
    // Given: un reporte vigente, uno vencido, uno sin fecha legible y un id que nunca existió
    const REPORTES = r2Falso();
    const guardar = (id: string, caduca: string) =>
      REPORTES.put(`r/${id}`, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
        customMetadata: { caduca },
      });
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
    for (const r of respuestas.slice(1)) {
      expect(r.status).toBe(404);
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(await r.text()).toBe(AMABLE);
    }
    // And: los vencidos (con fecha pasada o sin fecha legible) se borraron; el vigente sigue
    expect(REPORTES.objetos.has(`r/${vencido}`)).toBe(false);
    expect(REPORTES.objetos.has(`r/${sinFecha}`)).toBe(false);
    expect(REPORTES.objetos.has(`r/${vigente}`)).toBe(true);
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

  // @spec16_e9 — Sin clave, con su límite por IP estricto y su tope diario
  it('spec16_e9 reservar y subir no usan ninguna clave y tienen su limite por IP mas estricto', async () => {
    // Given: un entorno SIN clave de OpenRouter y un límite de subida que se agota a la tercera
    const REPORTES = r2Falso();
    const limit = jest
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValue({ success: false });
    const env = { REPORTES, LIMITE_SUBIDA: { limit } };
    // When: se reserva, se sube y se vuelve a reservar
    const reserva = (await (await worker.fetch(post({ tipo: 'reservarReporte' }), env)).json()) as Enlace;
    const sube = await worker.fetch(post({ tipo: 'subirReporte', id: reserva.id, pdf: PDF }), env);
    const tercera = await worker.fetch(post({ tipo: 'reservarReporte' }), env);
    // Then: las dos primeras pasan sin clave; la tercera recibe 429 y no guarda nada más
    expect(sube.status).toBe(200);
    expect([tercera.status, await tercera.text()]).toEqual([429, '{"error":"DEMASIADAS_PETICIONES"}']);
    expect(REPORTES.objetos.has(`reservas/${reserva.id}`)).toBe(false);
    // And: el chat sigue exigiendo su clave
    const chat = await worker.fetch(post({ tipo: 'interpretar', texto: 'hola' }), {});
    expect(chat.status).toBe(500);
    // And: la configuración declara el bucket, el binding y un límite de subida menor que el general
    const toml = leer('servidor/wrangler.toml');
    expect(toml).toMatch(/binding = "REPORTES"/);
    expect(toml).toMatch(/bucket_name = "crecemos-reportes"/);
    const limites = [...toml.matchAll(/name = "(\w+)"[\s\S]*?limit = (\d+)/g)].map(m => [m[1], Number(m[2])]);
    const porNombre = Object.fromEntries(limites);
    expect(porNombre.LIMITE_SUBIDA).toBeLessThan(porNombre.LIMITE);
    // And: la app y el Worker cuentan los mismos días y el mismo tope de bytes
    expect(DIAS_ENLACE_REPORTE).toBe(DIAS_DE_VIDA_DEL_ENLACE);
    expect(MAX_PDF_BYTES_SUBIDA).toBe(MAX_PDF_BYTES);
  });

  // @spec16_e19 — Tope diario global de subidas
  it('spec16_e19 el tope diario global de subidas responde con un mensaje amable', async () => {
    // Given: un contador de hoy (UTC) que ya llegó al tope, en R2
    const REPORTES = r2Falso();
    expect(LIMITE_DIARIO_SUBIDAS).toBe(100);
    const hoyUtc = new Date().toISOString().slice(0, 10);
    await REPORTES.put(`contadores/${hoyUtc}`, String(LIMITE_DIARIO_SUBIDAS));
    // When: se intenta reservar y subir
    const reservaDeAntes = 'f'.repeat(32);
    await REPORTES.put(`reservas/${reservaDeAntes}`, '', {
      customMetadata: {
        caduca: new Date(Date.now() + 86400000).toISOString(),
        venceReserva: new Date(Date.now() + 60000).toISOString(),
      },
    });
    const r1 = await reservar(REPORTES);
    const r2 = await subir(REPORTES, reservaDeAntes);
    // Then: 503 LIMITE_DIARIO, sin detalles, y no se guarda nada
    for (const r of [r1, r2]) {
      expect([r.status, await r.text()]).toEqual([503, '{"error":"LIMITE_DIARIO"}']);
    }
    expect(REPORTES.objetos.has(`r/${reservaDeAntes}`)).toBe(false);
    // And: cada subida exitosa suma uno al contador de hoy
    const otro = r2Falso();
    await crear(otro);
    await crear(otro);
    expect(Buffer.from(otro.objetos.get(`contadores/${hoyUtc}`)!.bytes).toString()).toBe('2');
  });
});

// --- Parte B · El servicio de la app ------------------------------------------------------------

const ID = '0123456789abcdef0123456789abcdef';
const BASE = 'https://asistente.ejemplo.test';
const JSON_OK = (id = ID, base = BASE) => ({
  id,
  url: `${base}/r/${id}`,
  caduca: new Date(Date.now() + 30 * 86400000).toISOString(),
});
const TOKEN = 'b'.repeat(32);
const respuestaJson = (cuerpo: unknown, status = 200) =>
  ({ ok: status < 400, status, text: async () => JSON.stringify(cuerpo) }) as unknown as Response;

describe('Sprint-16 · la app reserva y sube el reporte por la puerta del Worker', () => {
  // @spec16_e10 — Un encabezado, un intento, 8 s, nunca lanza, nada técnico
  it('spec16_e10 reservar y subir mandan un solo encabezado un intento y nunca lanzan', async () => {
    // Given: un Worker que responde bien
    const f = jest.fn(async () => respuestaJson({ ...JSON_OK(), token: TOKEN }));
    // When: se reserva y se sube
    const reserva = await reservarReporte(f as unknown as typeof fetch, `${BASE}/`);
    const subida = await subirReporte(f as unknown as typeof fetch, `${BASE}/`, ID, PDF);
    // Then: dos POST de un intento cada uno, con solo Content-Type y el cuerpo exacto
    expect(reserva).toMatchObject({ ok: true, token: TOKEN, enlace: { id: ID, url: `${BASE}/r/${ID}` } });
    expect(subida).toMatchObject({ ok: true, enlace: { id: ID, url: `${BASE}/r/${ID}` } });
    expect(f).toHaveBeenCalledTimes(2);
    const [[url1, init1], [, init2]] = f.mock.calls as unknown as [string, RequestInit][];
    expect(url1).toBe(`${BASE}/`);
    for (const init of [init1, init2]) {
      expect(init.method).toBe('POST');
      expect(Object.keys(init.headers as object)).toEqual(['Content-Type']);
    }
    expect(JSON.parse(init1.body as string)).toEqual({ tipo: 'reservarReporte' });
    expect(JSON.parse(init2.body as string)).toEqual({ tipo: 'subirReporte', id: ID, pdf: PDF });

    // And: ante cada falla devuelve un código (que la pantalla traduce), sin lanzar y sin reintentar
    const malas: [string, () => Promise<Response>, string][] = [
      ['sin red', () => Promise.reject(new TypeError('Network request failed')), 'SIN_RED'],
      ['429', async () => respuestaJson({ error: 'DEMASIADAS_PETICIONES' }, 429), 'LIMITE'],
      ['503 del tope diario', async () => respuestaJson({ error: 'LIMITE_DIARIO' }, 503), 'LIMITE_DIARIO'],
      ['502', async () => respuestaJson({ error: 'NO_DISPONIBLE' }, 502), 'SERVIDOR'],
      ['404 amable', async () => respuestaJson({}, 404), 'SERVIDOR'],
      ['url ajena', async () => respuestaJson({ ...JSON_OK(), url: 'https://otro.test/r/' + ID }), 'RESPUESTA_INVALIDA'],
      ['id corto', async () => respuestaJson(JSON_OK('abc')), 'RESPUESTA_INVALIDA'],
      ['id distinto al reservado', async () => respuestaJson(JSON_OK('f'.repeat(32))), 'RESPUESTA_INVALIDA'],
      ['sin fecha', async () => respuestaJson({ ...JSON_OK(), caduca: 'ayer' }), 'RESPUESTA_INVALIDA'],
      ['no es JSON', async () => ({ ok: true, status: 200, text: async () => '<html>' }) as unknown as Response, 'RESPUESTA_INVALIDA'],
    ];
    for (const [nombre, impl, codigo] of malas) {
      const g = jest.fn(impl);
      const m = await subirReporte(g as unknown as typeof fetch, BASE, ID, PDF);
      expect([nombre, m]).toEqual([nombre, { ok: false, error: codigo }]);
      expect(g).toHaveBeenCalledTimes(1);
    }
    // And: un PDF de más de 400 KB ni siquiera sale del teléfono
    const h = jest.fn();
    const enorme = Buffer.alloc(MAX_PDF_BYTES_SUBIDA + 10).toString('base64');
    expect(await subirReporte(h as unknown as typeof fetch, BASE, ID, enorme)).toEqual({
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
      const pendiente = reservarReporte(f as unknown as typeof fetch, BASE);
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
    // And: no hay dependencias nuevas: solo la de voz salió
    const paquete = JSON.parse(leer('package.json'));
    expect(Object.keys(paquete.dependencies)).not.toEqual(expect.arrayContaining(['aws-sdk', 'axios']));
    expect(TEXTO_SIN_INTERNET).toMatch(/^Necesitas internet/);
  });
});

// --- Borrar de la nube (token) ------------------------------------------------------------------

type Reserva = Enlace & { token: string };
const borrar = (REPORTES: R2, id: unknown, token: unknown, extra: object = {}) =>
  worker.fetch(post({ tipo: 'borrarReporte', id, token }), { REPORTES, ...extra });
const creadoConToken = async (REPORTES: R2) => {
  const reserva = (await (await reservar(REPORTES)).json()) as Reserva;
  await subir(REPORTES, reserva.id);
  return reserva;
};

describe('Sprint-16 · el Worker borra con el token', () => {
  // @spec16_e31 — Borrar de la nube
  it('spec16_e31 borrar con el token correcto borra el PDF y el enlace da 404 amable', async () => {
    // Given: un reporte subido y su token
    const REPORTES = r2Falso();
    const { id, token } = await creadoConToken(REPORTES);
    expect((await worker.fetch(pedir(id), { REPORTES })).status).toBe(200);
    // When: se borra con el token
    const r = await borrar(REPORTES, id, token);
    // Then: responde la respuesta genérica, el archivo ya no está y el enlace da el 404 amable de siempre
    expect([r.status, await r.text()]).toEqual([200, '{"ok":true}']);
    expect(REPORTES.objetos.has(`r/${id}`)).toBe(false);
    const get = await worker.fetch(pedir(id), { REPORTES });
    expect([get.status, await get.text()]).toEqual([404, AMABLE]);
  });

  // @spec16_e32 — Token incorrecto o id inexistente: la misma respuesta genérica, y nada se borra
  it('spec16_e32 un token incorrecto o un id inexistente dan la misma respuesta generica y no borran nada', async () => {
    // Given: un reporte subido
    const REPORTES = r2Falso();
    const { id, token } = await creadoConToken(REPORTES);
    const otro = await creadoConToken(REPORTES);
    const casos: [string, unknown, unknown][] = [
      ['token ajeno', id, otro.token],
      ['token inventado', id, 'c'.repeat(32)],
      ['token con otro largo', id, 'abc'],
      ['token que no es texto', id, 12345],
      ['sin token', id, undefined],
      ['el id como token', id, id],
      ['id inexistente', 'd'.repeat(32), token],
      ['id mal escrito', 'xx', token],
      ['sin id', undefined, token],
    ];
    // When: se intentan
    const respuestas = await Promise.all(casos.map(([, i, t]) => borrar(REPORTES, i, t)));
    // Then: todas responden exactamente lo mismo que un borrado bueno, y los dos archivos siguen
    for (const r of respuestas) expect([r.status, await r.text()]).toEqual([200, '{"ok":true}']);
    expect(REPORTES.objetos.has(`r/${id}`)).toBe(true);
    expect(REPORTES.objetos.has(`r/${otro.id}`)).toBe(true);
    // And: el límite estricto por IP también aplica a borrar
    const limit = jest.fn().mockResolvedValue({ success: false });
    const limitado = await borrar(REPORTES, id, token, { LIMITE_SUBIDA: { limit } });
    expect([limitado.status, await limitado.text()]).toEqual([429, '{"error":"DEMASIADAS_PETICIONES"}']);
    expect(REPORTES.objetos.has(`r/${id}`)).toBe(true);
  });

  // @spec16_e36 — El token se entrega una vez y no se guarda en claro
  it('spec16_e36 el token solo se entrega al reservar y en R2 solo queda su hash', async () => {
    // Given: una reserva, una subida, un GET y un borrado
    const REPORTES = r2Falso();
    const reservaRes = await reservar(REPORTES);
    const reserva = (await reservaRes.json()) as Reserva;
    const respuestas = [
      await subir(REPORTES, reserva.id),
      await worker.fetch(pedir(reserva.id), { REPORTES }),
      await worker.fetch(pedir(reserva.id + 'x'), { REPORTES }),
      await borrar(REPORTES, reserva.id, 'e'.repeat(32)),
    ];
    // Then: el token distinto del id aparece en la respuesta de reservar y en NINGUNA otra
    expect(reserva.token).toMatch(/^[0-9a-f]{32}$/);
    expect(reserva.token).not.toBe(reserva.id);
    for (const r of respuestas) expect(await r.text()).not.toContain(reserva.token);
    // And: en R2 (reserva, archivo y contador) no está el token, solo un hash SHA-256 de 64 caracteres
    const todo = JSON.stringify([...REPORTES.objetos.entries()].map(([k, o]) => [k, o.opciones]));
    expect(todo).not.toContain(reserva.token);
    expect(todo).toMatch(/"hashBorrado":"[0-9a-f]{64}"/);
    // And: el código del Worker compara en tiempo constante y no registra nada
    const codigo = leer('servidor/worker.js');
    expect(codigo).toMatch(/crypto\.subtle\.digest\('SHA-256'/);
    expect(codigo).toMatch(/diferencia \|= /);
    expect(codigo).not.toMatch(/console\./);
  });
});

// --- La lista local de enlaces y "Mis reportes" -------------------------------------------------

const AHORA = Date.parse('2026-10-15T12:00:00-05:00');
const en = (dias: number) => new Date(AHORA + dias * 86400000).toISOString();
const entrada = (n: number, extra: Partial<EntradaReporte> = {}): EntradaReporte => ({
  clave: `clave-${n}`,
  id: n.toString(16).padStart(32, '0'),
  url: `https://asistente.ejemplo.test/r/${n.toString(16).padStart(32, '0')}`,
  tokenBorrado: 'f'.repeat(32),
  periodoEtiqueta: 'Todo tu historial',
  filtro: { tipo: 'todo' },
  creadoEn: new Date(AHORA - 1000 * (100 - n)).toISOString(),
  caduca: en(30),
  guardado: false,
  ...extra,
});

describe('Sprint-16 · la lista local de enlaces', () => {
  beforeEach(() => clearAllMockStorages());

  // @spec16_e33 — Temporales: a lo más 5 vigentes; los vencidos se descartan
  it('spec16_e33 los enlaces sin guardar son a lo mas 5 vigentes y los vencidos se descartan', async () => {
    // Given: siete enlaces creados uno tras otro, y uno ya vencido
    await registrarEntradaDeReporte(entrada(0, { caduca: en(-1) }), AHORA);
    for (let n = 1; n <= 7; n += 1) await registrarEntradaDeReporte(entrada(n), AHORA);
    // When: se consultan
    const existentes: number[] = [];
    for (let n = 0; n <= 7; n += 1) {
      if (await entradaDeReporte(`clave-${n}`, AHORA)) existentes.push(n);
    }
    // Then: quedan solo los 5 más nuevos, y ninguna entrada está marcada como guardada
    expect(MAX_ENLACES_TEMPORALES).toBe(5);
    expect(existentes).toEqual([3, 4, 5, 6, 7]);
    expect(await listarReportesGuardados()).toEqual([]);
    // And: un enlace vencido no cuenta como vigente
    await registrarEntradaDeReporte(entrada(8, { caduca: en(-1) }), AHORA);
    expect(await entradaDeReporte('clave-8', AHORA)).toBeNull();
  });

  // @spec16_e34 — Guardar es opcional, con título limpio, y hay un máximo de 20
  it('spec16_e34 guardar en Mis reportes limpia el titulo y tiene un maximo de 20', async () => {
    // Given: un enlace sin guardar
    await registrarEntradaDeReporte(entrada(1), AHORA);
    expect(await listarReportesGuardados()).toEqual([]);
    // When: se guarda con un título sucio, vacío y válido
    expect(await guardarReporteEnLista('clave-1', '   \n\t ', AHORA)).toBe('titulo-vacio');
    expect(await guardarReporteEnLista('no-hay', 'Algo', AHORA)).toBe('no-existe');
    expect(await guardarReporteEnLista('clave-1', `  Mi\u0007   reporte \n de ${'x'.repeat(80)}`, AHORA)).toBe('ok');
    // Then: el título queda sin controles, con espacios juntos y de a lo más 50 caracteres
    const [guardado] = await listarReportesGuardados();
    expect(guardado.guardado).toBe(true);
    expect(guardado.titulo).toMatch(/^Mi reporte de x+$/);
    expect(guardado.titulo!.length).toBeLessThanOrEqual(50);
    expect(sanearTitulo('  a   b ')).toBe('a b');
    // And: el 21 no entra; uno ya guardado sí se puede editar
    for (let n = 2; n <= MAX_REPORTES_GUARDADOS; n += 1) {
      await registrarEntradaDeReporte(entrada(n), AHORA);
      expect(await guardarReporteEnLista(`clave-${n}`, `Reporte ${n}`, AHORA)).toBe('ok');
    }
    await registrarEntradaDeReporte(entrada(21), AHORA);
    expect(await guardarReporteEnLista('clave-21', 'Uno más', AHORA)).toBe('limite');
    expect(await guardarReporteEnLista('clave-5', 'Cinco editado', AHORA)).toBe('ok');
    expect(await listarReportesGuardados()).toHaveLength(MAX_REPORTES_GUARDADOS);
    // And: quitar uno libera un lugar
    await quitarReporteDeLista('clave-2');
    expect(await guardarReporteEnLista('clave-21', 'Uno más', AHORA)).toBe('ok');
  });

  // @spec16_e37 — La lista va del más reciente al más viejo y conserva lo vencido
  it('spec16_e37 la lista va del mas reciente al mas viejo y conserva los guardados vencidos', async () => {
    // Given: tres guardados creados en distinto momento, uno ya vencido
    for (const n of [1, 3, 2]) {
      await registrarEntradaDeReporte(entrada(n, n === 1 ? { caduca: en(-2) } : {}), AHORA - 5 * 86400000);
      await guardarReporteEnLista(`clave-${n}`, `Reporte ${n}`, AHORA - 5 * 86400000);
    }
    // When: se lista
    const lista = await listarReportesGuardados();
    // Then: del más reciente (creadoEn mayor) al más viejo, y el vencido sigue ahí
    expect(lista.map(e => e.titulo)).toEqual(['Reporte 3', 'Reporte 2', 'Reporte 1']);
    // And: consultar por la clave de un guardado vencido no lo da por vigente ni lo borra
    expect(await entradaDeReporte('clave-1', AHORA)).toBeNull();
    expect((await listarReportesGuardados()).map(e => e.titulo)).toContain('Reporte 1');
  });

  // @spec16_e38 — Quitar de la lista y borrar todos los datos
  it('spec16_e38 quitar de mi lista olvida la entrada y borrar los enlaces limpia todo', async () => {
    // Given: dos guardados y uno temporal
    for (const n of [1, 2]) {
      await registrarEntradaDeReporte(entrada(n), AHORA);
      await guardarReporteEnLista(`clave-${n}`, `Reporte ${n}`, AHORA);
    }
    await registrarEntradaDeReporte(entrada(3), AHORA);
    // When: se quita uno
    await quitarReporteDeLista('clave-1');
    // Then: ya no está (ni como guardado ni como temporal)
    expect(await entradaDeReporte('clave-1', AHORA)).toBeNull();
    expect((await listarReportesGuardados()).map(e => e.clave)).toEqual(['clave-2']);
    // When: se borran todos los enlaces (lo que debe llamar cualquier opción de «borrar todos los datos»)
    await borrarEnlacesDeReporte();
    // Then: no queda nada
    expect(await listarReportesGuardados()).toEqual([]);
    expect(await entradaDeReporte('clave-3', AHORA)).toBeNull();
  });

  // @spec16_e39 — Una guardada que caducó hereda su lugar al crear el enlace nuevo
  it('spec16_e39 crear otro enlace del mismo contenido hereda el lugar y el titulo de la guardada', async () => {
    // Given: una guardada que caducó
    await registrarEntradaDeReporte(entrada(1, { caduca: en(-1) }), AHORA - 40 * 86400000);
    await guardarReporteEnLista('clave-1', 'Mi historial', AHORA - 40 * 86400000);
    // When: se registra el enlace nuevo con la misma clave (otro id)
    await registrarEntradaDeReporte(entrada(9, { clave: 'clave-1' }), AHORA);
    // Then: sigue guardada con su título, pero ahora con el enlace nuevo y vigente
    const [e] = await listarReportesGuardados();
    expect([e.titulo, e.id, e.guardado]).toEqual(['Mi historial', entrada(9).id, true]);
    expect((await entradaDeReporte('clave-1', AHORA))?.id).toBe(entrada(9).id);
  });

  // @spec16_e40 — Lo guardado no lleva datos del negocio
  it('spec16_e40 lo guardado no lleva cierres ni datos del negocio y lo ilegible se ignora', async () => {
    // Given: una entrada guardada
    await registrarEntradaDeReporte(entrada(1), AHORA);
    const { createAsyncStorage } = require('@react-native-async-storage/async-storage');
    const almacen = createAsyncStorage('crecemos');
    // Then: solo trae los campos de la entrada
    const crudo = JSON.parse((await almacen.getItem('@crecemos/enlaces-reporte')) as string);
    expect(Object.keys(crudo[0]).sort()).toEqual(
      ['caduca', 'clave', 'creadoEn', 'filtro', 'guardado', 'id', 'periodoEtiqueta', 'tokenBorrado', 'url'].sort(),
    );
    // And: una lista corrupta o con basura no rompe nada y se limpia
    await almacen.setItem('@crecemos/enlaces-reporte', JSON.stringify([{ hola: 1 }, null, 7]));
    expect(await entradaDeReporte('clave-1', AHORA)).toBeNull();
    expect(JSON.parse((await almacen.getItem('@crecemos/enlaces-reporte')) as string)).toEqual([]);
    // And: sin nada guardado, consultar no escribe nada
    await almacen.removeItem('@crecemos/enlaces-reporte');
    expect(await entradaDeReporte('clave-1', AHORA)).toBeNull();
    expect(await almacen.getItem('@crecemos/enlaces-reporte')).toBeNull();
  });
});

// --- La clave del reporte y los textos de Mis reportes ------------------------------------------

const cierre = (fecha: string, preparadas = 20, extra: Partial<Cierre> = {}): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [
    { productoId: 'p1', nombre: 'Anticucho', preparadas, sobrantes: 0, precioUnitario: 10, costoUnitario: 8 },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: [],
  abreCiclo: false,
  creadoEn: '2026-10-15T12:00:00-05:00',
  actualizadoEn: '2026-10-15T12:00:00-05:00',
  ...extra,
});
const PRODUCTO: Producto = {
  id: 'p1',
  nombre: 'Anticucho',
  unidad: 'porcion',
  precioVenta: 10,
  costoUnitario: 8,
  actualizadoEn: '2026-07-15',
  activo: true,
};
const PERFIL: Perfil = {
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  aceptaYape: true,
  yapeAjeno: false,
  actualizadoEn: '2026-10-15T12:00:00-05:00',
};

describe('Sprint-16 · la clave del reporte y los textos de Mis reportes', () => {
  // @spec16_e41 — La clave sale de los datos, no del tiempo ni del QR
  it('spec16_e41 la clave sale de los datos y no cambia con el tiempo ni con lo que no es del reporte', () => {
    const base = claveDelReporte('Todo tu historial', [cierre('2026-10-01'), cierre('2026-10-02')], [PRODUCTO], PERFIL, false);
    // El orden de los cierres no importa; la hora de edición y el Yape tampoco
    expect(
      claveDelReporte(
        'Todo tu historial',
        [
          cierre('2026-10-02', 20, { actualizadoEn: '2026-12-01T00:00:00-05:00', montoYape: 99 }),
          cierre('2026-10-01'),
        ],
        [PRODUCTO],
        { ...PERFIL, yapeAjeno: true, actualizadoEn: '2027-01-01' },
        false,
      ),
    ).toBe(base);
    expect(base).toMatch(/^[0-9a-f]{16}$/);
    // Cualquier dato del reporte la cambia
    const otras = [
      claveDelReporte('Octubre 2026', [cierre('2026-10-01'), cierre('2026-10-02')], [PRODUCTO], PERFIL, false),
      claveDelReporte('Todo tu historial', [cierre('2026-10-01'), cierre('2026-10-02', 21)], [PRODUCTO], PERFIL, false),
      claveDelReporte('Todo tu historial', [cierre('2026-10-01')], [PRODUCTO], PERFIL, false),
      claveDelReporte('Todo tu historial', [cierre('2026-10-01'), cierre('2026-10-02')], [{ ...PRODUCTO, nombre: 'Pancita' }], PERFIL, false),
      claveDelReporte('Todo tu historial', [cierre('2026-10-01'), cierre('2026-10-02')], [PRODUCTO], { ...PERFIL, negocio: 'Otro' }, false),
      claveDelReporte('Todo tu historial', [cierre('2026-10-01'), cierre('2026-10-02')], [PRODUCTO], { ...PERFIL, fotoUri: 'data:image/png;base64,AAAA' }, false),
      claveDelReporte('Todo tu historial', [cierre('2026-10-01'), cierre('2026-10-02')], [PRODUCTO], PERFIL, true),
    ];
    for (const otra of otras) expect(otra).not.toBe(base);
    expect(new Set([base, ...otras]).size).toBe(otras.length + 1);
    // Y no deja ver los datos
    expect(base).not.toMatch(/Freddy|Anticucho/);
    expect(leer('src/analisis/claveReporte.ts')).not.toMatch(/Date\.now|new Date|hoy/);
  });

  // @spec16_e42 — Títulos sugeridos y días que quedan
  it('spec16_e42 el titulo sugerido sigue al periodo y los dias que quedan se redondean hacia arriba', () => {
    expect(tituloSugerido('todo', 'Todo tu historial', '2026-10-15')).toBe('Todo mi historial · 15 oct');
    expect(tituloSugerido('ultimos30', 'Del 16 de septiembre al 15 de octubre', '2026-10-15')).toBe('Últimos 30 días · 15 oct');
    expect(tituloSugerido('mes', 'Septiembre 2026', '2026-10-15')).toBe('Septiembre 2026');
    expect(tituloSugerido('esteMes', 'Octubre 2026 (en curso)', '2026-10-15')).toBe('Octubre 2026 · 15 oct');
    expect(tituloSugerido('rango', 'Del 1 de agosto al 15 de octubre', '2026-10-15').length).toBeLessThanOrEqual(50);
    expect(diasQueQuedan(en(30), AHORA)).toBe(30);
    expect(diasQueQuedan(new Date(AHORA + 3600000).toISOString(), AHORA)).toBe(1);
    expect(diasQueQuedan(en(-1), AHORA)).toBe(0);
  });
});
