/**
 * Pruebas de apoyo del resumen agregado del negocio (no son escenarios del SPEC; el e8 vive en
 * `sdd/sprint-14.test.ts`): los bordes del armado, el tope de 1,500 caracteres y que los cierres
 * posteriores a hoy no cuentan.
 */

import type { Cierre, ContextoAnalisis, LineaCierre, Producto } from '@dominio/tipos';
import {
  armarResumenNegocio,
  cifrasDelResumen,
  MAX_CARACTERES_RESUMEN,
  MAX_NOMBRE_PRODUCTO,
} from '@analisis/resumenNegocio';

const instante = '2026-10-14T12:00:00-05:00';
const linea = (nombre: string, preparadas: number, precio = 10, costo = 6): LineaCierre => ({
  productoId: `p-${nombre}`,
  nombre,
  preparadas,
  sobrantes: 0,
  precioUnitario: precio,
  costoUnitario: costo,
});
const cierre = (fecha: string, lineas: LineaCierre[], extra: Partial<Cierre> = {}): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas,
  montoYape: 0,
  yapePendiente: false,
  gastos: [],
  abreCiclo: false,
  creadoEn: instante,
  actualizadoEn: instante,
  ...extra,
});
const HOY = '2026-10-14';

describe('armarResumenNegocio', () => {
  it('sin cierres: todo vacío y hoy sin cerrar', () => {
    expect(armarResumenNegocio({ cierres: [], productos: [], hoy: HOY })).toEqual({
      meses: [],
      productos: [],
      diasDeLaSemana: null,
      ciclo: null,
      hoy: {
        ventas: 0,
        ventasTexto: 'S/ 0.00',
        gastos: 0,
        gastosTexto: 'S/ 0.00',
        resultado: 0,
        resultadoTexto: 'S/ 0.00',
        cerrado: false,
      },
      // Sprint-17: el aviso de ejemplo vive en la raíz.
      incluyeEjemplo: false,
      diasDeEjemplo: 0,
    });
  });

  it('hoy cerrado trae sus totales; un cierre posterior a hoy no cuenta en nada', () => {
    const ctx: ContextoAnalisis = {
      cierres: [
        cierre(HOY, [linea('Pancita', 10)], { gastos: [{ categoria: 'mercaderia', monto: 30 }] }),
        cierre('2026-10-20', [linea('Pancita', 99)]),
      ],
      productos: [],
      hoy: HOY,
    };
    const r = armarResumenNegocio(ctx);
    const montos = {
      ventas: 100,
      ventasTexto: 'S/ 100.00',
      gastos: 30,
      gastosTexto: 'S/ 30.00',
      resultado: 70,
      resultadoTexto: 'S/ 70.00',
    };
    expect(r.hoy).toEqual({ ...montos, cerrado: true });
    expect(r.meses).toEqual([
      { mes: 'octubre 2026', ...montos, porciones: 10, dias: 1, enCurso: true },
    ]);
    expect(r.productos).toEqual([
      { nombre: 'Pancita', porciones: 10, venta: 100, ventaTexto: 'S/ 100.00' },
    ]);
    expect(r.ciclo).toEqual(montos);
  });

  it('los meses son los últimos 6, del más antiguo al actual, y salta los que no tienen días', () => {
    const fechas = ['2026-03-05', '2026-05-05', '2026-06-05', '2026-08-05', '2026-10-05'];
    const ctx: ContextoAnalisis = {
      cierres: fechas.map(f => cierre(f, [linea('Pan', 1)])),
      productos: [],
      hoy: HOY,
    };
    expect(armarResumenNegocio(ctx).meses.map(m => m.mes)).toEqual([
      'mayo 2026',
      'junio 2026',
      'agosto 2026',
      'octubre 2026',
    ]);
  });

  it('los productos son de los últimos 90 días, de los que más venden a los que menos', () => {
    const ctx: ContextoAnalisis = {
      cierres: [
        cierre('2026-06-01', [linea('Viejo', 50)]),
        cierre('2026-10-01', [linea('Chicha', 3, 2), linea('Rachi', 20, 9)]),
      ],
      productos: [],
      hoy: HOY,
    };
    expect(armarResumenNegocio(ctx).productos).toEqual([
      { nombre: 'Rachi', porciones: 20, venta: 180, ventaTexto: 'S/ 180.00' },
      { nombre: 'Chicha', porciones: 3, venta: 6, ventaTexto: 'S/ 6.00' },
    ]);
  });

  it('el nombre de un producto viaja limpio y de a lo más 30 caracteres', () => {
    const ctx: ContextoAnalisis = {
      cierres: [cierre('2026-10-01', [linea('<b>Anticucho</b> {especial}  ' + 'x'.repeat(60), 5)])],
      productos: [] as Producto[],
      hoy: HOY,
    };
    const [producto] = armarResumenNegocio(ctx).productos;
    expect(producto.nombre.length).toBeLessThanOrEqual(MAX_NOMBRE_PRODUCTO);
    expect(producto.nombre).not.toMatch(/[<>{}]/);
    expect(producto.nombre.startsWith('b Anticucho')).toBe(true);
  });

  it('con muchos productos y meses nunca pasa de 1,500 caracteres: quita primero los que menos venden', () => {
    const lineas = Array.from({ length: 25 }, (_, i) =>
      linea(`Producto numero ${i} con nombre largo`, 1000 - i, 123.45, 100),
    );
    const cierres = [
      '2026-05-05',
      '2026-06-05',
      '2026-07-05',
      '2026-08-05',
      '2026-09-05',
      '2026-10-05',
    ].map(f => cierre(f, lineas, { gastos: [{ categoria: 'mercaderia', monto: 123456.78 }] }));
    const r = armarResumenNegocio({ cierres, productos: [], hoy: HOY });
    expect(JSON.stringify(r).length).toBeLessThanOrEqual(MAX_CARACTERES_RESUMEN);
    expect(r.productos.length).toBeGreaterThanOrEqual(3);
    expect(r.productos.length).toBeLessThan(25);
    expect(r.productos[0].porciones).toBeGreaterThanOrEqual(
      r.productos[r.productos.length - 1].porciones,
    );
  });

  it('las cifras del resumen salen de su forma serializada', () => {
    const ctx: ContextoAnalisis = {
      cierres: [cierre('2026-10-01', [linea('Pan', 7)])],
      productos: [],
      hoy: HOY,
    };
    const cifras = cifrasDelResumen(armarResumenNegocio(ctx));
    expect(cifras).toEqual(expect.arrayContaining(['70', '2026', '7']));
  });

  it('no muta lo que recibe', () => {
    const cierres = [
      cierre('2026-10-01', [linea('Pan', 7)]),
      cierre('2026-10-20', [linea('Pan', 1)]),
    ];
    const copia = JSON.stringify(cierres);
    armarResumenNegocio({ cierres, productos: [], hoy: HOY });
    expect(JSON.stringify(cierres)).toBe(copia);
  });
});
