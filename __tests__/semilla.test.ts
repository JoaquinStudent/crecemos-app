/**
 * Pruebas de apoyo de semilla.ts (no son escenarios del SPEC).
 * Validacion del JSON, materializacion y desplazamiento por dia de la semana.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { calcularCierre } from '@dominio/cierre';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { Cierre, SemillaJSON } from '@dominio/tipos';

const real: unknown = JSON.parse(
  readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8'),
);
const semillaReal = (): SemillaJSON => {
  const r = validarSemilla(real);
  if (!r.ok) throw new Error('La semilla real no valida');
  return r.semilla;
};

const minima = (): SemillaJSON => ({
  version: 1,
  semilla: 'minima',
  diaSemanaBase: 3,
  productos: [
    {
      id: 'p-a',
      nombre: 'A',
      unidad: 'porcion',
      precioVenta: 10,
      costoUnitario: 8,
      actualizadoDiasAtras: 10,
    },
  ],
  cierres: [
    {
      diasAtras: 1,
      lineas: [
        { productoId: 'p-a', preparadas: 10, sobrantes: 1, precioUnitario: 10, costoUnitario: 8 },
      ],
      montoYape: 20,
      yapePendiente: true,
      gastos: [{ categoria: 'gas', monto: 5 }],
      abreCiclo: true,
      cobradoDiasAtras: 0,
    },
  ],
});

const clon = (): Record<string, any> => JSON.parse(JSON.stringify(minima()));

describe('validarSemilla', () => {
  it('acepta la semilla real', () => {
    const r = validarSemilla(real);
    expect(r.ok).toBe(true);
  });

  it('acepta una semilla con la lista de cierres vacia', () => {
    expect(validarSemilla({ ...minima(), cierres: [] }).ok).toBe(true);
  });

  it('acepta un cierre sin cobradoDiasAtras', () => {
    const s = clon();
    delete s.cierres[0].cobradoDiasAtras;
    expect(validarSemilla(s).ok).toBe(true);
  });

  it('rechaza un JSON sin cierres', () => {
    const s = clon();
    delete s.cierres;
    expect(validarSemilla(s)).toEqual({ ok: false });
  });

  it('rechaza un JSON sin productos o con la lista vacia', () => {
    const sin = clon();
    delete sin.productos;
    expect(validarSemilla(sin).ok).toBe(false);
    expect(validarSemilla({ ...minima(), productos: [] }).ok).toBe(false);
  });

  it('rechaza tipos malos', () => {
    const casos: Array<(s: Record<string, any>) => void> = [
      s => (s.version = '1'),
      s => delete s.semilla,
      s => delete s.diaSemanaBase,
      s => (s.diaSemanaBase = 7),
      s => (s.diaSemanaBase = -1),
      s => (s.diaSemanaBase = 2.5),
      s => (s.productos[0].unidad = 'kilo'),
      s => (s.productos[0].precioVenta = '10'),
      s => delete s.productos[0].actualizadoDiasAtras,
      s => (s.cierres[0].diasAtras = 'ayer'),
      s => (s.cierres[0].lineas = 'x'),
      s => delete s.cierres[0].lineas[0].productoId,
      s => (s.cierres[0].lineas[0].sobrantes = null),
      s => (s.cierres[0].lineas[0].sobrantes = 11),
      s => (s.cierres[0].lineas[0].preparadas = 2.5),
      s => (s.cierres[0].montoYape = '20'),
      s => delete s.cierres[0].yapePendiente,
      s => (s.cierres[0].gastos[0].categoria = 'lujos'),
      s => delete s.cierres[0].abreCiclo,
      s => (s.cierres[0].cobradoDiasAtras = 'hoy'),
    ];
    casos.forEach((rompe, i) => {
      const s = clon();
      rompe(s);
      expect({ caso: i, ok: validarSemilla(s).ok }).toEqual({ caso: i, ok: false });
    });
  });

  it('rechaza lo que no es un objeto', () => {
    for (const x of [null, undefined, 42, 'texto', [], true]) {
      expect(validarSemilla(x)).toEqual({ ok: false });
    }
  });
});

describe('materializarSemilla', () => {
  // Miercoles 2026-10-07: coincide con diaSemanaBase 3, sin desplazamiento.
  const miercoles = new Date('2026-10-07T12:00:00-05:00');

  it('convierte los dias en fechas locales, con el ultimo dia del mes y del ano', () => {
    const s = minima();
    s.diaSemanaBase = new Date(2026, 0, 1).getDay(); // jueves 1 de enero de 2026
    s.cierres = [
      { ...s.cierres[0], diasAtras: 1 },
      { ...s.cierres[0], diasAtras: 0 },
    ];
    const { cierres } = materializarSemilla(s, new Date(2026, 0, 1, 23, 30));
    expect(cierres.map(c => c.fecha)).toEqual(['2025-12-31', '2026-01-01']);
  });

  it('productos: id, activo, unidad y actualizadoEn como fecha local', () => {
    const { productos } = materializarSemilla(minima(), miercoles);
    expect(productos).toEqual([
      {
        id: 'p-a',
        nombre: 'A',
        unidad: 'porcion',
        precioVenta: 10,
        costoUnitario: 8,
        actualizadoEn: '2026-09-27',
        activo: true,
      },
    ]);
  });

  it('cierres: id nuevo y unico, instantes de ahora, nombre copiado del producto y cobradoEn', () => {
    const s = minima();
    s.cierres.push({ ...s.cierres[0], diasAtras: 3, cobradoDiasAtras: undefined });
    const { cierres } = materializarSemilla(s, miercoles);
    expect(new Set(cierres.map(c => c.id)).size).toBe(2);
    const [a, b] = cierres;
    expect(a.creadoEn).toBe(miercoles.toISOString());
    expect(a.actualizadoEn).toBe(miercoles.toISOString());
    expect(a.lineas[0].nombre).toBe('A');
    expect(a.cobradoEn).toBe('2026-10-07');
    expect(b.cobradoEn).toBeUndefined();
    expect(a.abreCiclo).toBe(true);
    expect(a.gastos).toEqual([{ categoria: 'gas', monto: 5 }]);
  });

  it('usa la fecha local y no UTC: a las 10 p.m. en Lima sigue siendo el mismo dia', () => {
    const tarde = new Date('2026-10-07T22:30:00-05:00'); // ya es 8 de octubre en UTC
    const { cierres } = materializarSemilla(minima(), tarde);
    expect(cierres[0].fecha).toBe('2026-10-06');
  });

  it('no muta la semilla recibida', () => {
    const s = minima();
    const copia = JSON.parse(JSON.stringify(s));
    materializarSemilla(s, new Date('2026-10-13T12:00:00-05:00'));
    expect(s).toEqual(copia);
  });
});

describe('materializarSemilla: desplazamiento por dia de la semana', () => {
  const diaDe = (fecha: string) => {
    const [a, m, d] = fecha.split('-').map(Number);
    return new Date(a, m - 1, d).getDay();
  };

  // Martes 2026-10-13: la semilla se penso en miercoles, asi que se corre 6 dias.
  it('hoy martes: el cierre de diasAtras 1 (un martes en la semilla) cae en el martes anterior', () => {
    const { cierres } = materializarSemilla(minima(), new Date('2026-10-13T12:00:00-05:00'));
    expect(cierres[0].fecha).toBe('2026-10-06');
    expect(diaDe(cierres[0].fecha)).toBe(2);
  });

  it('hoy jueves: se corre 1 dia, el minimo para conservar el dia de la semana', () => {
    const { cierres, productos } = materializarSemilla(
      minima(),
      new Date('2026-10-08T12:00:00-05:00'),
    );
    expect(cierres[0].fecha).toBe('2026-10-06');
    expect(productos[0].actualizadoEn).toBe('2026-09-27');
    // cobradoDiasAtras 0 se corre igual que los demas.
    expect(cierres[0].cobradoEn).toBe('2026-10-07');
  });

  it('cada cierre cae en el dia de la semana en que fue pensado, cualquiera sea hoy', () => {
    const s = semillaReal();
    for (let n = 0; n < 14; n++) {
      const hoy = new Date(2026, 9, 7 + n, 12); // 7 al 20 de octubre
      const { cierres } = materializarSemilla(s, hoy);
      cierres.forEach((c, i) => {
        const esperado = (((s.diaSemanaBase - s.cierres[i].diasAtras) % 7) + 7) % 7;
        expect(diaDe(c.fecha)).toBe(esperado);
      });
    }
  });

  it('el desplazamiento es el minimo (0 a 6 dias) y nunca manda un cierre al futuro', () => {
    const s = minima();
    s.cierres = [{ ...s.cierres[0], diasAtras: 0 }];
    for (let n = 0; n < 14; n++) {
      const hoy = new Date(2026, 9, 7 + n, 12); // 7 al 20 de octubre
      const esperado = (hoy.getDay() - s.diaSemanaBase + 7) % 7;
      const { cierres } = materializarSemilla(s, hoy);
      const [a, m, d] = cierres[0].fecha.split('-').map(Number);
      const dias = Math.round(
        (new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() -
          new Date(a, m - 1, d).getTime()) /
          86400000,
      );
      expect(dias).toBe(esperado);
      expect(dias).toBeGreaterThanOrEqual(0);
      expect(dias).toBeLessThanOrEqual(6);
    }
  });

  const ventasPorDia = (cierres: Cierre[]) => {
    const porDia: Record<number, number[]> = {};
    for (const c of cierres) (porDia[diaDe(c.fecha)] ??= []).push(calcularCierre(c).venta);
    return Object.entries(porDia).map(([dia, v]) => ({
      dia: Number(dia),
      promedio: v.reduce((t, x) => t + x, 0) / v.length,
    }));
  };

  it.each(['2026-10-07', '2026-10-08', '2026-10-10', '2026-10-13', '2026-10-20'])(
    'con hoy = %s los patrones de e9 siguen valiendo',
    dia => {
      const [a, m, d] = dia.split('-').map(Number);
      const { productos, cierres } = materializarSemilla(semillaReal(), new Date(a, m - 1, d, 12));

      const vendidas: Record<string, number> = {};
      for (const c of cierres) {
        for (const [id, n] of Object.entries(calcularCierre(c).vendidasPorProducto)) {
          vendidas[id] = (vendidas[id] ?? 0) + n;
        }
      }
      expect(vendidas['p-pancita']).toBeGreaterThan(vendidas['p-anticucho']);

      const margen = (id: string) => {
        const p = productos.find(x => x.id === id);
        return (p?.precioVenta ?? 0) - (p?.costoUnitario ?? 0);
      };
      expect(margen('p-anticucho')).toBeGreaterThan(margen('p-pancita'));

      const promedios = ventasPorDia(cierres);
      const flojo = promedios.reduce((menor, x) => (x.promedio < menor.promedio ? x : menor));
      expect(flojo.dia).toBe(3);
    },
  );

  it('el precio viejo del anticucho sigue en los cierres anteriores a julio, sea cual sea hoy', () => {
    const { cierres } = materializarSemilla(semillaReal(), new Date(2026, 9, 20, 12));
    const precios = cierres.map(c => ({
      fecha: c.fecha,
      precio: c.lineas.find(l => l.productoId === 'p-anticucho')?.precioUnitario,
    }));
    expect(precios.some(x => x.precio === 9)).toBe(true);
    expect(precios.some(x => x.precio === 10)).toBe(true);
  });
});
