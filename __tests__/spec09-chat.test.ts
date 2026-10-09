import { consultar } from '@services/jev';
import { interpretarRespuesta, resolverProductoLocal } from '@analisis/intenciones';
import type { ContextoAnalisis } from '@dominio/tipos';

const ctx: ContextoAnalisis = {
  hoy: '2026-10-07',
  cierres: [],
  productos: [
    {
      id: 'producto-7',
      nombre: 'Mazamorra morada',
      unidad: 'porcion',
      precioVenta: 5,
      costoUnitario: 2,
      activo: true,
      actualizadoEn: '2026-10-07',
    },
  ],
};

const respuesta = (objeto: unknown) =>
  ({ ok: true, text: async () => JSON.stringify(objeto) } as Response);

describe('SPEC-09 · escenarios 8 y 9', () => {
  it('spec09_e8: muestra la frase calculada y no solicita redacción al Worker', async () => {
    const fetchFn = jest.fn(async () =>
      respuesta({ intencion: 'ventaDelDia', dia: 'ayer', confianza: 0.9 }),
    );
    const r = await consultar(
      fetchFn as typeof fetch,
      'https://ejemplo.test',
      '¿Cuánto vendí ayer?',
      ctx,
    );
    expect(r).toMatchObject({
      tipo: 'respuesta',
      texto: 'Ayer no cerraste tu día.',
      redactada: false,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const peticiones = fetchFn.mock.calls as unknown as [string, { body: string }][];
    expect(JSON.parse(peticiones[0][1].body)).toEqual({
      tipo: 'interpretar',
      texto: '¿Cuánto vendí ayer?',
    });
  });

  it('spec09_e9: resuelve el nombre vigente sin enviar catálogo ni aceptar un id inventado', async () => {
    const fetchFn = jest.fn(async () =>
      respuesta({ intencion: 'cuantoPreparar', dia: 'ninguno', confianza: 0.92 }),
    );
    const r = await consultar(
      fetchFn as typeof fetch,
      'https://ejemplo.test',
      '¿Cuánto preparo de mazamorra morada?',
      ctx,
    );
    expect(r).toMatchObject({ tipo: 'respuesta', consulta: { producto: 'producto-7' } });
    expect(JSON.stringify(fetchFn.mock.calls)).not.toContain('producto-7');
    expect(JSON.stringify(fetchFn.mock.calls)).not.toContain('precioVenta');
    expect(
      interpretarRespuesta({ intencion: 'cuantoPreparar', dia: 'ninguno', confianza: 0.9 }),
    ).toMatchObject({ intencion: 'cuantoPreparar' });
    expect(resolverProductoLocal('¿Cuánto preparo de MAZAMORRA MORADA?', ctx.productos)).toBe(
      'producto-7',
    );
    expect(resolverProductoLocal('¿Cuánto preparo de mazamorra?', ctx.productos)).toBeUndefined();
    expect(
      resolverProductoLocal('¿Cuánto preparo de mazamorra morada?', [
        { ...ctx.productos[0], activo: false },
      ]),
    ).toBeUndefined();
  });
});
