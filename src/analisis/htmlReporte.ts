// src/analisis/htmlReporte.ts
// El reporte como documento HTML para imprimir en A4 (595 × 842 pt). Puro: sin React, sin reloj
// (AGENTS.md, regla 3). Sin JavaScript, sin enlaces y sin imágenes externas: lo que sale es lo que
// se ve, y del perfil solo entran el nombre, el negocio y la foto (RNF-08, regla 8).
import { avatarDe } from '@dominio/foto';
import { formatoFecha, formatoFechaCorta, formatoSoles, nombreMes } from '@dominio/formato';
import type { FechaNegocio, MesCompleto, Perfil, Senales } from '@dominio/tipos';
import { diasRegistradosTexto, textoFaltan, VENTANA_DIAS } from './senales';

/** Alto de la barra del mes mayor, en pt; las demás son proporcionales. */
const ALTO_BARRA_PT = 100;
/** Alto mínimo de una barra: un mes sin ventas igual se ve. */
const ALTO_MINIMO_PT = 3;
/** Opacidad de la hoja mientras el reporte está en construcción (igual que la pantalla). */
const OPACIDAD_EN_CONSTRUCCION = 0.6;
/** Largo máximo del nombre y del negocio (igual que `textoReporte`). */
const MAX_ROTULO = 60;

const FRASE_PIE =
  'Son totales registrados por el propio negocio en la app Crecemos; no incluyen movimientos individuales.';
const SIN_MES = 'aún no hay un mes completo';

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
body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.35; color: #1A1016 }
.hoja { width: 595pt; min-height: 838pt; display: flex; flex-direction: column; page-break-inside: avoid; break-inside: avoid }
.banda { background: #CD0157; color: #fff; padding: 18pt 36pt; display: flex; justify-content: space-between; align-items: center }
.marca { font-size: 22pt; font-weight: 700 }
.fecha { font-size: 12pt }
.contenido { padding: 26pt 36pt 0 }
.identidad { display: flex; align-items: center; margin-bottom: 20pt; page-break-inside: avoid; break-inside: avoid }
.foto, .inicial { width: 72pt; height: 72pt; border-radius: 50%; margin-right: 16pt; flex-shrink: 0 }
.foto { object-fit: cover; border: 1pt solid #E4D7DE }
.inicial { background: #CD0157; color: #fff; font-size: 32pt; font-weight: 700; text-align: center; line-height: 72pt }
.identidad > div:last-child { min-width: 0 }
.nombre { font-size: 20pt; font-weight: 700; overflow-wrap: anywhere }
.negocio { font-size: 13pt; color: #6B5A62; overflow-wrap: anywhere }
h1 { font-size: 20pt; margin: 0 0 4pt }
.periodo { font-size: 12pt; color: #6B5A62; margin-bottom: 16pt }
.aviso { border-left: 4pt solid #CD0157; background: #FAF5F7; padding: 10pt 12pt; margin-bottom: 16pt; font-size: 12pt; page-break-inside: avoid; break-inside: avoid }
.tarjetas { display: flex; margin-bottom: 20pt; page-break-inside: avoid; break-inside: avoid }
.tarjeta { flex: 1; border: 1pt solid #E4D7DE; background: #FAF5F7; border-radius: 8pt; padding: 10pt; margin-right: 8pt }
.tarjeta:last-child { margin-right: 0 }
.etiqueta { color: #6B5A62 }
.valor { font-size: 18pt; font-weight: 700; margin-top: 4pt }
.tarjeta:last-child .valor { color: #0F7A4F }
.sinmes { font-size: 12pt; color: #6B5A62; margin-top: 6pt }
.detalle, .base { color: #6B5A62 }
.fila { display: flex; align-items: flex-start; margin-bottom: 16pt; page-break-inside: avoid; break-inside: avoid }
.grafico { flex: 1.3; margin-right: 24pt }
.dias { flex: 1 }
.subtitulo { font-size: 13pt; font-weight: 700; margin-bottom: 8pt }
.barras { display: flex; align-items: flex-end; border-bottom: 1pt solid #E4D7DE }
.col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end }
.monto { font-weight: 700; margin-bottom: 3pt; white-space: nowrap }
.barra { width: 44pt; background: #CD0157; border-radius: 3pt 3pt 0 0 }
.mes { color: #6B5A62; margin: 3pt 0 }
table { border-collapse: collapse; width: 100% }
td { padding: 6pt 0; border-bottom: 1pt solid #E4D7DE }
td.num { text-align: right; font-weight: 700 }
.antiguedad { color: #6B5A62 }
.pie { margin-top: auto; padding: 14pt 36pt; border-top: 1pt solid #E4D7DE; color: #6B5A62; page-break-inside: avoid; break-inside: avoid }
`;

const dias = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;

const capitalizar = (texto: string): string => texto.charAt(0).toUpperCase() + texto.slice(1);

/** 'Jul', 'Ago', 'Sep': el mes en tres letras, como en la pantalla. */
const mesCorto = (m: MesCompleto): string => capitalizar(nombreMes(`${m.mes}-01`).slice(0, 3));

const altoBarra = (venta: number, mayor: number): number =>
  mayor > 0
    ? Math.max(ALTO_MINIMO_PT, Math.round((venta / mayor) * ALTO_BARRA_PT))
    : ALTO_MINIMO_PT;

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
    cifra('Ganancia promedio mensual', s.gananciaPromedioMensual) +
    '<div class="tarjeta"><div class="etiqueta">Constancia de registro</div>' +
    `<div class="valor">${s.constancia} %</div>` +
    `<div class="detalle">${diasRegistradosTexto(s.diasRegistrados)}</div>` +
    `${base}</div></div>`
  );
};

const graficoYTabla = (meses: MesCompleto[]): string => {
  if (meses.length === 0) return '';
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
  return (
    '<div class="fila">' +
    `<div class="grafico"><div class="subtitulo">Venta por mes</div><div class="barras">${columnas}</div></div>` +
    `<div class="dias"><div class="subtitulo">Días registrados por mes</div><table>${filas}</table></div>` +
    '</div>'
  );
};

/** 'martes 20 de octubre de 2026': el día en minúscula, dentro de una frase. */
const fechaEnFrase = (hoy: FechaNegocio): string => {
  const f = formatoFecha(hoy);
  return `${f.charAt(0).toLowerCase()}${f.slice(1)} de ${hoy.slice(0, 4)}`;
};

/**
 * El documento HTML del reporte, completo y sin dependencias, para `react-native-html-to-pdf`.
 * Dice lo mismo que `textoReporte` (reutiliza sus textos y constantes). No muta la entrada.
 */
export const htmlReporte = (s: Senales, perfil: Perfil | null, hoy: FechaNegocio): string => {
  const estilo = s.enConstruccion ? ` style="opacity: ${OPACIDAD_EN_CONSTRUCCION}"` : '';
  return (
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Reporte de actividad del negocio</title>' +
    `<style>${ESTILO}</style></head><body>` +
    `<div class="hoja"${estilo}>` +
    `<div class="banda"><div class="marca">Crecemos</div><div class="fecha">${formatoFecha(
      hoy,
    )}</div></div>` +
    '<div class="contenido">' +
    identidad(perfil) +
    '<h1>Reporte de actividad del negocio</h1>' +
    `<div class="periodo">${periodo(s)}</div>` +
    (s.enConstruccion
      ? `<div class="aviso"><strong>${textoFaltan(s.diasFaltantes)}</strong></div>`
      : '') +
    tarjetas(s) +
    graficoYTabla(s.meses) +
    (s.registraDesde === undefined
      ? ''
      : `<div class="antiguedad">Registra desde el ${formatoFechaCorta(s.registraDesde)} (${dias(
          s.antiguedadDias,
        )})</div>`) +
    '</div>' +
    `<div class="pie"><div>${FRASE_PIE}</div><div>Generado el ${fechaEnFrase(hoy)}</div></div>` +
    '</div></body></html>'
  );
};
