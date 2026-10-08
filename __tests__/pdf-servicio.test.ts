/**
 * Pruebas de apoyo del servicio del PDF (no son escenarios del SPEC; los recorridos del SPEC son
 * spec07_e9 y spec07_e10). Las dos librerías nativas están simuladas en `jest.setup.js`: aquí se
 * mira con qué opciones se llaman, que nunca lanzan y que ni la red ni el almacenamiento se tocan.
 */

import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { generatePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import { ALTO_A4_PT, ANCHO_A4_PT, compartirPdf } from '@services/pdf';

const HTML = '<!doctype html><html><body>Reporte de actividad del negocio</body></html>';
const NOMBRE = 'Reporte-Crecemos-2026-10-20';
const TITULO = 'Reporte de actividad del negocio';

const generar = jest.mocked(generatePDF);
const compartir = jest.mocked(Share.open);

describe('compartirPdf', () => {
  beforeEach(() => {
    generar.mockReset();
    generar.mockResolvedValue({ filePath: '/tmp/prueba.pdf' });
    compartir.mockReset();
    compartir.mockResolvedValue({ success: true } as Awaited<ReturnType<typeof Share.open>>);
    clearAllMockStorages();
  });

  it('la hoja es A4: 595 × 842 puntos', () => {
    expect(ANCHO_A4_PT).toBe(595);
    expect(ALTO_A4_PT).toBe(842);
  });

  it('genera el PDF con las opciones exactas: A4, fondo blanco, sin borde y con los fondos', async () => {
    const resultado = await compartirPdf(HTML, NOMBRE, TITULO);

    expect(generar).toHaveBeenCalledTimes(1);
    expect(generar).toHaveBeenCalledWith({
      html: HTML,
      fileName: NOMBRE,
      width: 595,
      height: 842,
      bgColor: '#FFFFFF',
      padding: 0,
      shouldPrintBackgrounds: true,
      directory: 'Documents',
    });
    expect(resultado).toEqual({ ok: true });
  });

  it('pasa siempre el ancho y el alto juntos', async () => {
    await compartirPdf(HTML, NOMBRE, TITULO);

    const opciones = generar.mock.calls[0][0];
    expect(opciones.width).toBe(ANCHO_A4_PT);
    expect(opciones.height).toBe(ALTO_A4_PT);
  });

  it('abre la hoja con el archivo, el tipo pdf y failOnCancel apagado', async () => {
    await compartirPdf(HTML, NOMBRE, TITULO);

    expect(compartir).toHaveBeenCalledTimes(1);
    expect(compartir).toHaveBeenCalledWith({
      url: 'file:///tmp/prueba.pdf',
      type: 'application/pdf',
      title: TITULO,
      failOnCancel: false,
    });
  });

  it('primero genera y después comparte', async () => {
    await compartirPdf(HTML, NOMBRE, TITULO);

    expect(generar.mock.invocationCallOrder[0]).toBeLessThan(compartir.mock.invocationCallOrder[0]);
  });

  it('no repite el prefijo file:// si la librería ya lo trae', async () => {
    generar.mockResolvedValue({ filePath: 'file:///var/mobile/Documents/Reporte.pdf' });

    await compartirPdf(HTML, NOMBRE, TITULO);

    expect(compartir.mock.calls[0][0].url).toBe('file:///var/mobile/Documents/Reporte.pdf');
  });

  it('cerrar la hoja sin compartir es ok: no es un error', async () => {
    compartir.mockResolvedValue({ success: false, dismissedAction: true } as Awaited<
      ReturnType<typeof Share.open>
    >);

    await expect(compartirPdf(HTML, NOMBRE, TITULO)).resolves.toEqual({ ok: true });
  });

  describe('si no se puede generar', () => {
    const NO_SE_PUDO = { ok: false, error: 'NO_SE_PUDO_PREPARAR' };

    it('un rechazo da NO_SE_PUDO_PREPARAR y no abre la hoja', async () => {
      generar.mockRejectedValue(new Error('boom: PDF_FAILED'));

      await expect(compartirPdf(HTML, NOMBRE, TITULO)).resolves.toEqual(NO_SE_PUDO);
      expect(compartir).not.toHaveBeenCalled();
    });

    it('una excepción síncrona tampoco lanza', async () => {
      generar.mockImplementation(() => {
        throw new Error('síncrono');
      });

      await expect(compartirPdf(HTML, NOMBRE, TITULO)).resolves.toEqual(NO_SE_PUDO);
      expect(compartir).not.toHaveBeenCalled();
    });

    it.each([
      ['sin resultado', undefined],
      ['sin archivo', {}],
      ['con la ruta vacía', { filePath: '' }],
    ])('una respuesta %s da NO_SE_PUDO_PREPARAR', async (_caso, respuesta) => {
      generar.mockResolvedValue(respuesta as unknown as Awaited<ReturnType<typeof generatePDF>>);

      await expect(compartirPdf(HTML, NOMBRE, TITULO)).resolves.toEqual(NO_SE_PUDO);
      expect(compartir).not.toHaveBeenCalled();
    });
  });

  describe('si no se puede abrir la hoja', () => {
    const NO_SE_PUDO = { ok: false, error: 'NO_SE_PUDO_ABRIR' };

    it('un rechazo da NO_SE_PUDO_ABRIR', async () => {
      compartir.mockRejectedValue(new Error('No hay nada con qué compartir'));

      await expect(compartirPdf(HTML, NOMBRE, TITULO)).resolves.toEqual(NO_SE_PUDO);
      expect(generar).toHaveBeenCalledTimes(1);
    });

    it('una excepción síncrona tampoco lanza', async () => {
      compartir.mockImplementation(() => {
        throw new Error('síncrono');
      });

      await expect(compartirPdf(HTML, NOMBRE, TITULO)).resolves.toEqual(NO_SE_PUDO);
    });
  });

  it('el resultado no trae la ruta del archivo ni ningún texto técnico', async () => {
    const bien = await compartirPdf(HTML, NOMBRE, TITULO);
    generar.mockRejectedValue(new Error('boom: PDF_FAILED /private/var/secreto.pdf'));
    const mal = await compartirPdf(HTML, NOMBRE, TITULO);

    expect(JSON.stringify(bien)).not.toContain('.pdf');
    expect(JSON.stringify(mal)).not.toMatch(/boom|PDF_FAILED|secreto|\.pdf/);
  });

  it('no guarda la ruta del archivo: el contenedor de la app cambia al reinstalar', async () => {
    await compartirPdf(HTML, NOMBRE, TITULO);

    expect(await createAsyncStorage('crecemos').getAllKeys()).toEqual([]);
  });

  it('no hace ninguna petición de red', async () => {
    const red = global.fetch as jest.Mock;
    red.mockClear();

    await compartirPdf(HTML, NOMBRE, TITULO);
    generar.mockRejectedValue(new Error('x'));
    await compartirPdf(HTML, NOMBRE, TITULO);

    expect(red).not.toHaveBeenCalled();
  });
});
