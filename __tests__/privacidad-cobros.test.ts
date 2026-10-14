/**
 * P0 #6 de la auditoría: el aviso de privacidad del chat dice que no viaja lo que te deben por
 * cobrar. Aquí se comprueba que es verdad: en `cuantoPorCobrar` el cuerpo que sale del teléfono
 * no lleva montos ni fechas del Yape, solo señales de vocabulario cerrado.
 */
import type { Cierre, ContextoAnalisis } from '@dominio/tipos';
import { FRASE_NEUTRA_COBROS, armarHechoParaJuicio } from '@analisis/semaforo';
import { consultar } from '@services/jev';

const HOY = '2026-10-07';

const porCobrar = (fecha: string, montoYape: number): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [],
  montoYape,
  yapePendiente: true,
  gastos: [],
  abreCiclo: false,
  creadoEn: '2026-10-07T12:00:00-05:00',
  actualizadoEn: '2026-10-07T12:00:00-05:00',
});

// 213.50 en Yape por cobrar desde el 1 de octubre.
const CTX: ContextoAnalisis = {
  cierres: [porCobrar('2026-10-01', 150.5), porCobrar('2026-10-04', 63)],
  productos: [],
  hoy: HOY,
};

const respuesta = (objeto: unknown) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(objeto) } as unknown as Response);

describe('cuantoPorCobrar no manda montos ni fechas del Yape', () => {
  it('el hecho para el juicio lleva una frase neutra, sin cifras y con las señales', () => {
    const hecho = armarHechoParaJuicio(
      {
        intencion: 'cuantoPorCobrar',
        frase: 'Tienes S/ 213.50 por cobrar desde el 1 de octubre.',
        cifras: ['213.50', '1 de octubre'],
      },
      { plazo: 'vencido', monto: 'alto' },
    );

    expect(hecho).toEqual({
      intencion: 'cuantoPorCobrar',
      frase: FRASE_NEUTRA_COBROS,
      cifras: [],
      senales: { plazo: 'vencido', monto: 'alto' },
    });
  });

  it('otras intenciones siguen mandando su frase y sus cifras', () => {
    const hecho = armarHechoParaJuicio(
      { intencion: 'compararCiclo', frase: 'Te quedan S/ 78.00 menos.', cifras: ['78.00'] },
      { tendencia: 'baja', magnitud: 'grande' },
    );
    expect(hecho.frase).toBe('Te quedan S/ 78.00 menos.');
    expect(hecho.cifras).toEqual(['78.00']);
  });

  it('ninguna petición del chat lleva el monto ni la fecha del Yape por cobrar', async () => {
    const fetchFn = jest.fn(async (_url: unknown, init?: { body?: string }) => {
      const cuerpo = JSON.parse(init?.body ?? '{}');
      return cuerpo.tipo === 'interpretar'
        ? respuesta({ intencion: 'cuantoPorCobrar', producto: 'ninguno', dia: 'ninguno', confianza: 0.95 })
        : respuesta({ semaforo: 'urgente', confianza: 0.9 });
    });

    const r = await consultar(fetchFn as unknown as typeof fetch, 'https://x.test', '¿cuánto me deben?', CTX);

    // La respuesta que lee Freddy sí trae el monto: se calcula en el teléfono.
    expect(r.tipo === 'respuesta' && r.texto).toContain('213.50');
    expect(r.tipo === 'respuesta' && r.semaforo).toBe('urgente');

    const cuerpos = (fetchFn.mock.calls as unknown as [string, { body: string }][]).map(c => c[1].body);
    const juzgar = cuerpos.find(c => JSON.parse(c).tipo === 'juzgar');
    expect(juzgar).toBeDefined();
    for (const cuerpo of cuerpos) {
      // Ni 213.50, ni 150.50, ni 63, ni la fecha, ni el símbolo de soles, ni la palabra Yape.
      expect(cuerpo).not.toMatch(/213|150|63|octubre|2026|S\//i);
      expect(cuerpo).not.toMatch(/yape/i);
    }
    expect(JSON.parse(juzgar as string).hecho).toEqual({
      intencion: 'cuantoPorCobrar',
      frase: FRASE_NEUTRA_COBROS,
      cifras: [],
      senales: { plazo: 'normal', monto: 'alto' },
    });
  });
});
