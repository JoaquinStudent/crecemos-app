#!/usr/bin/env node
/* eslint-disable no-bitwise */
'use strict';

// Genera seed/semilla.json: los datos de ejemplo que la app descarga una vez.
// Determinista: el mismo texto de semilla da siempre los mismos bytes. Sin reloj ni
// Math.random(): "hoy" de la semilla es el miércoles 2026-10-07 y todo cuelga de ahí.
// Uso: npm run semilla   (o: node scripts/generar-semilla.js)
//
// Supuestos sin confirmar (P4): precios y costos de sdd/domain.md. Para cambiarlos se
// edita este archivo y se vuelve a correr el comando.

const { Buffer } = require('buffer');
const fs = require('fs');
const path = require('path');

const SEMILLA = 'crecemos-20261007';
const HOY = Date.UTC(2026, 9, 7); // diasAtras = 0
const DIA_SEMANA_BASE = 3; // miércoles: Date.getDay() de diasAtras = 0
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const PARES = 20; // 20 ciclos de 2 días = 40 cierres
const SPAN = 90; // el cierre más antiguo queda a 90 días
const SUBIO_PRECIO = '2026-07-15'; // el anticucho pasó de S/ 9 a S/ 10
const SUBIO_COSTO = '2026-10-01'; // el corazón sube en octubre
const LIQUIDA_CADA = 7; // la hermana le entrega el Yape una vez por semana
const PRIMERA_LIQUIDACION = 8; // diasAtras de la entrega más reciente

// ----- Generador pseudoaleatorio sembrado (xmur3 + mulberry32) -----
const xmur3 = texto => {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
};

const mulberry32 = semilla => {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const azar = mulberry32(xmur3(SEMILLA)());
const entre = (min, max) => min + Math.floor(azar() * (max - min + 1));
const redondear = n => Math.round((n + Number.EPSILON) * 100) / 100;

// ----- Los productos (supuestos actuales de productosPorDefecto.ts) -----
const PRODUCTOS = [
  {
    id: 'p-anticucho',
    nombre: 'Anticucho',
    unidad: 'porcion',
    precioVenta: 10,
    costoUnitario: 8.2,
  },
  { id: 'p-pancita', nombre: 'Pancita', unidad: 'porcion', precioVenta: 9, costoUnitario: 8 },
  { id: 'p-rachi', nombre: 'Rachi', unidad: 'porcion', precioVenta: 9, costoUnitario: 7.6 },
  { id: 'p-chicha', nombre: 'Chicha', unidad: 'vaso', precioVenta: 2, costoUnitario: 1.6 },
].map(p => ({ ...p, actualizadoDiasAtras: 84 }));

// Porciones vendidas en un día normal. La pancita sale más; el anticucho deja más.
const DEMANDA = { 'p-anticucho': 6.5, 'p-pancita': 9.5, 'p-rachi': 5, 'p-chicha': 5 };
// Por día de la semana (0 = domingo). El miércoles es el más flojo.
const FACTOR_DIA = [1.15, 0.95, 1.0, 0.55, 1.0, 1.15, 1.3];

const diaSemana = diasAtras => (((DIA_SEMANA_BASE - diasAtras) % 7) + 7) % 7;
// Aritmética de calendario en UTC: no depende de la zona de quien lo corra.
const fechaDe = diasAtras => new Date(HOY - diasAtras * MS_POR_DIA).toISOString().slice(0, 10);

// ----- Calendario: pares de días seguidos separados por 1 a 3 días sin cierre -----
const huecos = Array.from({ length: PARES - 1 }, () => entre(1, 3));
// El más reciente cierra ayer (diasAtras 1) y el más antiguo abre a SPAN días: eso fija la suma
// de los huecos. Se reparte el sobrante o el faltante al azar, siempre entre 1 y 3.
let faltan = SPAN - 2 * PARES - huecos.reduce((a, b) => a + b, 0);
while (faltan !== 0) {
  const i = entre(0, huecos.length - 1);
  if (faltan > 0 && huecos[i] < 3) {
    huecos[i] += 1;
    faltan -= 1;
  } else if (faltan < 0 && huecos[i] > 1) {
    huecos[i] -= 1;
    faltan += 1;
  }
}

const pares = []; // pares[0] es el más reciente
let reciente = 1;
for (let k = 0; k < PARES; k++) {
  pares.push({ k, abre: reciente + 1, cierra: reciente });
  reciente += (huecos[k] || 0) + 2;
}

// ----- Un día de ventas -----
const lineaDe = (producto, diasAtras, k) => {
  const factor = FACTOR_DIA[diaSemana(diasAtras)];
  const ruido = 0.8 + azar() * 0.4;
  const vendidas = Math.max(1, Math.round(DEMANDA[producto.id] * factor * ruido));
  const tirada = azar();
  let sobrantes = tirada < 0.4 ? 0 : tirada < 0.75 ? 1 : 2;
  if (producto.id === 'p-chicha') sobrantes = tirada < 0.6 ? 0 : 1;
  if (k < 2) {
    // Los dos ciclos más recientes: sobra rachi y de lo demás casi nada.
    sobrantes = producto.id === 'p-rachi' ? 5 + entre(0, 1) : Math.min(sobrantes, 1);
  }
  const esAnticucho = producto.id === 'p-anticucho';
  return {
    productoId: producto.id,
    preparadas: vendidas + sobrantes,
    sobrantes,
    precioUnitario: esAnticucho && fechaDe(diasAtras) < SUBIO_PRECIO ? 9 : producto.precioVenta,
    costoUnitario: esAnticucho && fechaDe(diasAtras) < SUBIO_COSTO ? 7.6 : producto.costoUnitario,
  };
};

const ventaDe = lineas =>
  redondear(lineas.reduce((t, l) => t + (l.preparadas - l.sobrantes) * l.precioUnitario, 0));

const dia = (diasAtras, k) => {
  const lineas = PRODUCTOS.map(p => lineaDe(p, diasAtras, k));
  return { diasAtras, lineas, venta: ventaDe(lineas) };
};

// ----- Armar los 40 cierres, del más antiguo al más reciente -----
const cierres = [];
for (const par of [...pares].reverse()) {
  const primero = dia(par.abre, par.k);
  const segundo = dia(par.cierra, par.k);
  const mercaderia =
    5 * Math.round((0.52 * (primero.venta + segundo.venta) * (0.95 + azar() * 0.1)) / 5);
  const gastosPrimero = [
    { categoria: 'mercaderia', monto: mercaderia },
    { categoria: 'carbon', monto: 15 + 5 * entre(0, 1) },
    { categoria: 'movilidad', monto: entre(8, 12) },
  ];
  const gastosSegundo = [
    { categoria: 'carbon', monto: 15 + 5 * entre(0, 1) },
    { categoria: 'movilidad', monto: entre(8, 12) },
  ];
  if (azar() < 0.25) gastosSegundo.push({ categoria: 'gas', monto: 12 });
  if (azar() < 0.15) gastosSegundo.push({ categoria: 'otro', monto: 5 });

  [
    [primero, gastosPrimero, true],
    [segundo, gastosSegundo, false],
  ].forEach(([d, gastos, abreCiclo]) => {
    const reciente8 = d.diasAtras <= PRIMERA_LIQUIDACION;
    // ~25 % de la venta entra por Yape; algunos días no entra ninguno.
    const hayYape = reciente8 || azar() < 0.9;
    const montoYape = hayYape ? Math.round(d.venta * (0.18 + azar() * 0.22)) : 0;
    // El Yape es de su hermana: queda por cobrar hasta que ella se lo entrega (cada semana).
    const propio = !reciente8 && azar() < 0.15;
    const yapePendiente = montoYape > 0 && !propio;
    const cierre = {
      diasAtras: d.diasAtras,
      lineas: d.lineas,
      montoYape,
      yapePendiente,
      gastos,
      abreCiclo,
    };
    if (yapePendiente && d.diasAtras > PRIMERA_LIQUIDACION) {
      const semanas = Math.floor((d.diasAtras - PRIMERA_LIQUIDACION - 1) / LIQUIDA_CADA);
      cierre.cobradoDiasAtras = PRIMERA_LIQUIDACION + LIQUIDA_CADA * semanas;
    }
    cierres.push({ cierre, venta: d.venta });
  });
}

// ----- Comprobaciones: si un patrón falla, no se escribe nada -----
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(`La semilla no cumple: ${mensaje}`);
};
const lista = cierres.map(c => c.cierre);

const vendidas = id =>
  lista.reduce(
    (t, c) =>
      t +
      c.lineas.filter(l => l.productoId === id).reduce((s, l) => s + l.preparadas - l.sobrantes, 0),
    0,
  );
exigir(
  vendidas('p-pancita') > vendidas('p-anticucho'),
  'la pancita no se vende más que el anticucho',
);

const deja = id => {
  const p = PRODUCTOS.find(x => x.id === id);
  return p.precioVenta - p.costoUnitario;
};
exigir(deja('p-anticucho') > deja('p-pancita'), 'el anticucho no deja más por porción');

const porDia = {};
cierres.forEach(({ cierre, venta }) => {
  (porDia[diaSemana(cierre.diasAtras)] = porDia[diaSemana(cierre.diasAtras)] || []).push(venta);
});
const promedios = Object.entries(porDia).map(([d, v]) => [
  Number(d),
  v.reduce((a, b) => a + b, 0) / v.length,
  v.length,
]);
const masFlojo = promedios.reduce((m, x) => (x[1] < m[1] ? x : m));
exigir(masFlojo[0] === 3 && masFlojo[2] >= 4, 'el miércoles no es el día más flojo');

const rachiReciente = pares
  .slice(0, 2)
  .every(par =>
    lista
      .filter(c => c.diasAtras === par.abre || c.diasAtras === par.cierra)
      .every(c => c.lineas.find(l => l.productoId === 'p-rachi').sobrantes >= 5),
  );
exigir(rachiReciente, 'no sobra rachi en los dos ciclos más recientes');

const costosAnticucho = fecha =>
  lista
    .filter(c => (fecha ? fechaDe(c.diasAtras) >= SUBIO_COSTO : fechaDe(c.diasAtras) < SUBIO_COSTO))
    .map(c => c.lineas.find(l => l.productoId === 'p-anticucho').costoUnitario);
exigir(
  costosAnticucho(true).length >= 3 && costosAnticucho(true).every(x => x === 8.2),
  'el costo no sube en octubre',
);
exigir(
  costosAnticucho(false).every(x => x === 7.6),
  'el costo anterior no es 7.60',
);

const precios = lista.map(c => [
  fechaDe(c.diasAtras),
  c.lineas.find(l => l.productoId === 'p-anticucho').precioUnitario,
]);
exigir(precios.filter(([f]) => f < SUBIO_PRECIO).length >= 3, 'faltan cierres anteriores a julio');
exigir(
  precios.every(([f, p]) => p === (f < SUBIO_PRECIO ? 9 : 10)),
  'el precio del anticucho no cambia el 15 de julio',
);

const yapeTotal = lista.reduce((t, c) => t + c.montoYape, 0);
const ventaTotal = cierres.reduce((t, c) => t + c.venta, 0);
exigir(
  yapeTotal / ventaTotal > 0.2 && yapeTotal / ventaTotal < 0.3,
  'el Yape no es ~25 % de la venta',
);
const sinCobrar = lista.filter(c => c.yapePendiente && c.cobradoDiasAtras === undefined);
exigir(
  sinCobrar.length >= 3 && sinCobrar.every(c => c.diasAtras <= PRIMERA_LIQUIDACION),
  'faltan Yape por cobrar recientes',
);
exigir(lista.filter(c => c.cobradoDiasAtras !== undefined).length >= 3, 'faltan Yape ya cobrados');
exigir(
  lista.every(c => c.cobradoDiasAtras === undefined || c.cobradoDiasAtras < c.diasAtras),
  'un cobro anterior a su cierre',
);

exigir(lista.length === 40, 'no son 40 cierres');
exigir(
  Math.max(...lista.map(c => c.diasAtras)) >= 85 && Math.max(...lista.map(c => c.diasAtras)) <= 95,
  'no abarca ~90 días',
);
exigir(
  lista.every((c, i) => c.abreCiclo === (i % 2 === 0)),
  'los ciclos no son de 2 días',
);
exigir(
  lista.every((c, i) => !c.abreCiclo || lista[i + 1].diasAtras === c.diasAtras - 1),
  'un ciclo no tiene días seguidos',
);
exigir(
  lista.every((c, i) => {
    if (i === 0 || !c.abreCiclo) return true;
    const sinCierre = lista[i - 1].diasAtras - c.diasAtras - 1; // días entre un ciclo y el siguiente
    return sinCierre >= 1 && sinCierre <= 3;
  }),
  'los ciclos no se separan por 1 a 3 días sin cierre',
);
const promedioDia = ventaTotal / lista.length;
exigir(
  promedioDia > 185 && promedioDia < 215,
  `la venta promedio por día es ${promedioDia.toFixed(2)}`,
);
exigir(
  lista.every(
    c =>
      c.lineas.every(l => Number.isInteger(l.preparadas) && l.sobrantes <= l.preparadas) &&
      c.montoYape <= ventaDe(c.lineas),
  ),
  'una línea o un Yape rompe las reglas del cierre',
);

// ----- Escribir: una línea por cierre, JSON compacto -----
const texto =
  '{"version":1,"semilla":' +
  JSON.stringify(SEMILLA) +
  ',"diaSemanaBase":' +
  DIA_SEMANA_BASE +
  ',\n"productos":[\n' +
  PRODUCTOS.map(p => JSON.stringify(p)).join(',\n') +
  '\n],\n"cierres":[\n' +
  lista.map(c => JSON.stringify(c)).join(',\n') +
  '\n]}\n';

const bytes = Buffer.byteLength(texto, 'utf8');
exigir(bytes <= 50 * 1024, `pesa ${bytes} bytes`);

const destino = path.join(__dirname, '..', 'seed', 'semilla.json');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, texto);
process.stdout.write(
  `seed/semilla.json: ${
    lista.length
  } cierres, ${bytes} bytes, venta promedio S/ ${promedioDia.toFixed(2)} por día\n`,
);
