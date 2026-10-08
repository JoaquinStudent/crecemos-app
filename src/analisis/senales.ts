// src/analisis/senales.ts
// Señales para el banco y texto del reporte. Puro: sin React, sin reloj (AGENTS.md, regla 3).
import { calcularCierre } from '@dominio/cierre';
import { diasEntre, restarDias } from '@dominio/fecha';
import { formatoFechaCorta, formatoSoles, nombreMes, redondearSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, MesCompleto, Perfil, Senales } from '@dominio/tipos';

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

/** Largo máximo de cada parte de la identificación: así el texto nunca pasa del tope. */
const MAX_ROTULO = 60;

/** Meses desde el año 0: permite restar meses sin pasar por `Date`. */
const indiceDeMes = (mes: string): number => {
  const [anio, numero] = mes.split('-').map(Number);
  return anio * 12 + numero - 1;
};

const mesDeIndice = (indice: number): string =>
  `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`;

const promedio = (valores: number[]): number =>
  valores.length === 0 ? 0 : redondearSoles(valores.reduce((total, v) => total + v, 0) / valores.length);

/**
 * Meses completos para los promedios (hasta `MESES_MAXIMOS`, los más recientes). Completo = ya
 * terminó respecto de `hoy`, y si es el primer mes del registro, solo si el primer cierre cae en
 * sus primeros `DIAS_PRIMER_MES` días. Un mes entre medias sin cierres cuenta, con venta 0.
 */
const mesesCompletos = (cierres: Cierre[], registraDesde: FechaNegocio, hoy: FechaNegocio): MesCompleto[] => {
  const primerMes = indiceDeMes(registraDesde.slice(0, 7));
  const parcial = Number(registraDesde.slice(8, 10)) > DIAS_PRIMER_MES;
  const desde = parcial ? primerMes + 1 : primerMes;
  const hasta = indiceDeMes(hoy.slice(0, 7)) - 1; // el mes en curso no cuenta
  const desdeUltimos = Math.max(desde, hasta - MESES_MAXIMOS + 1);

  const meses: MesCompleto[] = [];
  for (let i = desdeUltimos; i <= hasta; i++) {
    const mes = mesDeIndice(i);
    const delMes = cierres.filter(c => c.fecha.startsWith(mes));
    const resumenes = delMes.map(calcularCierre);
    meses.push({
      mes,
      venta: redondearSoles(resumenes.reduce((total, r) => total + r.venta, 0)),
      teQueda: redondearSoles(resumenes.reduce((total, r) => total + r.teQueda, 0)),
      dias: new Set(delMes.map(c => c.fecha)).size,
    });
  }
  return meses;
};

/**
 * Las señales para el banco con la fecha de hoy como parámetro. Los cierres posteriores a `hoy` no
 * cuentan. No muta la entrada.
 */
export const senalesBanco = (cierres: Cierre[], hoy: FechaNegocio): Senales => {
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
  };
};

const dias = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;
const diasRegistradosTexto = (n: number): string => `${n} ${n === 1 ? 'día registrado' : 'días registrados'}`;

/**
 * Texto plano del reporte (≤ 2,000 caracteres). Solo totales y promedios, más el nombre y el negocio
 * del perfil: nada del Yape, la ubicación ni de un cierre individual (RNF-08, regla 8).
 */
export const textoReporte = (s: Senales, perfil: Perfil | null): string => {
  const quien = [perfil?.nombre, perfil?.negocio]
    .map(parte => (parte ?? '').trim().slice(0, MAX_ROTULO))
    .filter(parte => parte !== '')
    .join(' · ');

  const sinMes = 'aún no hay un mes completo';
  const hayMeses = s.mesesCompletos > 0;
  const periodo =
    s.primerCierre !== undefined && s.ultimoCierre !== undefined
      ? `Periodo: del ${formatoFechaCorta(s.primerCierre)} al ${formatoFechaCorta(s.ultimoCierre)} · ${diasRegistradosTexto(s.diasRegistrados)}`
      : `Periodo: sin días registrados en los últimos ${VENTANA_DIAS} días`;
  const base =
    s.diasTranscurridos === VENTANA_DIAS
      ? `de los últimos ${VENTANA_DIAS} días`
      : `de los ${dias(s.diasTranscurridos)} desde su primer cierre`;
  const constancia =
    s.diasTranscurridos === 0
      ? `Constancia de registro: 0 % (${diasRegistradosTexto(0)})`
      : `Constancia de registro: ${s.constancia} % ${base} (${diasRegistradosTexto(s.diasRegistrados)})`;

  const lineas = [
    'Reporte de actividad del negocio',
    ...(quien === '' ? [] : [quien]),
    periodo,
    `Venta promedio mensual: ${hayMeses ? formatoSoles(s.ventaPromedioMensual) : sinMes}`,
    `Ganancia promedio mensual: ${hayMeses ? formatoSoles(s.gananciaPromedioMensual) : sinMes}`,
    constancia,
    ...(hayMeses
      ? ['Días registrados por mes completo:', ...s.meses.map(m => `- ${nombreMes(`${m.mes}-01`)}: ${dias(m.dias)}`)]
      : []),
    ...(s.registraDesde === undefined
      ? []
      : [`Registra desde el ${formatoFechaCorta(s.registraDesde)} (${dias(s.antiguedadDias)})`]),
    ...(s.enConstruccion
      ? [
          `${s.diasFaltantes === 1 ? 'Te falta' : 'Te faltan'} ${dias(s.diasFaltantes)} de registro para que tu reporte sea convincente`,
        ]
      : []),
    'Son totales registrados por el propio negocio en la app Crecemos; no incluyen movimientos individuales.',
  ];
  return lineas.join('\n');
};
