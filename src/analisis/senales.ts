// src/analisis/senales.ts
// Señales para el banco y texto del reporte. Puro: sin React, sin reloj (AGENTS.md, regla 3).
import { calcularCierre } from '@dominio/cierre';
import { esEjemplo } from '@dominio/origen';
import { diasEntre, restarDias } from '@dominio/fecha';
import { formatoFechaCorta, formatoSoles, nombreMes, redondearSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, MesCompleto, Perfil, Senales } from '@dominio/tipos';
import {
  construirPasaporte,
  lineasTextoPasaporte,
  textoCuota,
  TITULO_CUOTA_BANCO,
} from './pasaporte';
import { diasCerradosTexto, lineasTextoInteligencia } from './frasesInteligencia';
import type { ExtraReporte } from './inteligencia';

/** Ventana de la constancia: 90 días contando hoy. */
export const VENTANA_DIAS = 90;
/** Meses completos que entran en los promedios. */
export const MESES_MAXIMOS = 3;
/** Un primer mes del registro solo cuenta si el primer cierre cae en sus primeros 7 días. */
export const DIAS_PRIMER_MES = 7;
/** Días registrados desde los que el reporte es convincente. */
export const DIAS_CONVINCENTE = 30;
/** Tope del texto compartido (~2 KB, manejo-de-datos.md). */
export const MAX_CARACTERES_REPORTE = 2000;

/** Lo que dice el reporte cuando solo hay datos de la demostración. */
export const AVISO_EJEMPLO =
  'Datos de ejemplo: este reporte es una demostración, no son registros reales del negocio.';

/** Largo máximo de cada parte de la identificación: así el texto nunca pasa del tope. */
const MAX_ROTULO = 60;

/** Meses desde el año 0: permite restar meses sin pasar por `Date`. */
const indiceDeMes = (mes: string): number => {
  const [anio, numero] = mes.split('-').map(Number);
  return anio * 12 + numero - 1;
};

const mesDeIndice = (indice: number): string =>
  `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`;

/** El mes calendario anterior a 'YYYY-MM' ('2027-01' → '2026-12'). */
export const mesAnterior = (mes: string): string => mesDeIndice(indiceDeMes(mes) - 1);

/** Las cuentas de un mes: lo que vendió, lo que gastó, el resultado registrado y los días con cierre. */
export interface TotalesMes extends MesCompleto {
  /** Gastos del mes: la suma de los gastos de cada cierre. */
  gastos: number;
}

/**
 * Venta, gastos, "te queda" (el resultado registrado) y días con cierre de un mes ('YYYY-MM'). Con
 * `hastaDia` solo cuentan los cierres de los días 1 a `hastaDia`; sin él, el mes entero. Solo cuentan
 * los cierres que existen: un día sin cierre no suma ni cuenta como día. Es la misma cuenta del reporte
 * del banco y del chat.
 */
export const totalesDelMes = (cierres: Cierre[], mes: string, hastaDia = 31): TotalesMes => {
  const delMes = cierres.filter(
    c => c.fecha.startsWith(mes) && Number(c.fecha.slice(8, 10)) <= hastaDia,
  );
  const resumenes = delMes.map(calcularCierre);
  return {
    mes,
    venta: redondearSoles(resumenes.reduce((total, r) => total + r.venta, 0)),
    gastos: redondearSoles(resumenes.reduce((total, r) => total + r.gastoTotal, 0)),
    teQueda: redondearSoles(resumenes.reduce((total, r) => total + r.teQueda, 0)),
    dias: new Set(delMes.map(c => c.fecha)).size,
  };
};

/**
 * Los cierres que cuentan para el reporte: los propios. Lo de ejemplo no es del negocio y queda
 * fuera, salvo que sea lo único que hay (así la demostración sigue funcionando, con el aviso
 * `soloEjemplo`). Una sola regla para las señales, el texto y la inteligencia del reporte.
 */
export const cierresDelReporte = (todos: Cierre[]): { cierres: Cierre[]; soloEjemplo: boolean } => {
  const propios = todos.filter(c => !esEjemplo(c));
  const soloEjemplo = propios.length === 0 && todos.length > 0;
  return { cierres: soloEjemplo ? todos : propios, soloEjemplo };
};

const promedio = (valores: number[]): number =>
  valores.length === 0
    ? 0
    : redondearSoles(valores.reduce((total, v) => total + v, 0) / valores.length);

/**
 * Meses completos para los promedios (hasta `MESES_MAXIMOS`, los más recientes). Completo = ya
 * terminó respecto de `hoy`, y si es el primer mes del registro, solo si el primer cierre cae en
 * sus primeros `DIAS_PRIMER_MES` días. Un mes entre medias sin cierres cuenta, con venta 0.
 */
const mesesCompletos = (
  cierres: Cierre[],
  registraDesde: FechaNegocio,
  hoy: FechaNegocio,
): MesCompleto[] => {
  const primerMes = indiceDeMes(registraDesde.slice(0, 7));
  const parcial = Number(registraDesde.slice(8, 10)) > DIAS_PRIMER_MES;
  const desde = parcial ? primerMes + 1 : primerMes;
  const hasta = indiceDeMes(hoy.slice(0, 7)) - 1; // el mes en curso no cuenta
  const desdeUltimos = Math.max(desde, hasta - MESES_MAXIMOS + 1);

  const meses: MesCompleto[] = [];
  for (let i = desdeUltimos; i <= hasta; i++) {
    const mes = mesDeIndice(i);
    const { venta, teQueda, dias } = totalesDelMes(cierres, mes);
    meses.push({ mes, venta, teQueda, dias });
  }
  return meses;
};

/**
 * Las señales para el banco con la fecha de hoy como parámetro. Los cierres posteriores a `hoy` no
 * cuentan. No muta la entrada.
 */
export const senalesBanco = (todos: Cierre[], hoy: FechaNegocio): Senales => {
  // Lo de ejemplo no es del negocio: queda fuera del reporte (salvo que sea lo único que hay).
  const { cierres, soloEjemplo } = cierresDelReporte(todos);
  const hasta = cierres.filter(c => c.fecha <= hoy);
  const fechas = [...new Set(hasta.map(c => c.fecha))].sort();
  const registraDesde = fechas[0];
  if (registraDesde === undefined) {
    return {
      constancia: 0,
      diasRegistrados: 0,
      diasTranscurridos: 0,
      ventaPromedioMensual: 0,
      gananciaPromedioMensual: 0,
      meses: [],
      mesesCompletos: 0,
      antiguedadDias: 0,
      enConstruccion: true,
      diasFaltantes: DIAS_CONVINCENTE,
    };
  }

  const enVentana = fechas.filter(f => f >= restarDias(hoy, VENTANA_DIAS - 1));
  const diasRegistrados = enVentana.length;
  const diasTranscurridos = Math.min(VENTANA_DIAS, diasEntre(registraDesde, hoy) + 1);
  const meses = mesesCompletos(hasta, registraDesde, hoy);

  return {
    constancia: Math.round((100 * diasRegistrados) / diasTranscurridos),
    diasRegistrados,
    diasTranscurridos,
    ventaPromedioMensual: promedio(meses.map(m => m.venta)),
    gananciaPromedioMensual: promedio(meses.map(m => m.teQueda)),
    meses,
    mesesCompletos: meses.length,
    primerCierre: enVentana[0],
    ultimoCierre: enVentana[enVentana.length - 1],
    registraDesde,
    antiguedadDias: diasEntre(registraDesde, hoy),
    enConstruccion: diasRegistrados < DIAS_CONVINCENTE,
    diasFaltantes: Math.max(0, DIAS_CONVINCENTE - diasRegistrados),
    ...(soloEjemplo ? { soloEjemplo } : {}),
  };
};

const dias = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;
/** '1 día registrado' · '58 días registrados': la pantalla y el texto del reporte lo dicen igual. */
export const diasRegistradosTexto = (n: number): string =>
  `${n} ${n === 1 ? 'día registrado' : 'días registrados'}`;

/** 'Te faltan 21 días de registro para que tu reporte sea convincente' (singular: 'Te falta 1 día…'). */
export const textoFaltan = (diasFaltantes: number): string =>
  `${diasFaltantes === 1 ? 'Te falta' : 'Te faltan'} ${dias(
    diasFaltantes,
  )} de registro para que tu reporte sea convincente`;

/**
 * Texto plano del reporte (≤ 2,000 caracteres). Solo totales y promedios, más el nombre y el negocio
 * del perfil: nada del Yape, la ubicación ni de un cierre individual (RNF-08, regla 8). Con `hoy`
 * suma la cuota de referencia y el código de constancia (el pasaporte); sin él, el reporte de siempre.
 */
export const textoReporte = (
  s: Senales,
  perfil: Perfil | null,
  hoy?: FechaNegocio,
  extra?: ExtraReporte,
): string => {
  const quien = [perfil?.nombre, perfil?.negocio]
    .map(parte => (parte ?? '').trim().slice(0, MAX_ROTULO))
    .filter(parte => parte !== '')
    .join(' · ');

  const sinMes = 'aún no hay un mes completo';
  const hayMeses = s.mesesCompletos > 0;
  const periodo =
    extra !== undefined
      ? `Periodo: ${extra.etiquetaPeriodo} · ${diasCerradosTexto(extra.inteligencia.dias)}`
      : s.primerCierre !== undefined && s.ultimoCierre !== undefined
      ? `Periodo: del ${formatoFechaCorta(s.primerCierre)} al ${formatoFechaCorta(
          s.ultimoCierre,
        )} · ${diasRegistradosTexto(s.diasRegistrados)}`
      : `Periodo: sin días registrados en los últimos ${VENTANA_DIAS} días`;
  const base =
    s.diasTranscurridos === VENTANA_DIAS
      ? `de los últimos ${VENTANA_DIAS} días`
      : `de los ${dias(s.diasTranscurridos)} desde su primer cierre`;
  const constancia =
    s.diasTranscurridos === 0
      ? `Constancia de registro: 0 % (${diasRegistradosTexto(0)})`
      : `Constancia de registro: ${s.constancia} % ${base} (${diasRegistradosTexto(
          s.diasRegistrados,
        )})`;

  const pasaporte = hoy === undefined ? null : construirPasaporte(s);
  // Con inteligencia, la cuota dice con palabras por qué aún no hay cifra (no se inventa una).
  const lineaSinCuota =
    extra !== undefined && pasaporte !== null && !pasaporte.cuota.disponible
      ? [`${TITULO_CUOTA_BANCO}: ${textoCuota(pasaporte.cuota)}`]
      : [];

  const armar = (inteligencia: string[]): string[] => [
    'Reporte de actividad del negocio',
    ...(s.soloEjemplo ? [AVISO_EJEMPLO] : []),
    ...(quien === '' ? [] : [quien]),
    periodo,
    ...inteligencia,
    `Venta promedio mensual: ${hayMeses ? formatoSoles(s.ventaPromedioMensual) : sinMes}`,
    `Resultado registrado promedio mensual (ventas menos gastos): ${
      hayMeses ? formatoSoles(s.gananciaPromedioMensual) : sinMes
    }`,
    constancia,
    ...(hayMeses
      ? [
          'Días registrados por mes completo:',
          ...s.meses.map(m => `- ${nombreMes(`${m.mes}-01`)}: ${dias(m.dias)}`),
        ]
      : []),
    ...(s.registraDesde === undefined
      ? []
      : [`Registra desde el ${formatoFechaCorta(s.registraDesde)} (${dias(s.antiguedadDias)})`]),
    ...(s.enConstruccion ? [textoFaltan(s.diasFaltantes)] : []),
    ...lineaSinCuota,
    ...(pasaporte === null ? [] : lineasTextoPasaporte(pasaporte)),
    'Son totales registrados por el propio negocio en la app Crecemos; incluyen pagos pendientes de recibir y no incluyen movimientos individuales.',
  ];

  if (extra === undefined) return armar([]).join('\n');
  // El texto tiene un tope: primero se acortan la lista de meses y, al final, el detalle.
  const intentos: [number, boolean][] = [
    [12, true],
    [6, true],
    [4, true],
    [3, true],
    [2, true],
    [1, true],
    [0, true],
    [0, false],
  ];
  for (const [meses, detalle] of intentos) {
    const texto = armar(lineasTextoInteligencia(extra.inteligencia, meses, detalle)).join('\n');
    if (texto.length <= MAX_CARACTERES_REPORTE) return texto;
  }
  return armar([]).join('\n');
};
