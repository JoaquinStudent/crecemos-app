/**
 * Tests del Sprint-04. Generados desde sdd/spec/Sprint-04/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

/// <reference types="node" />
import { execFileSync } from 'child_process';
import { readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { calcularCierre } from '@dominio/cierre';
import { marcarCobrados, totalPorCobrar } from '@dominio/cobro';
import { formatoSoles } from '@dominio/formato';
import { teDeja } from '@dominio/producto';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { Cierre, FechaNegocio, SemillaJSON } from '@dominio/tipos';
import { guardarCierre, listarCierres, marcarCobrado } from '@storage/repositorio';

// Mediodía del 2026-10-07 (miércoles) en Lima: es el "hoy" de los escenarios.
const ahora = new Date('2026-10-07T12:00:00-05:00');

// Cierre solo con Yape: lo único que importa para los cobros. La fecha es explícita.
const cierreYape = (
  id: string,
  fecha: FechaNegocio,
  montoYape: number,
  yapePendiente: boolean,
  cobradoEn?: FechaNegocio,
): Cierre => ({
  id,
  fecha,
  lineas: [],
  montoYape,
  yapePendiente,
  ...(cobradoEn ? { cobradoEn } : {}),
  gastos: [],
  abreCiclo: false,
  creadoEn: ahora.toISOString(),
  actualizadoEn: ahora.toISOString(),
});

const RUTA_SEMILLA = join(__dirname, '..', '..', 'seed', 'semilla.json');
const RUTA_GENERADOR = join(__dirname, '..', '..', 'scripts', 'generar-semilla.js');

describe('SPEC-04: Cobros pendientes y carga inicial desde el Mock API', () => {
  // @spec04_e1 — Total por cobrar
  it('spec04_e1 total por cobrar', () => {
    // Given: un cierre con S/ 50.00 de Yape por cobrar, otro con S/ 46.00 por cobrar y otro con S/ 30.00 ya cobrado
    // When: se calcula el total por cobrar
    // Then: el total es S/ 96.00 repartido en 2 pagos
    const cierres = [
      cierreYape('c-1', '2026-10-03', 50, true),
      cierreYape('c-2', '2026-10-05', 46, true),
      cierreYape('c-3', '2026-10-04', 30, true, '2026-10-06'),
    ];

    const resumen = totalPorCobrar(cierres);

    expect(resumen.total).toBe(96);
    expect(formatoSoles(resumen.total)).toBe('S/ 96.00');
    expect(resumen.pagos).toBe(2);
    expect(resumen.desde).toBe('2026-10-03');
  });

  // @spec04_e2 — Marcar como cobrado
  it('spec04_e2 marcar como cobrado', () => {
    // Given: dos cierres con Yape por cobrar que suman S/ 96.00
    // When: se marcan como cobrados el 2026-10-07
    // Then: el total por cobrar es S/ 0.00 y ambos cierres tienen fecha de cobro 2026-10-07
    // Con el repositorio real: se guardan, se marcan y se vuelven a leer.
    return (async () => {
      clearAllMockStorages();
      await guardarCierre(cierreYape('c-1', '2026-10-05', 50, true));
      await guardarCierre(cierreYape('c-2', '2026-10-06', 46, true));
      expect(totalPorCobrar(await listarCierres()).total).toBe(96);

      await marcarCobrado(['c-1', 'c-2'], '2026-10-07');

      const cierres = await listarCierres();
      const resumen = totalPorCobrar(cierres);
      expect(resumen.total).toBe(0);
      expect(formatoSoles(resumen.total)).toBe('S/ 0.00');
      expect(resumen.pagos).toBe(0);
      expect(cierres).toHaveLength(2);
      expect(cierres.map(c => c.cobradoEn)).toEqual(['2026-10-07', '2026-10-07']);
      // El dominio hace lo mismo sin tocar el original.
      const original = [cierreYape('c-1', '2026-10-05', 50, true)];
      expect(marcarCobrados(original, ['c-1'], '2026-10-07')[0].cobradoEn).toBe('2026-10-07');
      expect(original[0].cobradoEn).toBeUndefined();
    })();
  });

  // @spec04_e3 — Carga la semilla en el primer arranque
  it('spec04_e3 carga la semilla en el primer arranque', () => {
    // Given: el almacenamiento vacío y un servidor que responde la semilla con 4 productos y 40 cierres
    // When: arranca la app
    // Then: quedan guardados 4 productos y 40 cierres, y la clave "@crecemos/seed" tiene la fecha de carga
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e4 — Sin internet la app abre igual
  it('spec04_e4 sin internet la app abre igual', () => {
    // Given: el almacenamiento vacío y la red caída
    // When: arranca la app
    // Then: la app queda lista con 0 cierres, no muestra ningún error técnico y ofrece el botón "Cargar datos de ejemplo"
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e5 — No descarga dos veces
  it('spec04_e5 no descarga dos veces', () => {
    // Given: la semilla ya se cargó en un arranque anterior
    // When: la app arranca de nuevo
    // Then: no se hace ninguna petición de red
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e6 — Las fechas de la semilla se calculan desde hoy
  it('spec04_e6 las fechas de la semilla se calculan desde hoy', () => {
    // Given: un cierre de la semilla con "diasAtras" 1 y hoy 2026-10-07
    // When: se materializa la semilla
    // Then: el cierre queda con fecha 2026-10-06
    // Hoy es miércoles y la semilla se pensó en miércoles (diaSemanaBase 3): sin desplazamiento.
    const semilla: SemillaJSON = {
      version: 1,
      semilla: 'prueba',
      diaSemanaBase: 3,
      productos: [
        {
          id: 'p-anticucho',
          nombre: 'Anticucho',
          unidad: 'porcion',
          precioVenta: 10,
          costoUnitario: 8.2,
          actualizadoDiasAtras: 84,
        },
      ],
      cierres: [
        {
          diasAtras: 1,
          lineas: [
            { productoId: 'p-anticucho', preparadas: 20, sobrantes: 2, precioUnitario: 10, costoUnitario: 8.2 },
          ],
          montoYape: 46,
          yapePendiente: true,
          gastos: [{ categoria: 'movilidad', monto: 12 }],
          abreCiclo: false,
        },
      ],
    };

    const { cierres, productos } = materializarSemilla(semilla, ahora);

    expect(cierres).toHaveLength(1);
    expect(cierres[0].fecha).toBe('2026-10-06');
    expect(productos[0].actualizadoEn).toBe('2026-07-15');
  });

  // @spec04_e7 — La semilla pesa poco
  it('spec04_e7 la semilla pesa poco', () => {
    // Given: el archivo seed/semilla.json generado
    // When: se mide su tamaño
    // Then: pesa 50 KB o menos
    const bytes = statSync(RUTA_SEMILLA).size;

    expect(bytes).toBeGreaterThan(0);
    expect(bytes).toBeLessThanOrEqual(51200);
  });

  // @spec04_e8 — Una semilla inválida no guarda nada
  it('spec04_e8 una semilla invalida no guarda nada', () => {
    // Given: el almacenamiento vacío y un servidor que responde un JSON sin el campo "cierres"
    // When: arranca la app
    // Then: no se guarda ningún producto ni cierre y la app muestra "No pudimos cargar los datos de ejemplo"
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e9 — La semilla contiene lo que dijo Freddy
  it('spec04_e9 la semilla contiene lo que dijo freddy', () => {
    // Given: la semilla generada con la semilla fija "crecemos-20261007"
    // When: se analizan sus cierres
    // Then: la pancita tiene más porciones vendidas que el anticucho, el anticucho deja más por porción que la pancita, y el miércoles es el día de menor venta promedio
    const antes = readFileSync(RUTA_SEMILLA);
    try {
      // El generador es determinista: dos corridas dan los mismos bytes que el archivo versionado.
      execFileSync('node', [RUTA_GENERADOR], { stdio: 'pipe' });
      const primera = readFileSync(RUTA_SEMILLA);
      execFileSync('node', [RUTA_GENERADOR], { stdio: 'pipe' });
      const segunda = readFileSync(RUTA_SEMILLA);
      expect(primera.equals(segunda)).toBe(true);
      expect(primera.equals(antes)).toBe(true);
    } finally {
      writeFileSync(RUTA_SEMILLA, antes);
    }

    const validada = validarSemilla(JSON.parse(antes.toString('utf8')));
    expect(validada.ok).toBe(true);
    if (!validada.ok) return;
    expect(validada.semilla.semilla).toBe('crecemos-20261007');

    const { productos, cierres } = materializarSemilla(validada.semilla, ahora);

    // 1 · Porciones vendidas por producto, sumadas con calcularCierre.
    const vendidas: Record<string, number> = {};
    for (const c of cierres) {
      const resumen = calcularCierre(c);
      for (const [id, n] of Object.entries(resumen.vendidasPorProducto)) {
        vendidas[id] = (vendidas[id] ?? 0) + n;
      }
    }
    expect(vendidas['p-pancita']).toBeGreaterThan(vendidas['p-anticucho']);

    // 2 · Lo que deja cada porción con los precios y costos vigentes.
    const anticucho = productos.find(p => p.id === 'p-anticucho');
    const pancita = productos.find(p => p.id === 'p-pancita');
    if (!anticucho || !pancita) throw new Error('Faltan productos en la semilla');
    expect(teDeja(anticucho).monto).toBeGreaterThan(teDeja(pancita).monto);

    // 3 · Venta promedio por día de la semana (fecha local de cada cierre).
    const porDia: Record<number, number[]> = {};
    for (const c of cierres) {
      const [a, m, d] = c.fecha.split('-').map(Number);
      const dia = new Date(a, m - 1, d).getDay();
      (porDia[dia] ??= []).push(calcularCierre(c).venta);
    }
    const promedios = Object.entries(porDia).map(([dia, ventas]) => ({
      dia: Number(dia),
      promedio: ventas.reduce((t, v) => t + v, 0) / ventas.length,
    }));
    const flojo = promedios.reduce((menor, x) => (x.promedio < menor.promedio ? x : menor));
    expect(flojo.dia).toBe(3);
  });

  // @spec04_e10 — e2e: primer arranque con datos de ejemplo
  it('spec04_e10 e2e primer arranque con datos de ejemplo', () => {
    // Given: la app recién instalada y un servidor que responde la semilla
    // When: arranca la app y se abre Inicio
    // Then: Inicio muestra un monto en "Te queda" distinto de "S/ 0.00" y la tarjeta "Yape por cobrar" con su total
    throw new Error('Rojo: no implementado');
  });
});
