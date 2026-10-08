/**
 * Pruebas de apoyo del servicio de compartir (no son escenarios del SPEC): abre la hoja nativa con
 * el texto como mensaje, no lanza si falla y no hace ninguna petición de red.
 */

import { Share } from 'react-native';
import { compartirReporte } from '@services/compartir';

describe('compartirReporte', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('abre la hoja nativa con el texto como mensaje', async () => {
    const abrir = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction } as Awaited<ReturnType<typeof Share.share>>);

    const resultado = await compartirReporte('Reporte de actividad del negocio\nVenta: S/ 1.00');

    expect(abrir).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledWith({
      message: 'Reporte de actividad del negocio\nVenta: S/ 1.00',
    });
    expect(resultado).toEqual({ ok: true });
  });

  it('cerrar la hoja sin compartir no es un error', async () => {
    jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.dismissedAction } as Awaited<
        ReturnType<typeof Share.share>
      >);

    await expect(compartirReporte('texto')).resolves.toEqual({ ok: true });
  });

  it('si la hoja no se puede abrir, no lanza: devuelve el resultado con error', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('No hay nada con qué compartir'));

    await expect(compartirReporte('texto')).resolves.toEqual({
      ok: false,
      error: 'NO_SE_PUDO_ABRIR',
    });
  });

  it('si Share.share lanza de forma síncrona, tampoco lanza', async () => {
    jest.spyOn(Share, 'share').mockImplementation(() => {
      throw new Error('síncrono');
    });

    await expect(compartirReporte('texto')).resolves.toEqual({
      ok: false,
      error: 'NO_SE_PUDO_ABRIR',
    });
  });

  it('no hace ninguna petición de red', async () => {
    const red = global.fetch as jest.Mock;
    red.mockClear();
    jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction } as Awaited<ReturnType<typeof Share.share>>);

    await compartirReporte('texto');

    expect(red).not.toHaveBeenCalled();
  });
});
