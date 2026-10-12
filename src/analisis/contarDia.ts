// src/analisis/contarDia.ts
// "Cuéntame tu día": lee UNA frase libre (escrita o dictada con el micrófono del teclado) y propone
// los datos del cierre. 100% local y determinista: sin red, sin reloj, sin React. Solo PROPONE; quien
// guarda es la persona, con el botón de siempre. Conservador: lo ambiguo no se inventa, se devuelve
// en `noEntendido` para que la persona lo escriba.
import { redondearSoles, formatoSoles } from '@dominio/formato';
import { ETIQUETA_GASTO } from '@dominio/categorias';
import type { CategoriaGasto, Gasto, Producto } from '@dominio/tipos';
import { normalizarTexto } from './texto';

export interface InterpretacionDia {
  cantidades: Record<string, { preparadas?: number; sobrantes?: number }>;
  montoYape?: number;
  gastos: Gasto[];
  abreCiclo?: boolean;
  /** Fragmentos que no se pudieron ubicar (en minúsculas y sin tildes). */
  noEntendido: string[];
  /** Avisos de confianza: supuestos que se hicieron o datos que no cuadran. */
  notas: string[];
}

// ---------------------------------------------------------------- números

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21,
  veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};
const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};
const CENTENAS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, docientos: 200, trescientos: 300, trecientos: 300,
  cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800,
  novecientos: 900,
};
const BLANDOS = new Set(['un', 'uno', 'una']);

const centena = (w: string | undefined): number | undefined =>
  w === undefined ? undefined : (CENTENAS[w] ?? CENTENAS[w.replace(/as$/, 'os')]);

/** Un grupo de 0 a 999 en palabras: "ciento veinte", "cuarenta y cinco". */
const leerGrupo = (ws: string[], i: number): { v: number; len: number } | null => {
  let p = i;
  let v = 0;
  const c = centena(ws[p]);
  if (c !== undefined) {
    v += c;
    p += 1;
  }
  const d = DECENAS[ws[p] ?? ''];
  const u = UNIDADES[ws[p] ?? ''];
  if (d !== undefined) {
    v += d;
    p += 1;
    const sig = UNIDADES[ws[p + 1] ?? ''];
    if (ws[p] === 'y' && sig !== undefined && sig >= 1 && sig <= 9) {
      v += sig;
      p += 2;
    }
  } else if (u !== undefined) {
    v += u;
    p += 1;
    const sig = UNIDADES[ws[p + 1] ?? ''];
    if (u === 20 && ws[p] === 'y' && sig !== undefined && sig >= 1 && sig <= 9) {
      v += sig;
      p += 2;
    }
  }
  return p === i ? null : { v, len: p - i };
};

/** Lee un número en `ws[i]`: dígitos, decimales (30d50), palabras, "y medio". */
const leerNumero = (ws: string[], i: number): { v: number; len: number } | null => {
  const w = ws[i];
  let base: { v: number; len: number } | null = null;
  if (/^\d{1,7}$/.test(w)) {
    base = { v: parseInt(w, 10), len: 1 };
  } else if (/^\d{1,3}d\d{3}$/.test(w)) {
    base = { v: parseInt(w.replace('d', ''), 10), len: 1 }; // 1.200 = mil doscientos
  } else if (/^\d{1,7}d\d{1,2}$/.test(w)) {
    base = { v: parseFloat(w.replace('d', '.')), len: 1 };
  } else {
    const g = leerGrupo(ws, i);
    if (g && ws[i + g.len] === 'mil') {
      const resto = leerGrupo(ws, i + g.len + 1);
      base = { v: g.v * 1000 + (resto?.v ?? 0), len: g.len + 1 + (resto?.len ?? 0) };
    } else if (g) {
      base = g;
    } else if (w === 'mil') {
      const resto = leerGrupo(ws, i + 1);
      base = { v: 1000 + (resto?.v ?? 0), len: 1 + (resto?.len ?? 0) };
    }
  }
  if (!base) return null;
  const sig = ws[i + base.len];
  if (sig === 'y' && (ws[i + base.len + 1] === 'medio' || ws[i + base.len + 1] === 'media')) {
    return { v: base.v + 0.5, len: base.len + 2 };
  }
  return base;
};

// ---------------------------------------------------------------- léxico

const CATEGORIAS_LEXICO: Record<string, CategoriaGasto> = {
  carbon: 'carbon', carbones: 'carbon', brasa: 'carbon',
  gas: 'gas', balon: 'gas', balones: 'gas', garrafa: 'gas',
  movilidad: 'movilidad', taxi: 'movilidad', taxis: 'movilidad', pasaje: 'movilidad',
  pasajes: 'movilidad', combi: 'movilidad', combis: 'movilidad', bus: 'movilidad',
  micro: 'movilidad', mototaxi: 'movilidad', colectivo: 'movilidad', transporte: 'movilidad',
  mercaderia: 'mercaderia', mercaderias: 'mercaderia', insumo: 'mercaderia',
  insumos: 'mercaderia', mercado: 'mercaderia', carne: 'mercaderia', verduras: 'mercaderia',
  verdura: 'mercaderia',
  otros: 'otro', otro: 'otro',
};

const VERBOS_PREPARAR = new Set([
  'saque', 'hice', 'hicimos', 'lleve', 'cocine', 'traje', 'cargue',
]);
const VERBOS_SOBRAR = new Set([
  'sobro', 'sobraron', 'sobra', 'sobran', 'quedo', 'quedaron', 'queda', 'quedan', 'sobrante',
  'sobrantes', 'menos',
]);
const VERBOS_GASTAR = new Set(['gaste', 'gasto', 'gastos', 'gastamos', 'compre', 'pague', 'puse']);
const RELLENO_UNIDAD = new Set([
  'de', 'del', 'unidades', 'unidad', 'porciones', 'porcion', 'vasos', 'vaso', 'platos', 'plato', 'soles', 'sol',
]);
const RELLENO_YAPE_ATRAS = new Set([
  'de', 'por', 'en', 'fue', 'fueron', 'es', 'son', 'a', 'mi', 'total', 'me', 'entro', 'entraron',
  'ingreso', 'cobre', 'recibi', 'con', 'soles', 'sol', 's', 'el', 'los',
]);
const RELLENO_YAPE_ADELANTE = new Set(['de', 'por', 'en', 'con', 'fue', 'soles', 'sol']);
const RELLENO_CATEGORIA = new Set(['de', 'en', 'para', 'soles', 'sol']);
const RELLENO_CATEGORIA_ATRAS = new Set(['de', 'en', 'fue', 'son', 'para', 'por', 's']);
const PARTICULAS_NOMBRE = new Set(['de', 'la', 'el', 'con', 'y', 'en', 'al', 'del']);
const FRASE_TODO_VENDIDO =
  /\b(vendi todo|se vendio todo|todo vendido|se acabo todo|se me acabo todo|no (me )?(sobro|quedo|sobraron|quedaron) (nada|ni uno)|sin sobrantes)\b/;

const singular = (w: string): string =>
  w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
const iguales = (a: string, b: string): boolean => a === b || singular(a) === singular(b);
const esYape = (w: string): boolean => w.startsWith('yap');

// ---------------------------------------------------------------- piezas de la frase

type Pieza =
  | { k: 'num'; v: number; raw: string; blando: boolean }
  | { k: 'prod'; id: string | null; raw: string }
  | { k: 'cat'; cat: CategoriaGasto; raw: string }
  | { k: 'w'; w: string };

const textoDe = (p: Pieza): string => (p.k === 'w' ? p.w : p.k === 'num' || p.k === 'prod' || p.k === 'cat' ? p.raw : '');

interface Catalogo {
  id: string;
  nombre: string[];
}

/** El producto que empieza en `ws[i]`: nombre completo (gana el más largo) o una palabra suya. */
const buscarProducto = (
  ws: string[],
  i: number,
  catalogo: Catalogo[],
): { id: string | null; len: number } | null => {
  let mejor: { id: string; len: number } | null = null;
  for (const c of catalogo) {
    const L = c.nombre.length;
    if (L > 0 && c.nombre.every((t, k) => ws[i + k] !== undefined && iguales(ws[i + k], t))) {
      if (!mejor || L > mejor.len) mejor = { id: c.id, len: L };
    }
  }
  if (mejor) return mejor;
  const parciales = catalogo.filter(c =>
    c.nombre.some(t => !PARTICULAS_NOMBRE.has(t) && t.length >= 3 && iguales(ws[i], t)),
  );
  if (parciales.length === 1) return { id: parciales[0].id, len: 1 };
  if (parciales.length > 1) return { id: null, len: 1 };
  return null;
};

const piezasDe = (frase: string, catalogo: Catalogo[]): Pieza[] => {
  const ws = normalizarTexto(frase.replace(/(\d)[.,](\d)/g, '$1d$2'))
    .split(' ')
    .filter(w => w !== '');
  const piezas: Pieza[] = [];
  let i = 0;
  while (i < ws.length) {
    const n = leerNumero(ws, i);
    if (n) {
      piezas.push({ k: 'num', v: n.v, raw: ws.slice(i, i + n.len).join(' ').replace(/(\d)d(\d)/, '$1,$2'), blando: BLANDOS.has(ws[i]) && n.len === 1 });
      i += n.len;
      continue;
    }
    const p = buscarProducto(ws, i, catalogo);
    if (p) {
      piezas.push({ k: 'prod', id: p.id, raw: ws.slice(i, i + p.len).join(' ') });
      i += p.len;
      continue;
    }
    const cat = CATEGORIAS_LEXICO[ws[i]];
    if (cat) piezas.push({ k: 'cat', cat, raw: ws[i] });
    else piezas.push({ k: 'w', w: ws[i] });
    i += 1;
  }
  return piezas;
};

// ---------------------------------------------------------------- intérprete

type Modo = 'prep' | 'sobr' | 'gasto' | null;

export const interpretarDia = (texto: string, productos: Producto[]): InterpretacionDia => {
  const out: InterpretacionDia = { cantidades: {}, gastos: [], noEntendido: [], notas: [] };
  const catalogo: Catalogo[] = productos.map(p => ({
    id: p.id,
    nombre: normalizarTexto(p.nombre).split(' ').filter(w => w !== ''),
  }));
  const frases = texto.split(/[;!?\n]+|\.(?!\d)/).map(f => f.trim()).filter(f => f !== '');
  const todoVendido: { ids: string[] }[] = [];
  const noEnt = (f: string) => {
    const limpio = f.trim();
    if (limpio !== '' && !out.noEntendido.includes(limpio)) out.noEntendido.push(limpio);
  };

  for (const frase of frases) {
    const piezas = piezasDe(frase, catalogo);
    const usadas = new Set<number>();
    const fragmentosAntes = out.noEntendido.length;
    let modo: Modo = null;
    let ultimoProducto: string | null = null;
    let reconocido = false;
    let hayCompre = false;
    let negado = false;
    const idsMencionados = piezas.flatMap(p => (p.k === 'prod' && p.id ? [p.id] : []));

    const palabra = (j: number) => {
      const p = piezas[j];
      return p && p.k === 'w' && !usadas.has(j) ? p.w : undefined;
    };
    const fragmento = (j: number): string => {
      const previa = piezas[j - 1];
      const verbo =
        previa && previa.k === 'w' && (VERBOS_PREPARAR.has(previa.w) || VERBOS_SOBRAR.has(previa.w) || VERBOS_GASTAR.has(previa.w) || previa.w.startsWith('prepar'))
          ? [previa.w]
          : [];
      const partes = [...verbo, textoDe(piezas[j])];
      for (let k = j + 1; k < piezas.length && partes.length < 3; k++) {
        if (piezas[k].k === 'num') break;
        partes.push(textoDe(piezas[k]));
      }
      return partes.join(' ');
    };
    const siguienteUtil = (j: number, relleno: Set<string>): number => {
      let k = j + 1;
      while (k < piezas.length && palabra(k) !== undefined && relleno.has(palabra(k) as string)) k++;
      return k;
    };
    const anteriorUtil = (j: number, relleno: Set<string>): number => {
      let k = j - 1;
      while (k >= 0 && palabra(k) !== undefined && relleno.has(palabra(k) as string)) k--;
      return k;
    };
    const posicionYape = (j: number): number | null => {
      const a = anteriorUtil(j, RELLENO_YAPE_ATRAS);
      const pa = piezas[a];
      if (pa && pa.k === 'w' && esYape(pa.w)) return a;
      const d = siguienteUtil(j, RELLENO_YAPE_ADELANTE);
      const pd = piezas[d];
      if (pd && pd.k === 'w' && esYape(pd.w) && piezas[d + 1]?.k !== 'num') return d;
      return null;
    };
    const ponerCantidad = (id: string, campo: 'preparadas' | 'sobrantes', v: number, frag: string) => {
      if (!Number.isInteger(v)) return noEnt(frag);
      const previo = out.cantidades[id]?.[campo];
      if (previo === undefined) out.cantidades[id] = { ...out.cantidades[id], [campo]: v };
      else if (previo !== v) noEnt(frag);
      ultimoProducto = id;
      reconocido = true;
    };
    const ponerYape = (v: number, frag: string) => {
      const m = redondearSoles(v);
      if (out.montoYape === undefined) out.montoYape = m;
      else if (out.montoYape !== m) noEnt(frag);
      reconocido = true;
    };
    const ponerGasto = (cat: CategoriaGasto, v: number, frag: string) => {
      const m = redondearSoles(v);
      if (m > 0) out.gastos.push({ categoria: cat, monto: m });
      else noEnt(frag);
      reconocido = true;
    };

    for (let j = 0; j < piezas.length; j++) {
      if (usadas.has(j)) continue;
      const p = piezas[j];

      if (p.k === 'w') {
        if (VERBOS_PREPARAR.has(p.w) || p.w.startsWith('prepar')) {
          modo = 'prep';
          reconocido = true;
        } else if (VERBOS_SOBRAR.has(p.w)) {
          modo = 'sobr';
          reconocido = true;
        } else if (VERBOS_GASTAR.has(p.w)) {
          modo = 'gasto';
          reconocido = true;
          if (p.w === 'compre') {
            hayCompre = true;
            negado = piezas[j - 1]?.k === 'w' && (piezas[j - 1] as { w: string }).w === 'no';
          }
        } else if (p.w === 'vendi') {
          modo = null;
        }
        continue;
      }

      if (p.k === 'prod') {
        if (p.id === null) {
          noEnt(fragmento(j));
          continue;
        }
        ultimoProducto = p.id;
        // "pancita 5": producto primero, número después (solo si hay un verbo que diga qué es).
        const k = siguienteUtil(j, new Set(['de']));
        const n = piezas[k];
        if (n && n.k === 'num' && !usadas.has(k) && !n.blando && (modo === 'prep' || modo === 'sobr')) {
          const despues = siguienteUtil(k, RELLENO_UNIDAD);
          const pd = piezas[despues];
          const esSoles = palabra(k + 1) === 'soles' || palabra(k + 1) === 'sol';
          if (esSoles) continue;
          if (pd && pd.k === 'prod') {
            usadas.add(k);
            usadas.add(despues);
            const kk = siguienteUtil(despues, new Set(['de']));
            const resto = piezas[kk];
            if (resto && resto.k === 'num') usadas.add(kk);
            noEnt(`${p.raw} ${n.raw} ${pd.raw}${resto && resto.k === 'num' ? ` ${resto.raw}` : ''}`);
            continue;
          }
          usadas.add(k);
          ponerCantidad(p.id, modo === 'prep' ? 'preparadas' : 'sobrantes', n.v, `${p.raw} ${n.raw}`);
        }
        continue;
      }

      if (p.k === 'cat') {
        // Una categoría sin monto: solo "compré mercadería" tiene sentido por sí sola.
        if (p.cat === 'mercaderia') reconocido = reconocido || hayCompre;
        continue;
      }

      // ---- número
      const frag = fragmento(j);
      const antes = piezas[j - 1];
      const sig = piezas[j + 1];
      const soles =
        (antes && antes.k === 'w' && antes.w === 's' && !usadas.has(j - 1)) ||
        (sig && sig.k === 'w' && (sig.w === 'soles' || sig.w === 'sol'));
      if (sig && sig.k === 'w' && (sig.w === 'lucas' || sig.w === 'luca')) {
        noEnt(frag); // no se interpretan las lucas
        continue;
      }

      // Los "un/una/uno" suelen ser palabras comunes ("un yape"): solo cuentan con producto o con "sol".
      const kProd = siguienteUtil(j, RELLENO_UNIDAD);
      const pProd = piezas[kProd];
      const productoDespues = pProd && pProd.k === 'prod' ? pProd : null;
      if (p.blando && !soles && !productoDespues && !((p.raw === 'uno') && (modo === 'prep' || modo === 'sobr'))) {
        continue;
      }

      if (soles) {
        const yp = p.blando ? null : posicionYape(j);
        if (yp !== null) {
          usadas.add(yp);
          ponerYape(p.v, frag);
          continue;
        }
        const kc = siguienteUtil(j, RELLENO_CATEGORIA);
        const antC = anteriorUtil(j, RELLENO_CATEGORIA_ATRAS);
        const despues = piezas[kc];
        const previa = piezas[antC];
        const cat =
          previa && previa.k === 'cat' && !usadas.has(antC)
            ? (usadas.add(antC), previa.cat)
            : despues && despues.k === 'cat' && !usadas.has(kc)
              ? (usadas.add(kc), despues.cat)
              : null;
        if (cat) {
          ponerGasto(cat, p.v, frag);
        } else if (modo === 'gasto') {
          ponerGasto('otro', p.v, frag);
          out.notas.push(`Gasto de ${formatoSoles(p.v)} sin categoría: lo puse en Otros gastos.`);
        } else {
          noEnt(frag);
        }
        continue;
      }

      if (productoDespues) {
        const previo = piezas[anteriorUtil(j, new Set([':']))];
        const idx = anteriorUtil(j, new Set(['de']));
        if (previo && previo.k === 'prod' && !usadas.has(idx) && idx === j - 1) {
          // "anticuchos 60 pancita": ¿el 60 es de unos o de otros? No se adivina.
          usadas.add(idx);
          usadas.add(kProd);
          noEnt(`${previo.raw} ${p.raw} ${productoDespues.raw}`);
          continue;
        }
        usadas.add(kProd);
        if (productoDespues.id === null) {
          noEnt(frag);
          continue;
        }
        if (modo === 'prep' || modo === 'sobr') {
          ponerCantidad(productoDespues.id, modo === 'prep' ? 'preparadas' : 'sobrantes', p.v, frag);
        } else {
          ultimoProducto = productoDespues.id;
          noEnt(frag); // "60 anticuchos" sin decir si los preparó o le sobraron
        }
        continue;
      }

      const yp = p.blando ? null : posicionYape(j);
      if (yp !== null) {
        usadas.add(yp);
        ponerYape(p.v, frag);
        continue;
      }

      // Categoría: antes ("carbón 30") o después con "de/en/para" ("30 de carbón").
      const antC = anteriorUtil(j, new Set(['de', 'fue', 'son']));
      const previa = piezas[antC];
      const kc = siguienteUtil(j, RELLENO_CATEGORIA);
      const despues = piezas[kc];
      if (previa && previa.k === 'cat' && !usadas.has(antC)) {
        usadas.add(antC);
        ponerGasto(previa.cat, p.v, frag);
        continue;
      }
      if (despues && despues.k === 'cat' && !usadas.has(kc) && kc > j + 1) {
        usadas.add(kc);
        ponerGasto(despues.cat, p.v, frag);
        continue;
      }
      if (modo === 'gasto') {
        ponerGasto('otro', p.v, frag);
        out.notas.push(`Gasto de ${formatoSoles(p.v)} sin categoría: lo puse en Otros gastos.`);
        continue;
      }

      // Sin producto a la vista: el último que nombró en la frase, o el único que vende.
      const unico = catalogo.length === 1 ? catalogo[0].id : null;
      const dueno = ultimoProducto ?? unico;
      const sinPalabraSuelta = !(sig && sig.k === 'w' && !RELLENO_UNIDAD.has(sig.w) && sig.w !== 'y' && !esYape(sig.w) && !VERBOS_GASTAR.has(sig.w) && !VERBOS_PREPARAR.has(sig.w) && !VERBOS_SOBRAR.has(sig.w));
      if ((modo === 'prep' || modo === 'sobr') && dueno && sinPalabraSuelta) {
        const sinNombrar = !ultimoProducto;
        ponerCantidad(dueno, modo === 'prep' ? 'preparadas' : 'sobrantes', p.v, frag);
        if (sinNombrar) out.notas.push('Solo vendes un producto: puse la cantidad en ese.');
        continue;
      }
      noEnt(frag);
    }

    // "Compré mercadería" abre un ciclo nuevo; "no compré mercadería" no hace nada.
    const mencionaMercaderia = piezas.some(q => q.k === 'cat' && q.cat === 'mercaderia');
    if (hayCompre && mencionaMercaderia) {
      reconocido = true;
      if (!negado) out.abreCiclo = true;
    }

    if (FRASE_TODO_VENDIDO.test(normalizarTexto(frase))) {
      todoVendido.push({ ids: idsMencionados });
      reconocido = true;
    }

    if (!reconocido && out.noEntendido.length === fragmentosAntes) noEnt(frase);
  }

  // "Vendí todo": sobrantes en 0 para lo nombrado (o para todo lo preparado), sin pisar lo dicho.
  for (const t of todoVendido) {
    const ids = t.ids.length > 0 ? t.ids : Object.keys(out.cantidades).filter(id => out.cantidades[id].preparadas !== undefined);
    if (ids.length === 0) {
      noEnt('vendi todo');
      continue;
    }
    for (const id of ids) {
      const actual = out.cantidades[id] ?? {};
      if (actual.sobrantes === undefined) out.cantidades[id] = { ...actual, sobrantes: 0 };
    }
  }

  for (const [id, c] of Object.entries(out.cantidades)) {
    if (c.preparadas !== undefined && c.sobrantes !== undefined && c.sobrantes > c.preparadas) {
      const nombre = productos.find(p => p.id === id)?.nombre ?? 'un producto';
      out.notas.push(`Te sobran más ${nombre.toLowerCase()} de los que preparaste: revísalo.`);
    }
  }
  return out;
};

/** El resumen en palabras simples: "60 preparadas de anticucho, 5 sobrantes de anticucho, Yape S/ 120.00". */
export const resumenEntendido = (i: InterpretacionDia, productos: Producto[]): string => {
  const partes: string[] = [];
  for (const [id, c] of Object.entries(i.cantidades)) {
    const nombre = (productos.find(p => p.id === id)?.nombre ?? '').toLowerCase();
    if (c.preparadas !== undefined) partes.push(`${c.preparadas} preparadas de ${nombre}`);
    if (c.sobrantes !== undefined) partes.push(`${c.sobrantes} sobrantes de ${nombre}`);
  }
  if (i.montoYape !== undefined) partes.push(`Yape ${formatoSoles(i.montoYape)}`);
  for (const g of i.gastos) {
    partes.push(`gasto ${formatoSoles(g.monto)} de ${ETIQUETA_GASTO[g.categoria].toLowerCase()}`);
  }
  if (i.abreCiclo) partes.push('compraste mercadería hoy');
  return partes.join(', ');
};
