// src/analisis/clasificadorLocal.ts
// El clasificador de respaldo: cuando no hay internet (o el servidor no contesta), la pregunta se
// clasifica AQUÍ, en el teléfono, con reglas cerradas y puntaje por frases. Elige entre las MISMAS
// catorce intenciones que el servidor y devuelve lo mismo (`intencion`, `dia`, `confianza` de 0 a 1), con
// el mismo umbral (`UMBRAL_CONFIANZA`): por debajo, `noEntendi`. Las cifras y las frases las arma el
// código de siempre (`responderConsulta`); solo la clasificación necesitaba al servidor.
// Puro: sin red, sin reloj, sin azar, sin React. `hoy` es opcional y solo sirve para "anteayer".
import { diaSemana, restarDias } from '@dominio/fecha';
import type { Consulta, DiaConsulta, FechaNegocio, IntencionId } from '@dominio/tipos';
import { UMBRAL_CONFIANZA } from './intenciones';
import { normalizarTexto } from './texto';

interface Regla {
  /** Se prueba contra el texto normalizado (minúsculas, sin tildes ni signos). */
  re: RegExp;
  /** 1 = frase clara; 0,5 = pista débil que sola no alcanza. */
  peso: number;
  /** Si el texto también encaja con esto, la regla no cuenta (p. ej. "qué día me deja más"). */
  excluye?: RegExp;
}

const r = (re: RegExp, peso: number, excluye?: RegExp): Regla => ({ re, peso, excluye });

const MEJOR = '(mejor|mas|bien)';
const PEOR = '(peor|menos|mal)';
const HABLA_DE_DIA = /\bdias?\b/;
/** "El mes" es de las intenciones del mes, no de las del día: «cómo me fue el mes» no es «cómo me fue el lunes». */
const HABLA_DE_MES = /\bmes(es)?\b/;

const REGLAS: Record<Exclude<IntencionId, 'noEntendi'>, Regla[]> = {
  ventaDelDia: [
    r(
      /\bcuant[oa]s? (vendi|vendio|gane|hice|facture|ingrese|entro|me entro|vendimos)\b/,
      2,
      HABLA_DE_MES,
    ),
    r(/\b(mi|la|las|mis) ventas? (de|del|en)\b/, 1.5, HABLA_DE_MES),
    r(/\bcomo me (fue|va) (hoy|ayer|anteayer|antier|el|este)\b/, 1.5, HABLA_DE_MES),
    r(/\bque tal (me fue|mi venta|mis ventas|vendi)\b/, 1.5, HABLA_DE_MES),
    r(/\bcuanto (fue|es|ha sido|salio) (la|mi) venta\b/, 1.5, HABLA_DE_MES),
    r(/\b(vendi|vendio|venta|ventas)\b/, 0.5, HABLA_DE_MES),
    r(
      /\b(hoy|ayer|anteayer|antier|anoche|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/,
      0.5,
      HABLA_DE_MES,
    ),
  ],
  mejorDia: [
    r(/\bmejor dia\b/, 2),
    r(new RegExp(`\\bque dia (me va|me fue|vendo|gano|se vende|rinde|es) ${MEJOR}\\b`), 2),
    r(/\bque dia (gano|vendo|se vende|me deja) mas\b/, 2),
    r(new RegExp(`\\bdia (que )?(mas|mejor) (gano|vendo|me va|me deja|se vende|rinde)\\b`), 2),
    r(/\bdia (de )?(mas|mayor) (ventas?|ganancia)\b/, 2),
    r(/\bcuando (vendo|gano) mas\b/, 1.5),
    r(/\b(cual|que) es mi dia (fuerte|bueno|top)\b/, 2),
    r(/\bdia fuerte\b/, 1.5),
  ],
  peorDia: [
    r(/\bpeor dia\b/, 2),
    r(new RegExp(`\\bque dia (me va|me fue|vendo|gano|se vende|rinde|es) ${PEOR}\\b`), 2),
    r(/\bdia (mas )?(flojo|malo|bajo|debil|lento|muerto)\b/, 2),
    r(/\bdia que (menos|peor) (gano|vendo|me va|se vende|rinde)\b/, 2),
    r(/\bcuando (vendo|gano) menos\b/, 1.5),
    r(/\bque dia (gano|vendo) menos\b/, 2),
    r(/\bmas flojo\b/, 1),
  ],
  productoQueMasDeja: [
    r(/\b(me )?deja(n)? mas\b/, 2, HABLA_DE_DIA),
    r(/\b(cual|que) (producto|plato|cosa|de mis productos).{0,20}(gano|deja|conviene) mas\b/, 2),
    r(/\bcon (cual|que) (producto )?gano mas\b/, 2),
    r(/\bmas (ganancia|utilidad|margen)\b/, 1.5, HABLA_DE_DIA),
    r(/\bmayor (ganancia|utilidad|margen)\b/, 1.5, HABLA_DE_DIA),
    r(/\b(mas )?(rentable|conveniente)\b/, 1.5),
    r(/\bme conviene (mas|vender mas)\b/, 1.5, /\b(precio|subir|bajar)\b/),
    r(/\b(cual|que) (producto|plato|cosa)\b/, 0.5),
  ],
  productoQueMasSeVende: [
    r(/\b(se )?vende mas\b/, 2, HABLA_DE_DIA),
    r(/\bmas vendid[oa]s?\b/, 2),
    r(/\bmas se vende\b/, 2),
    r(/\b(cual|que) (producto|plato|cosa)?.{0,12}(vendo|vendi) mas\b/, 2, HABLA_DE_DIA),
    r(/\b(el|lo) que mas (vendo|sale|piden|se lleva)\b/, 2),
    r(/\bmas (pedido|popular|salida)\b/, 1.5),
    r(/\bsale mas\b/, 1.5, HABLA_DE_DIA),
    r(/\b(cual|que) (producto|plato|cosa)\b/, 0.5),
  ],
  cuantoPorCobrar: [
    r(/\bcuant[oa]s? (me )?(deben|adeudan|debe)\b/, 2),
    r(/\bme (deben|adeudan)\b/, 1.5),
    r(/\bpor cobrar\b/, 2),
    r(/\bcuanto (falta|me falta|tengo) (por |de |que )?cobrar\b/, 2),
    r(
      /\b(yapes?|pagos?)\b.{0,25}\b(pendientes?|falta|faltan|sin cobrar|no cobre|no me han pagado|deben)\b/,
      2,
    ),
    r(/\b(pendientes?|deuda|deudas|deudores|fiado|fiados|fiada)\b/, 1),
    r(/\bquien(es)? me (debe|deben)\b/, 2),
    r(/\bcobros?\b/, 1),
    r(/\bcobrar\b/, 1, /\b(precio|cuanto cobro|subir|bajar)\b/),
    r(/\byapes?\b/, 0.5),
  ],
  cuantoSacarParaLaCasa: [
    r(/\bpara (la )?casa\b/, 2),
    r(/\bpara (el )?hogar\b/, 2),
    r(/\bcuanto (puedo |me puedo |podria )?(sacar|retirar|llevar|llevarme|sacarme)\b/, 2),
    r(/\bcuanto (saco|retiro|me llevo|me pago|me puedo pagar|me toca)\b/, 2),
    r(/\b(sacar|retirar|retiro|saco)\b.{0,25}\b(plata|dinero|sol(es)?|negocio|gastos?)\b/, 1.5),
    r(/\bsin tocar (el|mi|la) (capital|inversion|mercaderia)\b/, 1.5),
    r(/\bmi (sueldo|pago|sustento)\b/, 1.5),
    r(/\bcuanto (puedo )?(gastar|usar)\b/, 1),
    r(/\b(sacar|retirar|retiro)\b/, 1),
  ],
  cuantoPreparar: [
    r(
      /\bcuant[oa]s? (preparo|preparar|compro|comprar|cocino|cocinar|debo preparar|debo comprar|debo cocinar|tengo que preparar|tengo que comprar|hago|llevo|traigo)\b/,
      2,
      HABLA_DE_MES,
    ),
    r(
      /\bque (preparo|compro|cocino|debo preparar|debo comprar|debo cocinar|deberia preparar|deberia comprar|tengo que preparar|tengo que comprar|llevo) ?(para )?(manana|hoy)?\b/,
      2,
    ),
    r(/\bque (preparar|comprar|cocinar)\b/, 1.5),
    r(/\b(preparo|preparar|prepara|comprar|compro|cocinar|cocino)\b.{0,25}\bmanana\b/, 1.5),
    r(/\b(preparar|preparo|comprar|compro|cocinar|cocino)\b/, 1),
    r(/\bmanana\b/, 0.5, /\b(vendi|vendio|ventas?)\b/),
    r(/\bcuant[oa]s? (porciones|platos|anticuchos|vasos|raciones|unidades|mercaderia)\b/, 1.5),
    r(/\b(recomiend|sugier)[a-z]*\b.{0,25}\b(manana|comprar|preparar)\b/, 1.5),
  ],
  resumenMesPasado: [
    r(/\bmes (pasado|anterior)\b/, 3),
    r(/\b(el )?ultimo mes\b/, 2),
    r(/\bcomo (me fue|cerre|termine|salio) (en )?(el|mi) mes\b/, 2.5),
    r(/\bcomo (fue|estuvo|salio) (el|mi) mes\b/, 2),
  ],
  resumenMesActual: [
    r(/\beste mes\b/, 2.5),
    r(/\bmes (actual|en curso)\b/, 3),
    r(/\bventas? del mes\b/, 2, /\bmes (pasado|anterior)\b/),
    r(/\bcomo (voy|vengo|estoy|me va|me esta yendo) (en|con) (el|mi) mes\b/, 2.5),
    r(/\b(lo )?que va del mes\b/, 2),
  ],
  compararCiclo: [
    r(/\bciclo (pasado|anterior)\b/, 2),
    r(
      /\b(contra|comparado con|comparar con|comparado|vs) (el )?(ciclo|anterior|pasado|lo anterior)\b/,
      2,
    ),
    r(/\bcomo (voy|me fue|me va|vengo|estoy)\b.{0,25}\b(ciclo|compra|compras)\b/, 2),
    r(/\b(este|el|mi) ciclo\b/, 1.5),
    r(/\bcomparar\b/, 1),
    r(/\bvoy (mejor|peor|igual)\b/, 1.5),
    r(/\b(mejor|peor|igual) que (el|la) (ultim[oa]|pasad[oa]|anterior)\b/, 1.5),
    r(/\bciclo\b/, 1),
  ],
  revisarPrecio: [
    r(
      /\b(subir|bajar|cambiar|aumentar|ajustar|revisar|subo|bajo|cambio|aumento|ajusto|reviso|mover)\b.{0,25}\bprecios?\b/,
      2,
    ),
    r(/\bprecios?\b.{0,25}\b(subir|bajar|cambiar|revisar|ajustar|aumentar|conviene|deberia)\b/, 2),
    r(/\bme conviene (subir|bajar|cambiar)\b/, 2),
    r(/\b(estoy|sigo) (cobrando|vendiendo) (poco|barato|muy barato)\b/, 2),
    r(/\bcobrar mas (caro)?\b/, 1.5),
    r(/\bprecios?\b/, 1),
    r(/\b(caro|barato|margen)\b/, 0.5),
  ],
  cuandoRecupereCapital: [
    r(/\bcapital\b/, 2, /\b(sacar|retirar|casa|tocar)\b/),
    r(/\b(recupere|recupero|recuperar|recuperado|recuperando|recuperamos)\b/, 2),
    r(/\bcuando (empiezo|comienzo|voy) a ganar\b/, 2),
    r(/\b(punto de equilibrio|salgo a mano|sali a mano|ya cubri)\b/, 2),
    r(
      /\b(inversion|invertido|inverti|invierto|puse de plata|lo que puse|lo que gaste en mercaderia)\b/,
      1.5,
    ),
    r(/\bmercaderia\b/, 0.5),
    r(/\bcapital\b/, 1),
  ],
};

/** Los días de la semana que entiende el chat, tal como los escribe la gente (ya normalizados). */
const DIAS_TEXTO: Array<[RegExp, DiaConsulta]> = [
  [/\blunes\b/, 'lunes'],
  [/\bmartes\b/, 'martes'],
  [/\bmiercoles\b/, 'miercoles'],
  [/\bjueves\b/, 'jueves'],
  [/\bviernes\b/, 'viernes'],
  [/\bsabados?\b/, 'sabado'],
  [/\bdomingos?\b/, 'domingo'],
];

const DIA_POR_NUMERO: Record<number, DiaConsulta> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
};

const ANTEAYER = /\b(anteayer|antier|antes de ayer|antesdeayer)\b/;

/**
 * El día que nombra la pregunta: `hoy`, `ayer`, un día de la semana o `ninguno`. "Anteayer" (que el
 * contrato no tiene) se vuelve el día de la semana que fue, si se conoce `hoy`. Gana el que aparece
 * primero en el texto.
 */
export const extraerDia = (texto: string, hoy?: FechaNegocio): DiaConsulta => {
  const normal = normalizarTexto(texto);
  const candidatos: Array<{ pos: number; dia: DiaConsulta }> = [];
  const anteayer = ANTEAYER.exec(normal);
  if (anteayer) {
    candidatos.push({
      pos: anteayer.index,
      dia: hoy ? DIA_POR_NUMERO[diaSemana(restarDias(hoy, 2))] : 'ninguno',
    });
  }
  const sinAnteayer = anteayer ? normal.replace(ANTEAYER, ' '.repeat(anteayer[0].length)) : normal;
  const simples: Array<[RegExp, DiaConsulta]> = [
    [/\b(hoy|anoche)\b/, 'hoy'],
    [/\bayer\b/, 'ayer'],
    ...DIAS_TEXTO,
  ];
  for (const [re, dia] of simples) {
    const m = re.exec(sinAnteayer);
    if (m)
      candidatos.push({
        pos: m.index,
        dia: dia === 'hoy' && /\banoche\b/.test(m[0]) ? 'ayer' : dia,
      });
  }
  candidatos.sort((a, b) => a.pos - b.pos);
  return candidatos.length > 0 ? candidatos[0].dia : 'ninguno';
};

/** Tope del puntaje: varias frases que dicen lo mismo no pesan más que una pregunta clara. */
const PUNTAJE_MAXIMO = 3;

/** Puntaje de cada intención para este texto ya normalizado. */
const puntuar = (normal: string): Array<{ intencion: IntencionId; puntaje: number }> =>
  (Object.keys(REGLAS) as Array<Exclude<IntencionId, 'noEntendi'>>).map(intencion => ({
    intencion,
    puntaje: Math.min(
      PUNTAJE_MAXIMO,
      REGLAS[intencion].reduce(
        (total, regla) =>
          regla.re.test(normal) && !(regla.excluye && regla.excluye.test(normal))
            ? total + regla.peso
            : total,
        0,
      ),
    ),
  }));

/** Del puntaje a la confianza de 0 a 1: la misma escala que el servidor. */
const confianzaDe = (puntaje: number): number => {
  if (puntaje >= 3) return 0.92;
  if (puntaje >= 2) return 0.85;
  if (puntaje >= 1.5) return 0.75;
  if (puntaje >= 1) return 0.65;
  return Math.min(0.45, puntaje * 0.6);
};

/** Cuánto debe ganarle la mejor intención a la segunda para no ser una pregunta ambigua. */
const VENTAJA_MINIMA = 0.75;

/**
 * Clasifica la pregunta sin red. Devuelve la misma forma que `interpretarRespuesta`: con menos de
 * `UMBRAL_CONFIANZA`, o si dos intenciones empatan, la consulta es `noEntendi` (el día solo si lo nombra). El producto
 * no se mira aquí: `consultar` lo resuelve con el catálogo del teléfono, igual que con el servidor.
 */
export const clasificarLocal = (texto: string, hoy?: FechaNegocio): Consulta => {
  const normal = typeof texto === 'string' ? normalizarTexto(texto) : '';
  if (normal === '') return { intencion: 'noEntendi', confianza: 0 };
  const orden = puntuar(normal).sort((a, b) => b.puntaje - a.puntaje);
  const [mejor, segundo] = orden;
  const confianza = confianzaDe(mejor.puntaje);
  const ambigua = mejor.puntaje - segundo.puntaje < VENTAJA_MINIMA && segundo.puntaje >= 1;
  if (confianza < UMBRAL_CONFIANZA || ambigua) {
    // Si nombra un día, se conserva: así «¿y ayer?» puede seguir la pregunta anterior (seguimiento.ts).
    const dia = extraerDia(texto, hoy);
    return {
      intencion: 'noEntendi',
      confianza: Math.min(confianza, 0.45),
      ...(dia === 'ninguno' ? {} : { dia }),
    };
  }
  return { intencion: mejor.intencion, dia: extraerDia(texto, hoy), confianza };
};
