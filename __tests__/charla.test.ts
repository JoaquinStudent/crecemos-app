/**
 * Pruebas de apoyo de la charla corta del chat (no son escenarios del SPEC; los escenarios 19 y 20
 * viven en sprint-08.test.ts): qué textos son charla, qué se contesta y que nunca lleva cifras.
 */
import { responderCharla, type CategoriaCharla } from '@analisis/charla';

const categoriaDe = (texto: string) => responderCharla(texto)?.categoria ?? null;

describe('charla corta: qué es charla', () => {
  const casos: Array<[CategoriaCharla, string[]]> = [
    [
      'saludo',
      [
        'hola',
        'holi',
        'buenas',
        'buenos días',
        'buenas tardes',
        'buenas noches',
        'hey',
        'qué tal',
        'cómo estás',
      ],
    ],
    ['agradecimiento', ['gracias', 'muchas gracias', 'genial', 'ok gracias', 'listo gracias']],
    ['despedida', ['chau', 'chao', 'adiós', 'hasta luego', 'nos vemos']],
    [
      'ayuda',
      [
        'quién eres',
        'qué eres',
        'qué haces',
        'qué puedes hacer',
        'ayuda',
        'cómo funciona',
        'qué te puedo preguntar',
      ],
    ],
  ];

  it.each(casos.flatMap(([categoria, textos]) => textos.map(t => [categoria, t] as const)))(
    '%s: "%s"',
    (categoria, texto) => {
      expect(categoriaDe(texto)).toBe(categoria);
    },
  );

  it('no distingue mayúsculas, tildes, signos ni espacios de sobra', () => {
    expect(categoriaDe('  ¡HOLA!  ')).toBe('saludo');
    expect(categoriaDe('¿Qué   TAL?')).toBe('saludo');
    expect(categoriaDe('Buenos DIAS...')).toBe('saludo');
    expect(categoriaDe('ADIOS')).toBe('despedida');
    expect(categoriaDe('¿Quien eres?')).toBe('ayuda');
  });

  it('acepta letras alargadas: "holaaa", "holiii", "graciaaas"', () => {
    expect(categoriaDe('holaaa')).toBe('saludo');
    expect(categoriaDe('holiii')).toBe('saludo');
    expect(categoriaDe('graciaaas')).toBe('agradecimiento');
  });

  it('una combinación de reglas sigue siendo charla', () => {
    expect(categoriaDe('hola, gracias')).not.toBeNull();
    expect(categoriaDe('hola buenos días')).toBe('saludo');
    expect(categoriaDe('hola, qué puedes hacer')).toBe('ayuda');
    expect(categoriaDe('gracias, chau')).toBe('despedida');
  });

  it('una pregunta real, sola o mezclada con charla, NO es charla', () => {
    for (const texto of [
      'hola, cuánto vendí ayer',
      '¿cuánto vendí ayer?',
      'gracias, y qué día me va peor',
      'holanda',
      'ayudante',
      'chaulafan',
      'hola hola hola quiero mi venta',
      'hola jev',
    ]) {
      expect(responderCharla(texto)).toBeNull();
    }
  });

  it('un texto vacío, de espacios, de signos o larguísimo no es charla y no falla', () => {
    for (const texto of ['', '   ', '¿?!!...', 'x'.repeat(5000), 'hola '.repeat(2000) + 'ventas']) {
      expect(responderCharla(texto)).toBeNull();
    }
    expect(() => responderCharla(undefined as unknown as string)).not.toThrow();
    expect(responderCharla(undefined as unknown as string)).toBeNull();
  });
});

describe('charla corta: qué se contesta', () => {
  const textos = [
    'hola',
    'buenas tardes',
    'gracias',
    'muchas gracias',
    'chau',
    'hasta luego',
    'qué puedes hacer',
    'ayuda',
  ];

  it('nunca lleva una cifra, un monto ni una fecha', () => {
    for (const nombre of [undefined, 'Freddy']) {
      for (const texto of textos) {
        const r = responderCharla(texto, nombre);
        expect(r).not.toBeNull();
        expect(r?.texto).not.toMatch(/\d|S\//);
        expect((r?.texto ?? '').length).toBeGreaterThan(10);
      }
    }
  });

  it('es determinista: el mismo texto da siempre la misma frase', () => {
    for (const texto of textos) {
      const primera = responderCharla(texto, 'Freddy');
      for (let i = 0; i < 5; i += 1) expect(responderCharla(texto, 'Freddy')).toEqual(primera);
    }
  });

  it('cada categoría tiene más de una frase, según el texto', () => {
    const frases = new Set(
      ['hola', 'holi', 'buenas', 'hey', 'buenos días', 'buenas tardes', 'qué tal'].map(
        t => responderCharla(t)?.texto,
      ),
    );
    expect(frases.size).toBeGreaterThan(1);
  });

  it('el saludo usa el nombre del perfil, y sin nombre saluda sin él', () => {
    expect(responderCharla('hola', 'Freddy')?.texto).toContain('Freddy');
    const sin = responderCharla('hola')?.texto ?? '';
    expect(sin).not.toContain('undefined');
    expect(sin).not.toContain(', !');
    expect(responderCharla('hola', '   ')?.texto).toBe(sin);
    expect(responderCharla('hola', '')?.texto).toBe(sin);
  });

  it('cuida el nombre: quita caracteres raros y lo recorta', () => {
    const raro = responderCharla('hola', '<b>Fred{y}</b>\n\t[x]')?.texto ?? '';
    expect(raro).not.toMatch(/[<>{}[\]\n\t]/);
    const largo = responderCharla('hola', 'A'.repeat(500))?.texto ?? '';
    expect(largo.length).toBeLessThan(200);
    expect(responderCharla('hola', '💥💥💥')?.texto).toBe(sin());
    expect(responderCharla('hola', 'María José')?.texto).toContain('María José');
  });

  it('solo "qué puedes hacer" y "ayuda" ofrecen las preguntas sugeridas', () => {
    expect(responderCharla('qué puedes hacer')?.conSugeridas).toBe(true);
    expect(responderCharla('ayuda')?.conSugeridas).toBe(true);
    expect(responderCharla('hola')?.conSugeridas).toBe(false);
    expect(responderCharla('gracias')?.conSugeridas).toBe(false);
  });

  it('la ayuda dice qué sabe responder', () => {
    const t = responderCharla('qué puedes hacer')?.texto ?? '';
    for (const palabra of ['vendiste', 'mejor', 'peor', 'producto', 'deben', 'casa', 'ciclo']) {
      expect(t).toContain(palabra);
    }
    expect(t.endsWith('Prueba con una de estas:')).toBe(true);
  });
});

const sin = () => responderCharla('hola')?.texto;
