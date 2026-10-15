// src/analisis/pasaporte.ts
// "Mi pasaporte para el banco": lo que se suma al reporte (cuota de referencia, constancia de
// registro por mes y, cuando existe el enlace en la nube, su QR y su código). Puro: sin React, sin reloj
// y sin red (AGENTS.md, regla 3). Todo sale de las `Senales`, que ya dejan fuera los datos de ejemplo
// (salvo que sean lo único que hay: entonces `soloEjemplo` viaja en cada sección).
import qrcode from 'qrcode-generator';
import { fechaLocal } from '@dominio/fecha';
import { formatoFechaCorta, formatoSoles, nombreMes } from '@dominio/formato';
import { RATIO_CUOTA_REFERENCIA, REDONDEO_CUOTA_SOLES } from '@dominio/referencia';
import type { Senales } from '@dominio/tipos';

// --- Palabras: honestas, sin prometer lo que no es -----------------------------------------------

export const TITULO_CUOTA = 'Cuota que tu negocio aguanta';
export const TITULO_CUOTA_BANCO = 'Cuota mensual de referencia';
/** Siempre junto a la cuota: no es una aprobación ni una calificación. */
export const NOTA_CUOTA = 'Es una referencia: la entidad decide con su propio análisis.';
export const TITULO_CONSTANCIA = 'Constancia de registro';
export const TITULO_CODIGO = 'Código de constancia';
/** Lo que el código ES y lo que NO es: nada de "prueba" ni "certificado". */
export const NOTA_CODIGO =
  'Identifica este reporte en la nube; el enlace del QR lo muestra tal cual. Caduca con el enlace.';
/** Mientras no se crea el enlace, el reporte no lleva ni QR ni código. */
export const AVISO_SIN_ENLACE = 'El código y el QR aparecerán cuando crees el enlace.';
export const AVISO_EJEMPLO_SECCION = 'Datos de ejemplo';
export const SIN_CUOTA_MES = 'Aún no hay un mes completo para calcular una referencia.';
export const SIN_CUOTA_RESULTADO =
  'Con el resultado registrado de estos meses no sale una cuota de referencia.';
export const SIN_CONSTANCIA_MES = 'Aún no hay un mes completo registrado.';

// --- Cuota de referencia -------------------------------------------------------------------------

export type CuotaReferencia =
  | { disponible: true; monto: number; ratio: number; base: number; meses: number }
  | { disponible: false; motivo: 'sinMes' | 'sinResultado' };

/**
 * Cuota mensual de referencia: el `RATIO_CUOTA_REFERENCIA` del resultado registrado promedio
 * mensual, redondeada hacia abajo a `REDONDEO_CUOTA_SOLES`. Sin un mes completo, o con un resultado
 * que no da ni un escalón, no hay cifra: no se inventa.
 */
export const cuotaReferencia = (s: Senales): CuotaReferencia => {
  if (s.mesesCompletos < 1) return { disponible: false, motivo: 'sinMes' };
  const crudo = s.gananciaPromedioMensual * RATIO_CUOTA_REFERENCIA;
  const monto = Math.floor((crudo + 1e-9) / REDONDEO_CUOTA_SOLES) * REDONDEO_CUOTA_SOLES;
  if (!(monto > 0)) return { disponible: false, motivo: 'sinResultado' };
  return {
    disponible: true,
    monto,
    ratio: RATIO_CUOTA_REFERENCIA,
    base: s.gananciaPromedioMensual,
    meses: s.mesesCompletos,
  };
};

/** 'Cerca de S/ 650.00 al mes' o la frase de por qué no hay cifra. */
export const textoCuota = (c: CuotaReferencia): string =>
  c.disponible
    ? `Cerca de ${formatoSoles(c.monto)} al mes`
    : c.motivo === 'sinMes'
    ? SIN_CUOTA_MES
    : SIN_CUOTA_RESULTADO;

/** '30 % de tu resultado registrado promedio mensual (S/ 2,180.00), de 3 meses completos'. */
export const explicacionCuota = (c: CuotaReferencia): string => {
  if (!c.disponible) return '';
  const pct = Math.round(c.ratio * 100);
  const meses = `${c.meses} ${c.meses === 1 ? 'mes completo' : 'meses completos'}`;
  return `${pct} % de tu resultado registrado promedio mensual (${formatoSoles(
    c.base,
  )}), de ${meses}`;
};

// --- Constancia de registro por mes --------------------------------------------------------------

export interface ConstanciaMes {
  /** 'AAAA-MM'. */
  mes: string;
  dias: number;
  diasDelMes: number;
  /** 'Registraste 24 de 30 días en septiembre'. */
  frase: string;
}

/** Cuántos días tiene el mes 'AAAA-MM' (sin reloj: calendario puro). */
export const diasDelMes = (mes: string): number => {
  const [anio, numero] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, numero, 0)).getUTCDate();
};

/** Días registrados de cada uno de los meses completos de las señales (hasta 3). */
export const constanciaPorMes = (s: Senales): ConstanciaMes[] =>
  s.meses.map(m => {
    const total = diasDelMes(m.mes);
    return {
      mes: m.mes,
      dias: m.dias,
      diasDelMes: total,
      frase: `Registraste ${m.dias} de ${total} días en ${nombreMes(`${m.mes}-01`)}`,
    };
  });

// --- El pasaporte y el código del enlace ---------------------------------------------------------

export interface Pasaporte {
  cuota: CuotaReferencia;
  constanciaMensual: ConstanciaMes[];
  soloEjemplo: boolean;
}

/** El pasaporte (cuota y constancia por mes); `null` si aún no hay días registrados. */
export const construirPasaporte = (s: Senales): Pasaporte | null => {
  if (s.diasRegistrados === 0) return null;
  return {
    cuota: cuotaReferencia(s),
    constanciaMensual: constanciaPorMes(s),
    soloEjemplo: s.soloEjemplo === true,
  };
};

/**
 * El código de constancia sale del id del enlace en la nube (128 bits que genera el Worker): los primeros
 * 12 dígitos hexadecimales en mayúscula, en 3 grupos de 4 ('CR-XXXX-XXXX-XXXX'). Identifica el archivo
 * subido, no el contenido del reporte; el id completo NO se puede reconstruir desde el código, así que
 * el código por sí solo no da acceso al archivo. Sin enlace no hay código.
 */
export const codigoDeEnlace = (id: string): string => {
  const h = id.slice(0, 12).toUpperCase();
  return `CR-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
};

// --- El QR ---------------------------------------------------------------------------------------
// Desde el Sprint-16 el único QR del reporte es el del ENLACE a su PDF en la nube (el de "constancia"
// no abría nada y se quitó), y el código `CR-XXXX-XXXX-XXXX` sale del id de ese enlace.

/** El enlace público del reporte: lo que codifica el QR y hasta cuándo vale. */
export interface EnlaceQR {
  /** El id de 32 hexadecimales que reservó el Worker: de él sale el código de constancia. */
  id: string;
  url: string;
  /** ISO 8601. */
  caduca: string;
}

/** 'Caduca el 22 de octubre': la fecha local del vencimiento, en palabras. */
export const textoCaduca = (caduca: string): string =>
  `Caduca el ${formatoFechaCorta(fechaLocal(new Date(caduca)))}`;

/** Módulos del QR (true = oscuro). Determinista: el mismo texto da siempre la misma matriz. */
export const modulosQR = (texto: string): boolean[][] => {
  const qr = qrcode(0, 'M');
  qr.addData(texto, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const filas: boolean[][] = [];
  for (let r = 0; r < n; r += 1) {
    const fila: boolean[] = [];
    for (let c = 0; c < n; c += 1) fila.push(qr.isDark(r, c));
    filas.push(fila);
  }
  return filas;
};

/** Tramos horizontales oscuros consecutivos: así se dibujan pocos rectángulos en vez de uno por módulo. */
export const corridasQR = (modulos: boolean[][]): { x: number; y: number; ancho: number }[] => {
  const corridas: { x: number; y: number; ancho: number }[] = [];
  modulos.forEach((fila, y) => {
    let inicio = -1;
    for (let x = 0; x <= fila.length; x += 1) {
      const oscuro = x < fila.length && fila[x];
      if (oscuro && inicio < 0) inicio = x;
      if (!oscuro && inicio >= 0) {
        corridas.push({ x: inicio, y, ancho: x - inicio });
        inicio = -1;
      }
    }
  });
  return corridas;
};

/** Margen blanco alrededor del QR, en módulos (el mínimo que piden los lectores). */
export const MARGEN_QR = 4;

/**
 * El QR como `<svg>` en línea para el PDF: un solo `<path>` con una línea por tramo oscuro. Sin
 * imágenes externas ni JavaScript. `lado` es el tamaño impreso, en pt.
 */
export const svgQR = (
  modulos: boolean[][],
  lado: number,
  etiqueta = 'Código QR del enlace de este reporte',
): string => {
  const total = modulos.length + 2 * MARGEN_QR;
  const trazo = corridasQR(modulos)
    .map(c => `M${c.x + MARGEN_QR} ${c.y + MARGEN_QR + 0.5}h${c.ancho}`)
    .join('');
  return (
    `<svg width="${lado}pt" height="${lado}pt" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="${etiqueta}">` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `<path d="${trazo}" stroke="#000" stroke-width="1" fill="none"/></svg>`
  );
};

// --- Texto plano ---------------------------------------------------------------------------------

/** Las líneas del pasaporte para el texto compartido (se suman a las del reporte). */
export const lineasTextoPasaporte = (p: Pasaporte): string[] => [
  ...(p.cuota.disponible
    ? [
        `${TITULO_CUOTA_BANCO}: ${formatoSoles(p.cuota.monto)} al mes (${explicacionCuota(
          p.cuota,
        )}). ${NOTA_CUOTA}`,
      ]
    : []),
];
