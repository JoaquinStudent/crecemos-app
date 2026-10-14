/**
 * "Mi pasaporte para el banco" (src/analisis/pasaporte.ts): cuota de referencia, constancia por mes,
 * código de constancia (CRC-32) y QR. Todo puro: "hoy" siempre entra como parámetro.
 */
import { RATIO_CUOTA_REFERENCIA, REDONDEO_CUOTA_SOLES } from '@dominio/referencia';
import type { Cierre, FechaNegocio, Senales } from '@dominio/tipos';
import {
  construirPasaporte,
  constanciaPorMes,
  contenidoCanonico,
  corridasQR,
  crc32Hex,
  cuotaReferencia,
  diasDelMes,
  explicacionCuota,
  formatoCodigo,
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
    const dos = cuotaReferencia(senalesBanco([...diasDe('2026-08', 20), ...diasDe('2026-09', 24)], HOY));
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
    expect(construirPasaporte(s, HOY)?.soloEjemplo).toBe(true);
  });

  it('el ejemplo no se mezcla con lo propio: con datos propios, el ejemplo no suma', () => {
    const solo = senalesBanco(tresMeses(), HOY);
    const mezclado = senalesBanco([...tresMeses(), ...diasDe('2026-06', 28, true)], HOY);
    expect(mezclado.soloEjemplo).toBeUndefined();
    expect(cuotaReferencia(mezclado)).toEqual(cuotaReferencia(solo));
    expect(contenidoCanonico(mezclado, HOY)).toBe(contenidoCanonico(solo, HOY));
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

describe('suma de comprobación y código', () => {
  it('CRC-32: el vector conocido de "123456789" es CBF43926', () => {
    expect(crc32Hex('123456789')).toBe('CBF43926');
  });

  it('otros vectores conocidos', () => {
    expect(crc32Hex('')).toBe('00000000');
    expect(crc32Hex('a')).toBe('E8B7BE43');
    expect(crc32Hex('The quick brown fox jumps over the lazy dog')).toBe('414FA339');
  });

  it('siempre 8 dígitos en mayúscula, con ceros a la izquierda', () => {
    for (const t of ['x', 'CRECEMOS1', 'Ñandú ✓', '0'.repeat(30)]) {
      expect(crc32Hex(t)).toMatch(/^[0-9A-F]{8}$/);
    }
  });

  it('el formato es CR-XXXX-XXXX', () => {
    expect(formatoCodigo('CBF43926')).toBe('CR-CBF4-3926');
    expect(construirPasaporte(senalesDe(), HOY)?.codigo).toMatch(/^CR-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('el contenido canónico tiene un orden y formato fijos', () => {
    expect(contenidoCanonico(senalesDe(), '2026-10-07')).toBe(
      'CRECEMOS1|P=20260723-20261006|V=5120.00|G=2180.00|D=58|C=650|E=20261007',
    );
  });

  it('con datos de ejemplo el contenido lleva X=1', () => {
    expect(contenidoCanonico(senalesDe({ soloEjemplo: true }), HOY)).toMatch(/\|X=1$/);
  });

  it('sin cuota el contenido dice C=0; sin periodo, P=-', () => {
    const c = contenidoCanonico(
      senalesDe({ gananciaPromedioMensual: 0, primerCierre: undefined, ultimoCierre: undefined }),
      HOY,
    );
    expect(c).toContain('|P=-|');
    expect(c).toContain('|C=0|');
  });

  it('es determinista: las mismas cifras y fecha dan siempre el mismo código y el mismo QR', () => {
    const a = construirPasaporte(senalesDe(), HOY);
    const b = construirPasaporte(senalesDe(), HOY);
    expect(a).toEqual(b);
    expect(modulosQR(a?.textoQR ?? '')).toEqual(modulosQR(b?.textoQR ?? ''));
  });

  it('un vector estable (verificado con zlib.crc32 de Node): estas cifras dan este código', () => {
    const p = construirPasaporte(senalesDe(), '2026-10-07');
    expect(p?.contenido).toBe(
      'CRECEMOS1|P=20260723-20261006|V=5120.00|G=2180.00|D=58|C=650|E=20261007',
    );
    expect(p?.codigo).toBe(formatoCodigo(crc32Hex(p?.contenido ?? '')));
    expect(p?.textoQR).toBe(`${p?.contenido}|K=${crc32Hex(p?.contenido ?? '')}`);
    expect(p?.codigo).toBe('CR-178E-5687');
  });

  it('cualquier cambio en una cifra o en la fecha cambia el código', () => {
    const base = construirPasaporte(senalesDe(), HOY)?.codigo;
    const otros = [
      construirPasaporte(senalesDe({ ventaPromedioMensual: 5121 }), HOY),
      construirPasaporte(senalesDe({ gananciaPromedioMensual: 2181 }), HOY),
      construirPasaporte(senalesDe({ diasRegistrados: 59 }), HOY),
      construirPasaporte(senalesDe({ primerCierre: '2026-07-24' }), HOY),
      construirPasaporte(senalesDe(), '2026-10-08'),
      construirPasaporte(senalesDe({ soloEjemplo: true }), HOY),
    ].map(p => p?.codigo);
    for (const otro of otros) expect(otro).not.toBe(base);
    expect(new Set([base, ...otros]).size).toBe(otros.length + 1);
  });

  it('no hay pasaporte sin ningún día registrado', () => {
    expect(construirPasaporte(senalesBanco([], HOY), HOY)).toBeNull();
  });

  it('el código se puede verificar a mano: crc32 del contenido = lo que va tras K=', () => {
    const p = construirPasaporte(senalesBanco(tresMeses(), HOY), HOY);
    const [contenido, suma] = (p?.textoQR ?? '').split('|K=');
    expect(contenido).toBe(p?.contenido);
    expect(formatoCodigo(crc32Hex(contenido))).toBe(p?.codigo);
    expect(crc32Hex(contenido)).toBe(suma);
  });
});

describe('QR', () => {
  const texto = 'CRECEMOS1|P=20260723-20261006|V=5120.00|G=2180.00|D=58|C=650|E=20261007|K=CBF43926';

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

  it('con `hoy` suma la cuota, el código y sus avisos honestos', () => {
    const s = senalesDe();
    const t = textoReporte(s, null, HOY);
    const p = construirPasaporte(s, HOY);
    expect(t).toContain('Cuota mensual de referencia: S/ 650.00 al mes');
    expect(t).toContain(NOTA_CUOTA);
    expect(t).toContain(`Código de constancia: ${p?.codigo}`);
    expect(t).toContain(NOTA_CODIGO);
    expect(t).toContain(`Datos del código: ${p?.contenido}`);
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

  it('sin cuota (sin mes completo) igual lleva el código y no promete una cifra', () => {
    const s = senalesDe({ meses: [], mesesCompletos: 0 });
    const lineas = lineasTextoPasaporte(construirPasaporte(s, HOY) as never);
    expect(lineas.some(l => l.startsWith('Cuota mensual'))).toBe(false);
    expect(lineas[0]).toContain('Código de constancia: CR-');
  });
});

describe('pureza', () => {
  it('no muta las señales que recibe', () => {
    const s = Object.freeze({ ...senalesDe(), meses: Object.freeze([...senalesDe().meses]) as never });
    expect(() => construirPasaporte(s as Senales, HOY)).not.toThrow();
  });
});
