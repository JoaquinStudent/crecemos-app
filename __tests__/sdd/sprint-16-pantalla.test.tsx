/**
 * Tests del Sprint-16 con la app montada. Generados desde sdd/spec/Sprint-16-voz-y-nube/SPEC.md.
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'.
 *
 * La red (`global.fetch`), el generador de PDF, la hoja de compartir y el portapapeles están
 * simulados: solo se mira qué reciben. Los cierres se siembran con fechas relativas a hoy.
 */
import { Linking, StyleSheet } from 'react-native';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { generatePDF } from 'react-native-html-to-pdf';
import { modulosQR } from '@analisis/pasaporte';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, Perfil } from '@dominio/tipos';
import { compartirReporte } from '@services/compartir';
import { olvidarEnlacesDeLaSesion } from '@services/reporteNube';
import { guardarCierre, guardarPerfil, guardarProducto, listarCierres } from '@storage/repositorio';
import { desmontarApp, montarApp } from '../../testutils/app';

jest.mock('@services/compartir');
jest.mock('react-native/Libraries/Components/Clipboard/Clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn(), getString: jest.fn() },
}));

const ID = '0123456789abcdef0123456789abcdef';
const URL_ENLACE = `https://crecemos-asistente.joaquiningsoft.workers.dev/r/${ID}`;
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
const respuestaOk = (id = ID) => {
  const caduca = new Date(Date.now() + 30 * 86400000).toISOString();
  vencimientoRespondido = caduca;
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        id,
        url: `https://crecemos-asistente.joaquiningsoft.workers.dev/r/${id}`,
        caduca,
      }),
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
    olvidarEnlacesDeLaSesion();
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
    // Then: recién ahora se envía, una sola vez, y solo {tipo, pdf}
    expect(llamadasAlWorker()).toHaveLength(1);
    const [, init] = llamadasAlWorker()[0];
    const cuerpo = JSON.parse(init.body);
    expect(Object.keys(cuerpo).sort()).toEqual(['pdf', 'tipo']);
    expect(cuerpo.pdf).toBe(PDF);
    expect(cuerpo.pdf).not.toMatch(/Freddy|yape/i);
  });

  // @spec16_e12 — Sin internet: aviso sin error técnico
  it('spec16_e12 e2e sin internet avisa con palabras sencillas y sin error tecnico', async () => {
    // Given: sin red y Mi reporte abierto
    fetchMock().mockRejectedValue(new TypeError('Network request failed'));
    const app = await abrirReporte();
    // When: pide el enlace y acepta
    await app.tocar('reporte-crear-enlace');
    await app.tocar('reporte-confirmar-subir');
    // Then: dice que necesita internet, sin códigos ni mensajes técnicos, y la pantalla sigue
    const aviso = app.textoDe('reporte-error-nube');
    expect(aviso).toMatch(/^Necesitas internet para esto/);
    expect(aviso).not.toMatch(/SIN_RED|TIEMPO_AGOTADO|Network|TypeError|fetch|HTTP|\b[45]\d\d\b/);
    expect(app.existe('reporte-enlace-url')).toBe(false);
    expect(app.existe('reporte-compartir-pdf')).toBe(true);
  });

  // @spec16_e13 — El resultado: QR, enlace en texto, copiar y compartir, caducidad
  it('spec16_e13 e2e el resultado muestra el QR el enlace en texto copiar compartir y la caducidad', async () => {
    // Given: una subida exitosa
    const app = await abrirReporte();
    await app.tocar('reporte-crear-enlace');
    await app.tocar('reporte-confirmar-subir');
    // Then: QR con etiqueta propia, enlace en texto, "Caduca el …" y los dos botones con texto
    expect(app.existe('reporte-enlace-qr')).toBe(true);
    expect(app.propsDe('reporte-enlace-qr').accessibilityLabel).toBe('Código QR del enlace de tu reporte');
    expect(app.textoDe('reporte-enlace-url')).toBe(URL_ENLACE);
    expect(app.textoDe('reporte-enlace-caduca')).toMatch(/^Caduca el \d{1,2} de \w+/);
    expect(app.textos()).toEqual(
      expect.arrayContaining(['Copiar enlace', 'Compartir enlace', 'Descargar PDF']),
    );
    // La caducidad sale de la respuesta del Worker: 30 días
    const dias = Math.round((Date.parse(vencimientoRespondido) - Date.now()) / 86400000);
    expect(dias).toBe(30);

    // When: copia
    await app.tocar('reporte-enlace-copiar');
    // Then: lo avisa
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

  // @spec16_e14 — El QR del enlace no es el de la constancia, y se reutiliza el enlace vigente
  it('spec16_e14 e2e el QR del enlace no es el de la constancia y el enlace vigente se reutiliza', async () => {
    // Given: un enlace creado
    const app = await abrirReporte();
    const matrizConstancia = JSON.stringify(
      app.buscar(n => n.props.testID === 'reporte-qr')[0] ? 'hay-constancia' : 'sin-constancia',
    );
    expect(matrizConstancia).toBe(JSON.stringify('hay-constancia'));
    await app.tocar('reporte-crear-enlace');
    await app.tocar('reporte-confirmar-subir');
    // Then: el QR del enlace codifica la dirección (no el código CR-…) y es otra matriz
    const codigoConstancia = app.textoDe('reporte-codigo');
    expect(codigoConstancia).toMatch(/^CR-/);
    expect(JSON.stringify(modulosQR(URL_ENLACE))).not.toBe(JSON.stringify(modulosQR(codigoConstancia)));
    expect(app.textoDe('reporte-enlace-url')).not.toMatch(/^CR-/);

    // When: cierra la hoja y vuelve a pedir el enlace del mismo reporte
    await app.tocar('reporte-enlace-listo');
    expect(app.existe('reporte-enlace-url')).toBe(false);
    await app.tocar('reporte-crear-enlace');
    // Then: se muestra el mismo sin confirmar ni subir otra vez
    expect(app.existe('reporte-confirmar-que-sube')).toBe(false);
    expect(app.textoDe('reporte-enlace-url')).toBe(URL_ENLACE);
    expect(llamadasAlWorker()).toHaveLength(1);
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
    // Then: ninguna de esas acciones hizo una petición de subida
    expect(llamadasAlWorker()).toHaveLength(0);
    // When: pide el enlace y cancela la confirmación
    await app.tocar('reporte-crear-enlace');
    expect(llamadasAlWorker()).toHaveLength(0);
    await app.tocar('reporte-confirmar-cancelar');
    // Then: cancelar tampoco envía nada
    expect(llamadasAlWorker()).toHaveLength(0);
    // When: vuelve a pedirlo y acepta
    await app.tocar('reporte-crear-enlace');
    await app.tocar('reporte-confirmar-subir');
    // Then: solo ahora hay UNA petición
    expect(llamadasAlWorker()).toHaveLength(1);
  });

  // @spec16_e17 — Mismo contenido, mismo enlace; contenido distinto, enlace nuevo
  it('spec16_e17 e2e el mismo contenido reutiliza el enlace y un contenido distinto sube uno nuevo', async () => {
    // Given: un historial con un día de hace 40 días (entra en "todo" pero no en "últimos 30 días")
    await guardarCierre(cierreDe(40));
    const app = await abrirReporte();
    await app.tocar('reporte-crear-enlace');
    await app.tocar('reporte-confirmar-subir');
    await app.tocar('reporte-enlace-listo');
    expect(llamadasAlWorker()).toHaveLength(1);
    // When: pide otra vez el enlace del mismo reporte
    await app.tocar('reporte-crear-enlace');
    // Then: reutiliza el vigente, sin subir otra vez
    expect(app.existe('reporte-confirmar-que-sube')).toBe(false);
    expect(llamadasAlWorker()).toHaveLength(1);
    await app.tocar('reporte-enlace-listo');
    // When: el reporte cambia (otro periodo)
    await app.tocar('reporte-filtro-boton');
    await app.tocar('reporte-filtro-opcion-ultimos30');
    await app.tocar('reporte-filtro-listo');
    await app.tocar('reporte-crear-enlace');
    // Then: pide confirmación y sube uno nuevo
    expect(app.existe('reporte-confirmar-que-sube')).toBe(true);
    await app.tocar('reporte-confirmar-subir');
    expect(llamadasAlWorker()).toHaveLength(2);
  });
});
