// src/analisis/htmlReporte.ts
// El reporte como documento HTML para imprimir en A4 (595 × 842 pt), en una sola página. Puro: sin
// React, sin reloj (AGENTS.md, regla 3). Sin JavaScript, sin enlaces y sin imágenes externas: lo que
// sale es lo que se ve, y del perfil solo entran el nombre, el negocio y la foto (RNF-08, regla 8).
import { avatarDe } from '@dominio/foto';
import { formatoFecha, formatoFechaCorta, formatoSoles, nombreMes } from '@dominio/formato';
import type { FechaNegocio, MesCompleto, Perfil, Senales } from '@dominio/tipos';
import {
  AVISO_EJEMPLO_SECCION,
  codigoDeEnlace,
  construirPasaporte,
  explicacionCuota,
  modulosQR,
  NOTA_CODIGO,
  NOTA_CUOTA,
  svgQR,
  textoCaduca,
  textoCuota,
  TITULO_CODIGO,
  TITULO_CONSTANCIA,
  TITULO_CUOTA_BANCO,
  type EnlaceQR,
  type Pasaporte,
} from './pasaporte';
import {
  diasCerradosTexto,
  fraseDiaMasVentas,
  fraseDiaQueMasDeja,
  fraseDiaQueMenosDeja,
  fraseMesFuerte,
  fraseProductoEstrella,
  NOTA_SIN_DIAS_SEMANA,
} from './frasesInteligencia';
import { ESTILOS_TORTA, etiquetaTorta, textoPorcion, type PorcionTorta } from './graficos';
import type { ExtraReporte, MesNegocio } from './inteligencia';
import { AVISO_EJEMPLO, diasRegistradosTexto, textoFaltan, VENTANA_DIAS } from './senales';

/** Alto de la barra del mes mayor, en pt; las demás son proporcionales. */
const ALTO_BARRA_PT = 70;
/** Alto mínimo de una barra: un mes sin ventas igual se ve. */
const ALTO_MINIMO_PT = 3;
/** Alto de la fila con el nombre del mes, debajo de las barras: la línea de promedio parte de ahí. */
const ALTO_MES_PT = 18;
/** Zona del gráfico: el monto (≈ 18 pt) encima de la barra más alta, más el mes debajo. */
const ALTO_GRAFICO_PT = ALTO_BARRA_PT + ALTO_MES_PT + 20;
/** Opacidad de la hoja mientras el reporte está en construcción (igual que la pantalla). */
const OPACIDAD_EN_CONSTRUCCION = 0.6;
/** Largo máximo del nombre y del negocio (igual que `textoReporte`). */
const MAX_ROTULO = 60;

const FRASE_PIE =
  'Son totales registrados por el propio negocio en la app Crecemos; no incluyen movimientos individuales.';
const SIN_MES = 'aún no hay un mes completo';

/** Para el analista del banco: sin jerga, una frase cada una. */
const TITULO_COMO_LEER = 'Cómo leer este reporte';
const DEFINICION_VENTA =
  'lo que vendió el negocio en un mes, promediado sobre los últimos meses completos.';
const DEFINICION_GANANCIA =
  'ventas menos gastos registrados en el mes; incluye pagos pendientes de recibir.';
const DEFINICION_CONSTANCIA = `el porcentaje de los últimos ${VENTANA_DIAS} días en los que el negocio registró su día de ventas.`;

const ENTIDADES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa lo que no debe leerse como HTML: `&`, `<`, `>`, `"` y `'`. */
export const escaparHtml = (texto: string): string => texto.replace(/[&<>"']/g, c => ENTIDADES[c]);

/** 'Reporte-Crecemos-2026-10-20': sin extensión, sin espacios ni tildes (la librería agrega `.pdf`). */
export const NOMBRE_ARCHIVO_PDF = (hoy: FechaNegocio): string => `Reporte-Crecemos-${hoy}`;

const ESTILO = `
@page { size: 595pt 842pt; margin: 0 }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact }
html, body { margin: 0; padding: 0; background: #fff }
body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.25; color: #1A1016 }
.hoja { width: 595pt; min-height: 838pt; display: flex; flex-direction: column; page-break-inside: avoid; break-inside: avoid }
.banda { background: #CD0157; color: #fff; padding: 9pt 36pt; display: flex; justify-content: space-between; align-items: center }
.marca { font-size: 22pt; font-weight: 700 }
.fecha { font-size: 12pt }
.contenido { padding: 8pt 36pt 0 }
.identidad { display: flex; align-items: center; margin-bottom: 6pt; page-break-inside: avoid; break-inside: avoid }
.foto, .inicial { width: 56pt; height: 56pt; border-radius: 50%; margin-right: 14pt; flex-shrink: 0 }
.foto { object-fit: cover; border: 1pt solid #E4D7DE }
.inicial { background: #CD0157; color: #fff; font-size: 26pt; font-weight: 700; text-align: center; line-height: 56pt }
.identidad > div:last-child { min-width: 0 }
.nombre { font-size: 18pt; font-weight: 700; overflow-wrap: anywhere }
.negocio { font-size: 12pt; color: #6B5A62; overflow-wrap: anywhere }
h1 { font-size: 24pt; line-height: 1.15; margin: 0 0 2pt }
.periodo { font-size: 12pt; color: #6B5A62; margin-bottom: 6pt }
.aviso { border-left: 4pt solid #CD0157; background: #FAF5F7; padding: 5pt 12pt; margin-bottom: 6pt; font-size: 12pt; page-break-inside: avoid; break-inside: avoid }
.tarjetas { display: flex; margin-bottom: 4pt; page-break-inside: avoid; break-inside: avoid }
.tarjeta { flex: 1; min-width: 0; border: 1pt solid #E4D7DE; background: #FAF5F7; border-radius: 8pt; padding: 9pt; margin-right: 8pt }
.tarjeta:last-child { margin-right: 0 }
.etiqueta { color: #6B5A62 }
.valor { font-size: 22pt; line-height: 1.15; font-weight: 700; margin-top: 3pt }
.tarjeta:last-child .valor { color: #0F7A4F }
.sinmes { font-size: 12pt; color: #6B5A62; margin-top: 6pt }
.detalle, .base { color: #6B5A62 }
.seccion { border-top: 1pt solid #E4D7DE; padding-top: 8pt; margin-top: 8pt; page-break-inside: avoid; break-inside: avoid }
.fila { display: flex; align-items: flex-start }
.grafico { flex: 1.35; min-width: 0; margin-right: 22pt }
.dias { flex: 1; min-width: 0 }
.subtitulo { font-size: 13pt; font-weight: 700; margin-bottom: 6pt }
.cab { display: flex; justify-content: space-between; align-items: baseline }
.leyenda { color: #6B5A62; white-space: nowrap }
.muestra { display: inline-block; width: 18pt; border-top: 2pt dotted #1A1016; margin-right: 5pt; vertical-align: middle }
.barras { position: relative; display: flex; align-items: flex-end; height: ${ALTO_GRAFICO_PT}pt }
.eje { position: absolute; left: 0; right: 0; bottom: ${ALTO_MES_PT}pt; border-top: 1pt solid #E4D7DE }
.promedio { position: absolute; left: 0; right: 0; z-index: 1; border-top: 2pt dotted #1A1016 }
.col { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end }
.monto { position: relative; z-index: 2; background: #fff; padding: 0 3pt; font-weight: 700; margin-bottom: 3pt; white-space: nowrap }
.barra { width: 56pt; background: #CD0157; border-radius: 3pt 3pt 0 0 }
.mes { height: ${ALTO_MES_PT}pt; line-height: ${ALTO_MES_PT}pt; color: #6B5A62 }
table { border-collapse: collapse; width: 100% }
td { padding: 5pt 0; border-bottom: 1pt solid #E4D7DE }
td.num { text-align: right; font-weight: 700 }
.antiguedad { color: #6B5A62; margin-top: 8pt; padding: 8pt 10pt; background: #FAF5F7; border-radius: 6pt }
.def { margin-bottom: 3pt }
.def:last-child { margin-bottom: 0 }
.pasaporte { display: flex; flex-wrap: wrap; align-items: flex-start }
.nota-codigo { width: 100%; margin-top: 6pt; color: #6B5A62 }
.cuota { flex: 1; min-width: 0; margin-right: 22pt }
.valor-cuota { font-size: 18pt; line-height: 1.15; font-weight: 700; margin-bottom: 3pt }
.constancia-mes { margin-top: 5pt }
.codigo { flex: 1.1; min-width: 0; display: flex; align-items: flex-start }
.codigo svg { flex-shrink: 0; margin-right: 10pt; border: 1pt solid #E4D7DE }
.enlace-reporte { font-size: 11pt; margin-top: 2pt; color: #6B5A62; overflow-wrap: anywhere; font-family: Menlo, Courier, monospace }
.numero-codigo { font-size: 14pt; font-weight: 700; letter-spacing: 0.5pt; font-family: Menlo, Courier, monospace }
.ejemplo { font-size: 11pt; font-weight: 700; color: #CD0157 }
.pie { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-start; padding: 8pt 36pt; border-top: 1pt solid #E4D7DE; color: #6B5A62; page-break-inside: avoid; break-inside: avoid }
.privacidad { flex: 1; margin-right: 18pt }
.generado { width: 170pt; text-align: right }
`;

const dias = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;

const capitalizar = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

/** 'Jul', 'Ago', 'Sep': el mes en tres letras, como en la pantalla. */
const mesCorto = (m: MesCompleto): string => capitalizar(nombreMes(`${m.mes}-01`).slice(0, 3));

/** Alto en pt de `valor` respecto de `mayor`: nunca más que la barra mayor. */
const proporcion = (valor: number, mayor: number): number =>
  mayor > 0 ? Math.min(ALTO_BARRA_PT, Math.round((valor / mayor) * ALTO_BARRA_PT)) : 0;

const altoBarra = (venta: number, mayor: number): number =>
  Math.max(ALTO_MINIMO_PT, proporcion(venta, mayor));

const identidad = (perfil: Perfil | null): string => {
  const nombre = (perfil?.nombre ?? '').trim().slice(0, MAX_ROTULO);
  const negocio = (perfil?.negocio ?? '').trim().slice(0, MAX_ROTULO);
  const avatar = avatarDe(perfil);
  // Sin foto y sin nombre no hay nada que mostrar en el círculo: un "?" no va en un documento.
  const circulo =
    avatar.tipo === 'foto'
      ? `<img class="foto" src="${escaparHtml(avatar.uri)}" alt="">`
      : nombre === ''
      ? ''
      : `<div class="inicial">${escaparHtml(avatar.texto)}</div>`;
  const quien =
    (nombre === '' ? '' : `<div class="nombre">${escaparHtml(nombre)}</div>`) +
    (negocio === '' ? '' : `<div class="negocio">${escaparHtml(negocio)}</div>`);
  return circulo === '' && quien === ''
    ? ''
    : `<div class="identidad">${circulo}<div>${quien}</div></div>`;
};

const periodo = (s: Senales): string => {
  const { primerCierre, ultimoCierre } = s;
  if (primerCierre === undefined || ultimoCierre === undefined) {
    return 'Todavía no hay días registrados';
  }
  const rango =
    primerCierre === ultimoCierre
      ? `El ${formatoFechaCorta(primerCierre)}`
      : `Del ${formatoFechaCorta(primerCierre)} al ${formatoFechaCorta(ultimoCierre)}`;
  return `${rango} · ${diasRegistradosTexto(s.diasRegistrados)}`;
};

const tarjetas = (s: Senales): string => {
  const hayMeses = s.mesesCompletos > 0;
  const cifra = (etiqueta: string, monto: number): string =>
    `<div class="tarjeta"><div class="etiqueta">${etiqueta}</div>${
      hayMeses
        ? `<div class="valor">${formatoSoles(monto)}</div>`
        : `<div class="sinmes">${SIN_MES}</div>`
    }</div>`;
  // Ningún porcentaje va solo: la constancia siempre lleva sus días registrados pegados.
  const base =
    s.diasTranscurridos === 0
      ? ''
      : `<div class="base">${
          s.diasTranscurridos === VENTANA_DIAS
            ? `de los últimos ${VENTANA_DIAS} días`
            : `de los ${dias(s.diasTranscurridos)} desde su primer cierre`
        }</div>`;
  return (
    '<div class="tarjetas">' +
    cifra('Venta promedio mensual', s.ventaPromedioMensual) +
    cifra('Resultado registrado promedio mensual', s.gananciaPromedioMensual) +
    '<div class="tarjeta"><div class="etiqueta">Constancia de registro</div>' +
    `<div class="valor">${s.constancia} %</div>` +
    `<div class="detalle">${diasRegistradosTexto(s.diasRegistrados)}</div>` +
    `${base}</div></div>`
  );
};

const antiguedad = (s: Senales): string =>
  s.registraDesde === undefined
    ? ''
    : `<div class="antiguedad">Registra desde el ${formatoFechaCorta(s.registraDesde)} (${dias(
        s.antiguedadDias,
      )})</div>`;

/**
 * Barras de venta por mes, con su línea de promedio, junto a los días registrados por mes. Todo con
 * `<div>`: la línea del promedio es un borde punteado a la altura del promedio, sin JavaScript.
 */
const graficoYTabla = (s: Senales): string => {
  const { meses } = s;
  if (meses.length === 0) {
    const sola = antiguedad(s);
    return sola === '' ? '' : `<div class="seccion">${sola}</div>`;
  }
  const mayor = Math.max(...meses.map(m => m.venta));
  const columnas = meses
    .map(
      m =>
        `<div class="col"><div class="monto">${formatoSoles(m.venta)}</div>` +
        `<div class="barra" style="height: ${altoBarra(m.venta, mayor)}pt"></div>` +
        `<div class="mes">${mesCorto(m)}</div></div>`,
    )
    .join('');
  const filas = meses
    .map(
      m =>
        `<tr><td>${capitalizar(nombreMes(`${m.mes}-01`))}</td><td class="num">${dias(
          m.dias,
        )}</td></tr>`,
    )
    .join('');
  const promedio = formatoSoles(s.ventaPromedioMensual);
  const alturaPromedio = ALTO_MES_PT + proporcion(s.ventaPromedioMensual, mayor);
  return (
    '<div class="seccion fila">' +
    '<div class="grafico">' +
    `<div class="cab"><div class="subtitulo">Venta por mes</div><div class="leyenda"><span class="muestra"></span>Promedio ${promedio}</div></div>` +
    `<div class="barras"><div class="eje"></div>${columnas}` +
    `<div class="promedio" style="bottom: ${alturaPromedio}pt"></div></div>` +
    '</div>' +
    `<div class="dias"><div class="subtitulo">Días registrados por mes</div><table>${filas}</table>${antiguedad(
      s,
    )}</div>` +
    '</div>'
  );
};

const LADO_QR_PT = 84;

/** Marca al lado del título de cada sección nueva cuando los datos son solo de ejemplo. */
const marcaEjemplo = (p: Pasaporte): string =>
  p.soloEjemplo ? ` <span class="ejemplo">· ${AVISO_EJEMPLO_SECCION}</span>` : '';

/**
 * El pasaporte para el banco: la cuota de referencia (siempre con su "es una referencia") a la
 * izquierda; el código de constancia con su QR, los días del último mes y lo que ES (y no es) el
 * código a la derecha.
 */
const pasaporte = (p: Pasaporte | null, enlace?: EnlaceQR): string => {
  if (p === null) return '';
  const ultimoMes = p.constanciaMensual[p.constanciaMensual.length - 1];
  const cuota =
    `<div class="cuota"><div class="subtitulo">${TITULO_CUOTA_BANCO}${marcaEjemplo(p)}</div>` +
    `<div class="valor-cuota">${escaparHtml(textoCuota(p.cuota))}</div>` +
    (p.cuota.disponible
      ? `<div class="detalle">${escaparHtml(explicacionCuota(p.cuota))}</div>`
      : '') +
    `<div class="detalle">${NOTA_CUOTA}</div></div>`;
  // Sin enlace no hay ni QR ni código: solo la constancia del último mes, en palabras. Con enlace: el QR de SU
  // dirección, el código que sale de su id, la fecha en que deja de funcionar y la dirección en texto pequeño.
  const codigo =
    `<div class="codigo">${enlace === undefined ? '' : svgQR(modulosQR(enlace.url), LADO_QR_PT)}` +
    `<div><div class="subtitulo">${
      enlace === undefined ? TITULO_CONSTANCIA : TITULO_CODIGO
    }${marcaEjemplo(p)}</div>` +
    (enlace === undefined ? '' : `<div class="numero-codigo">${codigoDeEnlace(enlace.id)}</div>`) +
    (ultimoMes === undefined
      ? ''
      : `<div class="constancia-mes">${escaparHtml(ultimoMes.frase)}</div>`) +
    (enlace === undefined
      ? ''
      : `<div class="constancia-mes"><strong>${escaparHtml(
          textoCaduca(enlace.caduca),
        )}</strong></div>` + `<div class="enlace-reporte">${escaparHtml(enlace.url)}</div>`) +
    '</div></div>';
  return `<div class="seccion pasaporte">${cuota}${codigo}${
    enlace === undefined ? '' : `<div class="nota-codigo">${NOTA_CODIGO}</div>`
  }</div>`;
};

const comoLeer = (): string => {
  const definicion = (termino: string, texto: string): string =>
    `<div class="def"><strong>${termino}:</strong> ${texto}</div>`;
  return (
    `<div class="seccion"><div class="subtitulo">${TITULO_COMO_LEER}</div>` +
    definicion('Venta promedio mensual', DEFINICION_VENTA) +
    definicion('Resultado registrado promedio mensual', DEFINICION_GANANCIA) +
    definicion('Constancia de registro', DEFINICION_CONSTANCIA) +
    '</div>'
  );
};

/** 'martes 20 de octubre de 2026': el día en minúscula, dentro de una frase. */
const fechaEnFrase = (hoy: FechaNegocio): string => {
  const f = formatoFecha(hoy);
  return `${f.charAt(0).toLowerCase()}${f.slice(1)} de ${hoy.slice(0, 4)}`;
};

// --- Las páginas de inteligencia de negocio (solo cuando se pide) ---------------------------------

/** Estilos de las páginas de inteligencia. Aparte, para que el documento sin ellas sea el de siempre. */
const ESTILO_EXTRA = `
.pagina { width: 595pt; page-break-before: always; break-before: page }
.pagina .contenido { padding: 14pt 36pt 0 }
h2 { font-size: 20pt; line-height: 1.15; margin: 0 0 3pt }
.valor-chico { font-size: 15pt; line-height: 1.15; font-weight: 700; margin-top: 3pt }
.linea { margin-bottom: 4pt }
th { text-align: left; padding: 4pt 0; border-bottom: 1pt solid #1A1016; color: #6B5A62 }
th.num { text-align: right }
tr { page-break-inside: avoid; break-inside: avoid }
.torta { display: flex; align-items: flex-start }
.torta > svg { flex-shrink: 0; margin-right: 18pt }
.leyenda-torta { flex: 1; min-width: 0 }
.ley { display: flex; align-items: center; margin-bottom: 6pt; page-break-inside: avoid; break-inside: avoid }
.ley svg { flex-shrink: 0; margin-right: 8pt; border: 1pt solid #1A1016 }
.ley-monto { color: #6B5A62 }
.pie-extra { margin-top: 12pt; padding: 8pt 0 14pt; border-top: 1pt solid #E4D7DE; color: #6B5A62 }
`;

/** Cuántos meses dibuja el gráfico y cuántos lista la tabla. */
const MESES_EN_GRAFICO = 12;
const MESES_EN_TABLA = 24;
const ALTO_FILA_MES_PT = 40;
const X_BARRAS_PT = 74;
const ANCHO_MAXIMO_BARRA_PT = 250;
const ANCHO_SVG_PT = 523;
const LADO_TORTA_PT = 160;
const NO_HAY_COMPARACION = 'No hay dos meses seguidos con días cerrados para comparar.';
const SIN_VENTAS = 'Aún no hay ventas en este periodo.';

const COLOR_RESULTADO = '#0F7A4F';
const COLOR_NEGATIVO = '#B3261E';

const banda = (hoy: FechaNegocio): string =>
  `<div class="banda"><div class="marca">Crecemos</div><div class="fecha">${formatoFecha(
    hoy,
  )}</div></div>`;

const textoSvg = (x: number, y: number, texto: string, extra = ''): string =>
  `<text x="${x}" y="${y}" font-size="11" fill="#1A1016"${extra}>${escaparHtml(texto)}</text>`;

/** Barras horizontales: por mes, la de ventas y la del resultado registrado, con su monto escrito. */
const svgBarrasMeses = (meses: MesNegocio[]): string => {
  const mayor = Math.max(0, ...meses.flatMap(m => [Math.abs(m.venta), Math.abs(m.resultado)]));
  const largo = (valor: number): number =>
    valor === 0 || mayor === 0
      ? 0
      : Math.max(2, Math.round((Math.abs(valor) / mayor) * ANCHO_MAXIMO_BARRA_PT));
  const filas = meses
    .map((m, i) => {
      const y = i * ALTO_FILA_MES_PT;
      const lv = largo(m.venta);
      const lr = largo(m.resultado);
      return (
        textoSvg(0, y + 13, m.etiquetaCorta, ' font-weight="700"') +
        (m.enCurso ? textoSvg(0, y + 29, 'en curso') : '') +
        `<rect x="${X_BARRAS_PT}" y="${y + 3}" width="${lv}" height="12" fill="#CD0157"/>` +
        textoSvg(X_BARRAS_PT + lv + 6, y + 13, `Ventas ${formatoSoles(m.venta)}`) +
        `<rect x="${X_BARRAS_PT}" y="${y + 21}" width="${lr}" height="12" fill="${
          m.resultado < 0 ? COLOR_NEGATIVO : COLOR_RESULTADO
        }"/>` +
        textoSvg(X_BARRAS_PT + lr + 6, y + 31, `Resultado registrado ${formatoSoles(m.resultado)}`)
      );
    })
    .join('');
  const alto = meses.length * ALTO_FILA_MES_PT;
  return (
    `<svg width="${ANCHO_SVG_PT}pt" height="${alto}pt" viewBox="0 0 ${ANCHO_SVG_PT} ${alto}" role="img" ` +
    `aria-label="Barras de ventas y resultado registrado por mes">${filas}</svg>`
  );
};

/** El relleno de una porción: su color y una marca distinta, para que el color no vaya solo. */
const patron = (id: string, indice: number): string => {
  const e = ESTILOS_TORTA[indice % ESTILOS_TORTA.length];
  const marcas: Record<(typeof ESTILOS_TORTA)[number]['patron'], string> = {
    liso: '',
    rayas: `<path d="M0 8L8 0M-2 2L2 -2M6 10L10 6" stroke="${e.marca}" stroke-width="1.6"/>`,
    puntos: `<circle cx="4" cy="4" r="1.7" fill="${e.marca}"/>`,
    cuadrícula: `<path d="M0 4H8M4 0V8" stroke="${e.marca}" stroke-width="1.2"/>`,
    líneas: `<path d="M0 2H8M0 6H8" stroke="${e.marca}" stroke-width="1.4"/>`,
  };
  return (
    `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">` +
    `<rect width="8" height="8" fill="${e.relleno}"/>${marcas[e.patron]}</pattern>`
  );
};

/** La torta: una porción por producto (hasta 5), con su patrón, sin JavaScript. */
const svgTorta = (porciones: PorcionTorta[]): string => {
  const centro = LADO_TORTA_PT / 2;
  const radio = centro - 4;
  const total = porciones.reduce((suma, p) => suma + p.venta, 0);
  const defs = porciones.map((_, i) => patron(`tp-${i}`, i)).join('');
  let angulo = -Math.PI / 2;
  const trozos = porciones.map((p, i) => {
    const relleno = `url(#tp-${i})`;
    if (porciones.length === 1) {
      return `<circle cx="${centro}" cy="${centro}" r="${radio}" fill="${relleno}" stroke="#fff" stroke-width="2"/>`;
    }
    const barrido = (p.venta / total) * 2 * Math.PI;
    const x0 = centro + radio * Math.cos(angulo);
    const y0 = centro + radio * Math.sin(angulo);
    angulo += barrido;
    const x1 = centro + radio * Math.cos(angulo);
    const y1 = centro + radio * Math.sin(angulo);
    const grande = barrido > Math.PI ? 1 : 0;
    return (
      `<path d="M${centro} ${centro}L${x0.toFixed(2)} ${y0.toFixed(
        2,
      )}A${radio} ${radio} 0 ${grande} 1 ` +
      `${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${relleno}" stroke="#fff" stroke-width="2"/>`
    );
  });
  return (
    `<svg width="${LADO_TORTA_PT}pt" height="${LADO_TORTA_PT}pt" viewBox="0 0 ${LADO_TORTA_PT} ${LADO_TORTA_PT}" ` +
    `role="img" aria-label="${escaparHtml(
      etiquetaTorta(porciones),
    )}"><defs>${defs}</defs>${trozos.join('')}</svg>`
  );
};

/** La leyenda: la misma marca de cada porción, su nombre con el porcentaje en palabras y su monto. */
const leyendaTorta = (porciones: PorcionTorta[]): string =>
  '<div class="leyenda-torta">' +
  porciones
    .map((p, i) => {
      const e = ESTILOS_TORTA[i % ESTILOS_TORTA.length];
      return (
        `<div class="ley"><svg width="16pt" height="16pt" viewBox="0 0 16 16" role="img" aria-label="Marca: ${e.patron}">` +
        `<defs>${patron(
          `tl-${i}`,
          i,
        )}</defs><rect width="16" height="16" fill="url(#tl-${i})"/></svg>` +
        `<div><div>${escaparHtml(textoPorcion(p))}</div><div class="ley-monto">${formatoSoles(
          p.venta,
        )}</div></div></div>`
      );
    })
    .join('') +
  '</div>';

const tablaMeses = (meses: MesNegocio[]): string =>
  '<table><thead><tr><th>Mes</th><th class="num">Ventas</th><th class="num">Gastos</th>' +
  '<th class="num">Resultado registrado</th><th class="num">Días cerrados</th></tr></thead><tbody>' +
  meses
    .map(
      m =>
        `<tr><td>${escaparHtml(m.etiqueta)}</td><td class="num">${formatoSoles(
          m.venta,
        )}</td><td class="num">${formatoSoles(m.gastos)}</td><td class="num">${formatoSoles(
          m.resultado,
        )}</td><td class="num">${m.dias}</td></tr>`,
    )
    .join('') +
  '</tbody></table>';

const linea = (rotulo: string, texto: string): string =>
  `<div class="linea"><strong>${rotulo}:</strong> ${escaparHtml(texto)}</div>`;

const seccion = (titulo: string, contenido: string): string =>
  `<div class="seccion"><div class="subtitulo">${titulo}</div>${contenido}</div>`;

/** Las páginas A4 que siguen a la hoja del banco: cada una empieza en hoja nueva con su banda. */
const paginasInteligencia = (s: Senales, extra: ExtraReporte, hoy: FechaNegocio): string => {
  const i = extra.inteligencia;
  const cabecera =
    `<h2>Inteligencia de negocio</h2><div class="periodo"><strong>Periodo:</strong> ${escaparHtml(
      extra.etiquetaPeriodo,
    )} · ${diasCerradosTexto(i.dias)}</div>` +
    (s.soloEjemplo
      ? `<div class="aviso"><strong>Datos de ejemplo.</strong> ${escaparHtml(AVISO_EJEMPLO)}</div>`
      : '');
  const pie = `<div class="pie-extra"><div>${FRASE_PIE}</div><div>Generado el ${fechaEnFrase(
    hoy,
  )}</div></div>`;
  const pagina = (contenido: string): string =>
    `<div class="pagina">${banda(hoy)}<div class="contenido">${contenido}</div></div>`;

  if (!i.hayDatos) {
    return pagina(`${cabecera}<div class="sinmes">Sin días cerrados en este periodo.</div>${pie}`);
  }

  const tarjeta = (etiqueta: string, valor: string, detalle = ''): string =>
    `<div class="tarjeta"><div class="etiqueta">${etiqueta}</div><div class="valor-chico">${valor}</div>${
      detalle === '' ? '' : `<div class="detalle">${detalle}</div>`
    }</div>`;
  const cifras =
    '<div class="tarjetas">' +
    tarjeta('Ventas del periodo', formatoSoles(i.venta)) +
    tarjeta('Gastos del periodo', formatoSoles(i.gastos)) +
    tarjeta('Resultado registrado', formatoSoles(i.resultado)) +
    tarjeta(
      'Promedio por día cerrado',
      formatoSoles(i.promedioVentaDia),
      `resultado registrado ${formatoSoles(i.promedioResultadoDia)}`,
    ) +
    '</div>';

  const nota =
    i.meses.length > MESES_EN_GRAFICO
      ? `<div class="detalle">El gráfico muestra los últimos ${MESES_EN_GRAFICO} meses.</div>`
      : '';
  const porMes = seccion(
    'Ventas, gastos y resultado registrado por mes',
    svgBarrasMeses(i.meses.slice(-MESES_EN_GRAFICO)) +
      nota +
      tablaMeses(i.meses.slice(-MESES_EN_TABLA)),
  );

  const fuerteDebil = seccion(
    'Mes más fuerte y mes más débil',
    i.mesMasFuerte && i.mesMasDebil
      ? linea('Mes más fuerte', fraseMesFuerte(i.mesMasFuerte)) +
          linea('Mes más débil', fraseMesFuerte(i.mesMasDebil))
      : `<div class="detalle">${escaparHtml(i.notaMeses ?? '')}</div>`,
  );
  const comparacion = seccion(
    'Comparación entre meses',
    i.comparaciones.length > 0
      ? i.comparaciones
          .slice(-6)
          .map(c => `<div class="linea">${escaparHtml(c.frase)}</div>`)
          .join('')
      : `<div class="detalle">${NO_HAY_COMPARACION}</div>`,
  );
  const semana = seccion(
    'Días de la semana',
    (i.diaMasVentas ? linea('Día que más vendes', fraseDiaMasVentas(i.diaMasVentas)) : '') +
      (i.diaQueMasDeja ? linea('Día que más deja', fraseDiaQueMasDeja(i.diaQueMasDeja)) : '') +
      (i.diaQueMenosDeja
        ? linea('Día que menos deja', fraseDiaQueMenosDeja(i.diaQueMenosDeja))
        : '') +
      (i.diaMasVentas || i.diaQueMasDeja || i.diaQueMenosDeja
        ? ''
        : `<div class="detalle">${NOTA_SIN_DIAS_SEMANA}</div>`),
  );
  const estrella = fraseProductoEstrella(i);
  const productos = seccion(
    'Producto estrella',
    estrella === null
      ? `<div class="detalle">${SIN_VENTAS}</div>`
      : linea('Producto estrella', estrella),
  );
  const torta = seccion(
    'Venta por producto',
    i.torta.length === 0
      ? `<div class="detalle">${SIN_VENTAS}</div>`
      : `<div class="torta">${svgTorta(i.torta)}${leyendaTorta(i.torta)}</div>`,
  );

  return (
    pagina(cabecera + cifras + porMes) +
    pagina(fuerteDebil + comparacion + semana + productos + torta + pie)
  );
};

/**
 * El documento HTML del reporte, completo y sin dependencias, para `react-native-html-to-pdf`.
 * Dice lo mismo que `textoReporte` (reutiliza sus textos y constantes). No muta la entrada.
 */
export const htmlReporte = (
  s: Senales,
  perfil: Perfil | null,
  hoy: FechaNegocio,
  extra?: ExtraReporte,
  enlace?: EnlaceQR,
): string => {
  const estilo = s.enConstruccion ? ` style="opacity: ${OPACIDAD_EN_CONSTRUCCION}"` : '';
  return (
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Reporte de actividad del negocio</title>' +
    `<style>${ESTILO}${extra === undefined ? '' : ESTILO_EXTRA}</style></head><body>` +
    `<div class="hoja"${estilo}>` +
    `<div class="banda"><div class="marca">Crecemos</div><div class="fecha">${formatoFecha(
      hoy,
    )}</div></div>` +
    '<div class="contenido">' +
    identidad(perfil) +
    '<h1>Reporte de actividad del negocio</h1>' +
    `<div class="periodo">${periodo(s)}</div>` +
    (extra === undefined
      ? ''
      : `<div class="periodo"><strong>Periodo del reporte:</strong> ${escaparHtml(
          extra.etiquetaPeriodo,
        )} · ${diasCerradosTexto(extra.inteligencia.dias)}</div>`) +
    (s.soloEjemplo
      ? `<div class="aviso"><strong>Datos de ejemplo.</strong> ${escaparHtml(AVISO_EJEMPLO)}</div>`
      : '') +
    (s.enConstruccion
      ? `<div class="aviso"><strong>${textoFaltan(s.diasFaltantes)}</strong></div>`
      : '') +
    tarjetas(s) +
    graficoYTabla(s) +
    pasaporte(construirPasaporte(s), enlace) +
    comoLeer() +
    '</div>' +
    `<div class="pie"><div class="privacidad">${FRASE_PIE}</div><div class="generado">Generado el ${fechaEnFrase(
      hoy,
    )}</div></div>` +
    '</div>' +
    (extra === undefined ? '' : paginasInteligencia(s, extra, hoy)) +
    '</body></html>'
  );
};
