/**
 * Pruebas de apoyo: la semilla de demostración alimenta el motor de decisiones (no son escenarios
 * del SPEC). Con el costo del anticucho de julio en S/ 6.80 (P27) la regla de precio salta en el
 * demo, y los últimos 30 días separan lo que se vende de lo que deja, sea cual sea el día del demo.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { SemillaJSON } from '@dominio/tipos';
import { gananciaPorProducto, insight } from '@analisis/metricas';
import { evaluarReglas } from '@analisis/reglas';

const semillaReal = (): SemillaJSON => {
  const texto = readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8');
  const r = validarSemilla(JSON.parse(texto));
  if (!r.ok) throw new Error('La semilla real no valida');
  return r.semilla;
};

// El demo es el 7 de octubre; el Demo Day, el martes 20. Se prueban días de la semana distintos.
const DIAS_DEL_DEMO = [7, 13, 20];
// Los demás días del 7 al 20: la semilla se desplaza por día de la semana (diaSemanaBase).
const OTROS_DIAS = [8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19];

describe('Semilla y motor de decisiones', () => {
  it('el anticucho costaba S/ 6.80 antes de octubre y S/ 8.20 desde octubre', () => {
    const { cierres, productos } = materializarSemilla(semillaReal(), new Date(2026, 9, 7, 12));
    const costos = (desde: string, hasta: string) =>
      cierres
        .filter(c => c.fecha >= desde && c.fecha < hasta)
        .map(c => c.lineas.find(l => l.productoId === 'p-anticucho')?.costoUnitario);

    const antes = costos('0000-00-00', '2026-10-01');
    expect(antes.length).toBeGreaterThanOrEqual(30);
    expect(new Set(antes)).toEqual(new Set([6.8]));
    const despues = costos('2026-10-01', '9999-99-99');
    expect(despues.length).toBeGreaterThanOrEqual(3);
    expect(new Set(despues)).toEqual(new Set([8.2]));
    // El costo actual del producto no cambia.
    expect(productos.find(p => p.id === 'p-anticucho')?.costoUnitario).toBe(8.2);
  });

  it('con hoy = 2026-10-07 la regla de precio dice cuánto menos deja el anticucho que en julio', () => {
    const ahora = new Date(2026, 9, 7, 12);
    const { cierres, productos } = materializarSemilla(semillaReal(), ahora);

    const r = evaluarReglas({ cierres, productos, hoy: fechaLocal(ahora) });

    const precio = r.find(x => x.reglaId === 'precio');
    expect(precio?.mensaje).toBe(
      'La diferencia estimada por unidad de Anticucho bajó S/ 0.40 desde julio (precio menos costo estimado). Revisa el precio.',
    );
    // Cobro (1) y precio (2): son las dos que muestra el motor.
    expect(r.map(x => x.reglaId)).toEqual(['cobro', 'precio']);
  });

  // `materializarSemilla` desplaza los cierres por `diaSemanaBase`: la regla tiene que saltar el
  // día que sea el demo, no solo el 7. (Con hoy = 13 o 20 la referencia de hace 90 días ya cae
  // después de la subida de precio de julio, y la diferencia es mayor; la regla salta igual.)
  it.each(DIAS_DEL_DEMO)('con hoy = 2026-10-%i la regla de precio salta', dia => {
    const ahora = new Date(2026, 9, dia, 12);
    const { cierres, productos } = materializarSemilla(semillaReal(), ahora);

    const r = evaluarReglas({ cierres, productos, hoy: fechaLocal(ahora) });

    expect(r.map(x => x.reglaId)).toContain('precio');
    expect(r.find(x => x.reglaId === 'precio')?.mensaje).toMatch(
      /^La diferencia estimada por unidad de Anticucho bajó S\/ \d+\.\d{2} desde julio \(precio menos costo estimado\)\. Revisa el precio\.$/,
    );
  });

  it.each(OTROS_DIAS)(
    'con hoy = 2026-10-%i la regla de precio salta, cualquiera sea el día de la semana',
    dia => {
      const ahora = new Date(2026, 9, dia, 12);
      const { cierres, productos } = materializarSemilla(semillaReal(), ahora);

      const r = evaluarReglas({ cierres, productos, hoy: fechaLocal(ahora) });

      expect(r.map(x => x.reglaId)).toContain('precio');
    },
  );

  // Los últimos 30 días: lo que ve "Qué me deja cada uno". Pancita se vende más, anticucho deja
  // más por porción, y por eso hay insight.
  it.each(DIAS_DEL_DEMO)(
    'con hoy = 2026-10-%i los últimos 30 días: Pancita se vende más, Anticucho deja más y hay insight',
    dia => {
      const ahora = new Date(2026, 9, dia, 12);
      const { cierres } = materializarSemilla(semillaReal(), ahora);

      const g = gananciaPorProducto(cierres, restarDias(fechaLocal(ahora), 30));

      expect(g).toHaveLength(4);
      const masVendido = [...g].sort((a, b) => b.seVende - a.seVende)[0];
      const masDeja = [...g].sort((a, b) => b.teDeja - a.teDeja)[0];
      expect(masVendido.nombre).toBe('Pancita');
      expect(masDeja.nombre).toBe('Anticucho');
      expect(insight(g)).not.toBeNull();
    },
  );

  it.each(OTROS_DIAS)(
    'con hoy = 2026-10-%i los últimos 30 días también separan lo que se vende de lo que deja',
    dia => {
      const ahora = new Date(2026, 9, dia, 12);
      const { cierres } = materializarSemilla(semillaReal(), ahora);

      const g = gananciaPorProducto(cierres, restarDias(fechaLocal(ahora), 30));

      expect([...g].sort((a, b) => b.seVende - a.seVende)[0].nombre).toBe('Pancita');
      expect([...g].sort((a, b) => b.teDeja - a.teDeja)[0].nombre).toBe('Anticucho');
      expect(insight(g)).not.toBeNull();
    },
  );
});
