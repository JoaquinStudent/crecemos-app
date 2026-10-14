/**
 * @jest-environment node
 *
 * Tests del Sprint-13. Generados desde sdd/spec/Sprint-13-chat-periodo/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * El Worker se llama como lo haría Cloudflare (`worker.fetch(request, env)`) y OpenRouter es un
 * `global.fetch` simulado: la red y la clave real nunca se tocan.
 */

/// <reference types="node" />
import { responderCharla } from '@analisis/charla';
import { clasificarLocal } from '@analisis/clasificadorLocal';
import { extraerCifras } from '@analisis/cifras';
import {
  INTENCIONES,
  interpretarRespuesta,
  PREGUNTAS_SUGERIDAS,
  responderConsulta,
  UMBRAL_CONFIANZA,
} from '@analisis/intenciones';
import { esJuzgable, senalesDeJuicio } from '@analisis/semaforo';
import { consultar, reiniciarEstadoDeRed } from '@services/jev';
import type {
  Cierre,
  Consulta,
  ContextoAnalisis,
  FechaNegocio,
  Gasto,
  IntencionId,
} from '@dominio/tipos';
import worker, { INTENCIONES as INTENCIONES_WORKER } from '../../servidor/worker.js';

// --- Datos: cierres armados a mano, con la fecha explícita ---------------------------------------

const instante = new Date('2026-10-14T12:00:00-05:00').toISOString();

/** Un día con una sola línea: `venta` soles (porciones a S/ 10) y, si hay, un gasto de mercadería. */
const dia = (fecha: FechaNegocio, venta: number, gasto = 0): Cierre => {
  const gastos: Gasto[] = gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [];
  return {
    id: `c-${fecha}`,
    fecha,
    lineas: [
      {
        productoId: 'p-anticucho',
        nombre: 'Anticucho',
        preparadas: venta / 10,
        sobrantes: 0,
        precioUnitario: 10,
        costoUnitario: 8,
      },
    ],
    montoYape: 0,
    yapePendiente: false,
    gastos,
    abreCiclo: false,
    creadoEn: instante,
    actualizadoEn: instante,
  };
};

const ctxDe = (cierres: Cierre[], hoy: FechaNegocio): ContextoAnalisis => ({
  cierres,
  productos: [],
  hoy,
});

const consultaDe = (intencion: IntencionId): Consulta => ({
  intencion,
  dia: 'ninguno',
  confianza: 0.9,
});

const frase = (intencion: IntencionId, ctx: ContextoAnalisis): string =>
  responderConsulta(consultaDe(intencion), ctx).frase;
const mesPasado = (ctx: ContextoAnalisis): string => frase('resumenMesPasado', ctx);
const esteMes = (ctx: ContextoAnalisis): string => frase('resumenMesActual', ctx);

const SIN_CIERRES = 'Ese mes no tiene días cerrados.';

/** Septiembre: dos días, venta S/ 2,700.00, gastos S/ 700.00, resultado S/ 2,000.00. */
const SEPTIEMBRE = [dia('2026-09-05', 1500, 400), dia('2026-09-19', 1200, 300)];
/** Agosto: un día con resultado S/ 1,500.00. */
const AGOSTO = [dia('2026-08-08', 1900, 400)];
const HOY = '2026-10-14';
const INICIO_SEPTIEMBRE =
  'En septiembre cerraste 2 días: vendiste S/ 2,700.00, gastaste S/ 700.00 y el resultado registrado fue S/ 2,000.00.';

describe('SPEC-13: El chat entiende el mes y Jev tiene un segundo intento', () => {
  // @spec13_e1 — El mes pasado se responde con ventas, gastos, resultado y la comparación
  it('spec13_e1 el mes pasado se responde con ventas gastos resultado y comparacion', () => {
    // Given: hoy 2026-10-14, dos cierres en septiembre y uno en agosto, y que Jev interpreta "cómo me fue el mes pasado"
    // When: se calcula la respuesta
    // Then: "En septiembre cerraste 2 días: … Es S/ 500.00 más que en agosto (1 día cerrado)."
    const hecho = responderConsulta(
      consultaDe('resumenMesPasado'),
      ctxDe([...SEPTIEMBRE, ...AGOSTO, dia('2026-10-03', 900)], HOY),
    );
    expect(hecho.frase).toBe(`${INICIO_SEPTIEMBRE} Es S/ 500.00 más que en agosto (1 día cerrado).`);
    expect(hecho.intencion).toBe('resumenMesPasado');
    expect(hecho.cifras).toEqual(extraerCifras(hecho.frase));
    expect(hecho.frase).not.toMatch(/ganancia|te queda/i);

    // Con un agosto de resultado mayor dice "menos"; con uno igual, "igual".
    const agostoMayor = [dia('2026-08-08', 1900, 400), dia('2026-08-20', 1000)];
    expect(mesPasado(ctxDe([...SEPTIEMBRE, ...agostoMayor], HOY))).toBe(
      `${INICIO_SEPTIEMBRE} Es S/ 500.00 menos que en agosto (2 días cerrados).`,
    );
    const agostoIgual = [dia('2026-08-08', 1900, 400), dia('2026-08-20', 500)];
    expect(mesPasado(ctxDe([...SEPTIEMBRE, ...agostoIgual], HOY))).toBe(
      `${INICIO_SEPTIEMBRE} Quedó igual que en agosto (2 días cerrados).`,
    );

    // Un día suelto es "1 día" y un resultado negativo conserva su signo.
    expect(mesPasado(ctxDe([dia('2026-09-05', 100, 200), ...AGOSTO], HOY))).toBe(
      'En septiembre cerraste 1 día: vendiste S/ 100.00, gastaste S/ 200.00 y el resultado registrado fue -S/ 100.00. Es S/ 1,600.00 menos que en agosto (1 día cerrado).',
    );
  });

  // @spec13_e2 — Un mes sin días cerrados lo dice sin inventar
  it('spec13_e2 un mes sin dias cerrados lo dice sin inventar', () => {
    // Given: hoy 2026-10-14 y cierres solo en agosto y en octubre
    // When: se pregunta por el mes pasado
    // Then: "Ese mes no tiene días cerrados." sin ninguna cifra; lo mismo con la lista vacía
    const hecho = responderConsulta(
      consultaDe('resumenMesPasado'),
      ctxDe([...AGOSTO, dia('2026-10-03', 900)], HOY),
    );
    expect(hecho.frase).toBe(SIN_CIERRES);
    expect(hecho.intencion).toBe('resumenMesPasado');
    expect(hecho.cifras).toEqual([]);
    expect(mesPasado(ctxDe([], HOY))).toBe(SIN_CIERRES);
  });

  // @spec13_e3 — Sin mes anterior con qué comparar, responde sin comparación
  it('spec13_e3 sin mes anterior responde sin comparacion', () => {
    // Given: hoy 2026-10-14 y los dos cierres de septiembre, ninguno en agosto
    // When: se pregunta por el mes pasado
    // Then: la frase de septiembre más "No hay con qué comparar: agosto no tiene días cerrados."
    const texto = mesPasado(ctxDe([...SEPTIEMBRE, dia('2026-07-10', 800)], HOY));
    expect(texto).toBe(
      `${INICIO_SEPTIEMBRE} No hay con qué comparar: agosto no tiene días cerrados.`,
    );
    expect(texto).not.toMatch(/\b(más|menos|igual)\b.*\bagosto\b/);
  });

  // @spec13_e4 — "Este mes" cuenta hasta hoy y se compara con los mismos días del mes anterior
  it('spec13_e4 este mes cuenta hasta hoy y se compara con los mismos dias', () => {
    // Given: hoy 2026-10-14, octubre con cierres el 3, el 10 y el 20 (futuro), y septiembre con el 5 y el 19
    // When: se pregunta "cómo voy este mes"
    // Then: se suman el 3 y el 10 contra el 5 de septiembre; el 20 de octubre y el 19 de septiembre no suman
    const cierres = [
      dia('2026-10-03', 1000, 200),
      dia('2026-10-10', 800, 100),
      dia('2026-10-20', 5000),
      ...SEPTIEMBRE,
    ];
    const hecho = responderConsulta(consultaDe('resumenMesActual'), ctxDe(cierres, HOY));
    expect(hecho.frase).toBe(
      'En lo que va de octubre (del 1 al 14) cerraste 2 días: vendiste S/ 1,800.00, gastaste S/ 300.00 y el resultado registrado va en S/ 1,500.00. En los mismos días de septiembre fue S/ 1,100.00 (1 día cerrado), así que vas S/ 400.00 más.',
    );
    expect(hecho.intencion).toBe('resumenMesActual');
    expect(hecho.cifras).toEqual(extraerCifras(hecho.frase));

    // Menos, igual y sin días del mes anterior en esos mismos días.
    const menos = [dia('2026-10-03', 1000, 200), dia('2026-09-05', 1500, 100)];
    expect(esteMes(ctxDe(menos, HOY))).toBe(
      'En lo que va de octubre (del 1 al 14) cerraste 1 día: vendiste S/ 1,000.00, gastaste S/ 200.00 y el resultado registrado va en S/ 800.00. En los mismos días de septiembre fue S/ 1,400.00 (1 día cerrado), así que vas S/ 600.00 menos.',
    );
    const igual = [dia('2026-10-03', 1000, 200), dia('2026-09-05', 900, 100)];
    expect(esteMes(ctxDe(igual, HOY))).toContain('así que vas igual.');
    const sinComparar = [dia('2026-10-03', 1000, 200), dia('2026-09-19', 1200)];
    expect(esteMes(ctxDe(sinComparar, HOY))).toBe(
      'En lo que va de octubre (del 1 al 14) cerraste 1 día: vendiste S/ 1,000.00, gastaste S/ 200.00 y el resultado registrado va en S/ 800.00. No hay con qué comparar: en los mismos días de septiembre no hay días cerrados.',
    );

    // Un cierre de hoy cuenta; sin cierres este mes, la frase fija.
    expect(esteMes(ctxDe([dia('2026-10-14', 500)], HOY))).toContain('cerraste 1 día: vendiste S/ 500.00');
    expect(esteMes(ctxDe([...SEPTIEMBRE, dia('2026-10-20', 5000)], HOY))).toBe(SIN_CIERRES);
  });

  // @spec13_e5 — Los bordes de fecha no se rompen
  it('spec13_e5 los bordes de fecha no se rompen', () => {
    // Given: un 1 de enero, un 31 de marzo, un 1 de marzo bisiesto y un 31 de mayo
    // When: se pregunta por el mes pasado y por este mes
    // Then: el mes calendario correcto, el último día cuenta en su mes y el primero del siguiente no
    // 1 de enero de 2027: el mes pasado es diciembre de 2026; el anterior, noviembre.
    const enero = [
      dia('2026-10-31', 5000),
      dia('2026-11-30', 1000, 200),
      dia('2026-12-01', 2000, 500),
      dia('2026-12-31', 1000),
      dia('2027-01-01', 600, 100),
      dia('2027-01-02', 9000),
    ];
    expect(mesPasado(ctxDe(enero, '2027-01-01'))).toBe(
      'En diciembre cerraste 2 días: vendiste S/ 3,000.00, gastaste S/ 500.00 y el resultado registrado fue S/ 2,500.00. Es S/ 1,700.00 más que en noviembre (1 día cerrado).',
    );
    // El primer día del mes: el tramo es un solo día.
    expect(esteMes(ctxDe(enero, '2027-01-01'))).toBe(
      'En lo que va de enero (solo el 1) cerraste 1 día: vendiste S/ 600.00, gastaste S/ 100.00 y el resultado registrado va en S/ 500.00. En ese mismo día de diciembre fue S/ 1,500.00 (1 día cerrado), así que vas S/ 1,000.00 menos.',
    );
    // El día 1 sin cierre todavía.
    expect(esteMes(ctxDe(enero.slice(0, 4), '2027-01-01'))).toBe(SIN_CIERRES);

    // 31 de marzo: febrero de 28 días comparado con enero de 31; el 1 de marzo es de marzo.
    const marzo = [
      dia('2026-01-31', 1000),
      dia('2026-02-28', 2000, 500),
      dia('2026-03-01', 700),
    ];
    expect(mesPasado(ctxDe(marzo, '2026-03-31'))).toBe(
      'En febrero cerraste 1 día: vendiste S/ 2,000.00, gastaste S/ 500.00 y el resultado registrado fue S/ 1,500.00. Es S/ 500.00 más que en enero (1 día cerrado).',
    );
    expect(esteMes(ctxDe(marzo, '2026-03-31'))).toBe(
      'En lo que va de marzo (del 1 al 31) cerraste 1 día: vendiste S/ 700.00, gastaste S/ 0.00 y el resultado registrado va en S/ 700.00. En los mismos días de febrero fue S/ 1,500.00 (1 día cerrado), así que vas S/ 800.00 menos.',
    );

    // 1 de marzo de 2028 (bisiesto): febrero llega hasta el 29.
    const bisiesto = [
      dia('2028-01-15', 400),
      dia('2028-02-01', 100),
      dia('2028-02-29', 1000),
      dia('2028-03-01', 300),
    ];
    expect(mesPasado(ctxDe(bisiesto, '2028-03-01'))).toBe(
      'En febrero cerraste 2 días: vendiste S/ 1,100.00, gastaste S/ 0.00 y el resultado registrado fue S/ 1,100.00. Es S/ 700.00 más que en enero (1 día cerrado).',
    );
    expect(esteMes(ctxDe(bisiesto, '2028-03-01'))).toBe(
      'En lo que va de marzo (solo el 1) cerraste 1 día: vendiste S/ 300.00, gastaste S/ 0.00 y el resultado registrado va en S/ 300.00. En ese mismo día de febrero fue S/ 100.00 (1 día cerrado), así que vas S/ 200.00 más.',
    );

    // 31 de mayo: abril de 30 días; el 1 de mayo no es de abril.
    const mayo = [dia('2026-03-31', 400), dia('2026-04-30', 900), dia('2026-05-01', 100)];
    expect(mesPasado(ctxDe(mayo, '2026-05-31'))).toBe(
      'En abril cerraste 1 día: vendiste S/ 900.00, gastaste S/ 0.00 y el resultado registrado fue S/ 900.00. Es S/ 500.00 más que en marzo (1 día cerrado).',
    );
  });

  // @spec13_e6 — Jev entiende la pregunta del mes
  it('spec13_e6 jev entiende la pregunta del mes', async () => {
    // Given: el vocabulario de intenciones de la app y el del Worker
    // When: se comparan
    // Then: las dos nuevas existen, con la misma descripción (≤ 120), sinónimos útiles, y el Worker se las ofrece a Jev
    const ids = INTENCIONES.map(i => i.id);
    expect(ids).toEqual(expect.arrayContaining(['resumenMesPasado', 'resumenMesActual']));
    const pasado = INTENCIONES.find(i => i.id === 'resumenMesPasado');
    const actual = INTENCIONES.find(i => i.id === 'resumenMesActual');
    expect(pasado?.descripcion).toMatch(/mes pasado/i);
    expect(pasado?.descripcion).toMatch(/cómo cerré el mes/i);
    expect(actual?.descripcion).toMatch(/ventas del mes/i);
    expect(actual?.descripcion).toMatch(/este mes/i);
    for (const i of [pasado, actual]) {
      expect(i?.descripcion.length).toBeLessThanOrEqual(120);
      expect(i?.sugerida).not.toBeNull();
    }
    expect(pasado?.sugerida).toBe('¿Cómo me fue el mes pasado?');

    // El Worker tiene las mismas intenciones con la misma descripción.
    expect(INTENCIONES_WORKER).toEqual(
      INTENCIONES.map(i => ({ id: i.id, descripcion: i.descripcion })),
    );
    // Y se las ofrece a Jev como opciones de la pregunta.
    const llamadas: Array<{ body: string }> = [];
    global.fetch = (async (_url: string, init: { body: string }) => {
      llamadas.push(init);
      return respuestaSysone({
        intencion: opcion('resumenMesPasado', 0.9),
        dia: opcion('ninguno', 0.9),
      });
    }) as unknown as typeof fetch;
    try {
      const r = await llamar(interpretar('cómo me fue el mes pasado'));
      expect(await jsonDe(r)).toMatchObject({ intencion: 'resumenMesPasado', confianza: 0.9 });
      const { criteria } = JSON.parse(llamadas[0].body).questions.intencion;
      expect(criteria.resumenMesPasado).toBe(pasado?.descripcion);
      expect(criteria.resumenMesActual).toBe(actual?.descripcion);
    } finally {
      global.fetch = original;
    }

    // Y la app acepta la respuesta del clasificador con cualquiera de las dos.
    for (const intencion of ['resumenMesPasado', 'resumenMesActual']) {
      expect(
        interpretarRespuesta({ intencion, producto: 'ninguno', dia: 'ninguno', confianza: 0.9 }),
      ).toEqual({ intencion, dia: 'ninguno', confianza: 0.9 });
    }
    // Las seis sugeridas de siempre no cambian (siete chips no caben con el aviso abierto).
    expect(PREGUNTAS_SUGERIDAS).toHaveLength(6);
  });

  // @spec13_e7 — La ayuda del chat menciona el mes
  it('spec13_e7 la ayuda del chat menciona el mes', () => {
    // Given: el chat abierto
    // When: se escribe "qué puedes hacer" (y las demás formas de pedir ayuda)
    // Then: toda ayuda nombra el mes, termina en "Prueba con una de estas:" y no lleva cifras
    const formas = [
      'ayuda',
      'qué puedes hacer',
      'quién eres',
      'qué eres',
      'qué haces',
      'cómo funciona',
      'qué te puedo preguntar',
      'hola, ayuda',
      'ayuda gracias',
      'ayuda chau',
    ];
    for (const forma of formas) {
      const charla = responderCharla(forma);
      expect({ forma, categoria: charla?.categoria }).toEqual({ forma, categoria: 'ayuda' });
      expect({ forma, texto: charla?.texto }).toEqual({
        forma,
        texto: expect.stringMatching(/\bmes\b/),
      });
      expect(charla?.texto.endsWith('Prueba con una de estas:')).toBe(true);
      expect(extraerCifras(charla?.texto ?? '')).toEqual([]);
    }
  });

  // --- Apoyo del Worker (e8 a e13) -----------------------------------------------------------------

  describe('Worker', () => {
    const NO_ENTIENDE = () => respuestaSysone({ intencion: opcion('noEntendi', 0.9), dia: opcion('ninguno', 0.9) });
    const DUDA = () =>
      respuestaSysone({ intencion: opcion('ventaDelDia', 0.5), dia: opcion('ayer', 0.9) });
    const DEEPSEEK = (intencion: string, confianza: number) =>
      chat({ intencion, dia: 'ninguno', confianza });
    const PREGUNTA = 'cómo me fue el mes pasado';

    // @spec13_e8 — Si Jev no entiende y DeepSeek acierta con confianza, se acepta
    it('spec13_e8 si jev no entiende y deepseek acierta con confianza se acepta', async () => {
      // Given: un Jev que responde noEntendi (0.9) y un DeepSeek que responde resumenMesPasado (0.9)
      // When: llega "interpretar" con "cómo me fue el mes pasado"
      // Then: se responde esa intención, con el modelo de DeepSeek, tras una llamada a Jev y una a DeepSeek
      conOpenRouter(NO_ENTIENDE(), DEEPSEEK('resumenMesPasado', 0.9));
      const r = await llamar(interpretar(PREGUNTA));
      expect(r.status).toBe(200);
      expect(await jsonDe(r)).toEqual({
        intencion: 'resumenMesPasado',
        dia: 'ninguno',
        confianza: 0.9,
        modelo: 'deepseek/deepseek-v4-flash',
      });
      expect(openrouter).toHaveBeenCalledTimes(2);
      expect(llamadasA()[0][0]).toBe(URL_SYSTEMONE);
      expect(llamadasA()[1][0]).toBe(URL_OPENROUTER);

      // Lo mismo si Jev duda: una intención con confianza 0.5.
      conOpenRouter(DUDA(), DEEPSEEK('resumenMesPasado', 0.9));
      const duda = await llamar(interpretar(PREGUNTA));
      expect(await jsonDe(duda)).toEqual({
        intencion: 'resumenMesPasado',
        dia: 'ninguno',
        confianza: 0.9,
        modelo: 'deepseek/deepseek-v4-flash',
      });
      expect(openrouter).toHaveBeenCalledTimes(2);
    });

    // @spec13_e9 — Si DeepSeek no llega a 0.8, se rechaza
    it('spec13_e9 si deepseek no llega a 0.8 se rechaza', async () => {
      // Given: un Jev que responde noEntendi y un DeepSeek con una intención real y confianza 0.7 (o 0.79)
      // When: llega "interpretar"
      // Then: sale noEntendi, nunca la intención de DeepSeek; con 0.8 justo sí se acepta; si DeepSeek dice noEntendi, sale noEntendi
      for (const confianza of [0.7, 0.79, 0.6]) {
        conOpenRouter(NO_ENTIENDE(), DEEPSEEK('resumenMesPasado', confianza));
        const r = await llamar(interpretar(PREGUNTA));
        expect(r.status).toBe(200);
        const cuerpo = await jsonDe(r);
        expect({ confianza, intencion: cuerpo.intencion }).toEqual({
          confianza,
          intencion: 'noEntendi',
        });
        expect(openrouter).toHaveBeenCalledTimes(2);
      }

      conOpenRouter(NO_ENTIENDE(), DEEPSEEK('resumenMesPasado', 0.8));
      expect((await jsonDe(await llamar(interpretar(PREGUNTA)))).intencion).toBe('resumenMesPasado');

      conOpenRouter(NO_ENTIENDE(), DEEPSEEK('noEntendi', 0.95));
      expect((await jsonDe(await llamar(interpretar(PREGUNTA)))).intencion).toBe('noEntendi');

      // Una duda de Jev rechazada también termina en noEntendi, y la app la lee como "No te entendí".
      conOpenRouter(DUDA(), DEEPSEEK('mejorDia', 0.7));
      const dudosa = await jsonDe(await llamar(interpretar(PREGUNTA)));
      expect(dudosa.intencion).toBe('noEntendi');
      expect(interpretarRespuesta(dudosa)?.intencion).toBe('noEntendi');
    });

    // @spec13_e10 — Si Jev está seguro, DeepSeek no se llama
    it('spec13_e10 si jev esta seguro deepseek no se llama', async () => {
      // Given: un Jev con una intención real y confianza de 0.6 o más
      // When: llega "interpretar"
      // Then: sale lo que dijo Jev, con su modelo, y hay una sola llamada a OpenRouter
      for (const confianza of [0.6, 0.95]) {
        conOpenRouter(
          respuestaSysone({
            intencion: opcion('resumenMesPasado', confianza),
            dia: opcion('ninguno', 0.9),
          }),
        );
        const r = await llamar(interpretar(PREGUNTA));
        expect(await jsonDe(r)).toEqual({
          intencion: 'resumenMesPasado',
          dia: 'ninguno',
          confianza,
          modelo: MODELO_REAL_DE_JEV,
        });
        expect(openrouter).toHaveBeenCalledTimes(1);
        expect(llamadasA()[0][0]).toBe(URL_SYSTEMONE);
      }
      expect(UMBRAL_CONFIANZA).toBe(0.6);
    });

    // @spec13_e11 — Si DeepSeek falla o no hay tiempo, sale noEntendi sin error
    it('spec13_e11 si deepseek falla o no hay tiempo sale noEntendi sin error', async () => {
      // Given: un Jev que responde noEntendi y un DeepSeek que falla, responde inválido o no contesta
      // When: llega "interpretar"
      // Then: 200 con noEntendi y sin código de error; sin tiempo ni siquiera se llama a DeepSeek
      const fallas: Array<Response | Error> = [
        errorDeOpenRouter(503, 'No available provider'),
        errorDeOpenRouter(404),
        new Error('Network connection lost'),
        chat('esto no es json'),
        chat({ intencion: 'borrarTodo', dia: 'ninguno', confianza: 0.99 }),
        chat({ intencion: 'resumenMesPasado', dia: 'antier', confianza: 0.99 }),
        chat({ intencion: 'resumenMesPasado', dia: 'ninguno', confianza: 7 }),
        new Response(JSON.stringify({ choices: [] }), { status: 200 }),
      ];
      for (const falla of fallas) {
        conOpenRouter(NO_ENTIENDE(), falla);
        const r = await llamar(interpretar(PREGUNTA));
        expect(r.status).toBe(200);
        const cuerpo = await jsonDe(r);
        expect(cuerpo).toEqual({
          intencion: 'noEntendi',
          dia: 'ninguno',
          confianza: 0.9,
          modelo: MODELO_REAL_DE_JEV,
        });
        expect(cuerpo).not.toHaveProperty('error');
        expect(openrouter).toHaveBeenCalledTimes(2);
      }

      // DeepSeek no contesta: se corta dentro del presupuesto de 7.5 s de la app (que espera 8).
      jest.useFakeTimers();
      conOpenRouter(NO_ENTIENDE(), () => colgada());
      let respuesta: Response | undefined;
      const pendiente = llamar(interpretar(PREGUNTA)).then(r => {
        respuesta = r;
      });
      await jest.advanceTimersByTimeAsync(6999);
      expect(respuesta).toBeUndefined();
      await jest.advanceTimersByTimeAsync(1);
      await pendiente;
      expect(respuesta?.status).toBe(200);
      expect((await jsonDe(respuesta as Response)).intencion).toBe('noEntendi');
      expect(jest.getTimerCount()).toBe(0);
      jest.useRealTimers();

      // A Jev ya se le fue casi todo el presupuesto: queda menos de 500 ms y no se llama a DeepSeek.
      jest.useFakeTimers();
      conOpenRouter(() => {
        jest.setSystemTime(Date.now() + 7200);
        return Promise.resolve(NO_ENTIENDE());
      }, DEEPSEEK('resumenMesPasado', 0.99));
      const sinTiempo = await llamar(interpretar(PREGUNTA));
      expect(sinTiempo.status).toBe(200);
      expect((await jsonDe(sinTiempo)).intencion).toBe('noEntendi');
      expect(openrouter).toHaveBeenCalledTimes(1);
    });

    // @spec13_e12 — A DeepSeek solo viaja el texto de la pregunta
    it('spec13_e12 a deepseek solo viaja el texto de la pregunta', async () => {
      // Given: "interpretar" con "cómo me fue el mes pasado" y un Jev que no entiende
      // When: el Worker llama a DeepSeek
      // Then: el mensaje del usuario es el texto; el resto es lo fijo del Worker, sin historial ni datos
      conOpenRouter(NO_ENTIENDE(), DEEPSEEK('resumenMesPasado', 0.9));
      await llamar(interpretar(PREGUNTA));

      expect(openrouter).toHaveBeenCalledTimes(2);
      const cuerpo = cuerpoDe(1);
      expect(Object.keys(cuerpo).sort()).toEqual([
        'max_tokens',
        'messages',
        'model',
        'provider',
        'reasoning',
        'response_format',
        'temperature',
      ]);
      expect(cuerpo.messages).toHaveLength(2);
      expect(cuerpo.messages[0].role).toBe('system');
      expect(cuerpo.messages[0].content).not.toContain(PREGUNTA);
      expect(cuerpo.messages[1]).toEqual({ role: 'user', content: PREGUNTA });
      expect(cuerpo.provider).toEqual({
        only: ['deepinfra', 'parasail', 'cloudflare'],
        data_collection: 'deny',
        require_parameters: true,
      });
      // La pregunta viaja una sola vez. Con otra pregunta, lo único que cambia en el cuerpo es ese mensaje:
      // todo lo demás es fijo del Worker y no lleva ningún dato.
      expect(llamadasA()[1][1].body?.split(PREGUNTA)).toHaveLength(2);
      conOpenRouter(NO_ENTIENDE(), DEEPSEEK('resumenMesPasado', 0.9));
      await llamar(interpretar('qué día me va peor 123'));
      const otro = cuerpoDe(1);
      expect(otro.messages[1]).toEqual({ role: 'user', content: 'qué día me va peor 123' });
      expect({ ...otro, messages: [otro.messages[0]] }).toEqual({
        ...cuerpo,
        messages: [cuerpo.messages[0]],
      });
      // Es la misma pregunta cerrada: el esquema estricto con las intenciones y los días de la app.
      const esquema = cuerpo.response_format.json_schema.schema;
      expect(esquema.properties.intencion.enum).toEqual(INTENCIONES.map(i => i.id));
      expect(cuerpo.response_format.json_schema.strict).toBe(true);
    });

    // @spec13_e13 — El modelo informado es el que decidió
    it('spec13_e13 el modelo informado es el que decidio', async () => {
      // Given: un Jev que no entiende, con un DeepSeek que acierta y con uno que se rechaza
      // When: el Worker responde
      // Then: `modelo` es el de DeepSeek en el primero y el de Jev en el segundo; solo salen cuatro campos
      conOpenRouter(NO_ENTIENDE(), DEEPSEEK('resumenMesActual', 0.85));
      const acepta = await jsonDe(
        await llamar(interpretar('cómo voy este mes'), {
          ...ENV,
          DEEPSEEK_MODELO: 'otro/modelo',
        }),
      );
      expect(acepta.modelo).toBe('otro/modelo');
      expect(Object.keys(acepta).sort()).toEqual(['confianza', 'dia', 'intencion', 'modelo']);

      conOpenRouter(NO_ENTIENDE(), DEEPSEEK('resumenMesActual', 0.5));
      const rechaza = await jsonDe(await llamar(interpretar('cómo voy este mes')));
      expect(rechaza.modelo).toBe(MODELO_REAL_DE_JEV);
      expect(rechaza.intencion).toBe('noEntendi');
      expect(Object.keys(rechaza).sort()).toEqual(['confianza', 'dia', 'intencion', 'modelo']);
    });
  });

  // @spec13_e14 — Sin internet, el teléfono entiende la pregunta del mes
  it('spec13_e14 sin internet el telefono entiende la pregunta del mes', () => {
    // Given: la red caída y la pregunta "cómo me fue el mes pasado"
    // When: se clasifica en el teléfono
    // Then: resumenMesPasado con 0.6 o más; "cómo voy este mes" es resumenMesActual; "cuánto vendí ayer" sigue igual
    const pasado = [
      '¿Cómo me fue el mes pasado?',
      'como me fue el mes pasado',
      'cuanto vendi el mes pasado',
      'cómo cerré el mes',
      'ventas del mes pasado',
      'cómo me fue en el mes anterior',
    ];
    for (const texto of pasado) {
      const c = clasificarLocal(texto, HOY);
      expect({ texto, intencion: c.intencion }).toEqual({ texto, intencion: 'resumenMesPasado' });
      expect(c.confianza).toBeGreaterThanOrEqual(UMBRAL_CONFIANZA);
    }
    const actual = [
      '¿Cómo voy este mes?',
      'como voy este mes',
      'cuanto vendi este mes',
      'ventas del mes',
      'cómo me va este mes',
      'cuánto llevo este mes',
    ];
    for (const texto of actual) {
      const c = clasificarLocal(texto, HOY);
      expect({ texto, intencion: c.intencion }).toEqual({ texto, intencion: 'resumenMesActual' });
      expect(c.confianza).toBeGreaterThanOrEqual(UMBRAL_CONFIANZA);
    }
    expect(clasificarLocal('cuánto vendí ayer', HOY).intencion).toBe('ventaDelDia');
    expect(clasificarLocal('cómo me fue ayer', HOY).intencion).toBe('ventaDelDia');
  });

  // @spec13_e15 — e2e: "cómo me fue el mes pasado" ya no dice "No te entendí bien"
  it('spec13_e15 e2e como me fue el mes pasado ya no dice no te entendi', async () => {
    // Given: los cierres de septiembre y agosto, y un servidor que entiende "resumen del mes pasado"
    // When: se pregunta "cómo me fue el mes pasado" por el camino completo del chat
    // Then: la frase del mes, sin semáforo, con una sola petición (solo el tipo y el texto); sin red, la frase marcada
    reiniciarEstadoDeRed();
    const ctx = ctxDe([...SEPTIEMBRE, ...AGOSTO], HOY);
    const servidor = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          intencion: 'resumenMesPasado',
          dia: 'ninguno',
          confianza: 0.9,
          modelo: 'deepseek/deepseek-v4-flash',
        }),
    }));
    const respuesta = await consultar(
      servidor as unknown as typeof fetch,
      'https://asistente.ejemplo.test',
      'cómo me fue el mes pasado',
      ctx,
    );
    expect(respuesta.tipo).toBe('respuesta');
    if (respuesta.tipo !== 'respuesta') return;
    expect(respuesta.texto).toBe(
      `${INICIO_SEPTIEMBRE} Es S/ 500.00 más que en agosto (1 día cerrado).`,
    );
    expect(respuesta.semaforo).toBeUndefined();
    expect(respuesta.redactada).toBe(false);
    expect(respuesta.consulta.intencion).toBe('resumenMesPasado');
    expect(servidor).toHaveBeenCalledTimes(1);
    const [, init] = servidor.mock.calls[0] as unknown as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      tipo: 'interpretar',
      texto: 'cómo me fue el mes pasado',
    });

    // Sin red, el teléfono lo entiende y responde la misma frase, avisando que fue sin internet.
    reiniciarEstadoDeRed();
    const caida = jest.fn(async () => {
      throw new Error('Network request failed');
    });
    const sinRed = await consultar(
      caida as unknown as typeof fetch,
      'https://asistente.ejemplo.test',
      'cómo me fue el mes pasado',
      ctx,
    );
    expect(sinRed.tipo).toBe('respuesta');
    if (sinRed.tipo !== 'respuesta') return;
    expect(sinRed.texto).toBe(respuesta.texto);
    expect(sinRed.sinInternet).toBe(true);
    reiniciarEstadoDeRed();
  });

  // @spec13_e16 — El mes no hereda del hilo ni pide semáforo
  it('spec13_e16 el mes no hereda del hilo ni pide semaforo', async () => {
    // Given: la pregunta anterior con día (ayer) y otra con producto (rachi)
    // When: sigue "¿y este mes?" y "¿y el mes pasado?"
    // Then: la consulta resuelta es la del mes, sin día ni producto heredados, sin juicio y sin petición para juzgar
    reiniciarEstadoDeRed();
    const ctx = ctxDe([...SEPTIEMBRE, ...AGOSTO, dia('2026-10-03', 900)], HOY);
    const previas: Consulta[] = [
      { intencion: 'ventaDelDia', dia: 'ayer', confianza: 0.9 },
      { intencion: 'cuantoPreparar', producto: 'p-rachi', dia: 'ninguno', confianza: 0.9 },
    ];
    const casos: Array<[string, IntencionId]> = [
      ['¿y este mes?', 'resumenMesActual'],
      ['¿y el mes pasado?', 'resumenMesPasado'],
    ];
    for (const previa of previas) {
      for (const [texto, intencion] of casos) {
        const servidor = jest.fn(async () => ({
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ intencion, dia: 'ninguno', confianza: 0.9, modelo: 'x' }),
        }));
        const r = await consultar(
          servidor as unknown as typeof fetch,
          'https://asistente.ejemplo.test',
          texto,
          ctx,
          previa,
        );
        expect(r.tipo).toBe('respuesta');
        if (r.tipo !== 'respuesta') continue;
        expect(r.consulta.intencion).toBe(intencion);
        expect(r.consulta.dia).toBe('ninguno');
        expect(r.consulta.producto).toBeUndefined();
        expect(r.semaforo).toBeUndefined();
        expect(servidor).toHaveBeenCalledTimes(1);
        expect(JSON.parse((servidor.mock.calls[0] as unknown as [string, { body: string }])[1].body).tipo).toBe(
          'interpretar',
        );
      }
    }
    for (const id of ['resumenMesPasado', 'resumenMesActual'] as IntencionId[]) {
      expect(esJuzgable(id)).toBe(false);
      expect(senalesDeJuicio(consultaDe(id), ctx)).toBeNull();
    }
  });
});

// --- Apoyo del Worker: llamadas simuladas a OpenRouter, como en worker.test.ts ---------------------

const URL_WORKER = 'https://asistente.ejemplo.test/';
const URL_OPENROUTER = 'https://openrouter.ai/api/v1/chat/completions';
const URL_SYSTEMONE = 'https://openrouter.ai/api/v1/systemone';
const CLAVE = 'clave-de-prueba-que-no-existe-0123456789';
const ENV: Record<string, unknown> = {
  OPENROUTER_API_KEY: CLAVE,
  JEV_MODELO: 'jev-latest',
  DEEPSEEK_MODELO: 'deepseek/deepseek-v4-flash',
  DEEPSEEK_PROVEEDORES: 'deepinfra, parasail ,cloudflare',
};
const MODELO_REAL_DE_JEV = 'typesafe/jev-1.13-20260917';

type Init = { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal };

const llamar = (cuerpo: unknown, env: Record<string, unknown> = ENV) =>
  worker.fetch(
    new Request(URL_WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }),
    env,
  );
const interpretar = (texto: string) => ({ tipo: 'interpretar', texto });
const jsonDe = async (r: Response) => JSON.parse(await r.text());

/** Una respuesta de OpenRouter (/chat/completions) cuyo mensaje es `contenido`. */
const chat = (contenido: unknown) =>
  new Response(
    JSON.stringify({
      id: 'gen-1',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: typeof contenido === 'string' ? contenido : JSON.stringify(contenido),
          },
        },
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
const opcion = (choice: unknown, confidence?: unknown) => ({ type: 'choice', choice, confidence });
const respuestaSysone = (answers: Record<string, unknown>) =>
  new Response(
    JSON.stringify({ id: 'gen-dec-1', model: MODELO_REAL_DE_JEV, provider: 'TypeSafe', answers }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
const errorDeOpenRouter = (status: number, mensaje = 'No endpoints found') =>
  new Response(JSON.stringify({ error: { code: status, message: mensaje } }), { status });

let openrouter: jest.Mock;
const original = global.fetch;
const conOpenRouter = (...respuestas: Array<(() => Promise<Response>) | Response | Error>) => {
  openrouter = jest.fn();
  respuestas.forEach(r =>
    openrouter.mockImplementationOnce(() =>
      r instanceof Error
        ? Promise.reject(r)
        : typeof r === 'function'
        ? r()
        : Promise.resolve(r.clone()),
    ),
  );
  global.fetch = openrouter as unknown as typeof fetch;
  return openrouter;
};
const llamadasA = (): [string, Init][] => openrouter.mock.calls as unknown as [string, Init][];
const cuerpoDe = (n: number) => JSON.parse(llamadasA()[n][1].body ?? '{}');
/** Una llamada que nunca contesta: solo termina cuando el Worker la corta. */
const colgada = () =>
  new Promise<Response>((_resolver, rechazar) => {
    const senal = (openrouter.mock.calls[openrouter.mock.calls.length - 1][1] as Init).signal;
    senal?.addEventListener('abort', () => rechazar(new Error('abortado')));
  });

afterEach(() => {
  global.fetch = original;
  jest.restoreAllMocks();
  jest.useRealTimers();
});
