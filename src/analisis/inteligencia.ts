// src/analisis/inteligencia.ts
// La inteligencia de negocio del reporte y de Resumen: ventas, gastos y resultado registrado por
// mes, el mes más fuerte y el más débil, la comparación entre meses, el promedio por día cerrado,
// los días de la semana y el producto estrella. Todo son cuentas del código sobre los cierres que se
// le pasan (el periodo ya viene filtrado); reutiliza `totalesDelMes`, `gananciaPorProducto`,
// `ventaPorProducto` y los días de la semana de `reglas.ts`. Puro: sin React, sin reloj
// (AGENTS.md, regla 3). Solo totales: nunca un cierre suelto con su fecha.
import { calcularCierre } from '@dominio/cierre';
import { diaSemana } from '@dominio/fecha';
import { formatoSoles, redondearSoles } from '@dominio/formato';
import { esEjemplo } from '@dominio/origen';
import type { Cierre, FechaNegocio, Producto } from '@dominio/tipos';
import {
  porcionesTorta,
  productosDelPeriodo,
  type PorcionTorta,
  type ProductoPeriodo,
} from './graficos';
import { diasCerradosTexto, NOTA_SIN_DOS_MESES } from './frasesInteligencia';
import { etiquetaMes, etiquetaMesCorta } from './periodo';
import {
  CIERRES_MINIMOS_DIA_FLOJO,
  DIAS_PLURAL,
  mejorDiaDeLaSemana,
  peorDiaDeLaSemana,
} from './reglas';
import { totalesDelMes } from './senales';

/** Las cuentas de un mes del periodo. */
export interface MesNegocio {
  /** 'AAAA-MM'. */
  mes: string;
  /** 'Octubre 2026 (en curso)'. */
  etiqueta: string;
  /** 'Oct 2026'. */
  etiquetaCorta: string;
  venta: number;
  gastos: number;
  /** Ventas menos gastos registrados (el "te queda" del mes). */
  resultado: number;
  /** Días con cierre en el mes; 0 = un mes sin cierres entre dos con cierres. */
  dias: number;
  enCurso: boolean;
}

export interface ComparacionMes {
  mes: string;
  anterior: string;
  /** Resultado del mes menos el del anterior: positivo = más. */
  diferencia: number;
  frase: string;
}

/** Un día de la semana con el monto que lo describe (venta promedio, o cuánto se aparta del promedio). */
export interface DiaSemanaNegocio {
  /** 0 = domingo … 6 = sábado. */
  dia: number;
  /** 'sábados'. */
  nombre: string;
  monto: number;
  cierres: number;
}

export interface Inteligencia {
  /** Hay al menos un cierre. */
  hayDatos: boolean;
  dias: number;
  venta: number;
  gastos: number;
  resultado: number;
  /** Venta (y resultado) entre los días cerrados. */
  promedioVentaDia: number;
  promedioResultadoDia: number;
  /** Del primer al último mes con cierres, seguidos; los meses sin cierres llevan `dias: 0`. */
  meses: MesNegocio[];
  mesMasFuerte: MesNegocio | null;
  mesMasDebil: MesNegocio | null;
  /** Por qué no hay mes más fuerte ni más débil, en palabras; `null` si los hay o no hay datos. */
  notaMeses: string | null;
  comparaciones: ComparacionMes[];
  diaMasVentas: DiaSemanaNegocio | null;
  diaQueMasDeja: DiaSemanaNegocio | null;
  diaQueMenosDeja: DiaSemanaNegocio | null;
  productos: ProductoPeriodo[];
  productoEstrella: ProductoPeriodo | null;
  torta: PorcionTorta[];
  /** Algún día del periodo es de ejemplo. */
  hayEjemplo: boolean;
}

/** Lo que el texto y el documento del reporte reciben además de las señales del banco. */
export interface ExtraReporte {
  etiquetaPeriodo: string;
  inteligencia: Inteligencia;
}

const siguienteMes = (mes: string): string => {
  const [anio, numero] = mes.split('-').map(Number);
  return numero === 12 ? `${anio + 1}-01` : `${anio}-${String(numero + 1).padStart(2, '0')}`;
};

const enMinuscula = (texto: string): string => texto.charAt(0).toLowerCase() + texto.slice(1);

const frasesComparacion = (actual: MesNegocio, anterior: MesNegocio): ComparacionMes => {
  const diferencia = redondearSoles(actual.resultado - anterior.resultado);
  const dias = `${diasCerradosTexto(actual.dias)} contra ${anterior.dias}`;
  const previo = enMinuscula(anterior.etiqueta);
  const frase =
    diferencia === 0
      ? `${actual.etiqueta}: el resultado registrado quedó igual que en ${previo} (${formatoSoles(
          actual.resultado,
        )}; ${dias}).`
      : `${actual.etiqueta}: el resultado registrado fue ${formatoSoles(Math.abs(diferencia))} ${
          diferencia > 0 ? 'más' : 'menos'
        } que en ${previo} (${formatoSoles(actual.resultado)} contra ${formatoSoles(
          anterior.resultado,
        )}; ${dias}).`;
  return { mes: actual.mes, anterior: anterior.mes, diferencia, frase };
};

/** Venta promedio por día cerrado de cada día de la semana, con al menos 2 cierres de ese día. */
const ventaPorDiaDeLaSemana = (cierres: Cierre[]): DiaSemanaNegocio | null => {
  const porDia = new Map<number, number[]>();
  for (const c of cierres) {
    const dia = diaSemana(c.fecha);
    porDia.set(dia, [...(porDia.get(dia) ?? []), calcularCierre(c).venta]);
  }
  let mejor: DiaSemanaNegocio | null = null;
  let candidatos = 0;
  for (const [dia, ventas] of [...porDia].sort((a, b) => a[0] - b[0])) {
    if (ventas.length < CIERRES_MINIMOS_DIA_FLOJO) continue;
    candidatos += 1;
    const monto = redondearSoles(ventas.reduce((suma, v) => suma + v, 0) / ventas.length);
    if (mejor === null || monto > mejor.monto) {
      mejor = { dia, nombre: DIAS_PLURAL[dia], monto, cierres: ventas.length };
    }
  }
  // Con un solo día de la semana candidato no hay con qué compararlo.
  return candidatos >= 2 ? mejor : null;
};

const cierresDelDia = (cierres: Cierre[], dia: number): number =>
  cierres.filter(c => diaSemana(c.fecha) === dia).length;

/**
 * Todas las cuentas del periodo. `cierres` son los del periodo (ya filtrados y sin los de ejemplo si
 * corresponde); `hoy` solo sirve para saber cuál es el mes en curso. No muta la entrada.
 */
export const inteligenciaDelNegocio = (
  cierres: Cierre[],
  productos: Producto[],
  hoy: FechaNegocio,
): Inteligencia => {
  const validos = cierres.filter(c => c.fecha <= hoy);
  const fechas = validos.map(c => c.fecha).sort();
  const mesActual = hoy.slice(0, 7);

  const meses: MesNegocio[] = [];
  if (fechas.length > 0) {
    const ultimo = fechas[fechas.length - 1].slice(0, 7);
    for (let mes = fechas[0].slice(0, 7); mes <= ultimo; mes = siguienteMes(mes)) {
      const t = totalesDelMes(validos, mes);
      const enCurso = mes === mesActual;
      meses.push({
        mes,
        etiqueta: `${etiquetaMes(mes)}${enCurso ? ' (en curso)' : ''}`,
        etiquetaCorta: etiquetaMesCorta(mes),
        venta: t.venta,
        gastos: t.gastos,
        resultado: t.teQueda,
        dias: t.dias,
        enCurso,
      });
    }
  }

  const dias = meses.reduce((suma, m) => suma + m.dias, 0);
  const venta = redondearSoles(meses.reduce((suma, m) => suma + m.venta, 0));
  const gastos = redondearSoles(meses.reduce((suma, m) => suma + m.gastos, 0));
  const resultado = redondearSoles(meses.reduce((suma, m) => suma + m.resultado, 0));

  // Más fuerte y más débil: solo entre meses terminados y con días cerrados. Un mes a medias
  // siempre saldría "el más débil".
  const terminados = meses.filter(m => !m.enCurso && m.dias > 0);
  let mesMasFuerte: MesNegocio | null = null;
  let mesMasDebil: MesNegocio | null = null;
  if (terminados.length >= 2) {
    mesMasFuerte = [...terminados].sort(
      (a, b) => b.venta - a.venta || b.resultado - a.resultado || b.mes.localeCompare(a.mes),
    )[0];
    mesMasDebil = [...terminados].sort(
      (a, b) => a.venta - b.venta || a.resultado - b.resultado || a.mes.localeCompare(b.mes),
    )[0];
  }

  const comparaciones: ComparacionMes[] = [];
  for (let i = 1; i < meses.length; i += 1) {
    if (meses[i].dias > 0 && meses[i - 1].dias > 0) {
      comparaciones.push(frasesComparacion(meses[i], meses[i - 1]));
    }
  }

  const ctx = { cierres: validos, productos, hoy };
  const mejor = mejorDiaDeLaSemana(ctx);
  const peor = peorDiaDeLaSemana(ctx);
  const comoDia = (d: { dia: number; diferencia: number } | null): DiaSemanaNegocio | null =>
    d === null
      ? null
      : {
          dia: d.dia,
          nombre: DIAS_PLURAL[d.dia],
          monto: d.diferencia,
          cierres: cierresDelDia(validos, d.dia),
        };

  const delPeriodo = productosDelPeriodo(validos, productos);

  return {
    hayDatos: validos.length > 0,
    dias,
    venta,
    gastos,
    resultado,
    promedioVentaDia: dias > 0 ? redondearSoles(venta / dias) : 0,
    promedioResultadoDia: dias > 0 ? redondearSoles(resultado / dias) : 0,
    meses,
    mesMasFuerte,
    mesMasDebil,
    notaMeses: validos.length > 0 && terminados.length < 2 ? NOTA_SIN_DOS_MESES : null,
    comparaciones,
    diaMasVentas: ventaPorDiaDeLaSemana(validos),
    diaQueMasDeja: comoDia(mejor),
    diaQueMenosDeja: comoDia(peor),
    productos: delPeriodo,
    productoEstrella: delPeriodo.length > 0 ? delPeriodo[0] : null,
    torta: porcionesTorta(delPeriodo),
    hayEjemplo: validos.some(esEjemplo),
  };
};

/** Los últimos `n` meses (los más recientes), en orden cronológico: las barras por mes. */
export const ultimosMeses = (meses: MesNegocio[], n = 6): MesNegocio[] => meses.slice(-n);

export * from './frasesInteligencia';
