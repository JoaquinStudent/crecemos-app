/**
 * "Mi pasaporte para el banco" (src/analisis/pasaporte.ts): cuota de referencia, constancia por mes,
 * código del enlace y QR. Todo puro: "hoy" siempre entra como parámetro.
 */
import { RATIO_CUOTA_REFERENCIA, REDONDEO_CUOTA_SOLES } from '@dominio/referencia';
import type { Cierre, FechaNegocio, Senales } from '@dominio/tipos';
import {
  construirPasaporte,
  codigoDeEnlace,
  constanciaPorMes,
  corridasQR,
  cuotaReferencia,
  diasDelMes,
  explicacionCuota,
  lineasTextoPasaporte,
  MARGEN_QR,
  modulosQR,
  NOTA_CODIGO,
  NOTA_CUOTA,
  svgQR,
  textoCuota,
} from '@analisis/pasaporte';
import { MAX_CARACTERES_REPORTE, senalesBanco, textoReporte } from '@analisis/senales';

const HOY: FechaNegocio = '2026-10-07';
const INSTANTE = '2026-10-07T12:00:00-05:00';

const cierreDe = (fecha: FechaNegocio, vendidas = 20, ejemplo = false): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [
    {
      productoId: 'p-anticucho',
      nombre: 'Anticucho',
      preparadas: vendidas,
      sobrantes: 0,
      precioUnitario: 10,
      costoUnitario: 8,
    },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: [],
  abreCiclo: false,
  creadoEn: INSTANTE,
  actualizadoEn: INSTANTE,
  ...(ejemplo ? { origen: 'ejemplo' as const } : {}),
});

/** Los días 1..n del mes 'AAAA-MM'. */
const diasDe = (mes: string, n: number, ejemplo = false): Cierre[] =>
  Array.from({ length: n }, (_, i) =>
    cierreDe(`${mes}-${String(i + 1).padStart(2, '0')}`, 20, ejemplo),
  );

const tresMeses = (ejemplo = false): Cierre[] => [
  ...diasDe('2026-07', 18, ejemplo),
  ...diasDe('2026-08', 20, ejemplo),
  ...diasDe('2026-09', 24, ejemplo),
];

const senalesDe = (extra: Partial<Senales> = {}): Senales => ({
  constancia: 64,
  diasRegistrados: 58,
  diasTranscurridos: 90,
  ventaPromedioMensual: 5120,
  gananciaPromedioMensual: 2180,
  meses: [
    { mes: '2026-07', venta: 4900, teQueda: 2100, dias: 18 },
    { mes: '2026-08', venta: 5100, teQueda: 2200, dias: 20 },
    { mes: '2026-09', venta: 5360, teQueda: 2240, dias: 24 },
  ],
  mesesCompletos: 3,
  primerCierre: '2026-07-23',
  ultimoCierre: '2026-10-06',
  registraDesde: '2026-07-16',
  antiguedadDias: 83,
  enConstruccion: false,
  diasFaltantes: 0,
  ...extra,
});

describe('cuotaReferencia', () => {
  it('es el 30 % del resultado promedio, redondeado hacia abajo a S/ 10', () => {
    expect(RATIO_CUOTA_REFERENCIA).toBe(0.3);
    expect(REDONDEO_CUOTA_SOLES).toBe(10);
    // 2,180 × 0.30 = 654 → 650
    expect(cuotaReferencia(senalesDe())).toEqual({
      disponible: true,
      monto: 650,
      ratio: 0.3,
      base: 2180,
      meses: 3,
    });
  });

  it.each([
    [1000, 300], // justo en un escalón
    [1033.33, 300], // 309.999 → 300
    [1034, 310],
    [100, 30],
    [34, 10], // 10.2 → 10: el primer escalón
  ])('con un resultado promedio de %s sale %s', (ganancia, esperado) => {
    const c = cuotaReferencia(senalesDe({ gananciaPromedioMensual: ganancia }));
    expect(c).toMatchObject({ disponible: true, monto: esperado });
  });

  it('sin datos no hay cuota: no se inventa', () => {
    const vacio = senalesBanco([], HOY);
    expect(cuotaReferencia(vacio)).toEqual({ disponible: false, motivo: 'sinMes' });
    expect(textoCuota(cuotaReferencia(vacio))).toBe(
      'Aún no hay un mes completo para calcular una referencia.',
    );
  });

  it('con menos de 3 meses completos usa los que hay y lo dice', () => {
    const uno = senalesBanco([...diasDe('2026-09', 24)], HOY);
    expect(uno.mesesCompletos).toBe(1);
    const c = cuotaReferencia(uno);
    expect(c).toMatchObject({ disponible: true, meses: 1 });
    expect(explicacionCuota(c)).toContain('de 1 mes completo');
    const dos = cuotaReferencia(
      senalesBanco([...diasDe('2026-08', 20), ...diasDe('2026-09', 24)], HOY),
    );
    expect(explicacionCuota(dos)).toContain('de 2 meses completos');
  });

  it('un mes parcial (el en curso) no cuenta: sin un mes completo no hay cuota', () => {
    const s = senalesBanco(diasDe('2026-10', 6), HOY);
    expect(s.mesesCompletos).toBe(0);
    expect(cuotaReferencia(s)).toEqual({ disponible: false, motivo: 'sinMes' });
  });

  it('con resultado cero o negativo no hay cuota', () => {
    for (const ganancia of [0, -150, 20]) {
      const c = cuotaReferencia(senalesDe({ gananciaPromedioMensual: ganancia }));
      expect(c).toEqual({ disponible: false, motivo: 'sinResultado' });
    }
    expect(textoCuota({ disponible: false, motivo: 'sinResultado' })).toBe(
      'Con el resultado registrado de estos meses no sale una cuota de referencia.',
    );
  });

  it('solo datos de ejemplo: calcula, pero lo marca (soloEjemplo viaja en las señales)', () => {
    const s = senalesBanco(tresMeses(true), HOY);
    expect(s.soloEjemplo).toBe(true);
    expect(cuotaReferencia(s).disponible).toBe(true);
    expect(construirPasaporte(s)?.soloEjemplo).toBe(true);
  });

  it('el ejemplo no se mezcla con lo propio: con datos propios, el ejemplo no suma', () => {
    const solo = senalesBanco(tresMeses(), HOY);
    const mezclado = senalesBanco([...tresMeses(), ...diasDe('2026-06', 28, true)], HOY);
    expect(mezclado.soloEjemplo).toBeUndefined();
    expect(cuotaReferencia(mezclado)).toEqual(cuotaReferencia(solo));
    expect(construirPasaporte(mezclado)).toEqual(construirPasaporte(solo));
  });

  it('el texto dice "cerca de" y nunca "aprobado", "puntaje" ni "califica"', () => {
    const texto = `${textoCuota(cuotaReferencia(senalesDe()))} ${explicacionCuota(
      cuotaReferencia(senalesDe()),
    )} ${NOTA_CUOTA}`;
    expect(texto).toContain('Cerca de S/ 650.00 al mes');
    expect(texto).toContain('Es una referencia: la entidad decide con su propio análisis.');
    expect(texto).not.toMatch(/aprob|puntaje|score|califica|garant|crédito/i);
  });
});

describe('constancia de registro por mes', () => {
  it('"Registraste 24 de 30 días en septiembre"', () => {
    const c = constanciaPorMes(senalesDe());
    expect(c.map(x => x.frase)).toEqual([
      'Registraste 18 de 31 días en julio',
      'Registraste 20 de 31 días en agosto',
      'Registraste 24 de 30 días en septiembre',
    ]);
    expect(c[2]).toMatchObject({ mes: '2026-09', dias: 24, diasDelMes: 30 });
  });

  it('usa los días reales que da senalesBanco (los últimos 3 meses completos)', () => {
    const s = senalesBanco(tresMeses(), HOY);
    expect(constanciaPorMes(s).map(x => x.dias)).toEqual(s.meses.map(m => m.dias));
  });

  it('sin meses completos no hay frases', () => {
    expect(constanciaPorMes(senalesBanco([], HOY))).toEqual([]);
    expect(constanciaPorMes(senalesDe({ meses: [], mesesCompletos: 0 }))).toEqual([]);
  });

  it('los días de cada mes, también febrero y los bisiestos', () => {
    expect(diasDelMes('2026-02')).toBe(28);
    expect(diasDelMes('2028-02')).toBe(29);
    expect(diasDelMes('2026-04')).toBe(30);
    expect(diasDelMes('2026-12')).toBe(31);
  });
});

describe('código del enlace', () => {
  const ID = '0123456789abcdef0123456789abcdef';

  it('el formato es CR-XXXX-XXXX-XXXX: los 12 primeros hexadecimales del id, en mayúscula', () => {
    expect(codigoDeEnlace(ID)).toBe('CR-0123-4567-89AB');
    expect(codigoDeEnlace('fedcba9876543210fedcba9876543210')).toBe('CR-FEDC-BA98-7654');
    expect(codigoDeEnlace(ID)).toMatch(/^CR-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('es determinista y no deja reconstruir el id completo', () => {
    expect(codigoDeEnlace(ID)).toBe(codigoDeEnlace(ID));
    expect(codigoDeEnlace(ID).slice(3).replace(/-/g, '')).toHaveLength(12);
    expect(ID.length).toBe(32);
  });

  it('dos ids distintos dan códigos distintos en una muestra de mil', () => {
    const hex = (n: number) => n.toString(16).padStart(8, '0');
    const codigos = new Set(
      Array.from({ length: 1000 }, (_, k) =>
        codigoDeEnlace(`${hex(k * 7919 + 13)}${hex(k)}${'a'.repeat(16)}`),
      ),
    );
    expect(codigos.size).toBe(1000);
  });

  it('el pasaporte ya no trae código ni contenido: sin enlace no hay código', () => {
    const p = construirPasaporte(senalesDe());
    expect(p).not.toHaveProperty('codigo');
    expect(p).not.toHaveProperty('contenido');
    expect(p).not.toHaveProperty('textoQR');
  });

  it('es determinista: las mismas cifras dan siempre el mismo pasaporte', () => {
    expect(construirPasaporte(senalesDe())).toEqual(construirPasaporte(senalesDe()));
  });

  it('no hay pasaporte sin ningún día registrado', () => {
    expect(construirPasaporte(senalesBanco([], HOY))).toBeNull();
  });

  it('la nota dice lo que el código es ahora y no promete una verificación', () => {
    expect(NOTA_CODIGO).toBe(
      'Identifica este reporte en la nube; el enlace del QR lo muestra tal cual. Caduca con el enlace.',
    );
    expect(NOTA_CODIGO).not.toMatch(/certific|garant|aprobad|criptogr|prueba de|verificaci/i);
  });
});

describe('QR', () => {
  const texto =
    'CRECEMOS1|P=20260723-20261006|V=5120.00|G=2180.00|D=58|C=650|E=20261007|K=CBF43926';

  it('es una matriz cuadrada de módulos con el patrón de búsqueda en las tres esquinas', () => {
    const m = modulosQR(texto);
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect((n - 17) % 4).toBe(0); // 21, 25, 29, 33, 37…
    for (const fila of m) expect(fila).toHaveLength(n);
    // Cada esquina: el cuadro de 7 × 7 con el borde oscuro.
    for (const [f, c] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ]) {
      for (let i = 0; i < 7; i += 1) {
        expect(m[f][c + i]).toBe(true);
        expect(m[f + 6][c + i]).toBe(true);
        expect(m[f + i][c]).toBe(true);
        expect(m[f + i][c + 6]).toBe(true);
      }
      expect(m[f + 3][c + 3]).toBe(true);
    }
  });

  it('es determinista y distinto para textos distintos', () => {
    expect(modulosQR(texto)).toEqual(modulosQR(texto));
    expect(modulosQR(texto)).not.toEqual(modulosQR(texto.replace('5120', '5121')));
  });

  it('las corridas cubren exactamente los módulos oscuros', () => {
    const m = modulosQR(texto);
    const dibujada = m.map(fila => fila.map(() => false));
    for (const c of corridasQR(m)) {
      for (let i = 0; i < c.ancho; i += 1) dibujada[c.y][c.x + i] = true;
    }
    expect(dibujada).toEqual(m);
  });

  it('el SVG del PDF: un solo path, sin imágenes externas, con margen y tamaño en pt', () => {
    const m = modulosQR(texto);
    const svg = svgQR(m, 84);
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('width="84pt"');
    expect(svg).toContain(`viewBox="0 0 ${m.length + 2 * MARGEN_QR} ${m.length + 2 * MARGEN_QR}"`);
    expect(svg.match(/<path /g)).toHaveLength(1);
    expect(svg).not.toMatch(/http|<image|<script|href/i);
    // La primera línea del path es la fila 0 desplazada por el margen.
    expect(svg).toMatch(/d="M\d+ 4\.5h\d+/);
  });
});

describe('texto del reporte con pasaporte', () => {
  it('sin `hoy` el texto es el de siempre (sin cuota ni código)', () => {
    const t = textoReporte(senalesDe(), null);
    expect(t).not.toContain('Código de constancia');
    expect(t).not.toContain('referencia');
  });

  it('con `hoy` suma la cuota y su aviso honesto, y ningún código (sin enlace no hay código)', () => {
    const t = textoReporte(senalesDe(), null, HOY);
    expect(t).toContain('Cuota mensual de referencia: S/ 650.00 al mes');
    expect(t).toContain(NOTA_CUOTA);
    expect(t).not.toContain('Código de constancia');
    expect(t).not.toContain('CR-');
  });

  it('cabe en el tope de 2,000 caracteres, también con nombres de 60 letras y 3 meses', () => {
    const perfil = {
      nombre: 'N'.repeat(80),
      negocio: 'B'.repeat(80),
      aceptaYape: true,
      yapeAjeno: false,
      actualizadoEn: INSTANTE,
    };
    const t = textoReporte(senalesDe({ enConstruccion: true, diasFaltantes: 21 }), perfil, HOY);
    expect(t.length).toBeLessThan(MAX_CARACTERES_REPORTE);
    const ejemplo = textoReporte(senalesDe({ soloEjemplo: true }), perfil, HOY);
    expect(ejemplo.length).toBeLessThan(MAX_CARACTERES_REPORTE);
    expect(ejemplo).toContain('Datos de ejemplo');
  });

  it('sin cuota (sin mes completo) no promete una cifra', () => {
    const s = senalesDe({ meses: [], mesesCompletos: 0 });
    const lineas = lineasTextoPasaporte(construirPasaporte(s) as never);
    expect(lineas.some(l => l.startsWith('Cuota mensual'))).toBe(false);
    expect(lineas).toEqual([]);
  });
});

describe('pureza', () => {
  it('no muta las señales que recibe', () => {
    const s = Object.freeze({
      ...senalesDe(),
      meses: Object.freeze([...senalesDe().meses]) as never,
    });
    expect(() => construirPasaporte(s as Senales)).not.toThrow();
  });
});
