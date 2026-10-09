/**
 * Pruebas de apoyo: la semilla de demostración alimenta el reporte para el banco (no son escenarios
 * del SPEC). Con 75 cierres (P26), agosto y septiembre dan ≈ S/ 5,000 de venta y ≈ S/ 2,200 de
 * "te queda" con hoy = 2026-10-07 (el mock 06 marca 5,120 y 2,180), y los promedios siguen en
 * rango el día del Demo Day aunque `materializarSemilla` mueva los cierres hasta 6 días.
 */

/// <reference types="node" />
import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { calcularCierre } from '@dominio/cierre';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { Cierre, SemillaJSON } from '@dominio/tipos';
import { gananciaPorProducto, insight } from '@analisis/metricas';
import { evaluarReglas } from '@analisis/reglas';

const RUTA = join(__dirname, '..', 'seed', 'semilla.json');

const semillaReal = (): SemillaJSON => {
  const r = validarSemilla(JSON.parse(readFileSync(RUTA, 'utf8')));
  if (!r.ok) throw new Error('La semilla real no valida');
  return r.semilla;
};

// El demo es el 7 de octubre; el Demo Day, el martes 20. Mismos tres días que semilla-decisiones.
const DIAS_DEL_DEMO = [7, 13, 20];

/** Venta y "te queda" de un mes de calendario ('YYYY-MM'), con la cuenta de calcularCierre. */
const delMes = (cierres: Cierre[], mes: string) => {
  const enElMes = cierres.filter(c => c.fecha.startsWith(mes));
  return {
    cierres: enElMes.length,
    venta: enElMes.reduce((t, c) => t + calcularCierre(c).venta, 0),
    teQueda: enElMes.reduce((t, c) => t + calcularCierre(c).teQueda, 0),
  };
};

/** Los dos últimos meses completos antes de `hoy` ('YYYY-MM-DD'). */
const ultimosDosMeses = (hoy: string): string[] => {
  const [a, m] = hoy.split('-').map(Number);
  const mes = (n: number) => {
    const d = new Date(Date.UTC(a, m - 1 - n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  return [mes(2), mes(1)];
};

describe('Semilla de 75 cierres para el reporte', () => {
  it('trae 75 cierres en unos 90 días, 4 productos y pesa 40 KB o menos', () => {
    const s = semillaReal();
    expect(s.cierres).toHaveLength(75);
    expect(s.productos).toHaveLength(4);
    const dias = s.cierres.map(c => c.diasAtras);
    expect(Math.min(...dias)).toBe(1); // hoy queda sin cierre
    expect(Math.max(...dias)).toBeGreaterThanOrEqual(85);
    expect(Math.max(...dias)).toBeLessThanOrEqual(95);
    expect(new Set(dias).size).toBe(75);
    expect(statSync(RUTA).size).toBeLessThanOrEqual(40 * 1024);
  });

  it('con hoy = 2026-10-07 agosto y septiembre venden entre S/ 4,900 y S/ 5,400 y dejan entre S/ 2,100 y S/ 2,300', () => {
    const { cierres } = materializarSemilla(semillaReal(), new Date(2026, 9, 7, 12));
    for (const mes of ['2026-08', '2026-09']) {
      const m = delMes(cierres, mes);
      expect({ mes, ok: m.venta >= 4900 && m.venta <= 5400 }).toEqual({ mes, ok: true });
      expect({ mes, ok: m.teQueda >= 2100 && m.teQueda <= 2300 }).toEqual({ mes, ok: true });
    }
  });

  it('con hoy = 2026-10-07 julio queda parcial: empieza el 9 y no cuenta', () => {
    const { cierres } = materializarSemilla(semillaReal(), new Date(2026, 9, 7, 12));
    const fechas = cierres.map(c => c.fecha).sort();
    expect(fechas[0]).toBe('2026-07-09');
    expect(fechas[fechas.length - 1]).toBe('2026-10-06');
  });

  it.each(DIAS_DEL_DEMO)(
    'con hoy = 2026-10-%i el promedio mensual de los dos últimos meses completos sigue entre S/ 4,500 y S/ 5,700',
    dia => {
      const ahora = new Date(2026, 9, dia, 12);
      const { cierres } = materializarSemilla(semillaReal(), ahora);
      const meses = ultimosDosMeses(fechaLocal(ahora)).map(m => delMes(cierres, m));
      const venta = meses.reduce((t, m) => t + m.venta, 0) / meses.length;
      expect(venta).toBeGreaterThanOrEqual(4500);
      expect(venta).toBeLessThanOrEqual(5700);
    },
  );

  it.each(DIAS_DEL_DEMO)('con hoy = 2026-10-%i no hay cierre en la fecha de hoy', dia => {
    const ahora = new Date(2026, 9, dia, 12);
    const { cierres } = materializarSemilla(semillaReal(), ahora);
    const hoy = fechaLocal(ahora);
    expect(cierres.some(c => c.fecha === hoy)).toBe(false);
    expect(cierres.every(c => c.fecha < hoy)).toBe(true);
    expect(new Set(cierres.map(c => c.fecha)).size).toBe(75);
  });

  it.each(DIAS_DEL_DEMO)(
    'con hoy = 2026-10-%i Pancita se vende más, Anticucho deja más por porción, hay insight y salta la regla de precio',
    dia => {
      const ahora = new Date(2026, 9, dia, 12);
      const hoy = fechaLocal(ahora);
      const { cierres, productos } = materializarSemilla(semillaReal(), ahora);

      const g = gananciaPorProducto(cierres, restarDias(hoy, 30));
      expect([...g].sort((a, b) => b.seVende - a.seVende)[0].nombre).toBe('Pancita');
      expect([...g].sort((a, b) => b.teDeja - a.teDeja)[0].nombre).toBe('Anticucho');
      expect(insight(g)).not.toBeNull();

      const precio = evaluarReglas({ cierres, productos, hoy }).find(x => x.reglaId === 'precio');
      expect(precio).toBeDefined();
      if (dia === 7) {
        expect(precio?.mensaje).toBe(
          'La diferencia estimada por unidad de Anticucho bajó S/ 0.40 desde julio (precio menos costo estimado). Revisa el precio.',
        );
      }
    },
  );
});
