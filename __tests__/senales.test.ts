/**
 * Pruebas de apoyo de las señales para el banco y del texto del reporte (no son escenarios del
 * SPEC): bordes de la ventana de 90 días, meses completos, umbral de 30 días, privacidad del texto
 * y la semilla real. "Hoy" siempre entra como parámetro: el reloj no decide nada.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { restarDias } from '@dominio/fecha';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { Cierre, FechaNegocio, Perfil, SemillaJSON, Senales } from '@dominio/tipos';
import {
  DIAS_CONVINCENTE,
  DIAS_PRIMER_MES,
  MAX_CARACTERES_REPORTE,
  MESES_MAXIMOS,
  senalesBanco,
  textoReporte,
  VENTANA_DIAS,
} from '@analisis/senales';

const HOY: FechaNegocio = '2026-10-07';
const INSTANTE = '2026-10-07T12:00:00-05:00';

/** Un cierre de un producto a S/ 10.00 la porción y sin sobrantes: venta = vendidas × 10. */
const cierreDe = (fecha: FechaNegocio, vendidas = 20, gasto = 0): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [
    {
      productoId: 'p-anticucho',
      nombre: 'Anticucho',
      preparadas: vendidas,
      sobrantes: 0,
      precioUnitario: 10,
      costoUnitario: 8,
    },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
  abreCiclo: false,
  creadoEn: INSTANTE,
  actualizadoEn: INSTANTE,
});

/** Un cierre por fecha. */
const enFechas = (fechas: FechaNegocio[]): Cierre[] => fechas.map(f => cierreDe(f));

/** `n` fechas seguidas que terminan `desde` días antes de hoy (1 = ayer). */
const seguidas = (n: number, desde = 1): FechaNegocio[] =>
  Array.from({ length: n }, (_, i) => restarDias(HOY, desde + i));

/** Un cierre el 10 de cada uno de los meses dados ('YYYY-MM'), con venta mensual explícita. */
const mensual = (mes: string, venta: number, gasto = 0): Cierre =>
  cierreDe(`${mes}-10`, venta / 10, gasto);

const perfilCompleto: Perfil = {
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  ubicacion: 'Av. Los Olivos 123, Comas',
  fotoUri: 'file:///fotos/freddy.jpg',
  aceptaYape: true,
  yapeAjeno: true,
  yapeNumero: '987654321',
  yapeTitular: 'Marta Quispe',
  yapeParentesco: 'hermana',
  actualizadoEn: INSTANTE,
};

const congelarTodo = <T>(valor: T): T => {
  if (valor !== null && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.freeze(valor);
    Object.values(valor as Record<string, unknown>).forEach(congelarTodo);
  }
  return valor;
};

describe('constantes', () => {
  it('traen los valores acordados', () => {
    expect(VENTANA_DIAS).toBe(90);
    expect(MESES_MAXIMOS).toBe(3);
    expect(DIAS_PRIMER_MES).toBe(7);
    expect(DIAS_CONVINCENTE).toBe(30);
    expect(MAX_CARACTERES_REPORTE).toBe(2000);
  });
});

describe('senalesBanco · ventana de 90 días y constancia', () => {
  it('el día 89 atrás entra y el 90 atrás no', () => {
    const s = senalesBanco(enFechas([restarDias(HOY, 89), restarDias(HOY, 90)]), HOY);
    expect(s.diasRegistrados).toBe(1);
    expect(s.primerCierre).toBe(restarDias(HOY, 89));
    expect(s.registraDesde).toBe(restarDias(HOY, 90));
    expect(s.antiguedadDias).toBe(90);
    expect(s.diasTranscurridos).toBe(90);
    expect(s.constancia).toBe(1); // round(100 × 1 ÷ 90)
  });

  it('hoy cuenta; un cierre fechado mañana no', () => {
    const s = senalesBanco(enFechas([HOY, restarDias(HOY, -1)]), HOY);
    expect(s.diasRegistrados).toBe(1);
    expect(s.ultimoCierre).toBe(HOY);
    expect(s.registraDesde).toBe(HOY);
  });

  it('los cierres del mismo día cuentan una sola vez', () => {
    const cierres = [
      cierreDe('2026-10-05'),
      cierreDe('2026-10-05', 30),
      cierreDe('2026-10-05', 40),
    ];
    const s = senalesBanco(cierres, HOY);
    expect(s.diasRegistrados).toBe(1);
  });

  it('con el registro más nuevo que 90 días, los días transcurridos van desde el primer cierre (inclusive)', () => {
    // Primer cierre hace 9 días → 10 días transcurridos contando hoy; 5 días registrados.
    const s = senalesBanco(
      enFechas(['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-04', '2026-10-06']),
      HOY,
    );
    expect(s.diasTranscurridos).toBe(10);
    expect(s.diasRegistrados).toBe(5);
    expect(s.constancia).toBe(50);
  });

  it('un registro que empezó hoy tiene constancia 100', () => {
    const s = senalesBanco(enFechas([HOY]), HOY);
    expect(s.diasTranscurridos).toBe(1);
    expect(s.constancia).toBe(100);
  });

  it('un día registrado cada día de la ventana da 100 y 90 días registrados', () => {
    const s = senalesBanco(enFechas(seguidas(90, 0)), HOY);
    expect(s.diasRegistrados).toBe(90);
    expect(s.constancia).toBe(100);
  });

  it('con registro de más de 90 días, el denominador sigue en 90', () => {
    const s = senalesBanco(enFechas([restarDias(HOY, 200), ...seguidas(45)]), HOY);
    expect(s.diasTranscurridos).toBe(90);
    expect(s.diasRegistrados).toBe(45);
    expect(s.constancia).toBe(50);
    expect(s.antiguedadDias).toBe(200);
  });

  it('primer y último cierre son los de la ventana, aunque haya otros más viejos', () => {
    const s = senalesBanco(enFechas(['2026-03-01', '2026-08-01', '2026-09-15', '2026-10-06']), HOY);
    expect(s.primerCierre).toBe('2026-08-01');
    expect(s.ultimoCierre).toBe('2026-10-06');
    expect(s.registraDesde).toBe('2026-03-01');
  });

  it('sin ningún cierre: todo en 0, sin lanzar', () => {
    const s = senalesBanco([], HOY);
    expect(s).toEqual({
      constancia: 0,
      diasRegistrados: 0,
      diasTranscurridos: 0,
      ventaPromedioMensual: 0,
      gananciaPromedioMensual: 0,
      meses: [],
      mesesCompletos: 0,
      primerCierre: undefined,
      ultimoCierre: undefined,
      registraDesde: undefined,
      antiguedadDias: 0,
      enConstruccion: true,
      diasFaltantes: 30,
    });
  });

  it('solo cierres más viejos que la ventana: 0 días registrados y constancia 0', () => {
    const s = senalesBanco(enFechas(['2026-03-01', '2026-03-02']), HOY);
    expect(s.diasRegistrados).toBe(0);
    expect(s.constancia).toBe(0);
    expect(s.primerCierre).toBeUndefined();
    expect(s.registraDesde).toBe('2026-03-01');
  });
});

describe('senalesBanco · umbral de "convincente"', () => {
  it.each([
    [0, true, 30],
    [9, true, 21],
    [29, true, 1],
    [30, false, 0],
    [45, false, 0],
  ])('%i días registrados → enConstruccion %s y faltan %i', (dias, enConstruccion, faltan) => {
    const s = senalesBanco(enFechas(seguidas(dias)), HOY);
    expect(s.diasRegistrados).toBe(dias);
    expect(s.enConstruccion).toBe(enConstruccion);
    expect(s.diasFaltantes).toBe(faltan);
  });
});

describe('senalesBanco · meses completos y promedios', () => {
  it('el mes en curso no cuenta', () => {
    const s = senalesBanco(
      [cierreDe('2026-08-02', 100), mensual('2026-09', 3000), mensual('2026-10', 9000)],
      HOY,
    );
    expect(s.meses.map(m => m.mes)).toEqual(['2026-08', '2026-09']);
    expect(s.ventaPromedioMensual).toBe(2000); // (1,000 + 3,000) ÷ 2: los 9,000 de octubre no entran
  });

  it('solo cierres del mes en curso: sin mes completo, promedios en 0', () => {
    const s = senalesBanco(enFechas(['2026-10-01', '2026-10-03']), HOY);
    expect(s.mesesCompletos).toBe(0);
    expect(s.meses).toEqual([]);
    expect(s.ventaPromedioMensual).toBe(0);
    expect(s.gananciaPromedioMensual).toBe(0);
  });

  it('un primer mes que empieza el día 9 es parcial y no baja el promedio', () => {
    const s = senalesBanco(
      [cierreDe('2026-07-09', 20), mensual('2026-08', 5000), mensual('2026-09', 5200)],
      HOY,
    );
    expect(s.meses.map(m => m.mes)).toEqual(['2026-08', '2026-09']);
    expect(s.mesesCompletos).toBe(2);
    expect(s.ventaPromedioMensual).toBe(5100);
  });

  it('un primer mes que empieza el día 7 cuenta; el día 8 no', () => {
    const base = [mensual('2026-08', 5000), mensual('2026-09', 5000)];
    const conDia7 = senalesBanco([cierreDe('2026-07-07', 500), ...base], HOY);
    expect(conDia7.meses.map(m => m.mes)).toEqual(['2026-07', '2026-08', '2026-09']);
    const conDia8 = senalesBanco([cierreDe('2026-07-08', 500), ...base], HOY);
    expect(conDia8.meses.map(m => m.mes)).toEqual(['2026-08', '2026-09']);
  });

  it('el mes siguiente al primero cuenta aunque el primer cierre sea tardío', () => {
    const s = senalesBanco([cierreDe('2026-08-28', 100), mensual('2026-09', 4000)], HOY);
    expect(s.meses.map(m => m.mes)).toEqual(['2026-09']);
  });

  it('con 5 meses completos toma los 3 últimos', () => {
    const cierres = [
      cierreDe('2026-04-02', 100), // primer cierre en los primeros 7 días
      mensual('2026-05', 1000),
      mensual('2026-06', 2000),
      mensual('2026-07', 3000),
      mensual('2026-08', 4000),
      mensual('2026-09', 5000),
    ];
    const s = senalesBanco(cierres, HOY);
    expect(s.meses.map(m => m.mes)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(s.mesesCompletos).toBe(3);
    expect(s.ventaPromedioMensual).toBe(4000);
  });

  it('un mes sin cierres entre dos con cierres cuenta como mes completo con venta 0', () => {
    const s = senalesBanco([cierreDe('2026-07-03', 100), mensual('2026-09', 3000)], HOY);
    const agosto = s.meses.find(m => m.mes === '2026-08');
    expect(agosto).toEqual({ mes: '2026-08', venta: 0, teQueda: 0, dias: 0 });
  });

  it('cuenta los días distintos de cada mes', () => {
    const cierres = [
      cierreDe('2026-08-03'),
      cierreDe('2026-08-03', 5),
      cierreDe('2026-08-04'),
      cierreDe('2026-09-01'),
    ];
    const s = senalesBanco(cierres, HOY);
    expect(s.meses.map(m => [m.mes, m.dias])).toEqual([
      ['2026-08', 2],
      ['2026-09', 1],
    ]);
  });

  it('la ganancia promedio es el "te queda" (venta − gastos), no el margen; admite meses en negativo', () => {
    const s = senalesBanco(
      [
        cierreDe('2026-08-02', 100, 400), // venta 1,000, gastos 400 → te queda 600
        cierreDe('2026-09-02', 100, 1200), // venta 1,000, gastos 1,200 → te queda −200
      ],
      HOY,
    );
    expect(s.meses.map(m => m.teQueda)).toEqual([600, -200]);
    expect(s.gananciaPromedioMensual).toBe(200);
  });

  it('redondea los promedios a dos decimales', () => {
    const una = (fecha: string, centimos: number): Cierre => ({
      ...cierreDe(fecha, 1),
      lineas: [{ ...cierreDe(fecha, 1).lineas[0], precioUnitario: centimos / 100 }],
    });
    const s = senalesBanco(
      [una('2026-07-02', 10001), una('2026-08-02', 10002), una('2026-09-02', 10002)],
      HOY,
    );
    expect(s.ventaPromedioMensual).toBe(100.02); // 100.0166… → 100.02
  });

  it('los meses cruzan el cambio de año', () => {
    const s = senalesBanco(
      [cierreDe('2026-10-02', 100), mensual('2026-11', 2000), mensual('2026-12', 4000)],
      '2027-01-10',
    );
    expect(s.meses.map(m => m.mes)).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('los meses salen en orden cronológico aunque los cierres lleguen desordenados', () => {
    const s = senalesBanco(
      [mensual('2026-09', 5000), cierreDe('2026-07-03', 100), mensual('2026-08', 4000)],
      HOY,
    );
    expect(s.meses.map(m => m.mes)).toEqual(['2026-07', '2026-08', '2026-09']);
  });
});

describe('senalesBanco · no muta la entrada', () => {
  it('con cierres congelados no lanza ni los cambia', () => {
    const cierres = congelarTodo([
      cierreDe('2026-07-03', 100, 300),
      cierreDe('2026-08-10', 200, 300),
      cierreDe('2026-09-10', 300, 300),
      cierreDe('2026-10-06'),
    ]);
    const antes = JSON.stringify(cierres);
    expect(() => senalesBanco(cierres, HOY)).not.toThrow();
    expect(JSON.stringify(cierres)).toBe(antes);
  });
});

describe('textoReporte', () => {
  const senalesDeTresMeses = () =>
    senalesBanco(
      [
        cierreDe('2026-07-03', 245, 1000),
        cierreDe('2026-07-17', 245, 1800),
        cierreDe('2026-08-05', 310, 1500),
        cierreDe('2026-08-19', 200, 1400),
        cierreDe('2026-09-08', 286, 1500),
        cierreDe('2026-09-22', 250, 1620),
        ...enFechas(seguidas(35)),
      ],
      HOY,
    );

  it('empieza exactamente con el título y trae las líneas en orden', () => {
    const texto = textoReporte(senalesDeTresMeses(), perfilCompleto);
    expect(texto.startsWith('Reporte de actividad del negocio')).toBe(true);
    const orden = [
      'Reporte de actividad del negocio',
      'Freddy · Anticuchos Freddy',
      'Periodo:',
      'Venta promedio mensual: S/ ',
      'Resultado registrado promedio mensual (ventas menos gastos): S/ ',
      'Constancia de registro: ',
      'Días registrados por mes',
      'Registra desde el 3 de julio',
      'Son totales registrados por el propio negocio en la app Crecemos; incluyen pagos pendientes de recibir y no incluyen movimientos individuales.',
    ].map(trozo => texto.indexOf(trozo));
    expect(orden.every(i => i >= 0)).toBe(true);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
  });

  it('la constancia lleva siempre su cifra de días al lado', () => {
    const s = senalesBanco(enFechas([restarDias(HOY, 89), ...seguidas(57)]), HOY);
    expect(textoReporte(s, null)).toContain(
      'Constancia de registro: 64 % de los últimos 90 días (58 días registrados)',
    );
  });

  it('con registro más nuevo que 90 días la constancia dice sobre cuántos días se calculó', () => {
    const s = senalesBanco(
      enFechas(['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-04', '2026-10-06']),
      HOY,
    );
    expect(textoReporte(s, null)).toContain(
      'Constancia de registro: 50 % de los 10 días desde su primer cierre (5 días registrados)',
    );
  });

  it('con un solo día registrado usa el singular', () => {
    const s = senalesBanco(enFechas([HOY]), HOY);
    const texto = textoReporte(s, null);
    expect(texto).toContain(
      'Constancia de registro: 100 % de los 1 día desde su primer cierre (1 día registrado)',
    );
    expect(texto).toContain('Te faltan 29 días de registro para que tu reporte sea convincente');
  });

  it('lista los días registrados por mes y el periodo en palabras', () => {
    const texto = textoReporte(
      senalesBanco(
        [
          cierreDe('2026-07-03'),
          cierreDe('2026-08-03'),
          cierreDe('2026-08-04'),
          cierreDe('2026-10-06'),
        ],
        HOY,
      ),
      null,
    );
    expect(texto).toContain('julio: 1 día');
    expect(texto).toContain('agosto: 2 días');
    // El periodo es la ventana de 90 días (el cierre del 3 de julio queda fuera); la antigüedad, todo el registro.
    expect(texto).toContain('Periodo: del 3 de agosto al 6 de octubre · 3 días registrados');
    expect(texto).toContain('Registra desde el 3 de julio (96 días)');
  });

  it('cada parte de la identificación va solo si no está vacía', () => {
    const s = senalesDeTresMeses();
    const con = (nombre: string, negocio: string) =>
      textoReporte(s, { ...perfilCompleto, nombre, negocio }).split('\n')[1];
    expect(con('Freddy', 'Anticuchos Freddy')).toBe('Freddy · Anticuchos Freddy');
    expect(con('Freddy', '  ')).toBe('Freddy');
    expect(con('', 'Anticuchos Freddy')).toBe('Anticuchos Freddy');
    expect(con(' ', '')).toMatch(/^Periodo:/);
    expect(textoReporte(s, null).split('\n')[1]).toMatch(/^Periodo:/);
  });

  it('sin ningún mes completo, los promedios dicen que aún no hay un mes completo', () => {
    const texto = textoReporte(senalesBanco(enFechas(seguidas(5)), HOY), null);
    expect(texto).toContain('Venta promedio mensual: aún no hay un mes completo');
    expect(texto).toContain(
      'Resultado registrado promedio mensual (ventas menos gastos): aún no hay un mes completo',
    );
    expect(texto).not.toContain('Días registrados por mes');
    expect(texto).not.toMatch(/S\/ \d/);
  });

  it('con 30 días o más no avisa que falta registro; con menos, sí', () => {
    const completo = textoReporte(senalesBanco(enFechas(seguidas(30)), HOY), null);
    expect(completo).not.toContain('Te falta');
    const casi = textoReporte(senalesBanco(enFechas(seguidas(29)), HOY), null);
    expect(casi).toContain('Te falta 1 día de registro para que tu reporte sea convincente');
  });

  it('sin ningún cierre no lanza y avisa que faltan 30 días', () => {
    const texto = textoReporte(senalesBanco([], HOY), perfilCompleto);
    expect(texto.startsWith('Reporte de actividad del negocio')).toBe(true);
    expect(texto).toContain('Te faltan 30 días de registro para que tu reporte sea convincente');
    expect(texto).toContain('Constancia de registro: 0 % (0 días registrados)');
    expect(texto).not.toContain('Registra desde');
  });

  it('nunca incluye el Yape, el titular, el parentesco, la ubicación ni la foto del perfil', () => {
    const texto = textoReporte(senalesDeTresMeses(), perfilCompleto);
    for (const privado of [
      '987654321',
      'Marta Quispe',
      'Marta',
      'hermana',
      'Av. Los Olivos',
      'Comas',
      'freddy.jpg',
    ]) {
      expect(texto).not.toContain(privado);
    }
    expect(texto.toLowerCase()).not.toContain('yape');
  });

  it('cabe en 2,000 caracteres, también con un nombre y un negocio larguísimos', () => {
    const normal = textoReporte(senalesDeTresMeses(), perfilCompleto);
    expect(normal.length).toBeLessThanOrEqual(MAX_CARACTERES_REPORTE);
    const largo = textoReporte(senalesDeTresMeses(), {
      ...perfilCompleto,
      nombre: 'F'.repeat(5000),
      negocio: 'A'.repeat(5000),
    });
    expect(largo.length).toBeLessThanOrEqual(MAX_CARACTERES_REPORTE);
    expect(largo.startsWith('Reporte de actividad del negocio')).toBe(true);
    expect(largo).toContain('Son totales registrados por el propio negocio');
  });

  it('no muta las señales ni el perfil', () => {
    const s = congelarTodo(senalesDeTresMeses());
    const p = congelarTodo({ ...perfilCompleto });
    expect(() => textoReporte(s, p)).not.toThrow();
  });

  it('es determinista: las mismas señales dan el mismo texto', () => {
    const s = senalesDeTresMeses();
    expect(textoReporte(s, perfilCompleto)).toBe(textoReporte(s, perfilCompleto));
  });
});

describe('con la semilla real (75 cierres) y hoy = 2026-10-07', () => {
  const semilla = (): SemillaJSON => {
    const r = validarSemilla(
      JSON.parse(readFileSync(join(__dirname, '..', 'seed', 'semilla.json'), 'utf8')),
    );
    if (!r.ok) throw new Error('La semilla real no valida');
    return r.semilla;
  };
  let s: Senales;
  beforeAll(() => {
    const { cierres } = materializarSemilla(semilla(), new Date(2026, 9, 7, 12));
    s = senalesBanco(cierres, HOY);
  });

  it('julio queda parcial: entran agosto y septiembre', () => {
    expect(s.mesesCompletos).toBe(2);
    expect(s.meses.map(m => m.mes)).toEqual(['2026-08', '2026-09']);
    expect(s.registraDesde).toBe('2026-07-09');
  });

  it('la venta promedio mensual ronda S/ 5,175 (agosto 5,287 y septiembre 5,062)', () => {
    expect(Math.round(s.meses[0].venta)).toBe(5287);
    expect(Math.round(s.meses[1].venta)).toBe(5062);
    expect(s.ventaPromedioMensual).toBeGreaterThan(5150);
    expect(s.ventaPromedioMensual).toBeLessThan(5200);
  });

  it('la ganancia promedio mensual ronda S/ 2,180', () => {
    expect(s.gananciaPromedioMensual).toBeGreaterThan(2150);
    expect(s.gananciaPromedioMensual).toBeLessThan(2210);
  });

  it('tiene constancia alta y el reporte no está en construcción', () => {
    expect(s.constancia).toBeGreaterThanOrEqual(75);
    expect(s.diasRegistrados).toBeGreaterThanOrEqual(70);
    expect(s.enConstruccion).toBe(false);
    expect(s.diasFaltantes).toBe(0);
    expect(textoReporte(s, perfilCompleto)).not.toContain('Te falta');
  });
});
