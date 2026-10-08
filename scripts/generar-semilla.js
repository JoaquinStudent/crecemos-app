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
// El costo del anticucho antes de octubre es S/ 6.80 (decisión P27): en julio dejaba S/ 2.20
// por porción y hoy deja S/ 1.80, así que la regla de precio salta en el demo.
// 75 cierres (decisión P26): ≈ 25 al mes de ≈ S/ 200 dan ≈ S/ 5,000 de venta mensual, la cifra
// que Freddy declaró y que el reporte para el banco tiene que mostrar.

const { Buffer } = require('buffer');
const fs = require('fs');
const path = require('path');

const SEMILLA = 'crecemos-20261007';
const HOY = Date.UTC(2026, 9, 7); // diasAtras = 0
const DIA_SEMANA_BASE = 3; // miércoles: Date.getDay() de diasAtras = 0
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const PARES = 37; // 37 ciclos de 2 días y, al fondo, 1 ciclo de un día
const CIERRES = 2 * PARES + 1; // 75
const SPAN = 90; // el cierre más antiguo queda a 90 días
const LIBRES = SPAN - CIERRES; // 15 días sin cierre, repartidos uno cada ~6 días
const MAX_BYTES = 40 * 1024; // el límite duro es 50 KB (SPEC-04, escenario 7)
const SUBIO_PRECIO = '2026-07-15'; // el anticucho pasó de S/ 9 a S/ 10
const SUBIO_COSTO = '2026-10-01'; // el corazón sube en octubre
const COSTO_ANTICUCHO_ANTES = 6.8; // costo del anticucho antes de octubre (en octubre sube a 8.20)
const LIQUIDA_CADA = 7; // la hermana le entrega el Yape una vez por semana
const PRIMERA_LIQUIDACION = 8; // diasAtras de la entrega más reciente

// Lo que tiene que cumplir el reporte para el banco con hoy = 2026-10-07 (los meses completos).
const MESES_REPORTE = ['2026-08', '2026-09'];
const VENTA_MES = [4900, 5400];
const TE_QUEDA_MES = [2100, 2300];
const TE_QUEDA_OBJETIVO = 2180; // lo que marca el mock 06
// Con hoy = 13 o 20 de octubre los cierres se corren hasta 6 días (diaSemanaBase): el promedio
// mensual de los dos últimos meses completos sigue en este rango.
const PROMEDIO_DESPLAZADO = [4500, 5700];

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
const DEMANDA = { 'p-anticucho': 7.14, 'p-pancita': 10.72, 'p-rachi': 5.64, 'p-chicha': 5.64 };
// Para achicar el archivo, la rachi y la chicha no entran en todos los cierres.
const PRESENCIA = { 'p-anticucho': 1, 'p-pancita': 1, 'p-rachi': 0.6, 'p-chicha': 0.35 };
// Por día de la semana (0 = domingo). El miércoles es el más flojo.
const RUIDO = 0.15; // cuánto varía la venta de un producto de un día a otro (±)
const FACTOR_DIA = [1.15, 0.95, 1.0, 0.55, 1.0, 1.15, 1.3];
// La mercadería de un ciclo es esta parte de lo que vende, y el carbón de un ciclo cuesta esto.
const PARTE_MERCADERIA = 0.45;
const CARBON_BASE = 25;

const diaSemana = diasAtras => (((DIA_SEMANA_BASE - diasAtras) % 7) + 7) % 7;
// Aritmética de calendario en UTC: no depende de la zona de quien lo corra.
const fechaDe = diasAtras => new Date(HOY - diasAtras * MS_POR_DIA).toISOString().slice(0, 10);

// ----- Calendario: 15 días sin cierre repartidos parejo entre los 38 ciclos -----
// huecos[k] = días sin cierre entre el ciclo k (más reciente = 0) y el siguiente, más antiguo.
const FASE = 7; // en qué punto del reparto empieza (0 a 36): mueve los días libres sin cambiar cuántos son
const huecos = Array.from(
  { length: PARES },
  (_, k) => Math.floor(((k + 1) * LIBRES + FASE) / PARES) - Math.floor((k * LIBRES + FASE) / PARES),
);

const pares = []; // pares[0] es el más reciente
let reciente = 1; // el más reciente cierra ayer (diasAtras 1)
for (let k = 0; k < PARES; k++) {
  pares.push({ k, abre: reciente + 1, cierra: reciente });
  reciente += huecos[k] + 2;
}
const unico = reciente; // el ciclo de un día, el más antiguo: queda a SPAN días

// ----- Un día de ventas -----
// Se sortea la presencia y los sobrantes de cada producto aunque no entren: así cambiar la
// presencia no mueve el resto de los números.
const FI = 0.6180339887; // reparte la presencia pareja (sin rachas), no al azar
const lineaDe = (producto, diasAtras, k) => {
  const factor = FACTOR_DIA[diaSemana(diasAtras)];
  const ruido = 1 - RUIDO + azar() * 2 * RUIDO;
  const vendidas = Math.max(1, Math.round(DEMANDA[producto.id] * factor * ruido));
  const tirada = azar();
  azar(); // (se sortea aunque no se use, para no mover los demás números)
  const turno = (diasAtras * FI + (producto.id === 'p-chicha' ? 0.37 : 0)) % 1;
  const entra = turno < PRESENCIA[producto.id] || k < 2; // los dos ciclos más recientes: todo
  let sobrantes = tirada < 0.4 ? 0 : tirada < 0.75 ? 1 : 2;
  if (producto.id === 'p-chicha') sobrantes = tirada < 0.6 ? 0 : 1;
  if (k < 2) {
    // Los dos ciclos más recientes: sobra rachi y de lo demás casi nada.
    sobrantes = producto.id === 'p-rachi' ? 5 + entre(0, 1) : Math.min(sobrantes, 1);
  }
  const esAnticucho = producto.id === 'p-anticucho';
  return {
    entra,
    productoId: producto.id,
    preparadas: vendidas + sobrantes,
    sobrantes,
    precioUnitario: esAnticucho && fechaDe(diasAtras) < SUBIO_PRECIO ? 9 : producto.precioVenta,
    costoUnitario:
      esAnticucho && fechaDe(diasAtras) < SUBIO_COSTO
        ? COSTO_ANTICUCHO_ANTES
        : producto.costoUnitario,
  };
};

const ventaDe = lineas =>
  redondear(lineas.reduce((t, l) => t + (l.preparadas - l.sobrantes) * l.precioUnitario, 0));

const dia = (diasAtras, k) => {
  const lineas = PRODUCTOS.map(p => lineaDe(p, diasAtras, k))
    .filter(l => l.entra)
    .map(({ entra, ...l }) => l);
  return { diasAtras, lineas, venta: ventaDe(lineas) };
};

// ----- Armar los 75 cierres, del más antiguo al más reciente -----
const cierres = [];

// Cada cierre sortea su Yape en este orden; `gastos` ya viene armado.
const agregar = (d, gastos, abreCiclo) => {
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
};

const mercaderiaDe = venta =>
  5 * Math.round((PARTE_MERCADERIA * venta * (0.95 + azar() * 0.1)) / 5);

// El ciclo más antiguo es de un solo día: compra mercadería y vende.
{
  const d = dia(unico, PARES);
  agregar(
    d,
    [
      { categoria: 'mercaderia', monto: mercaderiaDe(d.venta) },
      { categoria: 'movilidad', monto: entre(8, 12) },
    ],
    true,
  );
}
for (const par of [...pares].reverse()) {
  const primero = dia(par.abre, par.k);
  const segundo = dia(par.cierra, par.k);
  // 1 o 2 gastos por cierre: el primer día, la mercadería y la movilidad para traerla; el
  // segundo, el carbón del ciclo y, a veces, el gas o algo suelto.
  const gastosPrimero = [
    { categoria: 'mercaderia', monto: mercaderiaDe(primero.venta + segundo.venta) },
    { categoria: 'movilidad', monto: entre(8, 12) },
  ];
  const gastosSegundo = [{ categoria: 'carbon', monto: CARBON_BASE + 5 * entre(0, 1) }];
  const gas = azar() < 0.25;
  const otro = azar() < 0.15;
  if (gas) gastosSegundo.push({ categoria: 'gas', monto: 12 });
  else if (otro) gastosSegundo.push({ categoria: 'otro', monto: 5 });

  agregar(primero, gastosPrimero, true);
  agregar(segundo, gastosSegundo, false);
}

// ----- Calibración: la mercadería de cada mes se ajusta (de a S/ 5) hasta que "te queda" sea el objetivo -----
// La compra de mercadería es lo único que Freddy elige; así el "te queda" de cada mes de
// referencia cae donde debe sin tocar lo que se vende ni los patrones.
const mesDe = c => fechaDe(c.diasAtras).slice(0, 7);
MESES_REPORTE.forEach(mes => {
  const compras = cierres
    .map(c => c.cierre)
    .filter(c => c.abreCiclo && mesDe(c) === mes)
    .map(c => c.gastos.find(g => g.categoria === 'mercaderia'));
  const teQuedaDelMes = () =>
    cierres
      .filter(c => mesDe(c.cierre) === mes)
      .reduce((t, c) => t + c.venta - c.cierre.gastos.reduce((s, g) => s + g.monto, 0), 0);
  for (let i = 0; Math.abs(teQuedaDelMes() - TE_QUEDA_OBJETIVO) >= 5 && i < 500; i++) {
    compras[i % compras.length].monto += teQuedaDelMes() > TE_QUEDA_OBJETIVO ? 5 : -5;
  }
});

// ----- Comprobaciones: si un patrón falla, no se escribe nada -----
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(`La semilla no cumple: ${mensaje}`);
};
const lista = cierres.map(c => c.cierre);
const gastoDe = c => c.gastos.reduce((t, g) => t + g.monto, 0);

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
exigir(
  vendidas('p-pancita') > vendidas('p-rachi') && vendidas('p-pancita') > vendidas('p-chicha'),
  'la pancita no es la más vendida',
);

const deja = id => {
  const p = PRODUCTOS.find(x => x.id === id);
  return p.precioVenta - p.costoUnitario;
};
exigir(
  deja('p-anticucho') > deja('p-pancita') &&
    deja('p-anticucho') > deja('p-rachi') &&
    deja('p-anticucho') > deja('p-chicha'),
  'el anticucho no deja más por porción',
);
// Los cuatro productos siguen apareciendo en los últimos 30 días, sea cual sea el día del demo
// (los cierres se corren hasta 6 días hacia el pasado).
PRODUCTOS.forEach(p =>
  exigir(
    lista.filter(c => c.diasAtras <= 24 && c.lineas.some(l => l.productoId === p.id)).length >= 3,
    `${p.nombre} casi no aparece en los últimos 30 días`,
  ),
);

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
exigir(
  promedios.every(([d, , n]) => d === 3 || n >= 4),
  'un día de la semana casi no tiene cierres',
);

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
  costosAnticucho(false).every(x => x === COSTO_ANTICUCHO_ANTES),
  'el costo anterior no es 6.80',
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

exigir(lista.length === CIERRES, `no son ${CIERRES} cierres`);
exigir(new Set(lista.map(c => c.diasAtras)).size === CIERRES, 'dos cierres el mismo día');
exigir(Math.min(...lista.map(c => c.diasAtras)) === 1, 'hoy no queda sin cierre');
exigir(
  Math.max(...lista.map(c => c.diasAtras)) >= 85 && Math.max(...lista.map(c => c.diasAtras)) <= 95,
  'no abarca ~90 días',
);
// Ciclos de 2 días (el más antiguo, de uno), con 0 a 2 días sin cierre entre un ciclo y el siguiente.
exigir(
  lista.every((c, i) => c.abreCiclo === (i === 0 || i % 2 === 1)),
  'los ciclos no son de 2 días',
);
exigir(
  lista.every((c, i) => !c.abreCiclo || i === 0 || lista[i + 1].diasAtras === c.diasAtras - 1),
  'un ciclo no tiene días seguidos',
);
exigir(
  lista.every((c, i) => {
    if (i === 0 || !c.abreCiclo) return true;
    const sinCierre = lista[i - 1].diasAtras - c.diasAtras - 1; // días entre un ciclo y el siguiente
    return sinCierre >= 0 && sinCierre <= 2;
  }),
  'los ciclos no se separan por 0 a 2 días sin cierre',
);
exigir(
  lista[0].abreCiclo && lista[0].gastos.some(g => g.categoria === 'mercaderia'),
  'sin mercadería al inicio',
);
exigir(
  lista.every(c => c.abreCiclo === c.gastos.some(g => g.categoria === 'mercaderia')),
  'la mercadería no está solo en el día que abre el ciclo',
);
exigir(
  lista.every(c => c.gastos.length >= 1 && c.gastos.length <= 2),
  'un cierre no tiene 1 o 2 gastos',
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

// Venta y "te queda" por mes de calendario. `corrido` son los días que `materializarSemilla`
// mueve los cierres hacia el pasado (0 a 6): al sumar 0 o 7 a la fecha se prueba un hoy de otra semana.
const porMes = corrido => {
  const meses = {};
  cierres.forEach(({ cierre, venta }) => {
    const mes = new Date(HOY - cierre.diasAtras * MS_POR_DIA + corrido * MS_POR_DIA)
      .toISOString()
      .slice(0, 7);
    const m = (meses[mes] = meses[mes] || { cierres: 0, venta: 0, teQueda: 0 });
    m.cierres += 1;
    m.venta = redondear(m.venta + venta);
    m.teQueda = redondear(m.teQueda + venta - gastoDe(cierre));
  });
  return meses;
};
const hoy7 = porMes(0);
MESES_REPORTE.forEach(mes => {
  const m = hoy7[mes];
  exigir(
    m.venta >= VENTA_MES[0] && m.venta <= VENTA_MES[1],
    `la venta de ${mes} es S/ ${m.venta} (debe estar entre ${VENTA_MES[0]} y ${VENTA_MES[1]})`,
  );
  exigir(
    m.teQueda >= TE_QUEDA_MES[0] && m.teQueda <= TE_QUEDA_MES[1],
    `"te queda" de ${mes} es S/ ${m.teQueda} (debe estar entre ${TE_QUEDA_MES[0]} y ${TE_QUEDA_MES[1]})`,
  );
});
const desplazado = porMes(7);
const promedioDesplazado = MESES_REPORTE.reduce((t, mes) => t + desplazado[mes].venta, 0) / 2;
exigir(
  promedioDesplazado >= PROMEDIO_DESPLAZADO[0] && promedioDesplazado <= PROMEDIO_DESPLAZADO[1],
  `con los cierres corridos la venta promedio mensual es S/ ${promedioDesplazado.toFixed(2)}`,
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
exigir(bytes <= MAX_BYTES, `pesa ${bytes} bytes (el máximo es ${MAX_BYTES})`);

const destino = path.join(__dirname, '..', 'seed', 'semilla.json');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, texto);
const resumen = MESES_REPORTE.map(
  mes => `${mes}: venta S/ ${hoy7[mes].venta}, te queda S/ ${hoy7[mes].teQueda}`,
).join(' · ');
process.stdout.write(
  `seed/semilla.json: ${
    lista.length
  } cierres, ${bytes} bytes, venta promedio S/ ${promedioDia.toFixed(2)} por día\n${resumen}\n`,
);
