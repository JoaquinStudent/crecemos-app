/**
 * Pruebas de apoyo del documento HTML del reporte (no son escenarios del SPEC): estructura, diseño
 * de impresión, privacidad, escape, barras, tabla, aviso y la semilla real. "Hoy" siempre entra
 * como parámetro: el reloj no decide nada.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { escaparHtml, htmlReporte, NOMBRE_ARCHIVO_PDF } from '@analisis/htmlReporte';
import { senalesBanco } from '@analisis/senales';
import { formatoSoles } from '@dominio/formato';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { Cierre, FechaNegocio, Perfil, Senales } from '@dominio/tipos';

const HOY: FechaNegocio = '2026-10-20';
const INSTANTE = '2026-10-20T12:00:00-05:00';
const FRASE_PIE =
  'Son totales registrados por el propio negocio en la app Crecemos; no incluyen movimientos individuales.';
const FOTO = `data:image/jpeg;base64,${'A'.repeat(400)}`;

const perfilDe = (extra: Partial<Perfil> = {}): Perfil => ({
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  aceptaYape: true,
  yapeAjeno: false,
  actualizadoEn: INSTANTE,
  ...extra,
});

/** Tres meses completos y 58 días: las cifras del escenario 5 del Sprint-07. */
const senalesDe = (extra: Partial<Senales> = {}): Senales => ({
  constancia: 64,
  diasRegistrados: 58,
  diasTranscurridos: 90,
  ventaPromedioMensual: 5120,
  gananciaPromedioMensual: 2180,
  meses: [
    { mes: '2026-07', venta: 4900, teQueda: 2100, dias: 18 },
    { mes: '2026-08', venta: 5100, teQueda: 2200, dias: 18 },
    { mes: '2026-09', venta: 5360, teQueda: 2240, dias: 18 },
  ],
  mesesCompletos: 3,
  primerCierre: '2026-07-23',
  ultimoCierre: '2026-10-13',
  registraDesde: '2026-07-16',
  antiguedadDias: 96,
  enConstruccion: false,
  diasFaltantes: 0,
  ...extra,
});

const sinMeses = (extra: Partial<Senales> = {}): Senales =>
  senalesDe({
    meses: [],
    mesesCompletos: 0,
    ventaPromedioMensual: 0,
    gananciaPromedioMensual: 0,
    ...extra,
  });

const congelarTodo = <T>(valor: T): T => {
  if (valor !== null && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    Object.values(valor as Record<string, unknown>).forEach(congelarTodo);
  }
  return valor;
};

const cuenta = (texto: string, parte: string): number => texto.split(parte).length - 1;

describe('htmlReporte · el documento', () => {
  let html: string;
  beforeAll(() => {
    html = htmlReporte(senalesDe(), perfilDe(), HOY);
  });

  it('es un documento completo con su tipo, idioma, codificación y estilo interno', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<style>');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('no lleva JavaScript, enlaces, hojas ni imágenes externas', () => {
    const conFoto = htmlReporte(senalesDe(), perfilDe({ fotoUri: FOTO }), HOY);
    for (const documento of [html, conFoto]) {
      expect(documento.toLowerCase()).not.toContain('<script');
      expect(documento).not.toMatch(/javascript:/);
      expect(documento).not.toContain('http');
      expect(documento).not.toContain('href');
      expect(documento).not.toContain('<a ');
      expect(documento).not.toContain('<link');
      expect(documento).not.toContain('@import');
      expect(documento).not.toContain('onerror');
    }
  });

  it('sin foto no lleva ninguna imagen', () => {
    expect(html).not.toContain('<img');
    expect(html).not.toContain('url(');
  });

  it('está pensado para A4: página de 595 × 842 pt, sin margen y con colores exactos', () => {
    expect(html).toContain('@page');
    expect(html).toContain('size: 595pt 842pt');
    expect(html).toContain('margin: 0');
    expect(html).toContain('-webkit-print-color-adjust: exact');
    expect(html).toContain('width: 595pt');
  });

  it('usa la fuente del sistema y los colores de marca', () => {
    expect(html).toContain('-apple-system, Helvetica, Arial, sans-serif');
    for (const color of ['#CD0157', '#1A1016', '#6B5A62', '#FAF5F7', '#0F7A4F', '#E4D7DE']) {
      expect(html).toContain(color);
    }
  });

  it('ningún tamaño de letra baja de 11 pt', () => {
    const tamanios = [...html.matchAll(/font-size:\s*([\d.]+)pt/g)].map(m => Number(m[1]));
    expect(tamanios.length).toBeGreaterThan(0);
    expect(Math.min(...tamanios)).toBeGreaterThanOrEqual(11);
  });

  it('un nombre largo sin espacios se parte en vez de salirse de la hoja', () => {
    expect(html).toContain('overflow-wrap: anywhere');
  });

  it('evita saltos de página dentro de sus bloques', () => {
    expect(html).toContain('page-break-inside: avoid');
  });

  it('las etiquetas de bloque quedan balanceadas', () => {
    for (const etiqueta of ['div', 'table', 'tr', 'p', 'strong', 'span', 'tbody', 'thead']) {
      expect(cuenta(html, `<${etiqueta}`)).toBe(cuenta(html, `</${etiqueta}>`));
    }
  });
});

describe('htmlReporte · cabecera e identidad', () => {
  it('la banda dice "Crecemos" y la fecha de generación en palabras', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html).toContain('Crecemos');
    expect(html).toContain('Martes 20 de octubre');
  });

  it('con foto válida lleva la imagen circular con el data URI', () => {
    const html = htmlReporte(senalesDe(), perfilDe({ fotoUri: FOTO }), HOY);
    expect(html).toContain(`<img class="foto" src="${FOTO}" alt="">`);
    expect(html).toContain('border-radius: 50%');
    expect(html).not.toContain('class="inicial"');
  });

  it('sin foto lleva el círculo con la inicial', () => {
    const html = htmlReporte(senalesDe(), perfilDe({ nombre: 'freddy' }), HOY);
    expect(html).toContain('<div class="inicial">F</div>');
    expect(html).not.toContain('<img');
  });

  it('con una foto inválida cae a la inicial y no la usa', () => {
    for (const fotoUri of ['file:///fotos/freddy.jpg', 'hola', 'data:image/jpeg;base64,']) {
      const html = htmlReporte(senalesDe(), perfilDe({ fotoUri }), HOY);
      expect(html).toContain('<div class="inicial">F</div>');
      expect(html).not.toContain('<img');
      expect(html).not.toContain(fotoUri);
    }
  });

  it('una foto con comillas no se sale del atributo', () => {
    const rara = 'data:image/jpeg;base64,AA"onerror="alert(1)';
    const html = htmlReporte(senalesDe(), perfilDe({ fotoUri: rara }), HOY);
    expect(html).toContain('AA&quot;onerror=&quot;alert(1)');
    expect(html).not.toContain('"onerror="');
  });

  it('lleva el nombre y el negocio', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html).toContain('<div class="nombre">Freddy</div>');
    expect(html).toContain('<div class="negocio">Anticuchos Freddy</div>');
  });

  it('recorta cada parte a 60 caracteres, como el texto del reporte', () => {
    const html = htmlReporte(
      senalesDe(),
      perfilDe({ nombre: `  ${'N'.repeat(80)}  `, negocio: 'B'.repeat(80) }),
      HOY,
    );
    expect(html).toContain(`>${'N'.repeat(60)}<`);
    expect(html).not.toContain('N'.repeat(61));
    expect(html).toContain(`>${'B'.repeat(60)}<`);
    expect(html).not.toContain('B'.repeat(61));
  });

  it('sin perfil no hay bloque de identidad ni un "?" suelto', () => {
    const html = htmlReporte(senalesDe(), null, HOY);
    expect(html).not.toContain('class="identidad"');
    expect(html).not.toContain('class="inicial"');
    expect(html).toContain('Reporte de actividad del negocio');
  });

  it('con negocio pero sin nombre muestra solo el negocio', () => {
    const html = htmlReporte(senalesDe(), perfilDe({ nombre: '  ' }), HOY);
    expect(html).not.toContain('class="nombre"');
    expect(html).toContain('<div class="negocio">Anticuchos Freddy</div>');
  });
});

describe('htmlReporte · título y periodo', () => {
  it('dice el título y el periodo con las mismas fechas y cifras que el texto', () => {
    const html = htmlReporte(senalesDe({ diasRegistrados: 70 }), perfilDe(), HOY);
    expect(html).toContain('Reporte de actividad del negocio');
    expect(html).toContain('Del 23 de julio al 13 de octubre · 70 días registrados');
  });

  it('con un solo día dice la fecha y "1 día registrado"', () => {
    const html = htmlReporte(
      senalesDe({ diasRegistrados: 1, primerCierre: '2026-10-05', ultimoCierre: '2026-10-05' }),
      perfilDe(),
      HOY,
    );
    expect(html).toContain('El 5 de octubre · 1 día registrado');
  });

  it('sin días registrados lo dice con claridad', () => {
    const html = htmlReporte(senalesBanco([], HOY), perfilDe(), HOY);
    expect(html).toContain('Todavía no hay días registrados');
  });
});

describe('htmlReporte · tarjetas de cifras', () => {
  it('lleva las tres tarjetas con sus etiquetas', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html).toContain('Venta promedio mensual');
    expect(html).toContain('Ganancia promedio mensual');
    expect(html).toContain('Constancia de registro');
    expect(cuenta(html, 'class="tarjeta"')).toBe(3);
  });

  it('los montos salen con formatoSoles', () => {
    const html = htmlReporte(
      senalesDe({ ventaPromedioMensual: 1234.5, gananciaPromedioMensual: 0.1 + 0.2 }),
      perfilDe(),
      HOY,
    );
    expect(html).toContain(formatoSoles(1234.5));
    expect(html).toContain('S/ 0.30');
  });

  it('el porcentaje nunca va suelto: sus días registrados van pegados', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html).toContain(
      '<div class="valor">64 %</div><div class="detalle">58 días registrados</div>',
    );
    expect(html).toContain('de los últimos 90 días');
  });

  it('con un registro de un día, "1 día registrado" va en singular', () => {
    const html = htmlReporte(
      senalesDe({ constancia: 100, diasRegistrados: 1, diasTranscurridos: 1 }),
      perfilDe(),
      HOY,
    );
    expect(html).toContain(
      '<div class="valor">100 %</div><div class="detalle">1 día registrado</div>',
    );
  });

  it('sin ningún mes completo dice "aún no hay un mes completo" en lugar de las dos cifras', () => {
    const html = htmlReporte(sinMeses(), perfilDe(), HOY);
    expect(cuenta(html, 'aún no hay un mes completo')).toBe(2);
    expect(html).not.toContain('S/ 0.00');
    expect(html).toContain('64 %');
  });
});

describe('htmlReporte · barras por mes', () => {
  let html: string;
  beforeAll(() => {
    html = htmlReporte(senalesDe(), perfilDe(), HOY);
  });

  it('la barra mayor llena el alto (170 pt) y las demás son proporcionales', () => {
    // 4,900 ÷ 5,360 × 170 = 155.4 · 5,100 ÷ 5,360 × 170 = 161.8
    expect(html).toContain('<div class="barra" style="height: 155pt"></div>');
    expect(html).toContain('<div class="barra" style="height: 162pt"></div>');
    expect(html).toContain('<div class="barra" style="height: 170pt"></div>');
    expect(cuenta(html, 'class="barra"')).toBe(3);
  });

  it('el monto va encima de su barra y el mes en tres letras debajo', () => {
    expect(html).toContain(
      '<div class="monto">S/ 4,900.00</div><div class="barra" style="height: 155pt"></div><div class="mes">Jul</div>',
    );
    expect(html).toContain('<div class="mes">Ago</div>');
    expect(html).toContain('<div class="mes">Sep</div>');
  });

  it('un mes sin ventas se ve con una barra mínima', () => {
    const conCero = htmlReporte(
      senalesDe({
        meses: [
          { mes: '2026-08', venta: 0, teQueda: 0, dias: 0 },
          { mes: '2026-09', venta: 5000, teQueda: 2000, dias: 20 },
        ],
        mesesCompletos: 2,
      }),
      perfilDe(),
      HOY,
    );
    expect(conCero).toContain(
      '<div class="monto">S/ 0.00</div><div class="barra" style="height: 3pt">',
    );
    expect(conCero).toContain('<div class="barra" style="height: 170pt">');
  });

  it('si todos los meses valen 0 todas las barras son mínimas', () => {
    const ceros = htmlReporte(
      senalesDe({
        meses: [{ mes: '2026-09', venta: 0, teQueda: 0, dias: 0 }],
        mesesCompletos: 1,
      }),
      perfilDe(),
      HOY,
    );
    expect(ceros).toContain('<div class="barra" style="height: 3pt">');
  });

  it('un solo mes llena el alto', () => {
    const uno = htmlReporte(
      senalesDe({
        meses: [{ mes: '2026-09', venta: 800, teQueda: 300, dias: 10 }],
        mesesCompletos: 1,
      }),
      perfilDe(),
      HOY,
    );
    expect(uno).toContain('<div class="barra" style="height: 170pt">');
  });

  it('sin ningún mes completo no hay gráfico', () => {
    const vacio = htmlReporte(sinMeses(), perfilDe(), HOY);
    expect(vacio).not.toContain('class="barra"');
    expect(vacio).not.toContain('class="grafico"');
    expect(vacio).not.toContain('Venta por mes');
  });
});

describe('htmlReporte · días por mes y antigüedad', () => {
  it('lleva la tabla "Días registrados por mes"', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html).toContain('Días registrados por mes');
    expect(html).toContain('<td>Julio</td><td class="num">18 días</td>');
    expect(html).toContain('<td>Septiembre</td><td class="num">18 días</td>');
  });

  it('con un día dice "1 día"', () => {
    const html = htmlReporte(
      senalesDe({
        meses: [{ mes: '2026-09', venta: 100, teQueda: 50, dias: 1 }],
        mesesCompletos: 1,
      }),
      perfilDe(),
      HOY,
    );
    expect(html).toContain('<td>Septiembre</td><td class="num">1 día</td>');
  });

  it('sin meses completos no hay tabla', () => {
    const html = htmlReporte(sinMeses(), perfilDe(), HOY);
    expect(html).not.toContain('<table');
    expect(html).not.toContain('Días registrados por mes');
  });

  it('dice desde cuándo registra, con las mismas palabras que el texto', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html).toContain('Registra desde el 16 de julio (96 días)');
  });

  it('sin registro no dice desde cuándo', () => {
    const html = htmlReporte(senalesBanco([], HOY), perfilDe(), HOY);
    expect(html).not.toContain('Registra desde');
  });
});

describe('htmlReporte · en construcción', () => {
  it('avisa cuántos días faltan y atenúa todo el documento', () => {
    const html = htmlReporte(
      senalesDe({ enConstruccion: true, diasFaltantes: 21, diasRegistrados: 9 }),
      perfilDe(),
      HOY,
    );
    expect(html).toContain(
      '<div class="aviso"><strong>Te faltan 21 días de registro para que tu reporte sea convincente</strong></div>',
    );
    expect(html).toContain('<div class="hoja" style="opacity: 0.6">');
  });

  it('con un día que falta usa el singular', () => {
    const html = htmlReporte(
      senalesDe({ enConstruccion: true, diasFaltantes: 1 }),
      perfilDe(),
      HOY,
    );
    expect(html).toContain('Te falta 1 día de registro para que tu reporte sea convincente');
  });

  it('un reporte convincente no lleva aviso ni atenuación', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html).not.toContain('class="aviso"');
    expect(html).not.toContain('opacity');
    expect(html).not.toContain('Te faltan');
  });
});

describe('htmlReporte · pie', () => {
  let html: string;
  beforeAll(() => {
    html = htmlReporte(senalesDe(), perfilDe(), HOY);
  });

  it('lleva la frase de los totales registrados por el propio negocio', () => {
    expect(html).toContain(FRASE_PIE);
  });

  it('dice cuándo se generó, con el año', () => {
    expect(html).toContain('Generado el martes 20 de octubre de 2026');
  });
});

describe('htmlReporte · privacidad y escape', () => {
  const privado = perfilDe({
    yapeAjeno: true,
    yapeNumero: '987654321',
    yapeTitular: 'Persona de prueba',
    yapeParentesco: 'hermana',
    ubicacion: 'Afuera de la UTP',
    fotoUri: FOTO,
  });

  it('del perfil solo salen el nombre, el negocio y la foto', () => {
    const html = htmlReporte(senalesDe(), privado, HOY);
    for (const dato of ['987654321', 'Persona de prueba', 'hermana', 'Afuera de la UTP']) {
      expect(html).not.toContain(dato);
    }
    expect(html).toContain('Freddy');
    expect(html).toContain(FOTO);
  });

  it('escapa el nombre y el negocio', () => {
    const html = htmlReporte(
      senalesDe(),
      perfilDe({ nombre: `<script>alert("x")</script>`, negocio: `Pepe's & "Hijos" <i>` }),
      HOY,
    );
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('Pepe&#39;s &amp; &quot;Hijos&quot; &lt;i&gt;');
  });

  it('la inicial también va escapada', () => {
    const html = htmlReporte(senalesDe(), perfilDe({ nombre: '<Freddy' }), HOY);
    expect(html).toContain('<div class="inicial">&lt;</div>');
  });

  it('no muta sus entradas y siempre da el mismo documento', () => {
    const s = congelarTodo(senalesDe({ enConstruccion: true, diasFaltantes: 3 }));
    const p = congelarTodo({ ...privado });
    const primero = htmlReporte(s, p, HOY);
    expect(htmlReporte(s, p, HOY)).toBe(primero);
  });
});

describe('escaparHtml', () => {
  it('cambia los cinco caracteres que importan', () => {
    expect(escaparHtml('&')).toBe('&amp;');
    expect(escaparHtml('<')).toBe('&lt;');
    expect(escaparHtml('>')).toBe('&gt;');
    expect(escaparHtml('"')).toBe('&quot;');
    expect(escaparHtml("'")).toBe('&#39;');
  });

  it('escapa todas las apariciones, "&" primero (sin doble escape)', () => {
    expect(escaparHtml(`<a href="x">Pepe's & Co</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Pepe&#39;s &amp; Co&lt;/a&gt;',
    );
    expect(escaparHtml('&lt;')).toBe('&amp;lt;');
  });

  it('deja intacto lo demás: tildes, eñes y vacío', () => {
    expect(escaparHtml('Año Ñandú á é í ó ú')).toBe('Año Ñandú á é í ó ú');
    expect(escaparHtml('')).toBe('');
  });
});

describe('NOMBRE_ARCHIVO_PDF', () => {
  it('es "Reporte-Crecemos-" con la fecha, sin extensión', () => {
    expect(NOMBRE_ARCHIVO_PDF('2026-10-20')).toBe('Reporte-Crecemos-2026-10-20');
  });

  it('no tiene espacios, tildes ni extensión', () => {
    expect(NOMBRE_ARCHIVO_PDF('2026-01-05')).toMatch(/^[A-Za-z0-9-]+$/);
    expect(NOMBRE_ARCHIVO_PDF('2026-01-05').endsWith('.pdf')).toBe(false);
  });
});

/** El texto que se lee en el documento: sin el estilo ni las etiquetas. */
const soloTexto = (html: string): string =>
  html
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ');

/** El cuerpo de una regla de estilo: `.valor { … }` → '…'. */
const regla = (html: string, selector: string): string => {
  const inicio = html.indexOf(`${selector} {`);
  if (inicio < 0) throw new Error(`No hay ninguna regla "${selector}"`);
  return html.slice(html.indexOf('{', inicio) + 1, html.indexOf('}', inicio));
};

describe('htmlReporte · línea de promedio', () => {
  it('dibuja una línea punteada horizontal con la etiqueta "Promedio S/ …"', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    // 5,120 ÷ 5,360 × 170 = 162.4 pt sobre la base de las barras (18 pt de los meses).
    expect(html).toContain('<div class="promedio" style="bottom: 180pt"></div>');
    expect(cuenta(html, 'class="promedio"')).toBe(1);
    expect(regla(html, '.promedio')).toContain('dotted');
    expect(soloTexto(html)).toContain('Promedio S/ 5,120.00');
  });

  it('la etiqueta usa formatoSoles con la venta promedio mensual', () => {
    const html = htmlReporte(senalesDe({ ventaPromedioMensual: 5163.5 }), perfilDe(), HOY);
    expect(soloTexto(html)).toContain(`Promedio ${formatoSoles(5163.5)}`);
    expect(soloTexto(html)).toContain('Promedio S/ 5,163.50');
  });

  it('no usa JavaScript: es un <div> con el borde punteado y la altura en pt', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html.toLowerCase()).not.toContain('<script');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<canvas');
    expect(regla(html, '.promedio')).toContain('position: absolute');
  });

  it('con un solo mes completo la línea queda a la altura de su barra', () => {
    const html = htmlReporte(
      senalesDe({
        ventaPromedioMensual: 800,
        meses: [{ mes: '2026-09', venta: 800, teQueda: 300, dias: 10 }],
        mesesCompletos: 1,
      }),
      perfilDe(),
      HOY,
    );
    expect(html).toContain('<div class="promedio" style="bottom: 188pt"></div>');
    expect(soloTexto(html)).toContain('Promedio S/ 800.00');
  });

  it('un promedio mayor que la barra mayor no se sale del gráfico', () => {
    const html = htmlReporte(senalesDe({ ventaPromedioMensual: 999999 }), perfilDe(), HOY);
    expect(html).toContain('<div class="promedio" style="bottom: 188pt"></div>');
  });

  it('si todas las ventas son 0 la línea queda en la base', () => {
    const html = htmlReporte(
      senalesDe({
        ventaPromedioMensual: 0,
        meses: [{ mes: '2026-09', venta: 0, teQueda: 0, dias: 0 }],
        mesesCompletos: 1,
      }),
      perfilDe(),
      HOY,
    );
    expect(html).toContain('<div class="promedio" style="bottom: 18pt"></div>');
  });

  it('sin ningún mes completo no hay línea ni etiqueta de promedio', () => {
    const html = htmlReporte(sinMeses(), perfilDe(), HOY);
    expect(html).not.toContain('class="promedio"');
    expect(soloTexto(html)).not.toMatch(/Promedio S\//);
  });

  it('el monto de cada barra sigue encima de ella y el mes debajo', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html.indexOf('<div class="monto">S/ 5,360.00</div>')).toBeLessThan(
      html.indexOf('<div class="barra" style="height: 170pt">'),
    );
    expect(html).toContain('<div class="mes">Sep</div>');
  });
});

describe('htmlReporte · cómo leer este reporte', () => {
  const DEFINICIONES = [
    'Venta promedio mensual: lo que vendió el negocio en un mes, promediado sobre los últimos meses completos.',
    'Ganancia promedio mensual: lo que le queda al negocio en el mes, después de restar lo que gastó.',
    'Constancia de registro: el porcentaje de los últimos 90 días en los que el negocio registró su día de ventas.',
  ];
  const casos: [string, Senales][] = [
    ['con tres meses', senalesDe()],
    ['en construcción', senalesDe({ enConstruccion: true, diasFaltantes: 21 })],
    ['sin ningún mes completo', sinMeses()],
    ['sin días registrados', senalesBanco([], HOY)],
  ];

  it('lleva el título y las tres definiciones, palabra por palabra', () => {
    const texto = soloTexto(htmlReporte(senalesDe(), perfilDe(), HOY));
    expect(texto).toContain('Cómo leer este reporte');
    for (const definicion of DEFINICIONES) expect(texto).toContain(definicion);
    expect(cuenta(htmlReporte(senalesDe(), perfilDe(), HOY), 'class="def"')).toBe(3);
  });

  it.each(casos)('las definiciones también van %s', (_nombre, senales) => {
    const texto = soloTexto(htmlReporte(senales, perfilDe(), HOY));
    expect(texto).toContain('Cómo leer este reporte');
    for (const definicion of DEFINICIONES) expect(texto).toContain(definicion);
  });

  it.each(casos)('no usa las palabras "balance" ni "margen" %s', (_nombre, senales) => {
    const texto = soloTexto(htmlReporte(senales, perfilDe(), HOY));
    expect(texto).not.toMatch(/balance|margen|utilidad|conciliar/i);
  });

  it('cada definición cabe en una línea corta: sin jerga y de menos de 120 caracteres', () => {
    for (const definicion of DEFINICIONES) expect(definicion.length).toBeLessThan(120);
  });

  it('va después de las cifras y antes del pie', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(html.indexOf('Cómo leer este reporte')).toBeGreaterThan(html.indexOf('Venta por mes'));
    expect(html.indexOf('Cómo leer este reporte')).toBeLessThan(html.indexOf('class="pie"'));
  });
});

describe('htmlReporte · jerarquía y una sola página A4', () => {
  const peor = (): string =>
    htmlReporte(
      senalesDe({ enConstruccion: true, diasFaltantes: 21 }),
      perfilDe({ nombre: 'N'.repeat(60), negocio: 'B'.repeat(60), fotoUri: FOTO }),
      HOY,
    );

  it('el título mide 24 pt y el número de cada tarjeta, 22 pt', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(regla(html, 'h1')).toMatch(/font-size:\s*24pt/);
    expect(regla(html, '.valor')).toMatch(/font-size:\s*22pt/);
  });

  it('separa las secciones con una línea fina', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(regla(html, '.seccion')).toContain('border-top: 1pt solid #E4D7DE');
    expect(cuenta(html, 'class="seccion')).toBeGreaterThanOrEqual(2);
  });

  it('el pie queda al fondo de la hoja, con la privacidad y la fecha', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    expect(regla(html, '.hoja')).toContain('display: flex');
    expect(regla(html, '.hoja')).toContain('flex-direction: column');
    expect(regla(html, '.pie')).toContain('margin-top: auto');
    const pie = html.slice(html.indexOf('<div class="pie">'));
    expect(soloTexto(pie)).toContain(FRASE_PIE);
    expect(soloTexto(pie)).toContain('Generado el martes 20 de octubre de 2026');
    // El pie es lo último de la hoja: nada de contenido después.
    expect(html.indexOf('<div class="pie">')).toBeGreaterThan(
      html.indexOf('Cómo leer este reporte'),
    );
  });

  it('la hoja mide menos que la página (842 pt) y no se parte', () => {
    const html = htmlReporte(senalesDe(), perfilDe(), HOY);
    const alto = Number(/min-height:\s*([\d.]+)pt/.exec(regla(html, '.hoja'))?.[1]);
    expect(alto).toBeGreaterThanOrEqual(800);
    expect(alto).toBeLessThanOrEqual(842);
    expect(regla(html, '.hoja')).toContain('page-break-inside: avoid');
    expect(regla(html, '.hoja')).toContain('break-inside: avoid');
    expect(regla(html, '.hoja')).toContain('width: 595pt');
  });

  it('nunca fuerza un salto de página y tiene una sola hoja, también en el peor caso', () => {
    const documentos = [
      htmlReporte(senalesDe(), perfilDe(), HOY),
      htmlReporte(sinMeses({ enConstruccion: true, diasFaltantes: 21 }), perfilDe(), HOY),
      peor(),
    ];
    for (const html of documentos) {
      expect(cuenta(html, 'class="hoja"')).toBe(1);
      expect(html).not.toMatch(/page-break-(before|after):\s*always/);
      expect(html).not.toMatch(/break-(before|after):\s*(page|always)/);
      expect(html.trimEnd().endsWith('</div></body></html>')).toBe(true);
    }
  });

  it('en el peor caso (3 meses, en construcción, nombres de 60 letras, con foto) la foto y el pie siguen', () => {
    const html = peor();
    expect(html).toContain(`<img class="foto" src="${FOTO}" alt="">`);
    expect(html).toContain('Cómo leer este reporte');
    expect(html).toContain('class="aviso"');
    expect(html).toContain('class="pie"');
    expect(cuenta(html, 'class="barra"')).toBe(3);
  });

  it('el peor caso sigue siendo un documento ligero (menos de 12 KB sin la foto)', () => {
    const sinFoto = htmlReporte(
      senalesDe({ enConstruccion: true, diasFaltantes: 21 }),
      perfilDe({ nombre: 'N'.repeat(60), negocio: 'B'.repeat(60) }),
      HOY,
    );
    expect(Buffer.byteLength(sinFoto, 'utf8')).toBeLessThan(12 * 1024);
  });
});

describe('htmlReporte · cabe en una página', () => {
  const bytes = (texto: string): number => Buffer.byteLength(texto, 'utf8');

  it('sin foto, con 3 meses, pesa menos de 12 KB', () => {
    expect(bytes(htmlReporte(senalesDe(), perfilDe(), HOY))).toBeLessThan(12 * 1024);
  });

  it('en el peor caso (en construcción, nombres de 60 caracteres) sigue por debajo de 12 KB', () => {
    const html = htmlReporte(
      senalesDe({ enConstruccion: true, diasFaltantes: 21 }),
      perfilDe({ nombre: 'N'.repeat(60), negocio: 'B'.repeat(60) }),
      HOY,
    );
    expect(bytes(html)).toBeLessThan(12 * 1024);
  });

  it('tiene como mucho 3 barras aunque la señal traiga más meses por error', () => {
    const cuatro = senalesDe({
      meses: [
        { mes: '2026-06', venta: 100, teQueda: 10, dias: 1 },
        { mes: '2026-07', venta: 200, teQueda: 10, dias: 1 },
        { mes: '2026-08', venta: 300, teQueda: 10, dias: 1 },
        { mes: '2026-09', venta: 400, teQueda: 10, dias: 1 },
      ],
      mesesCompletos: 4,
    });
    // senalesBanco nunca da más de 3; el documento no inventa un límite propio: dibuja lo que recibe.
    expect(cuenta(htmlReporte(cuatro, perfilDe(), HOY), 'class="barra"')).toBe(4);
  });
});

describe('con la semilla real y hoy = 2026-10-20', () => {
  const semilla = () => {
    const r = validarSemilla(
      JSON.parse(readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8')),
    );
    if (!r.ok) throw new Error('La semilla real no valida');
    return r.semilla;
  };
  let cierres: Cierre[];
  let html: string;
  const perfil = perfilDe({
    yapeNumero: '987654321',
    yapeTitular: 'Marta Quispe',
    yapeParentesco: 'hermana',
    yapeAjeno: true,
    ubicacion: 'Av. Los Olivos 123, Comas',
  });

  beforeAll(() => {
    ({ cierres } = materializarSemilla(semilla(), new Date(2026, 9, 20, 12)));
    html = htmlReporte(senalesBanco(cierres, HOY), perfil, HOY);
  });

  it('lleva las cifras del reporte y los dos meses completos (agosto y septiembre)', () => {
    expect(html).toContain('Venta promedio mensual');
    expect(html).toContain('Ganancia promedio mensual');
    expect(html).toContain('<div class="mes">Ago</div>');
    expect(html).toContain('<div class="mes">Sep</div>');
    expect(html).toContain('<td>Agosto</td>');
    expect(html).toContain('<td>Septiembre</td>');
    expect(cuenta(html, 'class="barra"')).toBe(2);
    expect(html).not.toContain('Te faltan');
    expect(html).not.toContain('opacity');
  });

  it('no lleva ninguno de los datos privados ni el monto de un cierre suelto', () => {
    for (const dato of ['987654321', 'Marta Quispe', 'hermana', 'Av. Los Olivos 123, Comas']) {
      expect(html).not.toContain(dato);
    }
    const s = senalesBanco(cierres, HOY);
    const permitidos = new Set([
      formatoSoles(s.ventaPromedioMensual),
      formatoSoles(s.gananciaPromedioMensual),
      ...s.meses.map(m => formatoSoles(m.venta)),
    ]);
    const montos = new Set(html.match(/S\/ [\d,]+\.\d{2}/g));
    expect(montos.size).toBeGreaterThan(0);
    for (const monto of montos) expect(permitidos.has(monto)).toBe(true);
  });

  it('sin foto cabe en una página: menos de 12 KB', () => {
    expect(Buffer.byteLength(html, 'utf8')).toBeLessThan(12 * 1024);
  });
});
