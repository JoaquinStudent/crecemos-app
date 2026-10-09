/**
 * Tests del Sprint-08. Generados desde sdd/spec/Sprint-08-jev/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { fechaLocal } from '@dominio/fecha';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type {
  Cierre,
  Consulta,
  ContextoAnalisis,
  FechaNegocio,
  Gasto,
  Hecho,
  LineaCierre,
  Perfil,
  Producto,
} from '@dominio/tipos';
import { interpretarRespuesta, responderConsulta } from '@analisis/intenciones';
import {
  armarHechoParaJuicio,
  ETIQUETA_SEMAFORO,
  interpretarJuicio,
  senalesDeJuicio,
} from '@analisis/semaforo';
import { extraerCifras, validarRedaccion } from '@analisis/validarRedaccion';
import { consultar, redactarRespuesta } from '@services/jev';

// Mediodía del 2026-10-07 en Lima: solo alimenta el instante de creación; "hoy" y la fecha de cada cierre son explícitas.
const ahora = new Date('2026-10-07T12:00:00-05:00');
const HOY: FechaNegocio = '2026-10-07';

const linea = (
  nombre: string,
  preparadas: number,
  sobrantes: number,
  precioUnitario: number,
  costoUnitario: number,
): LineaCierre => ({
  productoId: `p-${nombre.toLowerCase()}`,
  nombre,
  preparadas,
  sobrantes,
  precioUnitario,
  costoUnitario,
});

interface Opciones {
  lineas?: LineaCierre[];
  gastos?: Gasto[];
  abreCiclo?: boolean;
  montoYape?: number;
  yapePendiente?: boolean;
}

// Cierre armado a mano: la fecha es explícita y el reloj no decide nada.
const cierreDe = (
  fecha: FechaNegocio,
  { lineas = [], gastos = [], abreCiclo = false, montoYape = 0, yapePendiente = false }: Opciones = {},
): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas,
  montoYape,
  yapePendiente,
  gastos,
  abreCiclo,
  creadoEn: ahora.toISOString(),
  actualizadoEn: ahora.toISOString(),
});

const ctxDe = (cierres: Cierre[], productos: Producto[] = [], hoy: FechaNegocio = HOY): ContextoAnalisis => ({
  cierres,
  productos,
  hoy,
});

// "Jev interpreta la pregunta como la intención X": la respuesta ya parseada del clasificador.
const jevInterpreta = (respuesta: unknown): Consulta => {
  const consulta = interpretarRespuesta(respuesta);
  if (consulta === null) throw new Error('El clasificador no devolvió una consulta válida');
  return consulta;
};

// --- Apoyo de e7, e8 y e10: un servidor intermedio simulado -------------------------------------

const URL_JEV = 'https://asistente.ejemplo.test';
const RUTA_SEMILLA = join(__dirname, '..', '..', 'seed', 'semilla.json');

const respuestaJson = (cuerpo: unknown, ok = true, status = 200) =>
  ({ ok, status, text: async () => JSON.stringify(cuerpo) } as unknown as Response);

/** Lo que responde el servidor a "interpretar": la intención ya clasificada. */
const interpretacion = (intencion: string, dia = 'ninguno') => ({
  intencion,
  producto: 'ninguno',
  dia,
  confianza: 0.95,
  modelo: 'typesafe/jev-1.13-20260917',
});

type Llamada = [string, { method?: string; headers?: Record<string, string>; body?: string }];

/** Las peticiones que recibió el fetch simulado, tal como salieron de la app. */
const llamadasDe = (fetchSim: jest.Mock): Llamada[] => fetchSim.mock.calls as unknown as Llamada[];

/** La app de Freddy con los datos de ejemplo: el perfil, los productos y los 75 cierres. */
const datosDeFreddy = () => {
  const validada = validarSemilla(JSON.parse(readFileSync(RUTA_SEMILLA, 'utf8')));
  if (!validada.ok) throw new Error('La semilla del repositorio no valida');
  const { cierres, productos } = materializarSemilla(validada.semilla, ahora);
  const perfil: Perfil = {
    nombre: 'Freddy',
    negocio: 'Anticuchos El Buen Sabor',
    ubicacion: 'Mercado de Surquillo',
    aceptaYape: true,
    yapeAjeno: true,
    yapeNumero: '987654321',
    yapeTitular: 'Rosa',
    yapeParentesco: 'esposa',
    actualizadoEn: ahora.toISOString(),
  };
  return { cierres, productos, perfil, hoy: fechaLocal(ahora) };
};

/** Nada de lo que es de Freddy (perfil y cierres) aparece en lo que salió por la red. */
const noFiltraNadaDeFreddy = (salida: string, cierres: Cierre[], perfil: Perfil) => {
  for (const privado of [
    perfil.nombre,
    perfil.negocio,
    perfil.ubicacion,
    perfil.yapeNumero,
    perfil.yapeTitular,
    perfil.yapeParentesco,
    'montoYape',
    'yapePendiente',
    'lineas',
    'gastos',
    'Authorization',
  ]) {
    expect(salida).not.toContain(privado);
  }
  for (const cierre of cierres) {
    expect(salida).not.toContain(cierre.id);
    expect(salida).not.toContain(cierre.fecha);
  }
};

/** Una venta de ayer de S/ 205.00 y la frase fija que el código arma con ella. */
const FRASE_AYER = 'Ayer, martes 6 de octubre, vendiste S/ 205.00.';
const ventaDeAyer = (): ContextoAnalisis =>
  ctxDe([
    cierreDe('2026-10-06', {
      lineas: [linea('Anticucho', 7, 0, 10, 8.2), linea('Pancita', 15, 0, 9, 8)],
    }),
  ]);

const CODIGOS_TECNICOS = /SIN_RED|TIEMPO_AGOTADO|RESPUESTA_INVALIDA|REDACCION_DESCARTADA|NO_DISPONIBLE|Network|Abort|HTTP|\b5\d\d\b|undefined|error/i;


// --- Apoyo de e11 y e17: un servidor intermedio que contesta según el tipo de petición ------------

/** Lo que contesta el servidor a "juzgar": el semáforo y su confianza. */
const juicioDe = (semaforo: string | null, confianza: number) => ({
  semaforo,
  confianza,
  modelo: 'typesafe/jev-1.13-20260917',
});

/** El ciclo anterior le dejó S/ 269 y el actual S/ 191: "Ganaste S/ 78.00 menos que el ciclo pasado." */
const ctxCompararCiclo = (): ContextoAnalisis =>
  ctxDe([
    cierreDe('2026-09-14', {
      abreCiclo: true,
      lineas: [linea('Anticucho', 40, 0, 10, 8)],
      gastos: [{ categoria: 'mercaderia', monto: 131 }],
    }),
    cierreDe('2026-09-28', {
      abreCiclo: true,
      lineas: [linea('Anticucho', 30, 0, 10, 8)],
      gastos: [{ categoria: 'mercaderia', monto: 109 }],
    }),
  ]);
const FRASE_CICLO = 'Ganaste S/ 78.00 menos que el ciclo pasado.';
const REDACCION_CICLO = 'Este ciclo te quedaron S/ 78.00 menos que en el pasado.';

interface ServidorSimulado {
  fetch: jest.Mock;
  /** Los tipos de petición que llegaron, en orden. */
  tipos: () => string[];
  /** Cuántas peticiones estuvieron en vuelo a la vez, como máximo. */
  simultaneas: () => number;
}

/** Un servidor que contesta a `interpretar`, `redactar` y `juzgar`; cada respuesta tarda un instante. */
const servidorSimulado = (
  contesta: Record<'interpretar' | 'redactar' | 'juzgar', () => Promise<Response>>,
): ServidorSimulado => {
  let enVuelo = 0;
  let maximo = 0;
  const f = jest.fn(async (_url: string, init: { body?: string }) => {
    const tipo = JSON.parse(init.body ?? '{}').tipo as 'interpretar' | 'redactar' | 'juzgar';
    enVuelo += 1;
    maximo = Math.max(maximo, enVuelo);
    try {
      await new Promise(resolver => setTimeout(resolver, 0));
      return await contesta[tipo]();
    } finally {
      enVuelo -= 1;
    }
  });
  return {
    fetch: f,
    tipos: () => llamadasDe(f).map(([, init]) => JSON.parse(init.body ?? '{}').tipo),
    simultaneas: () => maximo,
  };
};
const responde = (cuerpo: unknown) => () => Promise.resolve(respuestaJson(cuerpo));

describe('SPEC-08: Chat "Preguntarle a mis datos" con Jev', () => {
  // @spec08_e1 — Una pregunta sobre un día se responde con la cifra del dominio
  it('spec08_e1 una pregunta sobre un dia se responde con la cifra del dominio', () => {
    // Given: hoy 2026-10-07, un cierre del 2026-10-06 con venta de S/ 205.00, y que Jev interpreta "¿cuánto vendí ayer?" como la intención "venta de un día" con el día "ayer"
    // When: se calcula la respuesta
    // Then: la respuesta es "Ayer, martes 6 de octubre, vendiste S/ 205.00."
    // Venta del 6 de octubre: 7 anticuchos × S/ 10 + 15 pancitas × S/ 9 = 70 + 135 = S/ 205.00
    const cierres = [
      cierreDe('2026-10-06', { lineas: [linea('Anticucho', 7, 0, 10, 8.2), linea('Pancita', 15, 0, 9, 8)] }),
    ];
    const consulta = jevInterpreta({
      intencion: 'ventaDelDia',
      producto: 'ninguno',
      dia: 'ayer',
      confianza: 0.95,
    });

    const hecho = responderConsulta(consulta, ctxDe(cierres));

    expect(hecho.frase).toBe('Ayer, martes 6 de octubre, vendiste S/ 205.00.');
    expect(hecho.intencion).toBe('ventaDelDia');
  });

  // @spec08_e2 — El peor día sale del día flojo
  it('spec08_e2 el peor dia sale del dia flojo', () => {
    // Given: 4 semanas de cierres donde los miércoles ganan en promedio S/ 40.00 y el promedio de todos los días es S/ 85.00, y que Jev interpreta "¿qué día me va peor?" como la intención "peor día"
    // When: se calcula la respuesta
    // Then: la respuesta es "Los miércoles son tu día más flojo: ganas S/ 45.00 menos que tu promedio."
    // 5 semanas, de miércoles a sábado: los 5 miércoles ganan S/ 40.00 (4 × 10) y los otros 15 días
    // S/ 100.00 (10 × 10), así que el promedio de todos los días es (5 × 40 + 15 × 100) / 20 = S/ 85.00.
    const semanas = [
      ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
      ['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'],
      ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'],
      ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'],
      ['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'],
    ];
    const cierres = semanas.flatMap((dias, semana) =>
      dias.map((fecha, i) =>
        cierreDe(fecha, {
          abreCiclo: (semana === 0 && i === 0) || (semana === 3 && i === 0),
          lineas: [linea('Anticucho', i === 0 ? 4 : 10, 0, 10, 0)],
        }),
      ),
    );
    const consulta = jevInterpreta({
      intencion: 'peorDia',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.9,
    });

    const hecho = responderConsulta(consulta, ctxDe(cierres));

    expect(hecho.frase).toBe(
      'Los miércoles son tu día más flojo: ganas S/ 45.00 menos que tu promedio.',
    );
    expect(hecho.intencion).toBe('peorDia');
  });

  // @spec08_e3 — El producto que más deja sale de la ganancia por producto
  it('spec08_e3 el producto que mas deja sale de la ganancia por producto', () => {
    // Given: 410 porciones de pancita que dejan S/ 1.00 cada una y 270 de anticucho que dejan S/ 1.80 cada una, y que Jev interpreta "¿cuál me deja más?" como la intención "producto que más deja"
    // When: se calcula la respuesta
    // Then: la respuesta es "El anticucho es el que más te deja: S/ 1.80 por porción, S/ 486.00 en total."
    // Octubre: pancita 220 − 20 + 150 + 60 = 410 porciones que dejan S/ 1.00; anticucho 150 − 10 + 130 = 270 que dejan S/ 1.80.
    const cierres = [
      cierreDe('2026-10-01', {
        lineas: [linea('Pancita', 220, 20, 9, 8), linea('Anticucho', 150, 10, 10, 8.2)],
      }),
      cierreDe('2026-10-02', {
        lineas: [linea('Pancita', 150, 0, 9, 8), linea('Anticucho', 130, 0, 10, 8.2)],
      }),
      cierreDe('2026-10-03', { lineas: [linea('Pancita', 60, 0, 9, 8)] }),
    ];
    const consulta = jevInterpreta({
      intencion: 'productoQueMasDeja',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.88,
    });

    const hecho = responderConsulta(consulta, ctxDe(cierres));

    expect(hecho.frase).toBe(
      'El anticucho es el que más te deja: S/ 1.80 por porción, S/ 486.00 en total.',
    );
    expect(hecho.intencion).toBe('productoQueMasDeja');
  });

  // @spec08_e4 — Lo que tiene por cobrar sale de los cobros
  it('spec08_e4 lo que tiene por cobrar sale de los cobros', () => {
    // Given: hoy 2026-10-07 y S/ 120.00 por cobrar con el pago más antiguo del 2026-09-29, y que Jev interpreta "¿cuánto me deben?" como la intención "cuánto por cobrar"
    // When: se calcula la respuesta
    // Then: la respuesta es "Tienes S/ 120.00 por cobrar desde el 29 de septiembre."
    // S/ 70 del 2026-09-29 + S/ 50 del 2026-10-02 = S/ 120 por cobrar; el más antiguo es del 29 de septiembre
    const cierres = [
      cierreDe('2026-09-29', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 20, 0, 10, 8.2)],
        montoYape: 70,
        yapePendiente: true,
      }),
      cierreDe('2026-10-02', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 20, 0, 10, 8.2)],
        montoYape: 50,
        yapePendiente: true,
      }),
    ];
    const consulta = jevInterpreta({
      intencion: 'cuantoPorCobrar',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.97,
    });

    const hecho = responderConsulta(consulta, ctxDe(cierres));

    expect(hecho.frase).toBe('Tienes S/ 120.00 por cobrar desde el 29 de septiembre.');
    expect(hecho.intencion).toBe('cuantoPorCobrar');
  });

  // @spec08_e5 — Con poca confianza, no inventa
  it('spec08_e5 con poca confianza no inventa', () => {
    // Given: que Jev responde la intención con una confianza de 0.4 (el mínimo es 0.6)
    // When: se interpreta la pregunta
    // Then: la pantalla dice "No entendí tu pregunta. Prueba con una de estas:", muestra las preguntas sugeridas y no muestra ninguna cifra
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e6 — Sin internet, el apartado lo dice sin error técnico
  it('spec08_e6 sin internet el apartado lo dice sin error tecnico', () => {
    // Given: la red caída
    // When: se abre "Preguntarle a mis datos" y se toca "Preguntar"
    // Then: la pantalla dice "Necesitas internet para esto" y no muestra ningún código ni mensaje técnico
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e7 — A Jev solo viaja el texto de la pregunta
  it('spec08_e7 a jev solo viaja el texto de la pregunta', () => {
    // Given: un perfil con nombre, número de Yape y 75 cierres
    // When: se pregunta "¿cuánto vendí ayer?"
    // Then: la petición para interpretar es exactamente el tipo "interpretar" con ese texto, y no contiene el nombre, el Yape ni ningún monto de un cierre
    return (async () => {
      const { cierres, productos, perfil, hoy } = datosDeFreddy();
      expect(cierres).toHaveLength(75);
      const fetchSim = jest
        .fn()
        .mockResolvedValueOnce(respuestaJson(interpretacion('ventaDelDia', 'ayer')))
        .mockResolvedValue(respuestaJson({ texto: 'Ayer vendiste lo de siempre.' }));

      await consultar(fetchSim as unknown as typeof fetch, URL_JEV, '¿cuánto vendí ayer?', {
        cierres,
        productos,
        hoy,
      });

      // La primera petición es la de interpretar: solo el tipo y el texto de la pregunta.
      const [url, init] = llamadasDe(fetchSim)[0];
      expect(url).toBe(URL_JEV);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body ?? '')).toEqual({
        tipo: 'interpretar',
        texto: '¿cuánto vendí ayer?',
      });
      // El único encabezado es el tipo de contenido: ni Authorization ni cookies ni datos de Freddy.
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      // Ni el nombre, ni el Yape, ni ningún dato de un cierre salen del teléfono.
      noFiltraNadaDeFreddy(JSON.stringify(llamadasDe(fetchSim)[0]), cierres, perfil);
    })();
  });

  // @spec08_e8 — Al redactor solo viaja el hecho ya calculado
  it('spec08_e8 al redactor solo viaja el hecho ya calculado', () => {
    // Given: la respuesta calculada "Ayer, martes 6 de octubre, vendiste S/ 205.00."
    // When: se pide la redacción
    // Then: la petición es exactamente el tipo "redactar" con la intención y las cifras de ese hecho, y no contiene el perfil, el Yape ni ningún cierre
    return (async () => {
      const { cierres, perfil } = datosDeFreddy();
      const hecho = responderConsulta(
        jevInterpreta({ intencion: 'ventaDelDia', producto: 'ninguno', dia: 'ayer', confianza: 0.9 }),
        ventaDeAyer(),
      );
      expect(hecho.frase).toBe(FRASE_AYER);
      const fetchSim = jest
        .fn()
        .mockResolvedValue(respuestaJson({ texto: 'Ayer, martes 6 de octubre, te entraron S/ 205.00.' }));

      const resultado = await redactarRespuesta(fetchSim as unknown as typeof fetch, URL_JEV, hecho);

      expect(resultado.ok).toBe(true);
      expect(fetchSim).toHaveBeenCalledTimes(1);
      const [url, init] = llamadasDe(fetchSim)[0];
      expect(url).toBe(URL_JEV);
      // Exactamente el tipo "redactar" y el hecho ya calculado: la intención, la frase y las cifras.
      expect(JSON.parse(init.body ?? '')).toEqual({
        tipo: 'redactar',
        hecho: { intencion: 'ventaDelDia', frase: FRASE_AYER, cifras: ['6', '205.00'] },
      });
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      // El perfil, el Yape y los cierres no viajan.
      noFiltraNadaDeFreddy(JSON.stringify(llamadasDe(fetchSim)[0]), cierres, perfil);
    })();
  });

  // @spec08_e9 — Una redacción con una cifra distinta se descarta
  it('spec08_e9 una redaccion con una cifra distinta se descarta', () => {
    // Given: el hecho "vendiste S/ 205.00" y un redactor que responde "Ayer vendiste S/ 250.00"
    // When: se valida la redacción
    // Then: se descarta y la pantalla muestra la frase fija con "S/ 205.00"
    const frase = 'vendiste S/ 205.00';
    const hecho: Hecho = { intencion: 'ventaDelDia', frase, cifras: extraerCifras(frase) };

    const resultado = validarRedaccion('Ayer vendiste S/ 250.00', hecho);

    // Se descarta: no hay texto que mostrar, y lo que se muestra es la frase fija del código.
    expect(resultado).toEqual({ ok: false, motivo: 'CIFRA_NUEVA' });
    expect(hecho.frase).toContain('S/ 205.00');
    // Con la cifra correcta, en cambio, la redacción sí pasa.
    expect(validarRedaccion('Ayer vendiste S/ 205.00', hecho)).toEqual({
      ok: true,
      texto: 'Ayer vendiste S/ 205.00',
    });
  });

  // @spec08_e10 — Si el redactor falla o tarda, se muestra la frase fija
  it('spec08_e10 si el redactor falla o tarda se muestra la frase fija', () => {
    // Given: un redactor que no responde en 8 segundos o devuelve un error
    // When: se pide la redacción
    // Then: la pantalla muestra la frase fija con la cifra calculada, sin ningún mensaje técnico
    return (async () => {
      const ctx = ventaDeAyer();
      const pregunta = '¿cuánto vendí ayer?';
      const comoLaVeFreddy = (r: unknown) => {
        expect(r).toMatchObject({ tipo: 'respuesta', texto: FRASE_AYER, redactada: false });
        expect(JSON.stringify(r)).not.toMatch(CODIGOS_TECNICOS);
        expect((r as { texto: string }).texto).toContain('S/ 205.00');
      };

      // (a) El redactor devuelve un error: se muestra la frase fija.
      const conError = jest
        .fn()
        .mockResolvedValueOnce(respuestaJson(interpretacion('ventaDelDia', 'ayer')))
        .mockResolvedValueOnce(respuestaJson({ error: 'NO_DISPONIBLE' }, false, 502));
      comoLaVeFreddy(await consultar(conError as unknown as typeof fetch, URL_JEV, pregunta, ctx));
      expect(conError).toHaveBeenCalledTimes(2);

      // (b) El redactor no responde en 8 segundos: se corta y se muestra la frase fija.
      jest.useFakeTimers();
      try {
        const colgado = jest
          .fn()
          .mockResolvedValueOnce(respuestaJson(interpretacion('ventaDelDia', 'ayer')))
          .mockImplementationOnce(
            (_url: unknown, init?: { signal?: AbortSignal }) =>
              new Promise<Response>((_resolver, rechazar) => {
                init?.signal?.addEventListener('abort', () => {
                  const aborto = new Error('Aborted');
                  aborto.name = 'AbortError';
                  rechazar(aborto);
                });
              }),
          );
        let resultado: unknown;
        const pendiente = consultar(colgado as unknown as typeof fetch, URL_JEV, pregunta, ctx).then(
          r => {
            resultado = r;
          },
        );

        await jest.advanceTimersByTimeAsync(7999);
        expect(resultado).toBeUndefined();
        await jest.advanceTimersByTimeAsync(1);
        await pendiente;

        comoLaVeFreddy(resultado);
        expect(colgado).toHaveBeenCalledTimes(2);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    })();
  });

  // @spec08_e11 — Nada se envía sin tocar el botón
  it('spec08_e11 nada se envia sin tocar el boton', () => {
    // Given: la pantalla "Preguntarle a mis datos" con una pregunta escrita
    // When: se abre la pantalla y luego se toca "Preguntar"
    // Then: no hay ninguna petición de red al abrir ni al escribir, y al tocar el botón se hace 1 petición para interpretar y, si hay respuesta, 1 para redactar y, solo en las intenciones que se pueden juzgar, 1 para juzgar (las dos últimas se piden a la vez)
    // (La parte de la pantalla —abrir y escribir sin enviar— la prueba la oleada C; aquí se prueba el
    // servicio que el botón dispara: no hace nada hasta que se lo llama y luego pide exactamente esto.)
    return (async () => {
      const pregunta = '¿cómo voy contra el ciclo pasado?';
      const juzgable = servidorSimulado({
        interpretar: responde(interpretacion('compararCiclo')),
        redactar: responde({ texto: REDACCION_CICLO }),
        juzgar: responde(juicioDe('ojo', 0.8)),
      });
      // Antes de tocar "Preguntar" no hay ninguna petición.
      expect(juzgable.fetch).not.toHaveBeenCalled();

      const r = await consultar(
        juzgable.fetch as unknown as typeof fetch,
        URL_JEV,
        pregunta,
        ctxCompararCiclo(),
      );

      // Intención juzgable: 1 para interpretar y, después, 1 para redactar y 1 para juzgar a la vez.
      expect(r).toMatchObject({ tipo: 'respuesta', redactada: true, semaforo: 'ojo' });
      expect(juzgable.fetch).toHaveBeenCalledTimes(3);
      const tipos = juzgable.tipos();
      expect(tipos[0]).toBe('interpretar');
      expect([...tipos.slice(1)].sort()).toEqual(['juzgar', 'redactar']);
      expect(juzgable.simultaneas()).toBe(2);

      // Intención que no se juzga: 1 para interpretar y 1 para redactar, ninguna para juzgar.
      const simple = servidorSimulado({
        interpretar: responde(interpretacion('ventaDelDia', 'ayer')),
        redactar: responde({ texto: 'Ayer, martes 6 de octubre, te entraron S/ 205.00.' }),
        juzgar: responde(juicioDe('bien', 0.9)),
      });
      await consultar(
        simple.fetch as unknown as typeof fetch,
        URL_JEV,
        '¿cuánto vendí ayer?',
        ventaDeAyer(),
      );
      expect(simple.tipos()).toEqual(['interpretar', 'redactar']);

      // Sin respuesta que mostrar (no la entendió): solo la de interpretar.
      const dudosa = servidorSimulado({
        interpretar: responde({ ...interpretacion('compararCiclo'), confianza: 0.3 }),
        redactar: responde({ texto: REDACCION_CICLO }),
        juzgar: responde(juicioDe('ojo', 0.8)),
      });
      await consultar(
        dudosa.fetch as unknown as typeof fetch,
        URL_JEV,
        'algo raro',
        ctxCompararCiclo(),
      );
      expect(dudosa.tipos()).toEqual(['interpretar']);
    })();
  });

  // @spec08_e12 — e2e: preguntar con los datos de ejemplo
  it('spec08_e12 e2e preguntar con los datos de ejemplo', () => {
    // Given: la app con la semilla cargada y servidores simulados de Jev y del redactor
    // When: se abre "Preguntarle a mis datos" y se pregunta "¿qué día me va peor?"
    // Then: la pantalla muestra una respuesta que nombra "miércoles" y una cifra en soles que coincide con la calculada por el código
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e13 — El chat muestra la pregunta y la respuesta, en orden
  it('spec08_e13 el chat muestra la pregunta y la respuesta en orden', () => {
    // Given: el chat abierto y la respuesta calculada "Ayer, martes 6 de octubre, vendiste S/ 205.00."
    // When: se escribe "¿cuánto vendí ayer?" y se toca "Preguntar"
    // Then: aparecen dos burbujas en orden, primero la pregunta y debajo la respuesta, y el campo de texto queda vacío y listo para otra pregunta
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e14 — El botón flotante de Inicio abre el chat
  it('spec08_e14 el boton flotante de inicio abre el chat', () => {
    // Given: la app con la semilla cargada, en Inicio
    // When: se toca el botón flotante "Preguntar"
    // Then: se abre el chat con las preguntas sugeridas visibles, y "Atrás" vuelve a Inicio sin haber enviado ninguna petición
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e15 — Jev juzga el resultado ya calculado
  it('spec08_e15 jev juzga el resultado ya calculado', () => {
    // Given: la respuesta calculada "Ganaste S/ 78.00 menos que el ciclo pasado." de la intención "comparar ciclo" y un Jev que juzga "ojo" con confianza de 0.8
    // When: se pide el juicio
    // Then: la respuesta lleva el semáforo "Ojo" junto a la frase calculada
    // Ciclo anterior: venta 400 − gastos 131 = te queda 269. Ciclo actual: 300 − 109 = 191 (−29 %).
    const cierres = [
      cierreDe('2026-09-14', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 40, 0, 10, 8)],
        gastos: [{ categoria: 'mercaderia', monto: 131 }],
      }),
      cierreDe('2026-09-28', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 30, 0, 10, 8)],
        gastos: [{ categoria: 'mercaderia', monto: 109 }],
      }),
    ];
    const ctx = ctxDe(cierres);
    const consulta = jevInterpreta({
      intencion: 'compararCiclo',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.9,
    });
    const hecho = responderConsulta(consulta, ctx);
    expect(hecho.frase).toBe('Ganaste S/ 78.00 menos que el ciclo pasado.');
    const senales = senalesDeJuicio(consulta, ctx);
    expect(senales).toEqual({ tendencia: 'baja', magnitud: 'grande' });

    // Un Jev simulado juzga "ojo" con confianza de 0.8
    const juicio = interpretarJuicio({ semaforo: 'ojo', confianza: 0.8 });

    expect(juicio).toEqual({ semaforo: 'ojo', confianza: 0.8 });
    // La respuesta lleva la palabra "Ojo" junto a la frase calculada (que no cambia)
    expect(ETIQUETA_SEMAFORO[juicio?.semaforo ?? 'bien']).toBe('Ojo');
    expect(ETIQUETA_SEMAFORO.ojo).toBe('Ojo');
    expect(hecho.frase).toBe('Ganaste S/ 78.00 menos que el ciclo pasado.');
  });

  // @spec08_e16 — A Jev solo viaja el hecho calculado y señales con nombre
  it('spec08_e16 a jev solo viaja el hecho calculado y señales con nombre', () => {
    // Given: un perfil con nombre, número de Yape y 75 cierres, y la respuesta calculada "Ganaste S/ 78.00 menos que el ciclo pasado."
    // When: se pide el juicio
    // Then: la petición es exactamente el tipo "juzgar" con la intención, la frase, las cifras y las señales con nombre (tendencia y magnitud), y no contiene el perfil, el Yape ni ningún cierre
    // (La petición de red la arma el servicio en la oleada B3; aquí se prueba su cuerpo: lo único que puede viajar.)
    const { cierres, productos, perfil, hoy } = datosDeFreddy();
    const ctx = ctxDe(cierres, productos, hoy);
    const consulta = jevInterpreta({
      intencion: 'compararCiclo',
      producto: 'ninguno',
      dia: 'ninguno',
      confianza: 0.9,
    });
    const hecho = responderConsulta(consulta, ctx);
    expect(hecho.frase).toBe('Ganaste S/ 78.00 menos que el ciclo pasado.');
    const senales = senalesDeJuicio(consulta, ctx);
    expect(senales).not.toBeNull();

    const cuerpo = armarHechoParaJuicio(hecho, senales ?? {});

    expect(cuerpo).toEqual({
      intencion: 'compararCiclo',
      frase: 'Ganaste S/ 78.00 menos que el ciclo pasado.',
      cifras: ['78.00'],
      senales: { tendencia: 'baja', magnitud: 'grande' },
    });
    // Exactamente estas cuatro llaves y ninguna más
    expect(Object.keys(cuerpo).sort()).toEqual(['cifras', 'frase', 'intencion', 'senales']);
    // El perfil, el Yape y los cierres no viajan
    noFiltraNadaDeFreddy(JSON.stringify(cuerpo), cierres, perfil);
  });

  // @spec08_e17 — Sin juicio posible o con falla, la respuesta sale igual
  it('spec08_e17 sin juicio posible o con falla la respuesta sale igual', () => {
    // Given: la intención "venta de un día" (que no se puede juzgar) y, por otro lado, una intención juzgable con un Jev que falla, tarda más de 8 segundos o responde con confianza de 0.3
    // When: se arma la respuesta
    // Then: en el primer caso no se hace ninguna petición de juicio, y en el segundo la respuesta se muestra sin semáforo y sin ningún mensaje técnico
    return (async () => {
      const interpreta = responde(interpretacion('compararCiclo'));
      const redacta = responde({ texto: REDACCION_CICLO });
      const sinSemaforo = (r: unknown) => {
        expect(r).toMatchObject({ tipo: 'respuesta', texto: REDACCION_CICLO, frase: FRASE_CICLO });
        expect(r).not.toHaveProperty('semaforo');
        expect(JSON.stringify(r)).not.toMatch(CODIGOS_TECNICOS);
      };

      // Primer caso: "venta de un día" no se juzga, así que no hay ninguna petición de juicio.
      const noJuzgable = servidorSimulado({
        interpretar: responde(interpretacion('ventaDelDia', 'ayer')),
        redactar: responde({ texto: 'Ayer, martes 6 de octubre, te entraron S/ 205.00.' }),
        juzgar: responde(juicioDe('urgente', 0.99)),
      });
      const venta = await consultar(
        noJuzgable.fetch as unknown as typeof fetch,
        URL_JEV,
        '¿cuánto vendí ayer?',
        ventaDeAyer(),
      );
      expect(noJuzgable.tipos()).not.toContain('juzgar');
      expect(venta).toMatchObject({ tipo: 'respuesta', texto: expect.stringContaining('S/ 205.00') });
      expect(venta).not.toHaveProperty('semaforo');

      // Control: con un Jev que sí juzga con confianza, una intención juzgable lleva el semáforo.
      const bien = servidorSimulado({
        interpretar: interpreta,
        redactar: redacta,
        juzgar: responde(juicioDe('ojo', 0.8)),
      });
      const conJuicio = await consultar(
        bien.fetch as unknown as typeof fetch,
        URL_JEV,
        '¿cómo voy contra el ciclo pasado?',
        ctxCompararCiclo(),
      );
      expect(conJuicio).toMatchObject({ tipo: 'respuesta', texto: REDACCION_CICLO, semaforo: 'ojo' });

      // Segundo caso (a): Jev falla (error del servidor) y (b) responde con confianza de 0.3.
      const fallas: Array<() => Promise<Response>> = [
        () => Promise.resolve(respuestaJson({ error: 'NO_DISPONIBLE' }, false, 502)),
        () => Promise.reject(new TypeError('Network request failed')),
        responde(juicioDe('urgente', 0.3)),
        responde(juicioDe(null, 0)),
        responde({ semaforo: 'rojo', confianza: 0.9 }),
      ];
      for (const falla of fallas) {
        const servidor = servidorSimulado({ interpretar: interpreta, redactar: redacta, juzgar: falla });
        const r = await consultar(
          servidor.fetch as unknown as typeof fetch,
          URL_JEV,
          '¿cómo voy contra el ciclo pasado?',
          ctxCompararCiclo(),
        );
        sinSemaforo(r);
        expect(servidor.tipos()).toContain('juzgar');
      }

      // Segundo caso (c): Jev tarda más de 8 segundos; se corta y la respuesta sale igual.
      jest.useFakeTimers();
      try {
        const lento = (_url: string, init: { signal?: AbortSignal }) =>
          new Promise<Response>((_resolver, rechazar) => {
            init.signal?.addEventListener('abort', () => {
              const aborto = new Error('Aborted');
              aborto.name = 'AbortError';
              rechazar(aborto);
            });
          });
        const f = jest
          .fn()
          .mockResolvedValueOnce(respuestaJson(interpretacion('compararCiclo')))
          .mockResolvedValueOnce(respuestaJson({ texto: REDACCION_CICLO }))
          .mockImplementationOnce(lento);
        let resultado: unknown;
        const pendiente = consultar(
          f as unknown as typeof fetch,
          URL_JEV,
          '¿cómo voy contra el ciclo pasado?',
          ctxCompararCiclo(),
        ).then(r => {
          resultado = r;
        });

        await jest.advanceTimersByTimeAsync(7999);
        expect(resultado).toBeUndefined();
        await jest.advanceTimersByTimeAsync(1);
        await pendiente;

        sinSemaforo(resultado);
        expect(f).toHaveBeenCalledTimes(3);
        expect(jest.getTimerCount()).toBe(0);
      } finally {
        jest.useRealTimers();
      }
    })();
  });

  // @spec08_e18 — El semáforo se distingue por palabra, símbolo y color
  it('spec08_e18 el semaforo se distingue por palabra simbolo y color', () => {
    // Given: respuestas con el semáforo "bien", "ojo" y "urgente"
    // When: se muestran en el chat
    // Then: cada una dice su palabra ("Bien", "Ojo", "Urgente"), lleva un símbolo distinto y un color distinto, con la letra siempre oscura sobre el fondo suave (el naranja nunca es el color del texto)
    throw new Error('Rojo: no implementado');
  });
});
