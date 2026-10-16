// src/analisis/intenciones.ts
// El chat "Preguntarle a mis datos": un modelo solo CLASIFICA la pregunta en una de catorce intenciones;
// el código calcula la cifra con las funciones de siempre y arma una frase fija. Puro: sin red, sin
// reloj, sin React (AGENTS.md, reglas 3, 12 y 13). La fecha de hoy entra por `ctx.hoy`.
import { z } from 'zod';
import { calcularCierre } from '@dominio/cierre';
import { agruparCiclos, resumirCiclo, textoCapital } from '@dominio/ciclo';
import { totalPorCobrar } from '@dominio/cobro';
import { diaSemana, restarDias } from '@dominio/fecha';
import { formatoFecha, formatoSoles, nombreMes, redondearSoles } from '@dominio/formato';
import { esEjemplo } from '@dominio/origen';
import { teDeja } from '@dominio/producto';
import { singularUnidad, unidadSegunCantidad } from '@dominio/unidades';
import type {
  Cierre,
  Consulta,
  ContextoAnalisis,
  DiaConsulta,
  GananciaProducto,
  Hecho,
  IntencionId,
  Producto,
} from '@dominio/tipos';
import { articulo, extremosDeVentas, gananciaPorProducto } from './metricas';
import { planificarManana, textoPorciones } from './planificador';
import {
  caidaDePrecio,
  CICLOS_MINIMOS,
  cobroMensaje,
  comparacionMensaje,
  DIAS_PLURAL,
  mejorDiaDeLaSemana,
  peorDiaDeLaSemana,
  retiroMensaje,
} from './reglas';
import { extraerCifras } from './cifras';
import { mesAnterior, totalesDelMes } from './senales';

export interface Intencion {
  id: IntencionId;
  /** Una frase corta y sin ambigüedad: es lo que lee el modelo clasificador. */
  descripcion: string;
  /** La pregunta que se ofrece tocable; `null` en `noEntendi`. */
  sugerida: string | null;
}

/** Con menos confianza que esta, la pregunta se trata como no entendida. */
export const UMBRAL_CONFIANZA = 0.6;

export const DIAS_CONSULTA: readonly DiaConsulta[] = [
  'hoy',
  'ayer',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
  'ninguno',
];

/** Las catorce intenciones, en este orden. `descripcion` es lo que lee el clasificador. */
export const INTENCIONES: readonly Intencion[] = [
  {
    id: 'ventaDelDia',
    descripcion: 'Cuánto vendió en un día en concreto: hoy, ayer o un día de la semana.',
    sugerida: '¿Cuánto vendí ayer?',
  },
  {
    id: 'mejorDia',
    descripcion: 'Qué día de la semana le va mejor: el día que más gana.',
    sugerida: '¿Qué día me va mejor?',
  },
  {
    id: 'peorDia',
    descripcion: 'Qué día de la semana le va peor: el día más flojo, el que menos gana.',
    sugerida: '¿Qué día me va peor?',
  },
  {
    id: 'productoQueMasDeja',
    descripcion: 'Qué producto le deja más ganancia por porción.',
    sugerida: '¿Cuál me deja más?',
  },
  {
    id: 'productoQueMasSeVende',
    descripcion: 'Qué producto se vende más: el de más porciones vendidas.',
    sugerida: '¿Cuál se vende más?',
  },
  {
    id: 'cuantoPorCobrar',
    descripcion: 'Cuánta plata le deben todavía: el Yape que aún no cobró.',
    sugerida: '¿Cuánto me deben?',
  },
  {
    id: 'cuantoSacarParaLaCasa',
    descripcion: 'Cuánta plata puede sacar del negocio para la casa sin tocar su capital.',
    sugerida: '¿Cuánto puedo sacar para la casa?',
  },
  {
    id: 'cuantoPreparar',
    descripcion:
      'Cuánto preparar o qué comprar para mañana, de un producto o de todos: recomendación de compra.',
    sugerida: '¿Qué debería preparar mañana?',
  },
  {
    id: 'compararCiclo',
    descripcion: 'Cómo le fue en este ciclo de compra comparado con el ciclo pasado.',
    sugerida: '¿Cómo voy contra el ciclo pasado?',
  },
  {
    id: 'revisarPrecio',
    descripcion: 'Si debe revisar el precio de un producto porque ahora le deja menos.',
    sugerida: '¿Debo revisar un precio?',
  },
  {
    id: 'cuandoRecupereCapital',
    descripcion: 'Cuándo recuperó la plata que invirtió en mercadería en el ciclo actual.',
    sugerida: '¿Cuándo recuperé mi capital?',
  },
  {
    id: 'resumenMesPasado',
    descripcion:
      'Cómo me fue el mes pasado, cómo cerré el mes: ventas, gastos y resultado del mes anterior completo.',
    sugerida: '¿Cómo me fue el mes pasado?',
  },
  {
    id: 'resumenMesActual',
    descripcion:
      'Cómo voy este mes hasta hoy: ventas del mes, gastos y resultado de lo que va del mes en curso.',
    sugerida: '¿Cómo voy este mes?',
  },
  {
    id: 'noEntendi',
    descripcion: 'La pregunta no habla del negocio o no encaja en ninguna de las demás.',
    sugerida: null,
  },
];

const SUGERIDAS: readonly IntencionId[] = [
  'ventaDelDia',
  'peorDia',
  'productoQueMasDeja',
  'cuantoPorCobrar',
  'cuantoSacarParaLaCasa',
  'compararCiclo',
];

/** Las seis preguntas que se ofrecen tocables, en orden de utilidad. */
export const PREGUNTAS_SUGERIDAS: readonly string[] = SUGERIDAS.map(
  id => INTENCIONES.find(i => i.id === id)?.sugerida ?? '',
);

// --- Lo que dice el clasificador ------------------------------------------------------------

/** Los productos que el clasificador puede nombrar, tal como los escribe (no son ids). */
const PRODUCTOS_CLASIFICADOR = ['anticucho', 'pancita', 'rachi', 'chicha', 'ninguno'] as const;

const ids = INTENCIONES.map(i => i.id) as [IntencionId, ...IntencionId[]];
const dias = DIAS_CONSULTA as readonly [DiaConsulta, ...DiaConsulta[]];

const esquemaRespuesta = z.object({
  intencion: z.enum(ids),
  producto: z.enum(PRODUCTOS_CLASIFICADOR).optional(),
  dia: z.enum(dias),
  confianza: z.number().min(0).max(1),
});

/**
 * Lee la respuesta YA parseada del clasificador (`{ intencion, producto, dia, confianza }`). `null`
 * si falta un campo, si algo no es de la lista o si la confianza no es un número de 0 a 1. Con
 * menos de `UMBRAL_CONFIANZA` no se fía: devuelve `noEntendi`, sin producto ni día. El producto
 * `ninguno` es "sin producto"; los demás se vuelven id (`rachi` → `p-rachi`).
 */
export const interpretarRespuesta = (json: unknown): Consulta | null => {
  const r = esquemaRespuesta.safeParse(json);
  if (!r.success) return null;
  const { intencion, producto, dia, confianza } = r.data;
  if (confianza < UMBRAL_CONFIANZA) return { intencion: 'noEntendi', confianza };
  return {
    intencion,
    ...(!producto || producto === 'ninguno' ? {} : { producto: `p-${producto}` }),
    dia,
    confianza,
  };
};

/** Resuelve nombres vigentes en el teléfono; nunca se envía el catálogo al clasificador. */
export const resolverProductoLocal = (texto: string, productos: Producto[]): string | undefined => {
  const normalizar = (valor: string): string =>
    valor
      .toLocaleLowerCase('es-PE')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ]+/g, ' ')
      .trim();
  const pregunta = ` ${normalizar(texto)} `;
  const candidatos = productos.filter(p => p.activo && normalizar(p.nombre) !== '');
  // El nombre más largo evita que «chicha morada» se confunda con «chicha».
  candidatos.sort((a, b) => normalizar(b.nombre).length - normalizar(a.nombre).length);
  return candidatos.find(p => pregunta.includes(` ${normalizar(p.nombre)} `))?.id;
};

// --- Las frases ------------------------------------------------------------------------------

const POCOS_DIAS =
  'Todavía no tengo suficientes días para saberlo. Cierra más días y vuelve a preguntar.';
const POCAS_VENTAS = 'Todavía no tengo suficientes ventas para compararlos.';
const SIN_CICLO_CERRADO =
  'Todavía no cierras un ciclo completo. Cuando compres mercadería otra vez, te lo calculo.';
const SIN_CIERRES = 'Todavía no tienes ningún día cerrado.';
/** Cuántos días mira "el que más se vende" y "el que más deja": los mismos que "Qué me deja cada uno". */
const DIAS_PRODUCTOS = 30;

const NOMBRES_DIA: Partial<Record<DiaConsulta, { numero: number; nombre: string }>> = {
  lunes: { numero: 1, nombre: 'lunes' },
  martes: { numero: 2, nombre: 'martes' },
  miercoles: { numero: 3, nombre: 'miércoles' },
  jueves: { numero: 4, nombre: 'jueves' },
  viernes: { numero: 5, nombre: 'viernes' },
  sabado: { numero: 6, nombre: 'sábado' },
  domingo: { numero: 0, nombre: 'domingo' },
};

const SIN_DIAS_CERRADOS = 'Ese mes no tiene días cerrados.';

const hecho = (intencion: IntencionId, frase: string): Hecho => ({
  intencion,
  frase,
  cifras: extraerCifras(frase),
});

/** 410 → '410', 1410 → '1,410': las cantidades grandes se leen mejor con su coma. */
const conMiles = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const unidadDe = (ctx: ContextoAnalisis, productoId: string): string =>
  ctx.productos.find(p => p.id === productoId)?.unidad ?? 'porcion';

/** '1 porción', '410 porciones', '1 vaso', '12 vasos'. */
const cantidad = (n: number, unidad: string): string =>
  `${conMiles(n)} ${unidadSegunCantidad(n, unidad)}`;

/** "El anticucho" o "La pancita", para empezar una frase. */
const conArticulo = (nombre: string): string =>
  `${articulo(nombre) === 'la' ? 'La' : 'El'} ${nombre}`;

/** El producto de la consulta, si la app lo tiene y está activo. */
export const productoDe = (consulta: Consulta, ctx: ContextoAnalisis): Producto | undefined =>
  ctx.productos.find(p => p.id === consulta.producto && p.activo);

const pedirProducto = (intencion: IntencionId): Hecho =>
  hecho(intencion, '¿De cuál producto? Escribe su nombre como aparece en tu catálogo.');

/** El último cierre con fecha de hoy o anterior que cumple el filtro; los posteriores a hoy no cuentan. */
const ultimoCierre = (
  ctx: ContextoAnalisis,
  cumple: (c: Cierre) => boolean = () => true,
): Cierre | undefined =>
  ctx.cierres
    .filter(c => c.fecha <= ctx.hoy && cumple(c))
    .reduce<Cierre | undefined>(
      (a, c) => (a === undefined || c.fecha > a.fecha ? c : a),
      undefined,
    );

/** El cierre del que habla "¿cuánto vendí…?": hoy, ayer, el último de un día de la semana o el último que haya. */
const cierreDelDia = (consulta: Consulta, ctx: ContextoAnalisis): Cierre | undefined => {
  const dia = consulta.dia ?? 'ninguno';
  const detalle = NOMBRES_DIA[dia];
  if (dia === 'hoy') return ctx.cierres.find(c => c.fecha === ctx.hoy);
  if (dia === 'ayer') return ctx.cierres.find(c => c.fecha === restarDias(ctx.hoy, 1));
  if (detalle) return ultimoCierre(ctx, c => diaSemana(c.fecha) === detalle.numero);
  return ultimoCierre(ctx);
};

const ventaDelDia = (consulta: Consulta, ctx: ContextoAnalisis): Hecho => {
  const dia = consulta.dia ?? 'ninguno';
  const detalle = NOMBRES_DIA[dia];
  const cierre = cierreDelDia(consulta, ctx);

  if (cierre === undefined) {
    if (dia === 'hoy') return hecho('ventaDelDia', 'Hoy todavía no cerraste tu día.');
    if (dia === 'ayer') return hecho('ventaDelDia', 'Ayer no cerraste tu día.');
    if (detalle) return hecho('ventaDelDia', `El ${detalle.nombre} no tienes ningún día cerrado.`);
    return hecho('ventaDelDia', SIN_CIERRES);
  }
  const venta = formatoSoles(calcularCierre(cierre).venta);
  const fecha = formatoFecha(cierre.fecha).toLowerCase();
  if (dia === 'hoy') return hecho('ventaDelDia', `Hoy, ${fecha}, vendiste ${venta}.`);
  if (dia === 'ayer') return hecho('ventaDelDia', `Ayer, ${fecha}, vendiste ${venta}.`);
  return hecho('ventaDelDia', `El ${fecha} vendiste ${venta}.`);
};

const diaDeLaSemana = (intencion: 'peorDia' | 'mejorDia', ctx: ContextoAnalisis): Hecho => {
  const d = intencion === 'peorDia' ? peorDiaDeLaSemana(ctx) : mejorDiaDeLaSemana(ctx);
  if (d === null) return hecho(intencion, POCOS_DIAS);
  const dia = DIAS_PLURAL[d.dia];
  return hecho(
    intencion,
    intencion === 'peorDia'
      ? `Los ${dia} son tu día más flojo: ganas ${formatoSoles(
          d.diferencia,
        )} menos que tu promedio.`
      : `Los ${dia} son tu mejor día: ganas ${formatoSoles(d.diferencia)} más que tu promedio.`,
  );
};

const gananciaDeProductos = (ctx: ContextoAnalisis): GananciaProducto[] =>
  gananciaPorProducto(ctx.cierres, restarDias(ctx.hoy, DIAS_PRODUCTOS), ctx.productos);

const productoQueMasDeja = (ctx: ContextoAnalisis): Hecho => {
  const extremos = extremosDeVentas(gananciaDeProductos(ctx));
  if (extremos === null) return hecho('productoQueMasDeja', POCAS_VENTAS);
  const { masDeja: p } = extremos;
  const nombre = p.nombre.toLowerCase();
  const porUnidad = cantidad(1, unidadDe(ctx, p.productoId)).replace(/^1 /, '');
  return hecho(
    'productoQueMasDeja',
    `${conArticulo(nombre)} es ${
      articulo(nombre) === 'la' ? 'la' : 'el'
    } que más te deja: ${formatoSoles(p.teDeja)} por ${porUnidad}, ${formatoSoles(
      p.ganancia,
    )} en total.`,
  );
};

const productoQueMasSeVende = (ctx: ContextoAnalisis): Hecho => {
  const extremos = extremosDeVentas(gananciaDeProductos(ctx));
  if (extremos === null) return hecho('productoQueMasSeVende', POCAS_VENTAS);
  const { masVendido: p } = extremos;
  const nombre = p.nombre.toLowerCase();
  const vendidas = cantidad(p.seVende, unidadDe(ctx, p.productoId));
  return hecho(
    'productoQueMasSeVende',
    `${conArticulo(nombre)} es ${articulo(
      nombre,
    )} que más se vende: ${vendidas} en los últimos ${DIAS_PRODUCTOS} días.`,
  );
};

const cuantoPorCobrar = (ctx: ContextoAnalisis): Hecho =>
  hecho(
    'cuantoPorCobrar',
    totalPorCobrar(ctx.cierres).pagos === 0 ? 'No tienes nada por cobrar.' : cobroMensaje(ctx),
  );

const cuantoSacarParaLaCasa = (ctx: ContextoAnalisis): Hecho =>
  hecho(
    'cuantoSacarParaLaCasa',
    (ctx.ciclos ?? agruparCiclos(ctx.cierres)).length < CICLOS_MINIMOS
      ? SIN_CICLO_CERRADO
      : retiroMensaje(ctx),
  );

/**
 * "¿Cuánto preparo mañana?": la MISMA cuenta y las MISMAS palabras que la tarjeta "Para mañana" de
 * Inicio (`planificarManana`). Con `consulta.producto` responde solo de ese producto; sin él, o si la
 * app no lo tiene, de todos los activos. Sin muestras suficientes lo dice, no inventa.
 */
/** "Igual que…" → "igual que…" para ir entre paréntesis; "+8 más…" queda igual. */
const enMinuscula = (texto: string): string => `${texto.charAt(0).toLowerCase()}${texto.slice(1)}`;

const cuantoPreparar = (consulta: Consulta, ctx: ContextoAnalisis): Hecho => {
  const plan = planificarManana(ctx.cierres, ctx.productos, ctx.hoy);
  const propia = plan.sugerencias.filter(s => s.productoId === consulta.producto);
  const sugerencias = propia.length > 0 ? propia : plan.sugerencias;
  if (sugerencias.length === 0) {
    return hecho(
      'cuantoPreparar',
      `Mañana es ${plan.dia}. Todavía no tengo productos para sugerirte.`,
    );
  }
  const conDatos = sugerencias.filter(s => !s.datosInsuficientes && s.porciones !== null);
  const sinDatos = sugerencias.filter(s => s.datosInsuficientes);
  if (conDatos.length === 0) {
    return hecho('cuantoPreparar', `Mañana es ${plan.dia}. ${sinDatos[0].texto}.`);
  }
  const partes = conDatos.map(
    s =>
      `${textoPorciones(s.porciones ?? 0, s.unidad)} de ${s.nombre.toLowerCase()} (${enMinuscula(
        s.texto,
      )})`,
  );
  let frase = `Mañana es ${plan.dia}: prepara ${partes.join('; ')}.`;
  if (sinDatos.length > 0) {
    const nombres = sinDatos.map(s => s.nombre.toLowerCase()).join(' y ');
    frase += ` De ${nombres}: ${enMinuscula(sinDatos[0].texto)}.`;
  }
  const capital = redondearSoles(conDatos.reduce((total, s) => total + s.capital, 0));
  return hecho('cuantoPreparar', `${frase} Pondrías ${formatoSoles(capital)} de mercadería.`);
};

const compararCiclo = (ctx: ContextoAnalisis): Hecho => {
  const ciclos = agruparCiclos(ctx.cierres).length;
  if (ciclos === 0) return hecho('compararCiclo', SIN_CIERRES);
  if (ciclos < CICLOS_MINIMOS) {
    return hecho('compararCiclo', 'Todavía tienes un solo ciclo, no hay con qué comparar.');
  }
  return hecho('compararCiclo', `${comparacionMensaje(ctx)}.`);
};

const revisarPrecio = (consulta: Consulta, ctx: ContextoAnalisis): Hecho => {
  const producto = productoDe(consulta, ctx);
  if (producto === undefined) return pedirProducto('revisarPrecio');
  const caida = caidaDePrecio(ctx, producto);
  if (caida !== null) {
    return hecho(
      'revisarPrecio',
      `Lo que te deja ${articulo(
        producto.nombre,
      )} ${producto.nombre.toLowerCase()} por ${singularUnidad(
        producto.unidad,
      )} bajó ${formatoSoles(caida.caida)} desde ${caida.mes}. Revisa el precio.`,
    );
  }
  const nombre = producto.nombre.toLowerCase();
  const del = articulo(nombre) === 'la' ? 'de la' : 'del';
  return hecho(
    'revisarPrecio',
    `El precio ${del} ${nombre} no muestra una caída: te deja ${formatoSoles(
      teDeja(producto).monto,
    )} por ${cantidad(1, producto.unidad).replace(/^1 /, '')}.`,
  );
};

const cuandoRecupereCapital = (ctx: ContextoAnalisis): Hecho => {
  const ciclos = agruparCiclos(ctx.cierres);
  if (ciclos.length === 0) return hecho('cuandoRecupereCapital', SIN_CIERRES);
  return hecho(
    'cuandoRecupereCapital',
    `${textoCapital(resumirCiclo(ciclos[ciclos.length - 1]))}.`,
  );
};

/** '1 día', '26 días': lo que se cerró en el mes. */
const diasTexto = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;
/** '1 día cerrado', '22 días cerrados': el respaldo de una cifra de comparación. */
const diasCerrados = (n: number): string => `${n} ${n === 1 ? 'día cerrado' : 'días cerrados'}`;

/**
 * "¿Cómo me fue el mes pasado?" y "¿cómo voy este mes?": ventas, gastos y resultado registrado del
 * mes, con las MISMAS cuentas del reporte (`totalesDelMes`), y la comparación con el mes calendario
 * anterior. El mes pasado se compara con el mes anterior completo; "este mes" (del día 1 a hoy) se
 * compara con los mismos días del mes anterior, para no poner un mes a medias contra uno entero. Solo
 * cuentan los cierres que existen y los posteriores a hoy no cuentan: sin cierres en el mes, la frase
 * fija; sin cierres en el anterior, la respuesta sale sin comparación. No inventa ningún día.
 */
const resumenDelMes = (
  intencion: 'resumenMesPasado' | 'resumenMesActual',
  ctx: ContextoAnalisis,
): Hecho => {
  const cierres = ctx.cierres.filter(c => c.fecha <= ctx.hoy);
  const actual = intencion === 'resumenMesActual';
  const mesDeHoy = ctx.hoy.slice(0, 7);
  const diaDeHoy = Number(ctx.hoy.slice(8, 10));
  const mes = actual ? mesDeHoy : mesAnterior(mesDeHoy);
  const previo = mesAnterior(mes);
  const hastaDia = actual ? diaDeHoy : undefined;
  const t = totalesDelMes(cierres, mes, hastaDia);
  if (t.dias === 0) return hecho(intencion, SIN_DIAS_CERRADOS);
  const p = totalesDelMes(cierres, previo, hastaDia);

  const nombre = nombreMes(`${mes}-01`);
  const nombrePrevio = nombreMes(`${previo}-01`);
  const cifras = `vendiste ${formatoSoles(t.venta)}, gastaste ${formatoSoles(
    t.gastos,
  )} y el resultado registrado ${actual ? 'va en' : 'fue'} ${formatoSoles(t.teQueda)}.`;
  const inicio = actual
    ? `En lo que va de ${nombre} (${
        diaDeHoy === 1 ? 'solo el 1' : `del 1 al ${diaDeHoy}`
      }) cerraste ${diasTexto(t.dias)}: ${cifras}`
    : `En ${nombre} cerraste ${diasTexto(t.dias)}: ${cifras}`;
  const tramo = diaDeHoy === 1 ? 'En ese mismo día' : 'En los mismos días';

  const diferencia = redondearSoles(t.teQueda - p.teQueda);
  const mas = diferencia > 0 ? 'más' : 'menos';
  let comparacion: string;
  if (p.dias === 0) {
    comparacion = actual
      ? `No hay con qué comparar: ${tramo.toLowerCase()} de ${nombrePrevio} no hay días cerrados.`
      : `No hay con qué comparar: ${nombrePrevio} no tiene días cerrados.`;
  } else if (actual) {
    comparacion = `${tramo} de ${nombrePrevio} fue ${formatoSoles(p.teQueda)} (${diasCerrados(
      p.dias,
    )}), así que vas ${
      diferencia === 0 ? 'igual' : `${formatoSoles(Math.abs(diferencia))} ${mas}`
    }.`;
  } else {
    comparacion =
      diferencia === 0
        ? `Quedó igual que en ${nombrePrevio} (${diasCerrados(p.dias)}).`
        : `Es ${formatoSoles(Math.abs(diferencia))} ${mas} que en ${nombrePrevio} (${diasCerrados(
            p.dias,
          )}).`;
  }
  return hecho(intencion, `${inicio} ${comparacion}`);
};

// --- Qué cierres usó cada respuesta (para avisar los datos de ejemplo) ------------------------------

/** Hasta dónde mira "cuánto preparar": el mismo día de las 8 semanas anteriores a mañana (mañana − 56 = hoy − 55). */
const DIAS_PLAN = 55;

/**
 * Los cierres con que se calculó la respuesta de cada intención, para saber si alguno es de ejemplo
 * (Sprint-17, D121). Es la misma ventana que usa su cálculo: el cierre del día en `ventaDelDia`, los
 * últimos `DIAS_PRODUCTOS` días en los productos, el mes y el anterior en `resumenMes*`, los cobros
 * pendientes en `cuantoPorCobrar`, las ocho semanas de `cuantoPreparar` y todo el historial hasta hoy en
 * lo demás (días de la semana, ciclos, capital, precio). Los cierres posteriores a hoy no cuentan.
 */
const cierresUsados = (consulta: Consulta, ctx: ContextoAnalisis): Cierre[] => {
  const hasta = ctx.cierres.filter(c => c.fecha <= ctx.hoy);
  switch (consulta.intencion) {
    case 'ventaDelDia': {
      const cierre = cierreDelDia(consulta, ctx);
      return cierre === undefined ? [] : [cierre];
    }
    case 'productoQueMasDeja':
    case 'productoQueMasSeVende':
      return hasta.filter(c => c.fecha >= restarDias(ctx.hoy, DIAS_PRODUCTOS));
    case 'cuantoPorCobrar':
      return hasta.filter(c => c.yapePendiente && !c.cobradoEn);
    case 'cuantoPreparar':
      return hasta.filter(c => c.fecha >= restarDias(ctx.hoy, DIAS_PLAN));
    case 'resumenMesPasado':
    case 'resumenMesActual': {
      const mes = consulta.intencion === 'resumenMesActual' ? ctx.hoy.slice(0, 7) : null;
      const actual = mes ?? mesAnterior(ctx.hoy.slice(0, 7));
      const previo = mesAnterior(actual);
      return hasta.filter(c => c.fecha.startsWith(actual) || c.fecha.startsWith(previo));
    }
    case 'noEntendi':
      return [];
    default:
      return hasta;
  }
};

/**
 * La respuesta a la pregunta de Freddy: la cifra sale de las mismas funciones del resto de la app y
 * la frase es una plantilla fija. `cifras` sale de la propia frase (`extraerCifras`), la misma
 * función con que se vigila la redacción. Si algún cierre que usó es de ejemplo, el hecho lleva
 * `ejemplo: true` (`cierresUsados`); sin cierres usados no hay aviso. No lanza ni muta lo que recibe.
 */
export const responderConsulta = (consulta: Consulta, ctx: ContextoAnalisis): Hecho => {
  const calculado = calcularHecho(consulta, ctx);
  return cierresUsados(consulta, ctx).some(esEjemplo) ? { ...calculado, ejemplo: true } : calculado;
};

const calcularHecho = (consulta: Consulta, ctx: ContextoAnalisis): Hecho => {
  switch (consulta.intencion) {
    case 'ventaDelDia':
      return ventaDelDia(consulta, ctx);
    case 'peorDia':
    case 'mejorDia':
      return diaDeLaSemana(consulta.intencion, ctx);
    case 'productoQueMasDeja':
      return productoQueMasDeja(ctx);
    case 'productoQueMasSeVende':
      return productoQueMasSeVende(ctx);
    case 'cuantoPorCobrar':
      return cuantoPorCobrar(ctx);
    case 'cuantoSacarParaLaCasa':
      return cuantoSacarParaLaCasa(ctx);
    case 'cuantoPreparar':
      return cuantoPreparar(consulta, ctx);
    case 'compararCiclo':
      return compararCiclo(ctx);
    case 'revisarPrecio':
      return revisarPrecio(consulta, ctx);
    case 'cuandoRecupereCapital':
      return cuandoRecupereCapital(ctx);
    case 'resumenMesPasado':
    case 'resumenMesActual':
      return resumenDelMes(consulta.intencion, ctx);
    default:
      return hecho('noEntendi', 'No entendí tu pregunta. Prueba con una de estas:');
  }
};
