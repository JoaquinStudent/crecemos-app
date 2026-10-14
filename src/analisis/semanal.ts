// src/analisis/semanal.ts
// "Tu semana": el resumen de la última semana completa (lunes a domingo). Puro: sin React y sin
// reloj; `hoy` entra como parámetro (AGENTS.md, regla 3). Reutiliza `calcularCierre`, así que
// "te quedó" es la misma resta de siempre: ventas menos gastos.
import { calcularCierre } from '@dominio/cierre';
import { diaSemana, restarDias } from '@dominio/fecha';
import { formatoSoles, redondearSoles } from '@dominio/formato';
import { esEjemplo } from '@dominio/origen';
import type { Cierre, FechaNegocio } from '@dominio/tipos';

/** Con menos días registrados que esto la semana no dice nada confiable: la tarjeta calla. */
export const DIAS_MINIMOS_SEMANA = 3;

/** La pregunta que abre el Asistente desde la tarjeta (el chat ya sabe contestarla). */
export const PREGUNTA_SEMANA = '¿Qué día me va mejor?';

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export interface DiaDeLaSemana {
  fecha: FechaNegocio;
  /** 'sábado', en minúscula. */
  dia: string;
  teQueda: number;
}

export interface ComparacionSemana {
  /** Positivo: esta semana le fue mejor que la anterior. */
  diferencia: number;
  /** 'S/ 85.00 más que la semana anterior'. Nunca un porcentaje suelto. */
  texto: string;
}

export interface ResumenSemana {
  desde: FechaNegocio;
  hasta: FechaNegocio;
  vendido: number;
  gastado: number;
  teQueda: number;
  /** Días con cierre, de 7. */
  diasRegistrados: number;
  /** `undefined` si ningún día se distingue (un solo día o todos iguales). */
  mejorDia?: DiaDeLaSemana;
  peorDia?: DiaDeLaSemana;
  /** `undefined` si la semana anterior no tiene ningún día registrado. */
  comparacion?: ComparacionSemana;
  /** Todos sus días son de ejemplo: la tarjeta lo dice con el rótulo "Datos de ejemplo". */
  soloEjemplo: boolean;
}

/** Lunes de la semana de `f` (lunes a domingo). */
export const lunesDeLaSemana = (f: FechaNegocio): FechaNegocio =>
  restarDias(f, (diaSemana(f) + 6) % 7);

/** La tarjeta solo se muestra lunes, martes y miércoles: después, la semana ya es vieja. */
export const mostrarTuSemana = (hoy: FechaNegocio): boolean => {
  const dia = diaSemana(hoy);
  return dia >= 1 && dia <= 3;
};

const delRango = (cierres: Cierre[], desde: FechaNegocio, hasta: FechaNegocio): Cierre[] =>
  cierres.filter(c => c.fecha >= desde && c.fecha <= hasta);

const sumar = (valores: number[]): number => redondearSoles(valores.reduce((t, v) => t + v, 0));

const textoComparacion = (diferencia: number): string =>
  diferencia === 0
    ? 'Igual que la semana anterior'
    : `${formatoSoles(Math.abs(diferencia))} ${diferencia > 0 ? 'más' : 'menos'} que la semana anterior`;

/**
 * Los días de una semana según la política de datos de ejemplo: si la semana tiene días propios,
 * solo cuentan esos (lo de ejemplo no infla las cifras "reales"); si todo lo que hay es de
 * ejemplo, se usa eso y se avisa con `soloEjemplo`.
 */
const diasDe = (cierres: Cierre[], soloPropios: boolean): Cierre[] =>
  soloPropios ? cierres.filter(c => !esEjemplo(c)) : cierres;

/**
 * El resumen de la última semana completa (lunes a domingo) anterior a `hoy`, o `null` si tiene
 * menos de 3 días registrados. Funciona cualquier día: la ventana de la tarjeta (lunes a
 * miércoles) la decide `mostrarTuSemana`.
 */
export const resumenSemanaPasada = (cierres: Cierre[], hoy: FechaNegocio): ResumenSemana | null => {
  const desde = restarDias(lunesDeLaSemana(hoy), 7);
  const hasta = restarDias(desde, -6);
  const semana = delRango(cierres, desde, hasta);
  const hayPropios = semana.some(c => !esEjemplo(c));
  const dias = diasDe(semana, hayPropios);
  if (dias.length < DIAS_MINIMOS_SEMANA) return null;

  const resumenes = dias.map(c => ({ fecha: c.fecha, ...calcularCierre(c) }));
  const teQueda = sumar(resumenes.map(r => r.teQueda));

  // Mejor y peor día: el empate lo gana el día más temprano de la semana (resultado estable).
  const ordenados = [...resumenes].sort((a, b) => a.fecha.localeCompare(b.fecha));
  let mejor = ordenados[0];
  let peor = ordenados[0];
  for (const r of ordenados) {
    if (r.teQueda > mejor.teQueda) mejor = r;
    if (r.teQueda < peor.teQueda) peor = r;
  }
  const marcar = (r: (typeof ordenados)[number]): DiaDeLaSemana => ({
    fecha: r.fecha,
    dia: NOMBRES_DIA[diaSemana(r.fecha)],
    teQueda: r.teQueda,
  });
  const hayContraste = mejor.teQueda !== peor.teQueda;

  // La semana anterior se mide con el mismo criterio (propios o ejemplo) que la semana pasada.
  const previaDesde = restarDias(desde, 7);
  const previa = diasDe(delRango(cierres, previaDesde, restarDias(desde, 1)), hayPropios);
  let comparacion: ComparacionSemana | undefined;
  if (previa.length > 0) {
    const teQuedoPrevia = sumar(previa.map(c => calcularCierre(c).teQueda));
    const diferencia = redondearSoles(teQueda - teQuedoPrevia);
    comparacion = { diferencia, texto: textoComparacion(diferencia) };
  }

  return {
    desde,
    hasta,
    vendido: sumar(resumenes.map(r => r.venta)),
    gastado: sumar(resumenes.map(r => r.gastoTotal)),
    teQueda,
    diasRegistrados: dias.length,
    ...(hayContraste ? { mejorDia: marcar(mejor), peorDia: marcar(peor) } : {}),
    ...(comparacion ? { comparacion } : {}),
    soloEjemplo: !hayPropios,
  };
};

/** 'te quedó S/ 120.00', o 'gastaste S/ 15.00 más de lo que vendiste' si el día cerró en negativo. */
const queQuedo = (monto: number): string =>
  monto < 0
    ? `gastaste ${formatoSoles(Math.abs(monto))} más de lo que vendiste`
    : `te quedó ${formatoSoles(monto)}`;

export const textoMejorDia = (d: DiaDeLaSemana): string =>
  `El ${d.dia} fue tu mejor día: ${queQuedo(d.teQueda)}`;

export const textoPeorDia = (d: DiaDeLaSemana): string =>
  `El ${d.dia} fue el más flojo: ${queQuedo(d.teQueda)}`;

/** 'Te quedó S/ 480.00 en la semana'. */
export const textoTeQuedoSemana = (monto: number): string =>
  monto < 0
    ? `Gastaste ${formatoSoles(Math.abs(monto))} más de lo que vendiste`
    : `Te quedó ${formatoSoles(monto)}`;
