// src/analisis/pasaporte.ts
/* eslint-disable no-bitwise -- el CRC-32 y la codificación UTF-8 son aritmética de bits */
// "Mi pasaporte para el banco": lo que se suma al reporte (cuota de referencia, constancia de
// registro por mes y código de constancia con QR). Puro: sin React, sin reloj (`hoy` es parámetro)
// y sin red (AGENTS.md, regla 3). Todo sale de las `Senales`, que ya dejan fuera los datos de ejemplo
// (salvo que sean lo único que hay: entonces `soloEjemplo` viaja en el código y en cada sección).
import qrcode from 'qrcode-generator';
import { formatoSoles, nombreMes } from '@dominio/formato';
import { RATIO_CUOTA_REFERENCIA, REDONDEO_CUOTA_SOLES } from '@dominio/referencia';
import type { FechaNegocio, Senales } from '@dominio/tipos';

// --- Palabras: honestas, sin prometer lo que no es -----------------------------------------------

export const TITULO_CUOTA = 'Cuota que tu negocio aguanta';
export const TITULO_CUOTA_BANCO = 'Cuota mensual de referencia';
/** Siempre junto a la cuota: no es una aprobación ni una calificación. */
export const NOTA_CUOTA = 'Es una referencia: la entidad decide con su propio análisis.';
export const TITULO_CONSTANCIA = 'Constancia de registro';
export const TITULO_CODIGO = 'Código de constancia';
/** Lo que el código ES y lo que NO es: nada de "prueba" ni "certificado". */
export const NOTA_CODIGO =
  'Se generó en el teléfono con tus registros; sirve para comparar con los números del reporte. No reemplaza una verificación de la entidad.';
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
  return `${pct} % de tu resultado registrado promedio mensual (${formatoSoles(c.base)}), de ${meses}`;
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

// --- Suma de comprobación (CRC-32) ---------------------------------------------------------------

const TABLA_CRC: number[] = (() => {
  const tabla: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla.push(c >>> 0);
  }
  return tabla;
})();

/** Texto → bytes UTF-8 (sin `TextEncoder`: no depende del motor). */
const bytesUtf8 = (texto: string): number[] => {
  const bytes: number[] = [];
  for (const caracter of texto) {
    const p = caracter.codePointAt(0) ?? 0;
    if (p < 0x80) bytes.push(p);
    else if (p < 0x800) bytes.push(0xc0 | (p >> 6), 0x80 | (p & 0x3f));
    else if (p < 0x10000) bytes.push(0xe0 | (p >> 12), 0x80 | ((p >> 6) & 0x3f), 0x80 | (p & 0x3f));
    else {
      bytes.push(
        0xf0 | (p >> 18),
        0x80 | ((p >> 12) & 0x3f),
        0x80 | ((p >> 6) & 0x3f),
        0x80 | (p & 0x3f),
      );
    }
  }
  return bytes;
};

/** CRC-32 (IEEE 802.3, el de zip y PNG) de un texto, en 8 dígitos hexadecimales en mayúscula. */
export const crc32Hex = (texto: string): string => {
  let crc = 0xffffffff;
  for (const byte of bytesUtf8(texto)) crc = TABLA_CRC[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0');
};

/** 'CBF43926' → 'CR-CBF4-3926'. */
export const formatoCodigo = (hex8: string): string => `CR-${hex8.slice(0, 4)}-${hex8.slice(4, 8)}`;

// --- El código y su contenido --------------------------------------------------------------------

const sinGuiones = (fecha: FechaNegocio): string => fecha.replace(/-/g, '');

/**
 * El contenido canónico del código, siempre en este orden y con este formato (versión 1):
 * `CRECEMOS1|P=<desde>-<hasta>|V=<venta promedio>|G=<resultado promedio>|D=<días registrados>|C=<cuota
 * de referencia>|E=<emisión>`, más `|X=1` si son datos de ejemplo. Los montos van en soles con dos
 * decimales y sin separador de miles. La suma de comprobación se calcula sobre este texto exacto.
 */
export const contenidoCanonico = (s: Senales, hoy: FechaNegocio): string => {
  const cuota = cuotaReferencia(s);
  const periodo =
    s.primerCierre !== undefined && s.ultimoCierre !== undefined
      ? `${sinGuiones(s.primerCierre)}-${sinGuiones(s.ultimoCierre)}`
      : '-';
  return [
    'CRECEMOS1',
    `P=${periodo}`,
    `V=${s.ventaPromedioMensual.toFixed(2)}`,
    `G=${s.gananciaPromedioMensual.toFixed(2)}`,
    `D=${s.diasRegistrados}`,
    `C=${cuota.disponible ? cuota.monto : 0}`,
    `E=${sinGuiones(hoy)}`,
    ...(s.soloEjemplo ? ['X=1'] : []),
  ].join('|');
};

export interface Pasaporte {
  cuota: CuotaReferencia;
  constanciaMensual: ConstanciaMes[];
  /** El contenido canónico (sin la suma de comprobación): se imprime pequeño para poder compararlo. */
  contenido: string;
  /** Lo que lleva el QR: el contenido más `|K=<suma de comprobación>`. */
  textoQR: string;
  /** 'CR-XXXX-XXXX'. */
  codigo: string;
  soloEjemplo: boolean;
}

/** El pasaporte con la fecha de emisión (`hoy`) como parámetro; `null` si aún no hay días registrados. */
export const construirPasaporte = (s: Senales, hoy: FechaNegocio): Pasaporte | null => {
  if (s.diasRegistrados === 0) return null;
  const contenido = contenidoCanonico(s, hoy);
  const suma = crc32Hex(contenido);
  return {
    cuota: cuotaReferencia(s),
    constanciaMensual: constanciaPorMes(s),
    contenido,
    textoQR: `${contenido}|K=${suma}`,
    codigo: formatoCodigo(suma),
    soloEjemplo: s.soloEjemplo === true,
  };
};

// --- El QR ---------------------------------------------------------------------------------------

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
export const svgQR = (modulos: boolean[][], lado: number): string => {
  const total = modulos.length + 2 * MARGEN_QR;
  const trazo = corridasQR(modulos)
    .map(c => `M${c.x + MARGEN_QR} ${c.y + MARGEN_QR + 0.5}h${c.ancho}`)
    .join('');
  return (
    `<svg width="${lado}pt" height="${lado}pt" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="Código QR de constancia">` +
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
  `${TITULO_CODIGO}: ${p.codigo}. ${NOTA_CODIGO}`,
  `Datos del código: ${p.contenido}`,
];
