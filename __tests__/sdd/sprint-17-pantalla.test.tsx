/**
 * Tests del Sprint-17 que montan la app real o la burbuja: la etiqueta "Incluye datos de ejemplo"
 * (e11, e12), el aviso de privacidad nuevo (e13) y el e2e de la pregunta por cantidad (e16).
 * Generados desde sdd/spec/Sprint-17-chat-ejemplo/SPEC.md. Los demás escenarios (resumen, Worker,
 * prompts, respuestas calculadas y servicio) viven en `sprint-17.test.ts`.
 * La red es un `fetch` simulado: nada toca el servidor real.
 */
import { createElement } from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { BurbujaChat, TEXTO_EJEMPLO_NOTA } from '@components/molecules/BurbujaChat';
import { colors } from '@theme';
import { fechaLocal, restarDias } from '@dominio/fecha';
import type { Cierre } from '@dominio/tipos';
import { reiniciarEstadoDeRed } from '@services/jev';
import { guardarCierre } from '@storage/repositorio';
import { JEV_URL } from '../../src/config';
import { desmontarApp, montarApp, textoCompleto } from '../../testutils/app';

const TEXTO_PRIVACIDAD_NUEVO =
  'Tu pregunta y lo último que hablaron se envían a un servicio de inteligencia artificial para entenderla y escribirte la respuesta. Algunas respuestas se envían ya calculadas (por ejemplo, cuánto te queda en el ciclo), y si conversan, viajan unos totales por mes y por producto. Nunca van tu nombre, tu Yape, los montos ni las fechas de lo que te deben, ni la lista de tus días. Para opinar sobre tus cobros solo viaja una señal como «alto» o «vencido». Si no hay internet, solo respondo las preguntas sugeridas y no se envía nada.';

const hoy = () => fechaLocal(new Date());
const cierreDe = (dias: number, origen?: 'ejemplo'): Cierre => {
  const fecha = restarDias(hoy(), dias);
  return {
    id: `c-${fecha}`,
    fecha,
    lineas: [
      {
        productoId: 'p-anticucho',
        nombre: 'Anticucho',
        preparadas: 10,
        sobrantes: 3,
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
    ...(origen ? { origen } : {}),
  };
};

// --- La red del chat --------------------------------------------------------------------------------

interface Cuerpo {
  tipo: 'interpretar' | 'redactar' | 'juzgar' | 'conversar';
  texto?: string;
  hecho?: { frase: string; ejemplo?: boolean };
  resumen?: {
    incluyeEjemplo: boolean;
    diasDeEjemplo: number;
    meses: Array<{ mes: string; ventas: number; ventasTexto: string; porciones: number }>;
  };
}
type Servidor = Partial<Record<Cuerpo['tipo'], (c: Cuerpo) => Response>>;
const json = (cuerpo: unknown) =>
  ({ ok: true, status: 200, text: async () => JSON.stringify(cuerpo) } as unknown as Response);
const clasificacion = (intencion: string, dia = 'ninguno') => ({
  intencion,
  producto: 'ninguno',
  dia,
  confianza: 0.95,
});
const fetchPorDefecto = global.fetch;
const ponerRed = (chat: Servidor) => {
  const f = jest.fn(async (url: string, init?: { body?: string }) => {
    if (url !== JEV_URL) throw new TypeError('Network request failed');
    const cuerpo = JSON.parse(init?.body ?? '{}') as Cuerpo;
    const responder = chat[cuerpo.tipo];
    if (!responder) throw new TypeError('Network request failed');
    return responder(cuerpo);
  });
  global.fetch = f as unknown as typeof fetch;
  return {
    cuerpos: (): Cuerpo[] =>
      (f.mock.calls as unknown as Array<[string, { body?: string }]>)
        .filter(([url]) => url === JEV_URL)
        .map(([, init]) => JSON.parse(init.body ?? '{}') as Cuerpo),
  };
};

const abrirChat = async () => {
  const app = await montarApp();
  await app.tocar('tab-asistente');
  return {
    ...app,
    preguntar: async (texto: string) => {
      await app.escribir('preguntar-campo', texto);
      await app.tocar('preguntar-enviar');
    },
  };
};

beforeEach(() => {
  clearAllMockStorages();
  reiniciarEstadoDeRed();
});
afterEach(async () => {
  await desmontarApp();
  global.fetch = fetchPorDefecto;
});

describe('SPEC-17 (pantalla): la etiqueta de ejemplo, el aviso de privacidad y la cantidad', () => {
  // @spec17_e11 — La burbuja dice "Incluye datos de ejemplo" solo cuando corresponde
  it('spec17_e11 e2e la burbuja dice incluye datos de ejemplo solo cuando corresponde', async () => {
    const red = {
      interpretar: (c: Cuerpo) =>
        json(
          (c.texto ?? '').includes('ayer')
            ? clasificacion('ventaDelDia', 'ayer')
            : { ...clasificacion('noEntendi'), confianza: 0.9 },
        ),
      redactar: (c: Cuerpo) => json({ texto: c.hecho?.frase ?? '' }),
      conversar: () => json({ texto: 'Vas bien este mes.' }),
    };

    // Con un cierre de ejemplo: las dos respuestas llevan la etiqueta; la pregunta de Freddy, nunca.
    await guardarCierre(cierreDe(1, 'ejemplo'));
    ponerRed(red);
    const p = await abrirChat();
    await p.preguntar('¿cuánto vendí ayer?');
    expect(p.textoDe('chat-burbuja-1-ejemplo')).toBe('Incluye datos de ejemplo');
    expect(TEXTO_EJEMPLO_NOTA).toBe('Incluye datos de ejemplo');
    expect(p.existe('chat-burbuja-0-etiqueta-ejemplo')).toBe(false);
    await p.preguntar('¿cómo me fue este mes?');
    expect(p.textoDe('chat-burbuja-3-texto')).toBe('Vas bien este mes.');
    expect(p.textoDe('chat-burbuja-3-ejemplo')).toBe('Incluye datos de ejemplo');
    // "hola" no se apoya en cifras: no lleva la etiqueta.
    await p.preguntar('hola');
    expect(p.existe('chat-burbuja-5-etiqueta-ejemplo')).toBe(false);
    await desmontarApp();

    // Con solo cierres propios: ninguna.
    clearAllMockStorages();
    await guardarCierre(cierreDe(1));
    ponerRed(red);
    const q = await abrirChat();
    await q.preguntar('¿cuánto vendí ayer?');
    expect(q.existe('chat-burbuja-1-etiqueta-ejemplo')).toBe(false);
    await q.preguntar('¿cómo me fue este mes?');
    expect(q.existe('chat-burbuja-3-etiqueta-ejemplo')).toBe(false);
    await desmontarApp();

    // Sin internet y con ejemplo: conviven "Sin internet" e "Incluye datos de ejemplo".
    clearAllMockStorages();
    await guardarCierre(cierreDe(1, 'ejemplo'));
    ponerRed({});
    const r = await abrirChat();
    await r.preguntar('¿cuánto vendí ayer?');
    expect(r.textoDe('chat-burbuja-1-sin-internet')).toBe('Sin internet');
    expect(r.textoDe('chat-burbuja-1-ejemplo')).toBe('Incluye datos de ejemplo');
    expect(r.propsDe('chat-burbuja-1').accessibilityLabel).toMatch(
      /^Respuesta, sin internet, incluye datos de ejemplo: /,
    );
  });

  // @spec17_e12 — La etiqueta de ejemplo es accesible
  it('spec17_e12 la etiqueta de ejemplo es accesible', () => {
    let arbol!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      arbol = ReactTestRenderer.create(
        createElement(BurbujaChat, {
          autor: 'jev',
          texto: 'Ayer vendiste S/ 70.00.',
          ejemplo: true,
          testID: 'b',
        }),
      );
    });
    const esHost = (n: ReactTestRenderer.ReactTestInstance, nombre: string) =>
      (n.type as unknown) === nombre;
    // La palabra está en pantalla (no solo color), con ícono y estilo propios.
    const texto = arbol.root.findAll(n => esHost(n, 'Text') && n.props.testID === 'b-ejemplo')[0];
    expect(texto).toBeDefined();
    expect(textoCompleto(texto)).toBe('Incluye datos de ejemplo');
    const estilo = StyleSheet.flatten(texto.props.style);
    expect(estilo.fontSize).toBeGreaterThanOrEqual(14);
    expect(estilo.color).not.toBe(colors.accent);
    expect(estilo.color).not.toBe(colors.warning);
    const etiqueta = arbol.root.findAll(
      n => esHost(n, 'View') && n.props.testID === 'b-etiqueta-ejemplo',
    )[0];
    expect(etiqueta.findAll(n => /^#[0-9A-Fa-f]{6}$/.test(String(n.props.color))).length).toBeGreaterThan(0);
    const cajaEtiqueta = StyleSheet.flatten(etiqueta.props.style);
    expect(cajaEtiqueta.borderWidth).toBeGreaterThan(0);
    expect(cajaEtiqueta.backgroundColor).toBe(colors.infoSoft);
    // La burbuja también cambia de borde, y el lector de pantalla lo dice con palabras.
    const burbuja = arbol.root.findAll(n => esHost(n, 'View') && n.props.testID === 'b')[0];
    expect(burbuja.props.accessibilityLabel).toBe(
      'Respuesta, incluye datos de ejemplo: Ayer vendiste S/ 70.00.',
    );
    expect(StyleSheet.flatten(burbuja.props.style).borderColor).toBe(colors.info);
    // Sin la propiedad no hay etiqueta, y la pregunta de Freddy nunca la lleva.
    act(() => {
      arbol.update(
        createElement(BurbujaChat, { autor: 'freddy', texto: 'hola', ejemplo: true, testID: 'b' }),
      );
    });
    expect(arbol.root.findAll(n => n.props.testID === 'b-etiqueta-ejemplo')).toHaveLength(0);
    act(() => {
      arbol.update(createElement(BurbujaChat, { autor: 'jev', texto: 'hola', testID: 'b' }));
    });
    expect(arbol.root.findAll(n => n.props.testID === 'b-etiqueta-ejemplo')).toHaveLength(0);
    act(() => arbol.unmount());
  });

  // @spec17_e13 — El aviso de privacidad dice la verdad sobre los cobros (P90)
  it('spec17_e13 el aviso de privacidad dice la verdad sobre los cobros', async () => {
    ponerRed({});
    const p = await abrirChat();
    await p.tocar('preguntar-aviso-alternar');
    const texto = p.textoDe('preguntar-aviso-privacidad-texto');
    expect(texto).toBe(TEXTO_PRIVACIDAD_NUEVO);
    // Ya no dice que nunca viaja nada de los cobros: dice qué viaja (una señal) y qué no.
    expect(texto).not.toContain('lo que te deben por cobrar');
    expect(texto).toContain('los montos ni las fechas de lo que te deben');
    expect(texto).toMatch(/«alto» o «vencido»/);
    expect(texto).toContain('Nunca van tu nombre, tu Yape');
    expect(texto).toContain('no se envía nada');
  });

  // @spec17_e16 — e2e: la pregunta de cantidad llega con porciones y la respuesta lleva la etiqueta
  it('spec17_e16 e2e la pregunta de cantidad llega con porciones y la respuesta lleva la etiqueta', async () => {
    // Given: dos días de ejemplo (7 porciones cada uno, S/ 70.00) en meses distintos si caen así
    await guardarCierre(cierreDe(1, 'ejemplo'));
    await guardarCierre(cierreDe(2, 'ejemplo'));
    const red = ponerRed({
      interpretar: () => json({ ...clasificacion('noEntendi'), confianza: 0.9 }),
      // El modelo contesta con una cifra sin el formato de la app: "S/70".
      conversar: c => {
        const mes = [...(c.resumen?.meses ?? [])].sort((a, b) => b.porciones - a.porciones)[0];
        return json({ texto: `En ${mes.mes} vendiste ${mes.porciones} porciones, S/${mes.ventas}.` });
      },
    });
    const p = await abrirChat();
    // When
    await p.preguntar('¿En qué mes vendí más productos?');
    // Then: viajó porciones, el aviso de ejemplo y los textos; la respuesta sale con el formato de la app
    const conversar = red.cuerpos().find(c => c.tipo === 'conversar');
    expect(conversar?.resumen?.incluyeEjemplo).toBe(true);
    expect(conversar?.resumen?.diasDeEjemplo).toBe(2);
    expect(conversar?.resumen?.meses.every(m => typeof m.porciones === 'number')).toBe(true);
    expect(conversar?.resumen?.meses.every(m => /^S\/ [\d,]+\.\d{2}$/.test(m.ventasTexto))).toBe(true);
    const respuesta = p.textoDe('chat-burbuja-1-texto');
    expect(respuesta).toMatch(/vendiste \d+ porciones, S\/ [\d,]+\.\d{2}\.$/);
    expect(respuesta).not.toMatch(/S\/\d/);
    expect(p.textoDe('chat-burbuja-1-ejemplo')).toBe('Incluye datos de ejemplo');
  });
});
