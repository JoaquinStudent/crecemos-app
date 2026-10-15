/**
 * Tests del Sprint-16 con la app montada. Generados desde sdd/spec/Sprint-16-voz-y-nube/SPEC.md.
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'.
 *
 * La red (`global.fetch`), el generador de PDF, la hoja de compartir y el portapapeles están
 * simulados: solo se mira qué reciben. Los cierres se siembran con fechas relativas a hoy.
 */
import { Linking, StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { generatePDF } from 'react-native-html-to-pdf';
import { codigoDeEnlace, modulosQR, svgQR, textoCaduca } from '@analisis/pasaporte';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, Perfil } from '@dominio/tipos';
import { compartirReporte } from '@services/compartir';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import {
  guardarCierre,
  guardarPerfil,
  guardarProducto,
  guardarReporteEnLista,
  listarCierres,
  listarReportesGuardados,
  registrarEntradaDeReporte,
} from '@storage/repositorio';
import { tituloSugerido, type EntradaReporte } from '@dominio/reporteGuardado';
import { TEXTO_SIN_REPORTES } from '@screens/MisReportesScreen';
import { desmontarApp, montarApp } from '../../testutils/app';

jest.mock('@services/compartir');
jest.mock('react-native/Libraries/Components/Clipboard/Clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn(), getString: jest.fn() },
}));

const ID = '0123456789abcdef0123456789abcdef';
const ID_2 = 'fedcba9876543210fedcba9876543210';
const urlDe = (id: string) => `https://crecemos-asistente.joaquiningsoft.workers.dev/r/${id}`;
const URL_ENLACE = urlDe(ID);
const TOKEN = 'b'.repeat(32);
const CODIGO = 'CR-0123-4567-89AB';
const CODIGO_2 = 'CR-FEDC-BA98-7654';
/** El id que responde el Worker (cambia en la prueba de dos enlaces). */
let idRespondido = ID;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n').toString('base64');
const hoy = () => fechaLocal(new Date());

const FREDDY: Perfil = {
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  aceptaYape: true,
  yapeAjeno: false,
  actualizadoEn: new Date().toISOString(),
};

const cierreDe = (dias: number): Cierre => {
  const fecha = restarDias(hoy(), dias);
  return {
    id: `c-${fecha}`,
    fecha,
    lineas: [
      {
        productoId: 'p-anticucho',
        nombre: 'Anticucho',
        preparadas: 40,
        sobrantes: 0,
        precioUnitario: 10,
        costoUnitario: 8,
      },
    ],
    montoYape: 0,
    yapePendiente: false,
    gastos: [],
    abreCiclo: false,
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };
};

let vencimientoRespondido = '';
const respuestaOk = () => {
  const caduca = new Date(Date.now() + 30 * 86400000).toISOString();
  vencimientoRespondido = caduca;
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({ id: idRespondido, url: urlDe(idRespondido), caduca, token: TOKEN }),
  } as unknown as Response;
};

const abrirReporte = async () => {
  const app = await montarApp();
  await app.tocar('tab-resumen');
  await app.tocar('resumen-mi-reporte');
  return app;
};
const fetchMock = () => global.fetch as jest.Mock;
const llamadasAlWorker = () =>
  fetchMock().mock.calls.filter(([url]) => String(url).includes('workers.dev'));
/** Los `tipo` de las peticiones al Worker, en orden. */
const tipos = () => llamadasAlWorker().map(([, init]) => JSON.parse(init.body).tipo as string);
const hojaDelPdf = () => (generatePDF as jest.Mock).mock.calls.at(-1)[0].html as string;
/** Lo que hay guardado en el teléfono sobre enlaces (texto crudo), o null. */
const CLAVE_ENLACES = '@crecemos/enlaces-reporte';
const guardadosEnElTelefono = () => createAsyncStorage('crecemos').getItem(CLAVE_ENLACES);
/** Cierra la app y la vuelve a abrir con el MISMO almacenamiento (como cerrar y abrir el teléfono). */
const reabrirReporte = async () => {
  await desmontarApp();
  return abrirReporte();
};
const crearEnlace = async (app: Awaited<ReturnType<typeof montarApp>>) => {
  await app.tocar('reporte-crear-enlace');
  await app.tocar('reporte-confirmar-subir');
};

describe('Sprint-16 · Cerrar día sin voz', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    jest.clearAllMocks();
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
  });
  afterEach(desmontarApp);

  // @spec16_e1 — Cerrar día no tiene micrófono ni "Cuéntame tu día"
  it('spec16_e1 cerrar dia no tiene boton de microfono ni cuentame tu dia', async () => {
    // Given: la app con un producto
    const app = await montarApp();
    // When: se abre Cerrar día
    await app.tocar('tab-cerrar-dia');
    // Then: el formulario está, y no hay micrófono, "Cuéntame tu día" ni campo de relato
    expect(app.existe('preparadas-p-anticucho')).toBe(true);
    for (const id of ['cuentame-abrir', 'cuentame-hablar', 'cuentame-texto', 'cuentame-llenar']) {
      expect(app.existe(id)).toBe(false);
    }
    expect(app.textos().join(' ')).not.toMatch(/Cuéntame tu día|micrófono|Hablar|dictar/i);
  });

  // @spec16_e3 — e2e: el cierre por formulario sigue completo
  it('spec16_e3 e2e el cierre por formulario guarda un dia con porciones gastos y yape', async () => {
    // Given: Cerrar día abierto
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    // When: se llenan porciones, Yape y un gasto, y se guarda
    await app.escribir('preparadas-p-anticucho', '60');
    await app.escribir('sobrantes-p-anticucho', '5');
    await app.escribir('monto-yape', '120');
    await app.escribir('monto-gasto', '30');
    await app.tocar('agregar-gasto');
    await app.tocar('guardar-dia');
    await app.tocar('cierre-listo');
    // Then: el cierre queda guardado completo
    const [cierre] = await listarCierres();
    expect(cierre.lineas[0]).toMatchObject({ productoId: 'p-anticucho', preparadas: 60, sobrantes: 5 });
    expect(cierre.montoYape).toBe(120);
    expect(cierre.gastos).toEqual([{ categoria: 'mercaderia', monto: 30 }]);
  });
});

describe('Sprint-16 · Crear enlace con QR', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    jest.clearAllMocks();
    idRespondido = ID;
    for (const d of [1, 2, 3]) await guardarCierre(cierreDe(d));
    await guardarPerfil(FREDDY);
    (generatePDF as jest.Mock).mockResolvedValue({ filePath: '/tmp/r.pdf', base64: PDF });
    (compartirReporte as jest.Mock).mockResolvedValue({ ok: true });
    fetchMock().mockImplementation((url: string) =>
      String(url).includes('workers.dev')
        ? Promise.resolve(respuestaOk())
        : Promise.reject(new TypeError('Network request failed')),
    );
  });
  afterEach(desmontarApp);

  // @spec16_e11 — La confirmación sale antes de subir y nada se envía al abrir
  it('spec16_e11 e2e la confirmacion sale antes de subir y nada se envia al abrir Mi reporte', async () => {
    // Given: Mi reporte abierto
    const app = await abrirReporte();
    // Then: abrir la pantalla no habló con el Worker ni generó el PDF
    expect(llamadasAlWorker()).toHaveLength(0);
    expect(generatePDF).not.toHaveBeenCalled();
    expect(app.textos()).toContain('Crear enlace con QR');
    // And: el botón tiene texto visible y al menos 48 dp
    const alto = StyleSheet.flatten(app.botonDe('reporte-crear-enlace').props.style)?.height;
    expect(alto === undefined || alto >= 48).toBe(true);

    // When: toca el botón
    await app.tocar('reporte-crear-enlace');
    // Then: sale la confirmación con palabras sencillas y todavía no se envió nada
    expect(app.existe('reporte-confirmar-que-sube')).toBe(true);
    expect(app.textoDe('reporte-confirmar-que-sube')).toMatch(/ventas.*resultado.*constancia/);
    expect(app.textoDe('reporte-confirmar-que-sube')).toMatch(/QR de su propio enlace/);
    expect(app.textoDe('reporte-confirmar-que-no')).toMatch(/No se sube tu Yape, tu ubicación ni tus cierres uno por uno/);
    expect(app.textoDe('reporte-confirmar-publico')).toMatch(/Cualquiera que tenga el enlace podrá ver y descargar.*30 días/);
    expect(llamadasAlWorker()).toHaveLength(0);
    expect(generatePDF).not.toHaveBeenCalled();

    // When: dice que no
    await app.tocar('reporte-confirmar-cancelar');
    // Then: sigue sin enviarse nada
    expect(app.existe('reporte-confirmar-que-sube')).toBe(false);
    expect(llamadasAlWorker()).toHaveLength(0);

    // When: vuelve a tocar y acepta
    await app.tocar('reporte-crear-enlace');
    await app.tocar('reporte-confirmar-subir');
    // Then: recién ahora se envía: primero reservar (sin nada del usuario) y después subir {tipo, id, pdf}
    expect(tipos()).toEqual(['reservarReporte', 'subirReporte']);
    const [reservar, subir] = llamadasAlWorker().map(([, init]) => JSON.parse(init.body));
    expect(reservar).toEqual({ tipo: 'reservarReporte' });
    expect(Object.keys(subir).sort()).toEqual(['id', 'pdf', 'tipo']);
    expect(subir.id).toBe(ID);
    expect(subir.pdf).toBe(PDF);
    expect(subir.pdf).not.toMatch(/Freddy|yape/i);
  });

  // @spec16_e12 — Sin internet: aviso sin error técnico y sin QR
  it('spec16_e12 e2e sin internet avisa con palabras sencillas y sin error tecnico', async () => {
    // Given: sin red y Mi reporte abierto
    fetchMock().mockRejectedValue(new TypeError('Network request failed'));
    const app = await abrirReporte();
    // When: pide el enlace y acepta
    await crearEnlace(app);
    // Then: dice que necesita internet, sin códigos ni mensajes técnicos, y la pantalla sigue
    const aviso = app.textoDe('reporte-error-nube');
    expect(aviso).toMatch(/^Necesitas internet para esto/);
    expect(aviso).not.toMatch(/SIN_RED|TIEMPO_AGOTADO|Network|TypeError|fetch|HTTP|\b[45]\d\d\b/);
    expect(app.existe('reporte-enlace-url')).toBe(false);
    expect(app.existe('reporte-qr')).toBe(false);
    expect(app.existe('reporte-compartir-pdf')).toBe(true);
  });

  // @spec16_e13 — El resultado: QR, enlace en texto, copiar, compartir, descargar y caducidad
  it('spec16_e13 e2e el resultado muestra el QR el enlace en texto copiar compartir descargar y la caducidad', async () => {
    // Given: una creación exitosa
    const app = await abrirReporte();
    await crearEnlace(app);
    // Then: QR con etiqueta propia, enlace en texto, "Caduca el …" y los tres botones con texto
    expect(app.existe('reporte-enlace-qr')).toBe(true);
    expect(app.propsDe('reporte-enlace-qr').accessibilityLabel).toBe('Código QR del enlace de tu reporte');
    expect(app.textoDe('reporte-enlace-url')).toBe(URL_ENLACE);
    expect(app.textoDe('reporte-enlace-caduca')).toMatch(/^Caduca el \d{1,2} de \w+/);
    expect(app.textos()).toEqual(
      expect.arrayContaining(['Copiar enlace', 'Compartir enlace', 'Descargar PDF']),
    );
    // La caducidad sale de la respuesta del Worker: 30 días
    expect(Math.round((Date.parse(vencimientoRespondido) - Date.now()) / 86400000)).toBe(30);

    // When: copia
    await app.tocar('reporte-enlace-copiar');
    expect(app.textoDe('reporte-enlace-aviso')).toBe('Enlace copiado.');
    // When: comparte
    await app.tocar('reporte-enlace-compartir');
    // Then: la hoja de compartir recibe el enlace de VER (sin ?descargar)
    const mensaje = (compartirReporte as jest.Mock).mock.calls.at(-1)[0] as string;
    expect(mensaje).toContain(URL_ENLACE);
    expect(mensaje).not.toContain('descargar');
    // When: descarga
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    await app.tocar('reporte-enlace-descargar');
    // Then: se abre el enlace de descarga directa
    expect(abrir).toHaveBeenCalledWith(`${URL_ENLACE}?descargar=1`);
    abrir.mockRestore();
  });

  // @spec16_e14 — El QR codifica exactamente el enlace, y el enlace vigente se reutiliza
  it('spec16_e14 e2e el QR codifica exactamente el enlace y el enlace vigente se reutiliza', async () => {
    // Given: un enlace creado
    const app = await abrirReporte();
    await crearEnlace(app);
    // Then: el QR de la vista previa y el de la hoja codifican la dirección (no el código CR-…)
    const esperado = modulosQR(URL_ENLACE);
    const modulosDe = (id: string) => app.buscar(n => n.props.testID === id && n.props.modulos)[0].props.modulos;
    expect(modulosDe('reporte-qr')).toEqual(esperado);
    expect(modulosDe('reporte-enlace-qr')).toEqual(esperado);
    // And: el código acompaña al QR y sale del id del enlace, no del contenido del reporte
    expect(app.textoDe('reporte-codigo')).toBe(CODIGO);
    expect(app.textoDe('reporte-enlace-url')).not.toMatch(/^CR-/);

    // When: cierra la hoja y vuelve a pedir el enlace del mismo reporte
    await app.tocar('reporte-enlace-listo');
    expect(app.existe('reporte-enlace-url')).toBe(false);
    await app.tocar('reporte-crear-enlace');
    // Then: se muestra el mismo sin confirmar ni subir otra vez
    expect(app.existe('reporte-confirmar-que-sube')).toBe(false);
    expect(app.textoDe('reporte-enlace-url')).toBe(URL_ENLACE);
    expect(tipos()).toEqual(['reservarReporte', 'subirReporte']);
    expect(generatePDF).toHaveBeenCalledTimes(1);
  });

  // @spec16_e16 — La subida es opcional y nunca automática
  it('spec16_e16 e2e la subida es opcional y nunca automatica', async () => {
    // Given: Mi reporte abierto, con un contador de peticiones al Worker
    const app = await abrirReporte();
    expect(llamadasAlWorker()).toHaveLength(0);
    // When: cambia el periodo, comparte el PDF y comparte el texto
    await app.tocar('reporte-filtro-boton');
    await app.tocar('reporte-filtro-opcion-ultimos30');
    await app.tocar('reporte-filtro-listo');
    await app.tocar('reporte-compartir-pdf');
    await app.tocar('reporte-compartir');
    // Then: ninguna de esas acciones hizo una petición (ni de reserva ni de subida)
    expect(llamadasAlWorker()).toHaveLength(0);
    // When: pide el enlace y cancela la confirmación
    await app.tocar('reporte-crear-enlace');
    expect(llamadasAlWorker()).toHaveLength(0);
    await app.tocar('reporte-confirmar-cancelar');
    // Then: cancelar tampoco envía nada
    expect(llamadasAlWorker()).toHaveLength(0);
    // When: vuelve a pedirlo y acepta
    await crearEnlace(app);
    // Then: solo ahora hay peticiones: reservar y subir
    expect(tipos()).toEqual(['reservarReporte', 'subirReporte']);
  });

  // @spec16_e17 — Mismo contenido, mismo enlace; contenido distinto, enlace nuevo
  it('spec16_e17 e2e el mismo contenido reutiliza el enlace y un contenido distinto sube uno nuevo', async () => {
    // Given: un historial con un día de hace 40 días y un enlace creado para "Todo tu historial"
    await guardarCierre(cierreDe(40));
    const app = await abrirReporte();
    await crearEnlace(app);
    await app.tocar('reporte-enlace-listo');
    expect(tipos()).toHaveLength(2);
    // When: pide otra vez el enlace del mismo reporte
    await app.tocar('reporte-crear-enlace');
    // Then: reutiliza el vigente, sin subir otra vez
    expect(app.existe('reporte-confirmar-que-sube')).toBe(false);
    expect(tipos()).toHaveLength(2);
    await app.tocar('reporte-enlace-listo');
    // When: el reporte cambia (otro periodo) y pide el enlace
    await app.tocar('reporte-filtro-boton');
    await app.tocar('reporte-filtro-opcion-ultimos30');
    await app.tocar('reporte-filtro-listo');
    await app.tocar('reporte-crear-enlace');
    // Then: pide confirmación y sube uno nuevo (reservar y subir otra vez)
    expect(app.existe('reporte-confirmar-que-sube')).toBe(true);
    await app.tocar('reporte-confirmar-subir');
    expect(tipos()).toHaveLength(4);
  });

  // @spec16_e20 — El QR y el código llegan solo con el enlace: sin enlace, ninguno
  it('spec16_e20 e2e la vista previa sin enlace no tiene ni QR ni codigo y con enlace muestra ambos con su caducidad', async () => {
    // Given: Mi reporte abierto, sin enlace
    const app = await abrirReporte();
    // Then: ni QR ni código de constancia; una línea avisa cuándo aparecerán
    expect(app.existe('reporte-qr')).toBe(false);
    expect(app.existe('reporte-codigo')).toBe(false);
    expect(app.textoDe('reporte-qr-aviso')).toBe('El código y el QR aparecerán cuando crees el enlace.');
    expect(app.existe('reporte-qr-caduca')).toBe(false);
    // When: crea el enlace
    await crearEnlace(app);
    await app.tocar('reporte-enlace-listo');
    // Then: la vista previa muestra el QR del enlace, el código que sale de su id, "Caduca el …" y la dirección
    expect(app.existe('reporte-qr')).toBe(true);
    expect(app.textoDe('reporte-codigo')).toBe(CODIGO);
    expect(app.textoDe('reporte-codigo')).toBe(codigoDeEnlace(ID));
    expect(app.textoDe('reporte-qr-caduca')).toMatch(/^Caduca el \d{1,2} de \w+/);
    expect(app.textoDe('reporte-qr-url')).toBe(URL_ENLACE);
    expect(app.textoDe('reporte-codigo-nota')).toBe(
      'Identifica este reporte en la nube; el enlace del QR lo muestra tal cual. Caduca con el enlace.',
    );
    expect(app.existe('reporte-qr-aviso')).toBe(false);
  });

  // @spec16_e24 — Dos enlaces distintos, dos códigos distintos
  it('spec16_e24 e2e dos enlaces distintos dan codigos distintos y el codigo es el del id reservado', async () => {
    // Given: un historial con un día de hace 40 días y un enlace para "Todo tu historial" (id 1)
    await guardarCierre(cierreDe(40));
    const app = await abrirReporte();
    await crearEnlace(app);
    await app.tocar('reporte-enlace-listo');
    expect(app.textoDe('reporte-codigo')).toBe(CODIGO);
    // When: cambia el periodo y crea otro enlace (el Worker reserva otro id)
    idRespondido = ID_2;
    await app.tocar('reporte-filtro-boton');
    await app.tocar('reporte-filtro-opcion-ultimos30');
    await app.tocar('reporte-filtro-listo');
    await crearEnlace(app);
    await app.tocar('reporte-enlace-listo');
    // Then: el código cambia, y es el de los primeros 12 hexadecimales del id nuevo
    expect(app.textoDe('reporte-codigo')).toBe(CODIGO_2);
    expect(CODIGO_2).not.toBe(CODIGO);
    // And: el PDF subido lleva ese mismo código y ese QR
    expect(hojaDelPdf()).toContain(CODIGO_2);
    expect(hojaDelPdf()).toContain(svgQR(modulosQR(urlDe(ID_2)), 84));
    expect(hojaDelPdf()).not.toContain(CODIGO);
  });

  // @spec16_e21 — El PDF subido lleva el QR de su propio enlace; Compartir reporte usa el PDF que corresponde
  it('spec16_e21 e2e el PDF que se sube lleva el QR de su propio enlace y Compartir reporte usa el que corresponde', async () => {
    // Given: Mi reporte abierto, sin enlace
    const app = await abrirReporte();
    // When: comparte el PDF
    await app.tocar('reporte-compartir-pdf');
    // Then: el PDF no lleva ningún QR
    expect(hojaDelPdf()).not.toContain(svgQR(modulosQR(URL_ENLACE), 84));
    expect(hojaDelPdf()).not.toContain(URL_ENLACE);
    expect(hojaDelPdf()).not.toMatch(/CR-[0-9A-F]{4}/);

    // When: crea el enlace
    (generatePDF as jest.Mock).mockClear();
    await crearEnlace(app);
    // Then: el PDF que se generó para subir lleva el QR exacto de la url reservada, su caducidad y su texto
    const subido = hojaDelPdf();
    expect(subido).toContain(svgQR(modulosQR(URL_ENLACE), 84));
    expect(subido).toContain(URL_ENLACE);
    expect(subido).toContain(textoCaduca(vencimientoRespondido));
    expect(subido).toContain(`<div class="numero-codigo">${CODIGO}</div>`);
    // And: lo que viajó es el PDF generado a partir de ese documento
    expect(llamadasAlWorker().map(([, init]) => JSON.parse(init.body))[1].pdf).toBe(PDF);

    // When: comparte el PDF con el enlace vigente
    (generatePDF as jest.Mock).mockClear();
    await app.tocar('reporte-enlace-listo');
    await app.tocar('reporte-compartir-pdf');
    // Then: comparte el PDF CON el QR
    expect(hojaDelPdf()).toContain(svgQR(modulosQR(URL_ENLACE), 84));

  });

  // @spec16_e22 — Cambiar el periodo quita el QR
  it('spec16_e22 e2e cambiar el periodo quita el QR y volver lo recupera sin subir de nuevo', async () => {
    // Given: un historial con un día de hace 40 días y un enlace creado para "Todo tu historial"
    await guardarCierre(cierreDe(40));
    const app = await abrirReporte();
    await crearEnlace(app);
    await app.tocar('reporte-enlace-listo');
    expect(app.existe('reporte-qr')).toBe(true);
    // When: cambia a "Últimos 30 días" (otro contenido)
    await app.tocar('reporte-filtro-boton');
    await app.tocar('reporte-filtro-opcion-ultimos30');
    await app.tocar('reporte-filtro-listo');
    // Then: el QR desaparece de la vista previa y Compartir reporte genera el PDF sin QR
    expect(app.existe('reporte-qr')).toBe(false);
    expect(app.existe('reporte-qr-aviso')).toBe(true);
    (generatePDF as jest.Mock).mockClear();
    await app.tocar('reporte-compartir-pdf');
    expect(hojaDelPdf()).not.toContain(svgQR(modulosQR(URL_ENLACE), 84));
    expect(hojaDelPdf()).not.toMatch(/CR-[0-9A-F]{4}/);
    // When: vuelve a "Todo el historial"
    await app.tocar('reporte-filtro-boton');
    await app.tocar('reporte-filtro-opcion-todo');
    await app.tocar('reporte-filtro-listo');
    // Then: el QR reaparece, sin ninguna petición nueva
    expect(app.existe('reporte-qr')).toBe(true);
    expect(tipos()).toEqual(['reservarReporte', 'subirReporte']);
  });

  // @spec16_e23 — Si un paso falla, no queda QR y el mensaje es amable
  it('spec16_e23 e2e si falla la subida o el PDF a mitad no queda QR y el mensaje es amable', async () => {
    // Given: el Worker reserva bien pero la subida falla (502)
    const app = await abrirReporte();
    fetchMock().mockImplementation((_url: string, init: { body: string }) =>
      Promise.resolve(
        JSON.parse(init.body).tipo === 'reservarReporte'
          ? respuestaOk()
          : ({ ok: false, status: 502, text: async () => '{"error":"NO_DISPONIBLE"}' } as unknown as Response),
      ),
    );
    // When: crea el enlace
    await crearEnlace(app);
    // Then: mensaje amable sin códigos, sin QR en la vista previa ni hoja de resultado
    const aviso = app.textoDe('reporte-error-nube');
    expect(aviso).toBe('No pudimos crear el enlace ahora. Inténtalo más tarde.');
    expect(aviso).not.toMatch(/502|SERVIDOR|NO_DISPONIBLE/);
    expect(app.existe('reporte-qr')).toBe(false);
    expect(app.existe('reporte-enlace-url')).toBe(false);

    // When: ahora falla el PDF (después de reservar)
    fetchMock().mockImplementation(() => Promise.resolve(respuestaOk()));
    (generatePDF as jest.Mock).mockRejectedValueOnce(new Error('sin memoria'));
    (fetchMock() as jest.Mock).mockClear();
    await crearEnlace(app);
    // Then: mensaje amable, sin QR y sin haber subido nada
    expect(app.textoDe('reporte-error-nube')).toBe('No pudimos preparar el PDF. Inténtalo otra vez.');
    expect(app.existe('reporte-qr')).toBe(false);
    expect(tipos()).toEqual(['reservarReporte']);

    // When: el Worker llegó a su tope diario
    fetchMock().mockImplementation(() =>
      Promise.resolve({ ok: false, status: 503, text: async () => '{"error":"LIMITE_DIARIO"}' } as unknown as Response),
    );
    await crearEnlace(app);
    // Then: dice que lo intente mañana
    expect(app.textoDe('reporte-error-nube')).toBe('Hoy ya se subieron muchos reportes. Inténtalo mañana.');
    expect(app.existe('reporte-qr')).toBe(false);
    // And: ningún enlace quedó guardado en el teléfono, y un reintento posterior sí puede reservar otra vez
    expect(await guardadosEnElTelefono()).toBeNull();
    fetchMock().mockImplementation(() => Promise.resolve(respuestaOk()));
    fetchMock().mockClear();
    await crearEnlace(app);
    expect(tipos()).toEqual(['reservarReporte', 'subirReporte']);
    expect(app.existe('reporte-qr')).toBe(true);
  });

  // @spec16_e25 — Dos toques seguidos: una sola reserva y una sola subida
  it('spec16_e25 e2e dos toques seguidos crean un solo enlace con una reserva y una subida', async () => {
    // Given: la confirmación abierta
    const app = await abrirReporte();
    await app.tocar('reporte-crear-enlace');
    // When: toca "Sí, subir" dos veces sin esperar a que termine la primera
    const aceptar = app.botonDe('reporte-confirmar-subir');
    await act(async () => {
      await Promise.all([aceptar.props.onPress(), aceptar.props.onPress()]);
    });
    // Then: una reserva y una subida, nada más
    expect(tipos()).toEqual(['reservarReporte', 'subirReporte']);
    expect(generatePDF).toHaveBeenCalledTimes(1);
    // And: además, el botón "Crear enlace" tocado dos veces no abre dos confirmaciones ni sube de nuevo
    await app.tocar('reporte-enlace-listo');
    await act(async () => {
      const boton = app.botonDe('reporte-crear-enlace');
      await Promise.all([boton.props.onPress(), boton.props.onPress()]);
    });
    expect(tipos()).toHaveLength(2);
  });

  // @spec16_e26 — Con enlace vigente: "Ver mi enlace", cero peticiones
  it('spec16_e26 e2e con enlace vigente el boton pasa a Ver mi enlace y no pide confirmacion ni sube', async () => {
    // Given: un enlace creado
    const app = await abrirReporte();
    expect(app.textos()).toContain('Crear enlace con QR');
    await crearEnlace(app);
    await app.tocar('reporte-enlace-listo');
    // Then: el botón cambia de texto
    expect(app.textos()).toContain('Ver mi enlace');
    expect(app.textos()).not.toContain('Crear enlace con QR');
    // When: lo toca varias veces
    for (let i = 0; i < 3; i += 1) {
      await app.tocar('reporte-crear-enlace');
      // Then: muestra QR, código, caducidad y los tres botones, sin confirmación ni peticiones
      expect(app.existe('reporte-confirmar-que-sube')).toBe(false);
      expect(app.textoDe('reporte-enlace-url')).toBe(URL_ENLACE);
      expect(app.textoDe('reporte-enlace-caduca')).toMatch(/^Caduca el/);
      expect(app.textos()).toEqual(
        expect.arrayContaining(['Copiar enlace', 'Compartir enlace', 'Descargar PDF']),
      );
      await app.tocar('reporte-enlace-listo');
    }
    expect(tipos()).toHaveLength(2);
    expect(generatePDF).toHaveBeenCalledTimes(1);
  });

  // @spec16_e27 — Cerrar y abrir la app no provoca otra subida
  it('spec16_e27 e2e cerrar y abrir la app muestra el mismo enlace sin ninguna peticion nueva', async () => {
    // Given: un enlace creado y guardado en el teléfono
    const app = await abrirReporte();
    await crearEnlace(app);
    expect(tipos()).toHaveLength(2);
    const guardado = JSON.parse((await guardadosEnElTelefono()) ?? '[]');
    // Then: lo guardado es una entrada pequeña, sin cierres ni datos del negocio
    expect(guardado).toHaveLength(1);
    expect(Object.keys(guardado[0]).sort()).toEqual(
      ['caduca', 'clave', 'creadoEn', 'filtro', 'guardado', 'id', 'periodoEtiqueta', 'tokenBorrado', 'url'].sort(),
    );
    expect(guardado[0].guardado).toBe(false);
    expect(JSON.stringify(guardado)).not.toMatch(/Freddy|Anticucho|montoYape|cierre/i);
    // When: cierra la app y la abre otra vez
    fetchMock().mockClear();
    (generatePDF as jest.Mock).mockClear();
    const nueva = await reabrirReporte();
    // Then: el reporte ya muestra el QR y el código, el botón dice "Ver mi enlace" y no hubo peticiones
    expect(nueva.existe('reporte-qr')).toBe(true);
    expect(nueva.textoDe('reporte-codigo')).toBe(CODIGO);
    expect(nueva.textos()).toContain('Ver mi enlace');
    await nueva.tocar('reporte-crear-enlace');
    expect(nueva.textoDe('reporte-enlace-url')).toBe(URL_ENLACE);
    expect(llamadasAlWorker()).toHaveLength(0);
    expect(generatePDF).not.toHaveBeenCalled();
  });

  // @spec16_e28 — Un enlace vencido en el almacenamiento se descarta y se puede crear otro
  it('spec16_e28 e2e un enlace vencido en el telefono se descarta y se puede crear otro', async () => {
    // Given: un enlace creado y guardado, que luego vence
    const app = await abrirReporte();
    await crearEnlace(app);
    const guardado = JSON.parse((await guardadosEnElTelefono()) ?? '[]');
    guardado[0].caduca = new Date(Date.now() - 1000).toISOString();
    await createAsyncStorage('crecemos').setItem(CLAVE_ENLACES, JSON.stringify(guardado));
    // When: abre la app otra vez
    fetchMock().mockClear();
    const nueva = await reabrirReporte();
    // Then: no hay QR ni código, vuelve "Crear enlace con QR", lo vencido se limpió y no hubo peticiones
    expect(nueva.existe('reporte-qr')).toBe(false);
    expect(nueva.textos()).toContain('Crear enlace con QR');
    expect(JSON.parse((await guardadosEnElTelefono()) ?? '[]')).toEqual([]);
    expect(llamadasAlWorker()).toHaveLength(0);
    // When: crea otro
    idRespondido = ID_2;
    await crearEnlace(nueva);
    // Then: reserva y sube de nuevo, con el código nuevo
    expect(tipos()).toEqual(['reservarReporte', 'subirReporte']);
    expect(nueva.textoDe('reporte-codigo')).toBe(CODIGO_2);
  });

  // @spec16_e29 — La clave no cambia con el tiempo
  it('spec16_e29 e2e un dia despues el mismo contenido sigue teniendo su enlace', async () => {
    // Given: un enlace creado hoy
    const app = await abrirReporte();
    await crearEnlace(app);
    expect(tipos()).toHaveLength(2);
    await desmontarApp();
    // When: pasa un día (reloj simulado) y se abre otra vez el mismo reporte
    jest.useFakeTimers({
      doNotFake: [
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
      ],
      now: Date.now() + 86400000,
    });
    try {
      fetchMock().mockClear();
      const nueva = await abrirReporte();
      // Then: la fecha de emisión cambió, la clave no: sigue el mismo enlace y no hubo peticiones
      expect(nueva.textos()).toContain('Ver mi enlace');
      expect(nueva.existe('reporte-qr')).toBe(true);
      expect(llamadasAlWorker()).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  // @spec16_e30 — Salir y volver durante la subida no lanza otra
  it('spec16_e30 e2e si sale y vuelve durante la subida no se lanza otra', async () => {
    // Given: la reserva queda pendiente (el Worker tarda)
    let soltar!: (r: Response) => void;
    const respondidas: string[] = [];
    fetchMock().mockImplementation((_u: string, init: { body: string }) => {
      const tipo = JSON.parse(init.body).tipo as string;
      respondidas.push(tipo);
      return tipo === 'reservarReporte'
        ? new Promise<Response>(r => {
            soltar = r;
          })
        : Promise.resolve(respuestaOk());
    });
    const app = await abrirReporte();
    await app.tocar('reporte-crear-enlace');
    await act(async () => {
      void app.botonDe('reporte-confirmar-subir').props.onPress();
    });
    expect(tipos()).toEqual(['reservarReporte']);
    expect(app.textos()).toContain('Subiendo…');
    // When: sale de la pantalla y vuelve mientras la subida sigue
    const nueva = await reabrirReporte();
    // Then: el botón sigue en "Subiendo…" y deshabilitado, y tocarlo no hace nada
    expect(nueva.textos()).toContain('Subiendo…');
    expect(nueva.botonDe('reporte-crear-enlace').props.disabled).toBe(true);
    await nueva.tocar('reporte-crear-enlace');
    expect(nueva.existe('reporte-confirmar-que-sube')).toBe(false);
    // When: el Worker por fin responde
    await act(async () => {
      soltar(respuestaOk());
      await new Promise(resolver => setTimeout(resolver, 50));
    });
    // Then: se completó UNA sola creación y la pantalla nueva muestra el enlace
    expect(respondidas).toEqual(['reservarReporte', 'subirReporte']);
    expect(nueva.existe('reporte-qr')).toBe(true);
    expect(nueva.textos()).toContain('Ver mi enlace');
  });
});

// --- Guardar en "Mis reportes" y la pantalla Mis reportes ----------------------------------------

const DIA = 86400000;
const enDias = (n: number) => new Date(Date.now() + n * DIA).toISOString();
const hace = (n: number) => Date.now() - n * DIA;
/** Una entrada guardada, sembrada directo en el almacenamiento (como si se hubiera creado antes). */
const sembrarGuardado = async (
  n: number,
  titulo: string,
  extra: Partial<EntradaReporte> = {},
  creadoHace = 10 - n,
) => {
  const id = n.toString(16).padStart(32, 'a');
  const entrada: EntradaReporte = {
    clave: `clave-${n}`,
    id,
    url: urlDe(id),
    tokenBorrado: `${n}`.repeat(32).slice(0, 32),
    periodoEtiqueta: 'Todo tu historial',
    filtro: { tipo: 'todo' },
    creadoEn: new Date(hace(creadoHace)).toISOString(),
    caduca: enDias(25),
    guardado: false,
    ...extra,
  };
  // Se registra "en su momento" para que no se descarte aunque ya hubiera caducado.
  await registrarEntradaDeReporte(entrada, Math.min(Date.now(), Date.parse(entrada.caduca) - 1000));
  await guardarReporteEnLista(entrada.clave, titulo, Math.min(Date.now(), Date.parse(entrada.caduca) - 1000));
  return entrada;
};

describe('Sprint-16 · Mis reportes', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    jest.clearAllMocks();
    idRespondido = ID;
    for (const d of [1, 2, 3]) await guardarCierre(cierreDe(d));
    await guardarPerfil(FREDDY);
    (generatePDF as jest.Mock).mockResolvedValue({ filePath: '/tmp/r.pdf', base64: PDF });
    (compartirReporte as jest.Mock).mockResolvedValue({ ok: true });
    fetchMock().mockImplementation((url: string, init: { body: string }) => {
      if (!String(url).includes('workers.dev')) return Promise.reject(new TypeError('Network request failed'));
      return Promise.resolve(
        JSON.parse(init.body).tipo === 'borrarReporte'
          ? ({ ok: true, status: 200, text: async () => '{"ok":true}' } as unknown as Response)
          : respuestaOk(),
      );
    });
  });
  afterEach(desmontarApp);

  const abrirMisReportes = async () => {
    const app = await abrirReporte();
    await app.tocar('reporte-mis-reportes');
    return app;
  };

  // @spec16_e43 — Guardar es opcional, con título sugerido y editable
  it('spec16_e43 e2e guardar en Mis reportes es opcional y el titulo sugerido se puede cambiar', async () => {
    // Given: un enlace recién creado
    const app = await abrirReporte();
    await crearEnlace(app);
    // Then: no se guardó solo: nada en Mis reportes
    expect(await listarReportesGuardados()).toEqual([]);
    expect(app.textos()).toContain('Guardar en Mis reportes');
    // When: toca guardar
    await app.tocar('reporte-guardar');
    // Then: sale un campo con el título sugerido según el periodo
    const hoy = fechaLocal(new Date());
    expect(app.valorDe('reporte-titulo')).toBe(tituloSugerido('todo', 'Todo tu historial', hoy));
    expect(app.valorDe('reporte-titulo')).toMatch(/^Todo mi historial · \d{1,2} \w{3}$/);
    expect(await listarReportesGuardados()).toEqual([]);
    // When: lo deja vacío
    await app.escribir('reporte-titulo', '   ');
    await app.tocar('reporte-titulo-guardar');
    // Then: un mensaje amable y no se guarda
    expect(app.textos()).toContain('Escribe un título para tu reporte.');
    expect(await listarReportesGuardados()).toEqual([]);
    // When: escribe su propio título y guarda
    await app.escribir('reporte-titulo', 'Para el banco, octubre');
    await app.tocar('reporte-titulo-guardar');
    // Then: queda guardado con ese título y el botón pasa a "Editar título"
    expect((await listarReportesGuardados()).map(e => e.titulo)).toEqual(['Para el banco, octubre']);
    expect(app.textoDe('reporte-enlace-guardado')).toBe('Guardado en Mis reportes: «Para el banco, octubre»');
    expect(app.textos()).toContain('Editar título');
    expect(app.textos()).not.toContain('Guardar en Mis reportes');
    // And: guardar no hizo ninguna petición más (solo reservar y subir)
    expect(tipos()).toEqual(['reservarReporte', 'subirReporte']);
  });

  // @spec16_e44 — Pantalla vacía y accesos
  it('spec16_e44 e2e la pantalla vacia es amable y se llega desde Mi reporte y desde el Perfil', async () => {
    // Given: Mi reporte abierto, con su botón "Mis reportes" (texto y al menos 48 dp)
    const app = await abrirReporte();
    expect(app.textos()).toContain('Mis reportes');
    const alto = StyleSheet.flatten(app.botonDe('reporte-mis-reportes').props.style)?.height;
    expect(alto === undefined || alto >= 48).toBe(true);
    // When: entra
    await app.tocar('reporte-mis-reportes');
    // Then: estado vacío amable, sin peticiones
    expect(app.textos()).toContain(TEXTO_SIN_REPORTES);
    expect(llamadasAlWorker()).toHaveLength(0);
    await desmontarApp();
    // When: entra desde el Perfil
    const otra = await montarApp();
    await otra.tocar('abrir-perfil');
    expect(otra.textos()).toContain('Mis reportes');
    await otra.tocar('perfil-opcion-reportes');
    // Then: la misma pantalla
    expect(otra.textos()).toContain(TEXTO_SIN_REPORTES);
  });

  // @spec16_e45 — La lista: orden, estados y detalle
  it('spec16_e45 e2e la lista va del mas reciente al mas viejo con su estado en palabras y su detalle', async () => {
    // Given: tres guardados: uno con 25 días, uno con 1 día y uno que caducó
    const a = await sembrarGuardado(1, 'Antiguo', {}, 9);
    const b = await sembrarGuardado(2, 'Reciente', { caduca: new Date(Date.now() + 3600000).toISOString() }, 1);
    const c = await sembrarGuardado(3, 'Vencido', { caduca: new Date(hace(2)).toISOString() }, 5);
    // When: abre Mis reportes
    const app = await abrirMisReportes();
    // Then: del más reciente al más viejo, cada uno con su estado en palabras
    const orden = app.enOrden([a, b, c].map(e => `mis-reportes-titulo-${e.id}`));
    expect(orden).toEqual([b, c, a].map(e => `mis-reportes-titulo-${e.id}`));
    expect(app.textoDe(`mis-reportes-estado-${a.id}`)).toBe('Vigente · quedan 25 días');
    expect(app.textoDe(`mis-reportes-estado-${b.id}`)).toBe('Vigente · queda 1 día');
    expect(app.textoDe(`mis-reportes-estado-${c.id}`)).toMatch(/^Caducó el \d{1,2} de \w+/);
    // And: cada tarjeta se puede tocar, con etiqueta completa y al menos 48 dp
    const tarjeta = app.propsDe(`mis-reportes-tarjeta-${a.id}`);
    expect(tarjeta.accessibilityRole).toBe('button');
    expect(tarjeta.accessibilityLabel).toMatch(/Antiguo\. Todo tu historial\. Vigente · quedan 25 días\./);
    expect(StyleSheet.flatten(tarjeta.style).minHeight).toBeGreaterThanOrEqual(48);
    expect(llamadasAlWorker()).toHaveLength(0);
    // When: abre el detalle del vigente
    await app.tocar(`mis-reportes-tarjeta-${a.id}`);
    // Then: QR, código, enlace, caducidad y todos los botones con texto
    expect(app.existe('mis-reportes-enlace-qr')).toBe(true);
    expect(app.textoDe('mis-reportes-enlace-codigo')).toBe(codigoDeEnlace(a.id));
    expect(app.textoDe('mis-reportes-enlace-url')).toBe(a.url);
    expect(app.textoDe('mis-reportes-enlace-caduca')).toMatch(/^Caduca el/);
    expect(app.textos()).toEqual(
      expect.arrayContaining(['Copiar enlace', 'Compartir enlace', 'Descargar PDF', 'Borrar de la nube', 'Quitar de mi lista']),
    );
    expect(app.textoDe('mis-reportes-quitar-ayuda')).toMatch(/El archivo en la nube sigue hasta que caduque el/);
    await app.tocar('mis-reportes-listo');
    // When: abre el detalle del vencido
    await app.tocar(`mis-reportes-tarjeta-${c.id}`);
    // Then: dice que caducó, ofrece crear uno nuevo y NO ofrece descargar ni borrar
    expect(app.textoDe('mis-reportes-enlace-caduca')).toMatch(/^Caducó el/);
    expect(app.textos()).toContain('Crear enlace nuevo');
    expect(app.textos()).not.toContain('Descargar PDF');
    expect(app.textos()).not.toContain('Borrar de la nube');
    expect(llamadasAlWorker()).toHaveLength(0);
  });

  // @spec16_e46 — Crear enlace nuevo lleva a Mi reporte con el mismo periodo
  it('spec16_e46 e2e crear enlace nuevo abre Mi reporte con el mismo periodo elegido', async () => {
    // Given: un guardado vencido de "Últimos 30 días"
    const v = await sembrarGuardado(1, 'De 30 días', {
      caduca: new Date(hace(1)).toISOString(),
      periodoEtiqueta: 'Del 1 de septiembre al 30 de septiembre',
      filtro: { tipo: 'ultimos30' },
    });
    const app = await abrirMisReportes();
    // When: lo abre y toca "Crear enlace nuevo"
    await app.tocar(`mis-reportes-tarjeta-${v.id}`);
    await app.tocar('mis-reportes-nuevo');
    // Then: Mi reporte se abre con "Últimos 30 días" ya elegido, sin subir nada todavía
    // (Mi reporte queda apilado sobre el anterior: se busca entre todos los textos.)
    expect(app.textos().some(t => /^Periodo: Del \d{1,2} de \w+ al \d{1,2} de \w+/.test(t))).toBe(true);
    expect(llamadasAlWorker()).toHaveLength(0);
    expect(app.textos()).toContain('Crear enlace con QR');
  });

  // @spec16_e47 — Quitar de mi lista no habla con la red
  it('spec16_e47 e2e quitar de mi lista solo olvida la entrada y no hace ninguna peticion', async () => {
    // Given: un guardado vigente
    const g = await sembrarGuardado(1, 'Para quitar');
    const app = await abrirMisReportes();
    await app.tocar(`mis-reportes-tarjeta-${g.id}`);
    // When: lo quita de la lista
    await app.tocar('mis-reportes-quitar');
    // Then: desaparece, la pantalla queda vacía y no hubo peticiones
    expect(await listarReportesGuardados()).toEqual([]);
    expect(app.textos()).toContain(TEXTO_SIN_REPORTES);
    expect(llamadasAlWorker()).toHaveLength(0);
  });

  // @spec16_e48 — Borrar de la nube: confirmación, una sola petición con el token
  it('spec16_e48 e2e borrar de la nube pide confirmacion y hace una sola peticion con el token', async () => {
    // Given: un guardado vigente
    const g = await sembrarGuardado(1, 'Para borrar');
    const app = await abrirMisReportes();
    await app.tocar(`mis-reportes-tarjeta-${g.id}`);
    // When: toca "Borrar de la nube"
    await app.tocar('mis-reportes-borrar');
    // Then: pide confirmar con el título, y todavía no hay petición
    expect(app.textoDe('mis-reportes-confirmar-texto')).toBe(
      'Dejará de funcionar el enlace y el QR del reporte «Para borrar». ¿Borrar?',
    );
    expect(llamadasAlWorker()).toHaveLength(0);
    // When: dice que no
    await app.tocar('mis-reportes-confirmar-no');
    expect(llamadasAlWorker()).toHaveLength(0);
    // When: confirma, con dos toques seguidos
    await app.tocar('mis-reportes-borrar');
    const si = app.botonDe('mis-reportes-confirmar-si');
    await act(async () => {
      await Promise.all([si.props.onPress(), si.props.onPress()]);
    });
    // Then: UNA sola petición, con el id y el token guardados, y la entrada ya no está
    expect(llamadasAlWorker()).toHaveLength(1);
    expect(JSON.parse(llamadasAlWorker()[0][1].body)).toEqual({
      tipo: 'borrarReporte',
      id: g.id,
      token: g.tokenBorrado,
    });
    expect(await listarReportesGuardados()).toEqual([]);
    expect(app.textoDe('mis-reportes-aviso')).toBe('Se borró de la nube. El enlace ya no funciona.');
    // And: el token nunca se mostró en pantalla
    expect(app.textos().join(' ')).not.toContain(g.tokenBorrado);
  });

  // @spec16_e49 — Si borrar falla, no se pierde la entrada
  it('spec16_e49 e2e si no hay internet al borrar la entrada se queda y el mensaje es amable', async () => {
    // Given: un guardado vigente y sin red
    const g = await sembrarGuardado(1, 'Sin red');
    fetchMock().mockRejectedValue(new TypeError('Network request failed'));
    const app = await abrirMisReportes();
    await app.tocar(`mis-reportes-tarjeta-${g.id}`);
    // When: intenta borrar de la nube
    await app.tocar('mis-reportes-borrar');
    await app.tocar('mis-reportes-confirmar-si');
    // Then: mensaje amable sin códigos, y la entrada sigue en la lista
    const aviso = app.textoDe('mis-reportes-aviso');
    expect(aviso).toMatch(/^Necesitas internet para esto/);
    expect(aviso).not.toMatch(/SIN_RED|Network|TypeError|\b[45]\d\d\b/);
    expect((await listarReportesGuardados()).map(e => e.id)).toEqual([g.id]);
    expect(tipos()).toEqual(['borrarReporte']);
  });
});
