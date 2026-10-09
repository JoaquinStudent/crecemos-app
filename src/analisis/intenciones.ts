// src/analisis/intenciones.ts
// El chat "Preguntarle a mis datos": un modelo solo CLASIFICA la pregunta en una de doce intenciones;
// el código calcula la cifra con las funciones de siempre y arma una frase fija. Puro: sin red, sin
// reloj, sin React (AGENTS.md, reglas 3, 12 y 13). La fecha de hoy entra por `ctx.hoy`.
import { z } from 'zod';
import { calcularCierre } from '@dominio/cierre';
import { agruparCiclos, resumirCiclo, textoCapital } from '@dominio/ciclo';
import { totalPorCobrar } from '@dominio/cobro';
import { diaSemana, restarDias } from '@dominio/fecha';
import { formatoFecha, formatoSoles } from '@dominio/formato';
import { teDeja } from '@dominio/producto';
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
import {
  caidaDePrecio,
  cicloCerradoYActual,
  CICLOS_MINIMOS,
  cobroMensaje,
  comparacionMensaje,
  DIAS_PLURAL,
  mejorDiaDeLaSemana,
  peorDiaDeLaSemana,
  retiroMensaje,
  sobranteDeDosCiclos,
} from './reglas';
import { extraerCifras } from './validarRedaccion';

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

/** Las doce intenciones, en este orden. `descripcion` es lo que lee el clasificador. */
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
const cantidad = (n: number, unidad: string): string => {
  const uno = unidad === 'porcion' ? 'porción' : unidad;
  const varios =
    unidad === 'porcion' ? 'porciones' : /[aeiouáéíóú]$/i.test(uno) ? `${uno}s` : `${uno}es`;
  return `${conMiles(n)} ${n === 1 ? uno : varios}`;
};

/** "El anticucho" o "La pancita", para empezar una frase. */
const conArticulo = (nombre: string): string =>
  `${articulo(nombre) === 'la' ? 'La' : 'El'} ${nombre}`;

/** El producto de la consulta, si la app lo tiene y está activo. */
export const productoDe = (consulta: Consulta, ctx: ContextoAnalisis): Producto | undefined =>
  ctx.productos.find(p => p.id === consulta.producto && p.activo);

const pedirProducto = (intencion: IntencionId): Hecho =>
  hecho(intencion, '¿De cuál producto? Escribe su nombre como aparece en tu catálogo.');

/** 'rachi' de 'p-rachi' cuando el producto no aparece en la lista de la app. */
const nombreDeId = (id: string): string => id.replace(/^p-/, '');

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

const ventaDelDia = (consulta: Consulta, ctx: ContextoAnalisis): Hecho => {
  const dia = consulta.dia ?? 'ninguno';
  const ayer = restarDias(ctx.hoy, 1);
  const detalle = NOMBRES_DIA[dia];

  let cierre: Cierre | undefined;
  if (dia === 'hoy') cierre = ctx.cierres.find(c => c.fecha === ctx.hoy);
  else if (dia === 'ayer') cierre = ctx.cierres.find(c => c.fecha === ayer);
  else if (detalle) cierre = ultimoCierre(ctx, c => diaSemana(c.fecha) === detalle.numero);
  else cierre = ultimoCierre(ctx);

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
    `${conArticulo(nombre)} tiene la mayor diferencia estimada entre precio y costo: ${formatoSoles(
      p.teDeja,
    )} por ${porUnidad}, ${formatoSoles(p.ganancia)} en total.`,
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
    agruparCiclos(ctx.cierres).length < CICLOS_MINIMOS ? SIN_CICLO_CERRADO : retiroMensaje(ctx),
  );

/** Los productos con datos en los dos últimos ciclos: primero los de la app, en su orden; luego los demás. */
const productosConDatos = (ctx: ContextoAnalisis): string[] => {
  const ciclos = cicloCerradoYActual(ctx);
  if (ciclos === null) return [];
  const vistos = new Set<string>();
  for (const ciclo of [ciclos.cerrado, ciclos.actual]) {
    for (const c of ciclo.cierres) for (const l of c.lineas) vistos.add(l.productoId);
  }
  const conocidos = ctx.productos.map(p => p.id);
  const activos = ctx.productos.filter(p => p.activo && vistos.has(p.id)).map(p => p.id);
  const otros = [...vistos].filter(id => !conocidos.includes(id)).sort();
  return [...activos, ...otros];
};

/** "Qué compro mañana" sin producto: la misma cuenta de un producto, para todos los que tienen datos. */
const cuantoPrepararTodos = (ctx: ContextoAnalisis): Hecho => {
  const conDatos = productosConDatos(ctx);
  if (agruparCiclos(ctx.cierres).length < CICLOS_MINIMOS) {
    return hecho('cuantoPreparar', SIN_CICLO_CERRADO);
  }
  const partes: string[] = [];
  for (const id of conDatos) {
    const sobrante = sobranteDeDosCiclos(ctx, id);
    if (sobrante === null) continue;
    const producto = ctx.productos.find(p => p.id === id);
    const nombre = (producto?.nombre ?? sobrante.nombre ?? nombreDeId(id)).toLowerCase();
    partes.push(
      sobrante.cantidad === 0
        ? `${nombre}, te alcanza lo que preparas`
        : `${nombre}, prepara ${cantidad(sobrante.cantidad, producto?.unidad ?? 'porcion')} menos`,
    );
  }
  if (partes.length === 0) return hecho('cuantoPreparar', POCAS_VENTAS);
  return hecho('cuantoPreparar', `Para mañana, según lo que te sobró: ${partes.join('; ')}.`);
};

const cuantoPreparar = (consulta: Consulta, ctx: ContextoAnalisis): Hecho => {
  if (consulta.producto === undefined) return cuantoPrepararTodos(ctx);
  const sobrante = sobranteDeDosCiclos(ctx, consulta.producto);
  if (sobrante === null) return hecho('cuantoPreparar', SIN_CICLO_CERRADO);
  const producto = ctx.productos.find(p => p.id === consulta.producto);
  const nombre = producto?.nombre ?? sobrante.nombre ?? nombreDeId(consulta.producto);
  if (sobrante.cantidad === 0) {
    return hecho(
      'cuantoPreparar',
      `Con lo que preparas de ${nombre.toLowerCase()} te alcanza: en los últimos dos ciclos no registraste sobrantes.`,
    );
  }
  const menos = cantidad(sobrante.cantidad, producto?.unidad ?? 'porcion');
  return hecho(
    'cuantoPreparar',
    `Registraste sobrantes de ${nombre} en dos ciclos seguidos. Prepara ${menos} menos.`,
  );
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
      `La diferencia estimada por unidad de ${producto.nombre} bajó ${formatoSoles(
        caida.caida,
      )} desde ${caida.mes} (precio menos costo estimado). Revisa el precio.`,
    );
  }
  const nombre = producto.nombre.toLowerCase();
  const del = articulo(nombre) === 'la' ? 'de la' : 'del';
  return hecho(
    'revisarPrecio',
    `El precio ${del} ${nombre} no muestra una caída: diferencia estimada ${formatoSoles(
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

/**
 * La respuesta a la pregunta de Freddy: la cifra sale de las mismas funciones del resto de la app y
 * la frase es una plantilla fija. `cifras` sale de la propia frase (`extraerCifras`), la misma
 * función con que se vigila la redacción. No lanza ni muta lo que recibe.
 */
export const responderConsulta = (consulta: Consulta, ctx: ContextoAnalisis): Hecho => {
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
    default:
      return hecho('noEntendi', 'No entendí tu pregunta. Prueba con una de estas:');
  }
};
