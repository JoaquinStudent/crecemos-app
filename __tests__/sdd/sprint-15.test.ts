/**
 * @jest-environment node
 *
 * Tests del Sprint-15. Generados desde sdd/spec/Sprint-15-graficos/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * Funciones puras: periodo, gráficos, inteligencia de negocio, texto y documento del reporte.
 * "Hoy" siempre entra como parámetro: el reloj no decide nada. Los escenarios con la app montada
 * (e15 a e18) están en sprint-15-pantalla.test.tsx.
 */

/// <reference types="node" />
import { htmlReporte } from '@analisis/htmlReporte';
import { porcionesTorta, productosDelPeriodo, textoPorcentaje, textoPorcion, ultimosDias } from '@analisis/graficos';
import type { ProductoPeriodo } from '@analisis/graficos';
import {
  inteligenciaDelNegocio,
  lineasTextoInteligencia,
  ultimosMeses,
} from '@analisis/inteligencia';
import { cuotaReferencia, SIN_CUOTA_MES } from '@analisis/pasaporte';
import {
  fechaDeCorte,
  mesesConCierres,
  periodoDe,
  puedeEmitirReporte,
  senalesDelPeriodo,
  type FiltroPeriodo,
} from '@analisis/periodo';
import { mejorDiaDeLaSemana, peorDiaDeLaSemana, DIAS_PLURAL } from '@analisis/reglas';
import { datosDelReporte } from '@analisis/reporteDelPeriodo';
import {
  cierresDelReporte,
  senalesBanco,
  textoReporte,
} from '@analisis/senales';
import { diaSemana, restarDias } from '@dominio/fecha';
import { redondearSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, Origen, Perfil, Producto } from '@dominio/tipos';

const HOY: FechaNegocio = '2026-10-15';
const INSTANTE = '2026-10-15T12:00:00-05:00';

// --- Datos: cierres armados a mano, con la fecha explícita ---------------------------------------

const CATALOGO = {
  anticucho: { id: 'p-anticucho', nombre: 'Anticucho', precio: 10, costo: 8 },
  pancita: { id: 'p-pancita', nombre: 'Pancita', precio: 9, costo: 7 },
  rachi: { id: 'p-rachi', nombre: 'Rachi', precio: 9, costo: 7.6 },
  chicha: { id: 'p-chicha', nombre: 'Chicha', precio: 2, costo: 1.6 },
} as const;
type Clave = keyof typeof CATALOGO;

/** Un día con las unidades vendidas de cada producto (sin sobrantes) y, si hay, un gasto. */
const dia = (
  fecha: FechaNegocio,
  unidades: Partial<Record<Clave, number>>,
  gasto = 0,
  origen?: Origen,
): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: (Object.keys(unidades) as Clave[]).map(clave => ({
    productoId: CATALOGO[clave].id,
    nombre: CATALOGO[clave].nombre,
    preparadas: unidades[clave] ?? 0,
    sobrantes: 0,
    precioUnitario: CATALOGO[clave].precio,
    costoUnitario: CATALOGO[clave].costo,
  })),
  montoYape: 0,
  yapePendiente: false,
  gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
  abreCiclo: false,
  creadoEn: INSTANTE,
  actualizadoEn: INSTANTE,
  ...(origen ? { origen } : {}),
});

/** Un día de solo anticucho (S/ 10 la unidad) con esa `venta` en soles. */
const venta = (fecha: FechaNegocio, soles: number, gasto = 0, origen?: Origen): Cierre =>
  dia(fecha, { anticucho: soles / 10 }, gasto, origen);

const fechas = (cierres: Cierre[]): FechaNegocio[] => cierres.map(c => c.fecha);

const FREDDY: Perfil = {
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  aceptaYape: true,
  yapeAjeno: true,
  yapeNumero: '987654321',
  yapeTitular: 'Rosa Quispe',
  yapeParentesco: 'hermana',
  ubicacion: 'Av. Los Olivos 123',
  actualizadoEn: INSTANTE,
};

const TODO: FiltroPeriodo = { tipo: 'todo' };
const mes = (m: string): FiltroPeriodo => ({ tipo: 'mes', mes: m });

const CATALOGO_PRODUCTOS: Producto[] = Object.values(CATALOGO).map(p => ({
  id: p.id,
  nombre: p.nombre,
  unidad: 'porción',
  precioVenta: p.precio,
  costoUnitario: p.costo,
  actualizadoEn: '2026-01-01',
  activo: true,
}));

/** Todo el camino que sigue la pantalla Mi reporte, para probarlo sin pantalla. */
const armar = (
  todos: Cierre[],
  filtro: FiltroPeriodo = TODO,
  perfil: Perfil = FREDDY,
  hoy: FechaNegocio = HOY,
) => {
  const datos = datosDelReporte(todos, filtro, CATALOGO_PRODUCTOS, hoy);
  return {
    ...datos,
    texto: textoReporte(datos.senales, perfil, hoy, datos.extra),
    html: htmlReporte(datos.senales, perfil, hoy, datos.extra),
  };
};

/** Un historial largo: un cierre cada dos días del 1 de julio al 14 de octubre, con dos productos. */
const historialLargo = (): Cierre[] => {
  const cierres: Cierre[] = [];
  let f = '2026-07-01';
  for (let n = 0; f <= '2026-10-14'; n += 1) {
    cierres.push(dia(f, { anticucho: 8 + ((n * 7) % 13), pancita: 10 + ((n * 5) % 9) }, 40 + (n % 4) * 10));
    f = restarDias(f, -2);
  }
  return cierres;
};

describe('Sprint-15 · periodo, gráficos, inteligencia y reporte', () => {
  // @spec15_e1 — Los periodos rápidos
  it('spec15_e1 los periodos rapidos todo este mes mes pasado y ultimos 30 dias con sus bordes', () => {
    const cierres = [
      venta('2026-08-10', 100),
      venta('2026-09-05', 100),
      venta('2026-09-30', 100),
      venta('2026-10-01', 100),
      venta('2026-10-15', 100),
      venta('2026-10-20', 100), // posterior a hoy
    ];

    const todo = periodoDe({ tipo: 'todo' }, HOY, cierres);
    expect(todo.desde).toBe('2026-08-10');
    expect(todo.hasta).toBe(HOY);
    expect(fechas(todo.cierres)).toEqual([
      '2026-08-10',
      '2026-09-05',
      '2026-09-30',
      '2026-10-01',
      '2026-10-15',
    ]);
    expect(todo.etiqueta).toBe('Todo tu historial');
    expect(todo.enCurso).toBe(true);

    const este = periodoDe({ tipo: 'esteMes' }, HOY, cierres);
    expect([este.desde, este.hasta]).toEqual(['2026-10-01', '2026-10-15']);
    expect(fechas(este.cierres)).toEqual(['2026-10-01', '2026-10-15']);
    expect(este.etiqueta).toBe('Octubre 2026 (en curso)');
    expect(este.enCurso).toBe(true);

    const pasado = periodoDe({ tipo: 'mesPasado' }, HOY, cierres);
    expect([pasado.desde, pasado.hasta]).toEqual(['2026-09-01', '2026-09-30']);
    expect(fechas(pasado.cierres)).toEqual(['2026-09-05', '2026-09-30']);
    expect(pasado.etiqueta).toBe('Septiembre 2026');
    expect(pasado.enCurso).toBe(false);

    const treinta = periodoDe({ tipo: 'ultimos30' }, HOY, cierres);
    expect([treinta.desde, treinta.hasta]).toEqual(['2026-09-16', HOY]);
    expect(fechas(treinta.cierres)).toEqual(['2026-09-30', '2026-10-01', '2026-10-15']);
    expect(treinta.etiqueta).toBe('Del 16 de septiembre al 15 de octubre');

    // Bordes: 1 de enero (el mes pasado es diciembre del año anterior).
    const enero = [venta('2026-12-31', 100), venta('2027-01-01', 100)];
    const unoEnero = '2027-01-01';
    const eneroPasado = periodoDe({ tipo: 'mesPasado' }, unoEnero, enero);
    expect([eneroPasado.desde, eneroPasado.hasta]).toEqual(['2026-12-01', '2026-12-31']);
    expect(fechas(eneroPasado.cierres)).toEqual(['2026-12-31']);
    expect(eneroPasado.etiqueta).toBe('Diciembre 2026');
    const eneroEste = periodoDe({ tipo: 'esteMes' }, unoEnero, enero);
    expect([eneroEste.desde, eneroEste.hasta]).toEqual(['2027-01-01', '2027-01-01']);
    expect(fechas(eneroEste.cierres)).toEqual(['2027-01-01']);
    expect(eneroEste.etiqueta).toBe('Enero 2027 (en curso)');
    const eneroTreinta = periodoDe({ tipo: 'ultimos30' }, unoEnero, enero);
    expect(eneroTreinta.desde).toBe('2026-12-03');
    expect(eneroTreinta.etiqueta).toBe('Del 3 de diciembre de 2026 al 1 de enero de 2027');

    // Febrero de 29 y de 28 días.
    const bisiesto = periodoDe({ tipo: 'mesPasado' }, '2028-03-01', []);
    expect([bisiesto.desde, bisiesto.hasta]).toEqual(['2028-02-01', '2028-02-29']);
    expect(bisiesto.etiqueta).toBe('Febrero 2028');
    const comun = periodoDe({ tipo: 'mesPasado' }, '2027-03-10', []);
    expect([comun.desde, comun.hasta]).toEqual(['2027-02-01', '2027-02-28']);

    // Sin cierres: no lanza y "todo" no tiene desde.
    const vacio = periodoDe({ tipo: 'todo' }, HOY, []);
    expect(vacio.desde).toBeNull();
    expect(vacio.hasta).toBe(HOY);
    expect(vacio.cierres).toEqual([]);
    expect(vacio.etiqueta).toBe('Todo tu historial');

    // Un solo cierre.
    const uno = periodoDe({ tipo: 'todo' }, HOY, [venta('2026-10-03', 50)]);
    expect([uno.desde, uno.hasta]).toEqual(['2026-10-03', HOY]);
    expect(uno.cierres).toHaveLength(1);
  });

  // @spec15_e2 — Un mes, un rango y la lista de meses
  it('spec15_e2 elegir un mes un rango de meses y la lista de meses con cierres', () => {
    const cierres = [
      venta('2026-08-03', 100),
      venta('2026-08-31', 100),
      venta('2026-09-15', 100),
      venta('2026-10-02', 100),
      venta('2026-10-15', 100),
      venta('2026-11-02', 100), // futuro
    ];

    const agosto = periodoDe(mes('2026-08'), HOY, cierres);
    expect([agosto.desde, agosto.hasta]).toEqual(['2026-08-01', '2026-08-31']);
    expect(fechas(agosto.cierres)).toEqual(['2026-08-03', '2026-08-31']);
    expect(agosto.etiqueta).toBe('Agosto 2026');
    expect(agosto.enCurso).toBe(false);

    const octubre = periodoDe(mes('2026-10'), HOY, cierres);
    expect([octubre.desde, octubre.hasta]).toEqual(['2026-10-01', HOY]);
    expect(octubre.etiqueta).toBe('Octubre 2026 (en curso)');
    expect(octubre.enCurso).toBe(true);

    const noviembre = periodoDe(mes('2026-11'), HOY, cierres);
    expect(noviembre.cierres).toEqual([]);

    const hastaHoy = periodoDe({ tipo: 'rango', desde: '2026-08', hasta: '2026-10' }, HOY, cierres);
    expect([hastaHoy.desde, hastaHoy.hasta]).toEqual(['2026-08-01', HOY]);
    expect(hastaHoy.etiqueta).toBe('Del 1 de agosto al 15 de octubre');
    expect(fechas(hastaHoy.cierres)).toHaveLength(5);

    const hastaSeptiembre = periodoDe(
      { tipo: 'rango', desde: '2026-08', hasta: '2026-09' },
      HOY,
      cierres,
    );
    expect(hastaSeptiembre.hasta).toBe('2026-09-30');
    expect(hastaSeptiembre.etiqueta).toBe('Del 1 de agosto al 30 de septiembre');
    expect(fechas(hastaSeptiembre.cierres)).toEqual(['2026-08-03', '2026-08-31', '2026-09-15']);

    const invertido = periodoDe({ tipo: 'rango', desde: '2026-09', hasta: '2026-08' }, HOY, cierres);
    expect(invertido.desde).toBe(hastaSeptiembre.desde);
    expect(invertido.hasta).toBe(hastaSeptiembre.hasta);
    expect(invertido.etiqueta).toBe(hastaSeptiembre.etiqueta);

    const unMes = periodoDe({ tipo: 'rango', desde: '2026-08', hasta: '2026-08' }, HOY, cierres);
    expect(unMes.etiqueta).toBe('Agosto 2026');
    expect(fechas(unMes.cierres)).toEqual(fechas(agosto.cierres));

    const otroAnio = periodoDe({ tipo: 'rango', desde: '2025-11', hasta: '2026-02' }, HOY, [
      venta('2025-11-30', 100),
      venta('2026-02-28', 100),
      venta('2026-03-01', 100),
    ]);
    expect([otroAnio.desde, otroAnio.hasta]).toEqual(['2025-11-01', '2026-02-28']);
    expect(otroAnio.etiqueta).toBe('Del 1 de noviembre de 2025 al 28 de febrero de 2026');
    expect(otroAnio.cierres).toHaveLength(2);

    expect(mesesConCierres(cierres, HOY)).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(mesesConCierres([], HOY)).toEqual([]);
  });

  // @spec15_e3 — Torta: 5 porciones que suman 100
  it('spec15_e3 las ventas por producto se agrupan en 5 porciones que suman 100', () => {
    const prod = (nombre: string, soles: number): ProductoPeriodo => ({
      productoId: `p-${nombre}`,
      nombre,
      porciones: 1,
      venta: soles,
    });
    const suma = (t: { porcentaje: number }[]) => t.reduce((s, p) => s + p.porcentaje, 0);

    const seis = porcionesTorta([
      prod('A', 400),
      prod('B', 300),
      prod('C', 150),
      prod('D', 80),
      prod('E', 50),
      prod('F', 20),
    ]);
    expect(seis.map(p => p.nombre)).toEqual(['A', 'B', 'C', 'D', 'Otros']);
    expect(seis.map(p => p.porcentaje)).toEqual([40, 30, 15, 8, 7]);
    expect(seis[4]).toMatchObject({ esOtros: true, venta: 70, cantidad: 2, productoId: null });
    expect(suma(seis)).toBe(100);

    const iguales = porcionesTorta([prod('A', 100), prod('B', 100), prod('C', 100)]);
    expect(iguales.map(p => p.porcentaje)).toEqual([34, 33, 33]);

    const cinco = porcionesTorta([
      prod('A', 50),
      prod('B', 20),
      prod('C', 15),
      prod('D', 10),
      prod('E', 5),
    ]);
    expect(cinco).toHaveLength(5);
    expect(cinco.some(p => p.esOtros)).toBe(false);

    expect(porcionesTorta([prod('Solo', 80)]).map(p => p.porcentaje)).toEqual([100]);

    const diminuta = porcionesTorta([prod('Grande', 1000), prod('Chica', 4)]);
    expect(diminuta.map(p => p.porcentaje)).toEqual([100, 0]);
    expect(textoPorcentaje(0)).toBe('menos de 1 %');
    expect(textoPorcentaje(44)).toBe('44 %');
    expect(suma(diminuta)).toBe(100);

    expect(porcionesTorta([])).toEqual([]);
    expect(porcionesTorta([prod('Cero', 0)])).toEqual([]);

    expect(
      textoPorcion({
        productoId: 'p-pancita',
        nombre: 'Pancita',
        venta: 7254,
        porcentaje: 44,
        esOtros: false,
        cantidad: 1,
      }),
    ).toBe('Pancita, 44 % de lo que vendiste');
    expect(textoPorcion(seis[4])).toBe('Otros (2 productos), 7 % de lo que vendiste');

    // De los cierres: de mayor a menor venta, con el nombre actual del catálogo.
    const catalogo = CATALOGO_PRODUCTOS.map(p =>
      p.id === 'p-pancita' ? { ...p, nombre: 'Pancita especial' } : p,
    );
    const productos = productosDelPeriodo([dia('2026-10-01', { anticucho: 10, pancita: 20 })], catalogo);
    expect(productos).toEqual([
      { productoId: 'p-pancita', nombre: 'Pancita especial', porciones: 20, venta: 180 },
      { productoId: 'p-anticucho', nombre: 'Anticucho', porciones: 10, venta: 100 },
    ]);
  });

  // @spec15_e4 — Barras por mes: últimos 6 y el mes en curso
  it('spec15_e4 las barras por mes muestran los ultimos 6 y rotulan el mes en curso', () => {
    const cierres = [
      venta('2026-03-10', 1000, 300),
      venta('2026-04-10', 500, 100),
      venta('2026-04-20', 700, 200),
      // mayo sin cierres
      venta('2026-06-10', 800, 100),
      venta('2026-07-10', 900, 100),
      venta('2026-08-10', 1000, 100),
      venta('2026-09-10', 1100, 100),
      venta('2026-10-05', 300, 50),
    ];
    const i = inteligenciaDelNegocio(cierres, CATALOGO_PRODUCTOS, HOY);

    expect(i.meses).toHaveLength(8);
    expect(i.meses.map(m => m.mes)).toEqual([
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    const abril = i.meses[1];
    expect(abril).toMatchObject({ venta: 1200, gastos: 300, resultado: 900, dias: 2, enCurso: false });
    expect(abril.etiqueta).toBe('Abril 2026');
    expect(abril.etiquetaCorta).toBe('Abr 2026');

    const mayo = i.meses[2];
    expect(mayo).toMatchObject({ venta: 0, gastos: 0, resultado: 0, dias: 0 });

    const octubre = i.meses[7];
    expect(octubre).toMatchObject({ venta: 300, gastos: 50, resultado: 250, dias: 1, enCurso: true });
    expect(octubre.etiqueta).toBe('Octubre 2026 (en curso)');
    expect(i.meses.filter(m => m.enCurso)).toHaveLength(1);

    const barras = ultimosMeses(i.meses, 6);
    expect(barras.map(m => m.mes)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);

    const corto = inteligenciaDelNegocio(
      [venta('2026-09-10', 100), venta('2026-10-05', 50)],
      CATALOGO_PRODUCTOS,
      HOY,
    );
    expect(ultimosMeses(corto.meses, 6).map(m => m.mes)).toEqual(['2026-09', '2026-10']);
  });

  // @spec15_e5 — Últimos días con huecos
  it('spec15_e5 los ultimos dias marcan los dias sin cierre como huecos', () => {
    const cierres = [
      venta('2026-10-09', 300),
      venta('2026-10-12', 50, 120),
      venta('2026-10-14', 200, 50),
      venta('2026-10-15', 100),
    ];
    const periodo = periodoDe(TODO, HOY, cierres);

    const siete = ultimosDias(cierres, periodo, 7);
    expect(siete.dias.map(d => d.fecha)).toEqual([
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
    ]);
    expect(siete.dias.map(d => d.resultado)).toEqual([300, null, null, -70, null, 150, 100]);
    expect(siete.dias[0].venta).toBe(300);
    expect(siete.mejor?.fecha).toBe('2026-10-09');
    expect(siete.peor?.fecha).toBe('2026-10-12');

    // Con 14 y con 30 no empieza antes del primer día del periodo.
    expect(ultimosDias(cierres, periodo, 14).dias).toHaveLength(7);
    expect(ultimosDias(cierres, periodo, 30).dias[0].fecha).toBe('2026-10-09');

    // La ventana termina en el último día del periodo.
    const septiembre = periodoDe(mes('2026-09'), HOY, [
      venta('2026-09-26', 100),
      venta('2026-09-30', 100),
      venta('2026-10-02', 100),
    ]);
    const deSeptiembre = ultimosDias(septiembre.cierres, septiembre, 7);
    expect(deSeptiembre.dias).toHaveLength(7);
    expect(deSeptiembre.dias[0].fecha).toBe('2026-09-24');
    expect(deSeptiembre.dias[6].fecha).toBe('2026-09-30');

    // Un día de resultado 0 no es un hueco.
    const cero = [venta('2026-10-13', 100, 100), venta('2026-10-15', 100)];
    const conCero = ultimosDias(cero, periodoDe(TODO, HOY, cero), 7);
    expect(conCero.dias.map(d => d.resultado)).toEqual([0, null, 100]);

    // Sin cierres no hay nada.
    const vacio = ultimosDias([], periodoDe(TODO, HOY, []), 7);
    expect(vacio).toEqual({ dias: [], mejor: null, peor: null });
  });

  // @spec15_e6 — El reporte se emite con 1 cierre y sin meses completos
  it('spec15_e6 el reporte se puede emitir con 1 cierre y sin meses completos', () => {
    const uno = [venta(HOY, 200, 50)];
    const r = armar(uno);

    expect(puedeEmitirReporte(r.periodo)).toBe(true);
    expect(puedeEmitirReporte(periodoDe(TODO, HOY, []))).toBe(false);
    expect(r.senales.mesesCompletos).toBe(0);
    expect(r.senales.enConstruccion).toBe(true);
    expect(r.inteligencia).toMatchObject({ hayDatos: true, dias: 1, venta: 200, gastos: 50, resultado: 150 });

    expect(r.texto.startsWith('Reporte de actividad del negocio')).toBe(true);
    expect(r.texto).toContain('S/ 200.00');
    expect(r.texto).toContain('S/ 150.00');
    expect(r.texto).toContain('Te falta');
    expect(r.html).toContain('Ventas, gastos y resultado registrado por mes');
    expect(r.html).toContain('S/ 200.00');
    expect(r.html).toContain('Te faltan 29 días de registro');
  });

  // @spec15_e7 — La cuota del banco sigue exigiendo meses completos
  it('spec15_e7 la cuota del banco sigue exigiendo meses completos', () => {
    // Un solo mes en curso.
    const enCurso = [venta('2026-10-02', 1000, 200), venta('2026-10-09', 1000, 200)];
    const sinMes = armar(enCurso);
    expect(cuotaReferencia(sinMes.senales)).toEqual({ disponible: false, motivo: 'sinMes' });
    expect(sinMes.texto).toContain(SIN_CUOTA_MES);
    expect(sinMes.html).toContain(SIN_CUOTA_MES);

    // El mismo registro filtrado en "este mes": el mes en curso nunca cuenta.
    const esteMes = armar(enCurso, { tipo: 'esteMes' });
    expect(esteMes.senales.mesesCompletos).toBe(0);
    expect(cuotaReferencia(esteMes.senales).disponible).toBe(false);

    // Septiembre completo, elegido como mes: ya terminó, cuenta.
    const septiembre = [
      venta('2026-09-02', 1000, 400),
      venta('2026-09-09', 1000, 400),
      venta('2026-09-16', 1000, 400),
      venta('2026-09-23', 1000, 400),
      ...enCurso,
    ];
    const completo = armar(septiembre, mes('2026-09'));
    expect(completo.senales.mesesCompletos).toBe(1);
    const cuota = cuotaReferencia(completo.senales);
    expect(cuota.disponible).toBe(true);
    expect(completo.texto).not.toContain(SIN_CUOTA_MES);

    // Lo de siempre no cambió: sin el periodo, las señales son las del banco.
    expect(cuotaReferencia(senalesBanco(enCurso, HOY))).toEqual({
      disponible: false,
      motivo: 'sinMes',
    });
  });

  // @spec15_e8 — El reporte respeta el filtro
  it('spec15_e8 el reporte respeta el filtro de periodo', () => {
    const cierres = [
      dia('2026-08-05', { rachi: 30 }), // Rachi solo se vendió en agosto: S/ 270
      venta('2026-08-20', 100), // agosto: S/ 370
      dia('2026-09-05', { pancita: 20 }, 40), // S/ 180
      dia('2026-09-12', { anticucho: 25 }, 60), // S/ 250: septiembre S/ 430
    ];

    const todo = armar(cierres, TODO);
    expect(todo.texto).toContain('Agosto 2026');
    expect(todo.texto).toContain('Producto estrella: Anticucho');
    expect(todo.html).toContain('Rachi');
    expect(todo.html).toContain('Agosto 2026');

    const septiembre = armar(cierres, mes('2026-09'));
    expect(septiembre.periodo.etiqueta).toBe('Septiembre 2026');
    expect(septiembre.texto).toContain('Periodo: Septiembre 2026');
    expect(septiembre.html).toContain('Septiembre 2026');
    for (const salida of [septiembre.texto, septiembre.html]) {
      expect(salida).not.toContain('Rachi');
      expect(salida).not.toContain('Agosto');
      expect(salida).not.toContain('S/ 370.00');
      expect(salida).toContain('S/ 430.00');
    }

    // El mes en curso va rotulado.
    const octubre = armar([venta('2026-10-03', 100)], mes('2026-10'));
    expect(octubre.texto).toContain('Octubre 2026 (en curso)');
    expect(octubre.html).toContain('Octubre 2026 (en curso)');

    // "En construcción" mide todo el registro, no lo angosto del filtro.
    const largo: Cierre[] = [];
    for (let d = 1; d <= 31; d += 1) largo.push(venta(`2026-08-${String(d).padStart(2, '0')}`, 100));
    for (let d = 1; d <= 25; d += 1) largo.push(venta(`2026-09-${String(d).padStart(2, '0')}`, 100));
    const delMes = armar(largo, mes('2026-09'));
    expect(delMes.periodo.cierres).toHaveLength(25);
    expect(delMes.senales.enConstruccion).toBe(false);
    expect(delMes.senales.diasFaltantes).toBe(0);
    expect(delMes.texto).not.toContain('Te falta');
    expect(delMes.html).not.toContain('Te faltan');

    // La fecha de corte de un periodo que terminó es el día siguiente a su fin.
    expect(fechaDeCorte(periodoDe(mes('2026-09'), HOY, largo), HOY)).toBe('2026-10-01');
    expect(fechaDeCorte(periodoDe(TODO, HOY, largo), HOY)).toBe(HOY);
  });

  // @spec15_e9 — Mes más fuerte y más débil
  it('spec15_e9 mes mas fuerte y mes mas debil', () => {
    const cierres = [
      venta('2026-06-10', 1000, 400), // res 600
      venta('2026-07-10', 3000, 500), // res 2500
      venta('2026-08-10', 2000, 800), // res 1200
      venta('2026-09-10', 1500, 100), // res 1400
      venta('2026-10-05', 200), // en curso, el menor de todos
    ];
    const i = inteligenciaDelNegocio(cierres, CATALOGO_PRODUCTOS, HOY);
    expect(i.mesMasFuerte?.mes).toBe('2026-07');
    expect(i.mesMasDebil?.mes).toBe('2026-06');
    expect(i.notaMeses).toBeNull();

    // Con un solo mes terminado no hay con qué comparar.
    const pocos = inteligenciaDelNegocio(
      [venta('2026-09-10', 100), venta('2026-10-05', 50)],
      CATALOGO_PRODUCTOS,
      HOY,
    );
    expect(pocos.mesMasFuerte).toBeNull();
    expect(pocos.mesMasDebil).toBeNull();
    expect(pocos.notaMeses).toBe(
      'Aún no hay dos meses terminados para decir cuál fue el más fuerte y cuál el más débil.',
    );

    // Empate de ventas: gana el de mayor resultado y luego el más reciente; pierde el de menor.
    const empate = inteligenciaDelNegocio(
      [venta('2026-07-10', 1000, 600), venta('2026-08-10', 1000, 300), venta('2026-09-10', 1000, 300)],
      CATALOGO_PRODUCTOS,
      HOY,
    );
    expect(empate.mesMasFuerte?.mes).toBe('2026-09');
    expect(empate.mesMasDebil?.mes).toBe('2026-07');

    // Todo igual: el más fuerte es el más reciente y el más débil, el más antiguo.
    const iguales = inteligenciaDelNegocio(
      [venta('2026-07-10', 1000), venta('2026-08-10', 1000)],
      CATALOGO_PRODUCTOS,
      HOY,
    );
    expect(iguales.mesMasFuerte?.mes).toBe('2026-08');
    expect(iguales.mesMasDebil?.mes).toBe('2026-07');

    // Un mes sin cierres entre dos no es "el más débil".
    const hueco = inteligenciaDelNegocio(
      [venta('2026-06-10', 1000), venta('2026-08-10', 2000)],
      CATALOGO_PRODUCTOS,
      HOY,
    );
    expect(hueco.mesMasDebil?.mes).toBe('2026-06');
  });

  // @spec15_e10 — Comparación entre meses
  it('spec15_e10 la comparacion entre meses dice la diferencia en palabras', () => {
    const cierres = [
      venta('2026-08-10', 1500),
      venta('2026-09-05', 1500),
      venta('2026-09-20', 500),
      venta('2026-10-01', 500),
      venta('2026-10-08', 500),
      venta('2026-10-12', 500),
    ];
    const i = inteligenciaDelNegocio(cierres, CATALOGO_PRODUCTOS, HOY);
    expect(i.comparaciones.map(c => c.frase)).toEqual([
      'Septiembre 2026: el resultado registrado fue S/ 500.00 más que en agosto 2026 (S/ 2,000.00 contra S/ 1,500.00; 2 días cerrados contra 1).',
      'Octubre 2026 (en curso): el resultado registrado fue S/ 500.00 menos que en septiembre 2026 (S/ 1,500.00 contra S/ 2,000.00; 3 días cerrados contra 2).',
    ]);
    expect(i.comparaciones[0]).toMatchObject({ mes: '2026-09', anterior: '2026-08', diferencia: 500 });
    expect(i.comparaciones[1].diferencia).toBe(-500);

    const igual = inteligenciaDelNegocio(
      [venta('2026-07-05', 1000), venta('2026-08-05', 1000)],
      CATALOGO_PRODUCTOS,
      HOY,
    );
    expect(igual.comparaciones.map(c => c.frase)).toEqual([
      'Agosto 2026: el resultado registrado quedó igual que en julio 2026 (S/ 1,000.00; 1 día cerrado contra 1).',
    ]);

    // Un par con un mes sin cierres no se compara.
    const hueco = inteligenciaDelNegocio(
      [venta('2026-06-05', 1000), venta('2026-08-05', 1000)],
      CATALOGO_PRODUCTOS,
      HOY,
    );
    expect(hueco.comparaciones).toEqual([]);

    // Nunca un porcentaje.
    for (const c of [...i.comparaciones, ...igual.comparaciones]) expect(c.frase).not.toContain('%');
  });

  // @spec15_e11 — Promedio por día cerrado, día de la semana y producto estrella
  it('spec15_e11 promedio por dia cerrado dia de la semana y producto estrella', () => {
    // 35 días seguidos: los sábados venden 400; los miércoles, 100; el resto, 200.
    const cierres: Cierre[] = [];
    for (let f = '2026-09-10'; f <= '2026-10-14'; f = restarDias(f, -1)) {
      const d = diaSemana(f);
      cierres.push(venta(f, d === 6 ? 400 : d === 3 ? 100 : 200));
    }
    const i = inteligenciaDelNegocio(cierres, CATALOGO_PRODUCTOS, HOY);
    const ventaTotal = cierres.reduce((s, c) => s + c.lineas[0].preparadas * 10, 0);
    expect(i.dias).toBe(35);
    expect(i.venta).toBe(ventaTotal);
    expect(i.promedioVentaDia).toBe(redondearSoles(ventaTotal / 35));
    expect(i.promedioResultadoDia).toBe(redondearSoles(i.resultado / 35));

    expect(i.diaMasVentas).toMatchObject({ dia: 6, nombre: 'sábados', monto: 400 });
    const ctx = { cierres, productos: CATALOGO_PRODUCTOS, hoy: HOY };
    const mejor = mejorDiaDeLaSemana(ctx);
    const peor = peorDiaDeLaSemana(ctx);
    expect(mejor?.dia).toBe(6);
    expect(i.diaQueMasDeja).toMatchObject({ dia: mejor?.dia, monto: mejor?.diferencia });
    expect(i.diaQueMasDeja?.nombre).toBe(DIAS_PLURAL[mejor?.dia ?? 0]);
    expect(i.diaQueMenosDeja).toMatchObject({ dia: peor?.dia, monto: peor?.diferencia });

    // Con menos de 4 semanas no se inventa.
    const corto = inteligenciaDelNegocio(cierres.slice(0, 10), CATALOGO_PRODUCTOS, HOY);
    expect(corto.diaQueMasDeja).toBeNull();
    expect(corto.diaQueMenosDeja).toBeNull();

    // Producto estrella: el de más venta en soles; su porcentaje es el de la torta.
    const p = inteligenciaDelNegocio(
      [dia('2026-10-01', { pancita: 30, anticucho: 10, chicha: 5 })],
      CATALOGO_PRODUCTOS,
      HOY,
    );
    expect(p.productoEstrella).toMatchObject({ nombre: 'Pancita', venta: 270, porciones: 30 });
    expect(p.torta.map(t => t.porcentaje)).toEqual([71, 26, 3]);
    expect(p.torta[0].nombre).toBe(p.productoEstrella?.nombre);
    expect(p.productos.map(x => x.nombre)).toEqual(['Pancita', 'Anticucho', 'Chicha']);

    // Sin cierres no hay datos.
    const vacio = inteligenciaDelNegocio([], CATALOGO_PRODUCTOS, HOY);
    expect(vacio.hayDatos).toBe(false);
    expect(vacio.productoEstrella).toBeNull();
    expect(vacio.meses).toEqual([]);
  });

  // @spec15_e12 — El documento: secciones, gráficos y nada privado
  it('spec15_e12 el documento lleva las secciones y los graficos y nada privado', () => {
    const cierres = historialLargo();
    const r = armar(cierres);
    const html = r.html;

    // La página 1 de siempre y después las de inteligencia, con salto de página.
    expect(html.split('class="hoja"').length - 1).toBe(1);
    const paginas = html.split('class="pagina"').length - 1;
    expect(paginas).toBeGreaterThanOrEqual(1);
    expect(html).toMatch(/\.pagina\s*\{[^}]*page-break-before:\s*always/);
    expect(html).toMatch(/\.pagina\s*\{[^}]*break-before:\s*page/);
    expect(html).toContain('page-break-inside: avoid');

    for (const titulo of [
      'Ventas, gastos y resultado registrado por mes',
      'Mes más fuerte',
      'Mes más débil',
      'Comparación entre meses',
      'Promedio por día cerrado',
      'Día que más vendes',
      'Producto estrella',
      'Venta por producto',
    ]) {
      expect(html).toContain(titulo);
    }
    // Gráficos SVG en línea.
    expect(html).toContain('aria-label="Barras de ventas y resultado registrado por mes"');
    expect(html).toContain('aria-label="Torta de ventas por producto');
    expect(html.split('<svg').length - 1).toBeGreaterThanOrEqual(3);
    // El periodo y la fecha de generación.
    expect(html).toContain('Todo tu historial');
    expect(html).toContain('Generado el');
    // La tabla de meses trae un mes concreto con su monto.
    expect(html).toContain('Octubre 2026 (en curso)');

    // Sin JavaScript, enlaces ni imágenes externas; los url(#…) son de los patrones.
    const minuscula = html.toLowerCase();
    expect(minuscula).not.toContain('<script');
    expect(html).not.toContain('href');
    expect(html).not.toContain('http');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('<img');
    expect([...html.matchAll(/url\(([^)]*)\)/g)].every(m => m[1].startsWith('#'))).toBe(true);
    // Letras de 11 pt o más, también dentro de los SVG.
    const tamanios = [...html.matchAll(/font-size[:=]\s*"?([\d.]+)/g)].map(m => Number(m[1]));
    expect(tamanios.length).toBeGreaterThan(5);
    expect(Math.min(...tamanios)).toBeGreaterThanOrEqual(11);
    // Etiquetas balanceadas.
    for (const etiqueta of ['div', 'table', 'tr', 'svg', 'tbody', 'thead', 'text']) {
      expect(html.split(`<${etiqueta}`).length).toBe(html.split(`</${etiqueta}>`).length);
    }

    // Privacidad: del perfil, solo nombre y negocio. Ningún cierre suelto con su fecha.
    for (const privado of ['987654321', 'Rosa Quispe', 'hermana', 'Av. Los Olivos', 'Yape']) {
      expect(html).not.toContain(privado);
    }
    expect(html).toContain('Freddy');
    expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(html).not.toContain('17 de agosto');
    expect(r.texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);

    // Sin inteligencia, el documento es el de siempre: una sola hoja y sin salto de página.
    const antes = htmlReporte(r.senales, FREDDY, HOY);
    expect(antes.split('class="hoja"').length - 1).toBe(1);
    expect(antes).not.toContain('class="pagina"');
    expect(antes).not.toMatch(/page-break-(before|after):\s*always/);
  });

  // @spec15_e13 — El documento escapa lo que escribió la persona
  it('spec15_e13 el documento escapa todo lo que escribio la persona', () => {
    const peligroso: Perfil = {
      ...FREDDY,
      nombre: '<script>alert("x")</script> & Cía',
      negocio: 'Mi "negocio" <b>',
    };
    const cierres = historialLargo().map(c => ({
      ...c,
      lineas: c.lineas.map(l => ({
        ...l,
        nombre: l.productoId === 'p-anticucho' ? 'Anti<b>cucho</b> & "Co"' : l.nombre,
      })),
    }));
    // El catálogo vacío: el nombre sale de la línea del cierre.
    const datos = datosDelReporte(cierres, TODO, [], HOY);
    const html = htmlReporte(datos.senales, peligroso, HOY, datos.extra);

    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>cucho');
    expect(html).not.toContain('Mi "negocio"');
    expect(html).toContain('Mi &quot;negocio&quot; &lt;b&gt;');
    expect(html).toContain('Anti&lt;b&gt;cucho&lt;/b&gt; &amp; &quot;Co&quot;');
    expect(html).toContain('&lt;script&gt;');
    // El nombre también va escapado dentro de la etiqueta del gráfico.
    const etiquetas = [...html.matchAll(/aria-label="([^"]*)"/g)].map(m => m[1]);
    expect(etiquetas.some(e => e.includes('Anti&lt;b&gt;cucho'))).toBe(true);
    for (const etiqueta of ['div', 'table', 'tr', 'svg', 'text']) {
      expect(html.split(`<${etiqueta}`).length).toBe(html.split(`</${etiqueta}>`).length);
    }
  });

  // @spec15_e14 — El texto compartido
  it('spec15_e14 el texto compartido refleja el filtro y cabe en 2000 caracteres', () => {
    const r = armar(historialLargo());
    expect(r.texto.startsWith('Reporte de actividad del negocio')).toBe(true);
    expect(r.texto).toContain('Periodo: Todo tu historial');
    for (const parte of [
      'Ventas del periodo: ',
      'Promedio por día cerrado: ',
      'Por mes (ventas · gastos · resultado registrado):',
      'Octubre 2026 (en curso)',
      'Mes más fuerte: ',
      'Mes más débil: ',
      'Comparación: ',
      'Día que más vendes: ',
      'Producto estrella: ',
    ]) {
      expect(r.texto).toContain(parte);
    }
    expect(r.texto.length).toBeLessThanOrEqual(2000);
    for (const privado of ['987654321', 'Rosa Quispe', 'hermana', 'Av. Los Olivos']) {
      expect(r.texto).not.toContain(privado);
    }

    // El filtro: solo septiembre.
    const sept = armar(historialLargo(), mes('2026-09'));
    expect(sept.texto).toContain('Periodo: Septiembre 2026');
    expect(sept.texto).not.toContain('Julio 2026');
    expect(sept.texto).not.toContain('Octubre 2026');

    // 30 meses, nombres de 60 caracteres: sigue en 2,000 y se recortan los meses más viejos.
    const treinta: Cierre[] = [];
    for (let k = 0; k < 30; k += 1) {
      const m = 4 + k; // desde mayo de 2024
      const anio = 2024 + Math.floor(m / 12);
      const numero = (m % 12) + 1;
      treinta.push(venta(`${anio}-${String(numero).padStart(2, '0')}-10`, 1000 + k * 10, 100));
    }
    const largo = armar(treinta, TODO, {
      ...FREDDY,
      nombre: 'N'.repeat(60),
      negocio: 'B'.repeat(60),
    });
    expect(largo.inteligencia.meses.length).toBeGreaterThanOrEqual(30);
    expect(largo.texto.length).toBeLessThanOrEqual(2000);
    expect(largo.texto).toContain('Mes más fuerte: ');
    expect(largo.texto).not.toContain('- Mayo 2024');
    expect(lineasTextoInteligencia(largo.inteligencia, 3).length).toBeLessThan(
      lineasTextoInteligencia(largo.inteligencia, 12).length,
    );

    // Sin la inteligencia, el texto de siempre (sin líneas nuevas).
    expect(textoReporte(r.senales, FREDDY, HOY)).not.toContain('Ventas del periodo');
  });

  // El conjunto del reporte: la regla del Sprint-06 sobre los datos de ejemplo no cambia.
  it('el reporte deja fuera los cierres de ejemplo salvo que sean lo unico que hay', () => {
    const mezcla = [venta('2026-10-02', 100), venta('2026-10-03', 500, 0, 'ejemplo')];
    const r = cierresDelReporte(mezcla);
    expect(fechas(r.cierres)).toEqual(['2026-10-02']);
    expect(r.soloEjemplo).toBe(false);
    const solo = cierresDelReporte([venta('2026-10-03', 500, 0, 'ejemplo')]);
    expect(solo.cierres).toHaveLength(1);
    expect(solo.soloEjemplo).toBe(true);
    expect(cierresDelReporte([])).toEqual({ cierres: [], soloEjemplo: false });

    const armado = armar(mezcla);
    expect(armado.inteligencia.venta).toBe(100);
    expect(armado.soloEjemplo).toBe(false);
    expect(senalesDelPeriodo(r.cierres, armado.periodo, HOY).diasRegistrados).toBe(1);
  });
});
