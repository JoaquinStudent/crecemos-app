/**
 * Pruebas de apoyo del motor de decisiones (no son escenarios del SPEC): bordes de cada regla,
 * métricas, helpers de fecha y que ninguna función muta su entrada.
 */

import { diasEntre, diaSemana, restarDias } from '@dominio/fecha';
import { nombreMes } from '@dominio/formato';
import type {
  Cierre,
  ContextoAnalisis,
  FechaNegocio,
  GananciaProducto,
  LineaCierre,
  Producto,
  ResumenCiclo,
} from '@dominio/tipos';
import { compararCiclos, gananciaDelDia, gananciaPorProducto, insight } from '@analisis/metricas';
import { evaluarReglas, REGLAS } from '@analisis/reglas';

const ahora = new Date('2026-10-07T12:00:00-05:00');
const HOY: FechaNegocio = '2026-10-07';

const linea = (
  nombre: string,
  preparadas: number,
  sobrantes: number,
  precioUnitario: number,
  costoUnitario: number,
): LineaCierre => ({
  productoId: `p-${nombre.toLowerCase()}`,
  nombre,
  preparadas,
  sobrantes,
  precioUnitario,
  costoUnitario,
});

interface Opciones {
  lineas?: LineaCierre[];
  gastos?: { categoria: 'mercaderia' | 'carbon'; monto: number }[];
  abreCiclo?: boolean;
  montoYape?: number;
  yapePendiente?: boolean;
  cobradoEn?: FechaNegocio;
}

const cierreDe = (fecha: FechaNegocio, o: Opciones = {}): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: o.lineas ?? [],
  montoYape: o.montoYape ?? 0,
  yapePendiente: o.yapePendiente ?? false,
  cobradoEn: o.cobradoEn,
  gastos: o.gastos ?? [],
  abreCiclo: o.abreCiclo ?? false,
  creadoEn: ahora.toISOString(),
  actualizadoEn: ahora.toISOString(),
});

const producto = (
  nombre: string,
  precioVenta: number,
  costoUnitario: number,
  extra: Partial<Producto> = {},
): Producto => ({
  id: `p-${nombre.toLowerCase()}`,
  nombre,
  unidad: 'porcion',
  precioVenta,
  costoUnitario,
  actualizadoEn: '2026-09-01',
  activo: true,
  ...extra,
});

// Un día que gana exactamente `ganancia` soles (porciones a precio 1 y costo 0).
const diaGana = (fecha: FechaNegocio, ganancia: number, o: Opciones = {}): Cierre =>
  cierreDe(fecha, { lineas: [linea('Anticucho', ganancia, 0, 1, 0)], ...o });

const regla = (id: string) => {
  const r = REGLAS.find(x => x.id === id);
  if (!r) throw new Error(`Regla desconocida: ${id}`);
  return r;
};

const ctxDe = (
  cierres: Cierre[],
  productos: Producto[] = [],
  hoy: FechaNegocio = HOY,
): ContextoAnalisis => ({
  cierres,
  productos,
  hoy,
});

const congelar = <T>(valor: T): T => {
  if (valor && typeof valor === 'object') {
    Object.values(valor as object).forEach(congelar);
    Object.freeze(valor);
  }
  return valor;
};

describe('restarDias', () => {
  it('resta dentro del mes, cruza el mes y el año', () => {
    expect(restarDias('2026-10-07', 6)).toBe('2026-10-01');
    expect(restarDias('2026-10-01', 1)).toBe('2026-09-30');
    expect(restarDias('2026-01-01', 1)).toBe('2025-12-31');
    expect(restarDias('2026-03-01', 1)).toBe('2026-02-28');
  });

  it('respeta el 29 de febrero y los 90 días del escenario de precio', () => {
    expect(restarDias('2028-03-01', 1)).toBe('2028-02-29');
    expect(restarDias('2026-10-07', 90)).toBe('2026-07-09');
  });

  it('con 0 deja la fecha igual y con negativo suma días', () => {
    expect(restarDias('2026-10-07', 0)).toBe('2026-10-07');
    expect(restarDias('2026-12-31', -1)).toBe('2027-01-01');
  });

  it('no depende de la zona horaria del teléfono (regla 12)', () => {
    const zonaOriginal = process.env.TZ;
    try {
      for (const zona of ['America/Lima', 'UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
        process.env.TZ = zona;
        expect(restarDias('2026-03-09', 1)).toBe('2026-03-08');
        expect(restarDias('2026-10-07', 90)).toBe('2026-07-09');
        expect(diaSemana('2026-10-07')).toBe(3);
      }
    } finally {
      process.env.TZ = zonaOriginal;
    }
  });
});

describe('diasEntre y diaSemana', () => {
  it('cuenta los días de calendario, con signo', () => {
    expect(diasEntre('2026-07-09', '2026-10-07')).toBe(90);
    expect(diasEntre('2026-10-07', '2026-10-07')).toBe(0);
    expect(diasEntre('2026-10-07', '2026-10-06')).toBe(-1);
  });

  it('da el día de la semana con 0 = domingo', () => {
    expect(diaSemana('2026-10-07')).toBe(3); // miércoles
    expect(diaSemana('2026-10-04')).toBe(0); // domingo
    expect(diaSemana('2026-10-10')).toBe(6); // sábado
  });
});

describe('nombreMes', () => {
  it('devuelve el mes en minúscula', () => {
    expect(nombreMes('2026-07-09')).toBe('julio');
    expect(nombreMes('2026-01-01')).toBe('enero');
    expect(nombreMes('2026-12-31')).toBe('diciembre');
  });
});

describe('gananciaDelDia', () => {
  it('suma vendidas × (precio − costo) de cada línea', () => {
    const c = cierreDe('2026-10-01', {
      lineas: [linea('Pancita', 30, 10, 9, 8), linea('Anticucho', 10, 0, 10, 8.2)],
    });
    // 20 × 1.00 + 10 × 1.80
    expect(gananciaDelDia(c)).toBe(38);
  });

  it('redondea a 2 decimales (regla 13)', () => {
    const c = cierreDe('2026-10-01', {
      lineas: [linea('A', 3, 0, 0.3, 0.1), linea('B', 1, 0, 0.2, 0)],
    });
    expect(gananciaDelDia(c)).toBe(0.8);
  });

  it('un día sin líneas gana 0', () => {
    expect(gananciaDelDia(cierreDe('2026-10-01'))).toBe(0);
  });
});

describe('gananciaPorProducto', () => {
  it('solo cuenta los cierres desde la fecha, incluida ella', () => {
    const cierres = [
      cierreDe('2026-09-30', { lineas: [linea('Pancita', 100, 0, 9, 8)] }),
      cierreDe('2026-10-01', { lineas: [linea('Pancita', 10, 0, 9, 8)] }),
      cierreDe('2026-10-02', { lineas: [linea('Pancita', 5, 0, 9, 8)] }),
    ];
    expect(gananciaPorProducto(cierres, '2026-10-01')).toEqual([
      { productoId: 'p-pancita', nombre: 'Pancita', seVende: 15, teDeja: 1, ganancia: 15 },
    ]);
    expect(gananciaPorProducto(cierres, '2026-10-03')).toEqual([]);
  });

  it('usa el precio y costo copiados en cada cierre, no los de hoy (D2)', () => {
    const cierres = [
      cierreDe('2026-10-01', { lineas: [linea('Anticucho', 10, 0, 10, 8)] }), // deja 2.00
      cierreDe('2026-10-02', { lineas: [linea('Anticucho', 10, 0, 10, 9)] }), // deja 1.00
    ];
    expect(gananciaPorProducto(cierres, '2026-10-01')[0]).toMatchObject({
      seVende: 20,
      ganancia: 30,
      teDeja: 1.5,
    });
  });

  it('redondea el te deja por porción a 2 decimales', () => {
    const [g] = gananciaPorProducto(
      [cierreDe('2026-10-01', { lineas: [linea('Rachi', 3, 0, 10, 6.6667)] })],
      '2026-10-01',
    );
    expect(g.teDeja).toBe(3.33);
    expect(g.ganancia).toBe(10);
  });

  it('ordena por ganancia descendente y desempata por nombre', () => {
    const cierres = [
      cierreDe('2026-10-01', {
        lineas: [
          linea('Rachi', 10, 0, 9, 8),
          linea('Chicha', 5, 0, 2, 1.8),
          linea('Anticucho', 10, 0, 10, 8),
          linea('Pancita', 10, 0, 9, 8),
        ],
      }),
    ];
    // Anticucho 20.00, Pancita 10.00, Rachi 10.00, Chicha 1.00
    expect(gananciaPorProducto(cierres, '2026-10-01').map(g => g.nombre)).toEqual([
      'Anticucho',
      'Pancita',
      'Rachi',
      'Chicha',
    ]);
  });

  it('un producto sin porciones vendidas queda con te deja 0', () => {
    const [g] = gananciaPorProducto(
      [cierreDe('2026-10-01', { lineas: [linea('Pancita', 10, 10, 9, 8)] })],
      '2026-10-01',
    );
    expect(g).toMatchObject({ seVende: 0, teDeja: 0, ganancia: 0 });
  });

  it('sin cierres devuelve []', () => {
    expect(gananciaPorProducto([], '2026-10-01')).toEqual([]);
  });
});

describe('insight', () => {
  const g = (nombre: string, seVende: number, teDeja: number): GananciaProducto => ({
    productoId: `p-${nombre.toLowerCase()}`,
    nombre,
    seVende,
    teDeja,
    ganancia: seVende * teDeja,
  });

  it('es null si el que más se vende es también el que más deja', () => {
    expect(insight([g('Pancita', 400, 2), g('Anticucho', 100, 1)])).toBeNull();
  });

  it('es null con menos de 2 productos', () => {
    expect(insight([g('Pancita', 400, 2)])).toBeNull();
    expect(insight([])).toBeNull();
  });

  it('es null si todo empata y el más vendido ya es el que más deja', () => {
    expect(insight([g('Pancita', 400, 1), g('Anticucho', 100, 1)])).toBeNull();
  });

  it('el artículo sale del nombre: termina en "a" es "la", si no "el"', () => {
    expect(insight([g('Anticucho', 400, 1), g('Chicha', 100, 3.5)])).toBe(
      'El anticucho se vende más. La diferencia estimada por unidad de la chicha es S/ 2.50 mayor (precio menos costo estimado).',
    );
  });

  it('ignora a los productos sin ventas', () => {
    expect(insight([g('Pancita', 400, 1), g('Rachi', 0, 0), g('Anticucho', 100, 1.8)])).toBe(
      'La pancita se vende más. La diferencia estimada por unidad del anticucho es S/ 0.80 mayor (precio menos costo estimado).',
    );
    expect(insight([g('Pancita', 400, 1), g('Rachi', 0, 5)])).toBeNull();
  });
});

describe('compararCiclos', () => {
  const resumen = (teQueda: number): ResumenCiclo => ({
    venta: 0,
    capital: 0,
    teQueda,
    faltaParaCapital: 0,
  });

  it('dice cuánto más ganó', () => {
    expect(compararCiclos(resumen(262), resumen(214))).toBe(
      'Resultado registrado S/ 48.00 más que el ciclo pasado',
    );
  });

  it('dice cuánto menos ganó', () => {
    expect(compararCiclos(resumen(214), resumen(262))).toBe(
      'Resultado registrado S/ 48.00 menos que el ciclo pasado',
    );
  });

  it('dice "lo mismo" si es igual', () => {
    expect(compararCiclos(resumen(214), resumen(214))).toBe(
      'Resultado registrado igual al ciclo pasado',
    );
  });

  it('redondea la diferencia (regla 13)', () => {
    expect(compararCiclos(resumen(0.3), resumen(0.1))).toBe(
      'Resultado registrado S/ 0.20 más que el ciclo pasado',
    );
  });
});

describe('regla cobro', () => {
  const pendiente = (fecha: FechaNegocio, monto: number) =>
    cierreDe(fecha, {
      lineas: [linea('Anticucho', 1, 0, 1, 0)],
      montoYape: monto,
      yapePendiente: true,
    });

  it('S/ 100.00 justos no bastan; S/ 100.01 sí', () => {
    expect(regla('cobro').aplica(ctxDe([pendiente('2026-10-06', 100)]))).toBe(false);
    expect(regla('cobro').aplica(ctxDe([pendiente('2026-10-06', 100.01)]))).toBe(true);
  });

  it('7 días justos no bastan; 8 sí, aunque el monto sea chico', () => {
    expect(regla('cobro').aplica(ctxDe([pendiente('2026-09-30', 20)]))).toBe(false);
    expect(regla('cobro').aplica(ctxDe([pendiente('2026-09-29', 20)]))).toBe(true);
  });

  it('mira el pago pendiente más antiguo', () => {
    const r = regla('cobro');
    const ctx = ctxDe([pendiente('2026-10-05', 20), pendiente('2026-09-20', 20)]);
    expect(r.aplica(ctx)).toBe(true);
    expect(r.mensaje(ctx)).toBe('Tienes S/ 40.00 por cobrar desde el 20 de septiembre.');
  });

  it('un cobro ya cobrado no cuenta', () => {
    const cobrado = cierreDe('2026-09-01', {
      montoYape: 500,
      yapePendiente: true,
      cobradoEn: '2026-09-05',
    });
    expect(regla('cobro').aplica(ctxDe([cobrado]))).toBe(false);
  });

  it('sin nada por cobrar no aplica', () => {
    expect(regla('cobro').aplica(ctxDe([]))).toBe(false);
  });
});

describe('regla precio', () => {
  // El anticucho dejaba 1.80 el 2026-07-09
  const antiguo = (fecha: FechaNegocio = '2026-07-09') =>
    cierreDe(fecha, { lineas: [linea('Anticucho', 10, 0, 10, 8.2)] });

  it('cae S/ 0.30 justos aplica; S/ 0.29 no', () => {
    expect(regla('precio').aplica(ctxDe([antiguo()], [producto('Anticucho', 10, 8.5)]))).toBe(true);
    expect(regla('precio').aplica(ctxDe([antiguo()], [producto('Anticucho', 10, 8.49)]))).toBe(
      false,
    );
  });

  it('compara contra una línea de 90 días o más; de 89 no', () => {
    const p = [producto('Anticucho', 10, 8.8)];
    expect(regla('precio').aplica(ctxDe([antiguo('2026-07-09')], p))).toBe(true); // 90 días
    expect(regla('precio').aplica(ctxDe([antiguo('2026-07-10')], p))).toBe(false); // 89 días
  });

  it('sin línea de hace 90 días o más no aplica', () => {
    expect(regla('precio').aplica(ctxDe([], [producto('Anticucho', 10, 8.8)]))).toBe(false);
  });

  it('usa la línea más reciente de las que tienen 90 días o más', () => {
    const cierres = [
      cierreDe('2026-06-01', { lineas: [linea('Anticucho', 10, 0, 10, 7.5)] }), // dejaba 2.50
      antiguo('2026-07-09'), // dejaba 1.80
    ];
    const ctx = ctxDe(cierres, [producto('Anticucho', 10, 8.8)]);
    expect(regla('precio').mensaje(ctx)).toBe(
      'La diferencia estimada por unidad de Anticucho bajó S/ 0.60 desde julio (precio menos costo estimado). Revisa el precio.',
    );
  });

  it('el mes sale de la fecha de esa línea', () => {
    const ctx = ctxDe([antiguo('2026-06-30')], [producto('Anticucho', 10, 8.8)]);
    expect(regla('precio').mensaje(ctx)).toContain('desde junio');
  });

  it('ignora el producto inactivo', () => {
    const ctx = ctxDe([antiguo()], [producto('Anticucho', 10, 8.8, { activo: false })]);
    expect(regla('precio').aplica(ctx)).toBe(false);
  });

  it('con varios productos habla del que más cayó', () => {
    const cierres = [
      cierreDe('2026-07-09', {
        lineas: [linea('Anticucho', 10, 0, 10, 8.2), linea('Pancita', 10, 0, 9, 8)],
      }),
    ];
    const productos = [producto('Pancita', 9, 8.7), producto('Anticucho', 10, 8.8)]; // cae 0.70 y 0.60
    expect(regla('precio').mensaje(ctxDe(cierres, productos))).toContain(
      'La diferencia estimada por unidad de Pancita bajó S/ 0.70',
    );
  });

  it('un producto que mejoró no aplica', () => {
    expect(regla('precio').aplica(ctxDe([antiguo()], [producto('Anticucho', 10, 7)]))).toBe(false);
  });
});

describe('regla preparar', () => {
  // Rachi con `pen` sobrantes en el penúltimo ciclo y `ult` en el último
  const dosCiclos = (pen: number, ult: number, nombre = 'Rachi') => [
    cierreDe('2026-09-14', { abreCiclo: true, lineas: [linea(nombre, 30, pen, 9, 7.6)] }),
    cierreDe('2026-09-28', { abreCiclo: true, lineas: [linea(nombre, 30, ult, 9, 7.6)] }),
  ];

  it('3 sobrantes en cada ciclo aplica; 2 en uno no', () => {
    expect(regla('preparar').aplica(ctxDe(dosCiclos(3, 3)))).toBe(true);
    expect(regla('preparar').aplica(ctxDe(dosCiclos(3, 2)))).toBe(false);
    expect(regla('preparar').aplica(ctxDe(dosCiclos(2, 6)))).toBe(false);
  });

  it('recomienda restar la menor de las dos cifras', () => {
    expect(regla('preparar').mensaje(ctxDe(dosCiclos(8, 4)))).toBe(
      'Registraste sobrantes de Rachi en dos ciclos seguidos. Prepara 4 porciones menos.',
    );
  });

  it('un ciclo más antiguo no cuenta', () => {
    const cierres = [
      cierreDe('2026-09-01', { abreCiclo: true, lineas: [linea('Rachi', 30, 10, 9, 7.6)] }),
      ...dosCiclos(0, 5),
    ];
    expect(regla('preparar').aplica(ctxDe(cierres))).toBe(false);
  });

  it('suma los sobrantes de todos los días del ciclo', () => {
    const cierres = [
      cierreDe('2026-09-14', { abreCiclo: true, lineas: [linea('Rachi', 30, 1, 9, 7.6)] }),
      cierreDe('2026-09-15', { lineas: [linea('Rachi', 30, 2, 9, 7.6)] }),
      cierreDe('2026-09-28', { abreCiclo: true, lineas: [linea('Rachi', 30, 3, 9, 7.6)] }),
    ];
    expect(regla('preparar').aplica(ctxDe(cierres))).toBe(true);
  });

  it('tiene que ser el mismo producto en los dos ciclos', () => {
    const cierres = [
      cierreDe('2026-09-14', { abreCiclo: true, lineas: [linea('Rachi', 30, 5, 9, 7.6)] }),
      cierreDe('2026-09-28', { abreCiclo: true, lineas: [linea('Pancita', 30, 5, 9, 8)] }),
    ];
    expect(regla('preparar').aplica(ctxDe(cierres))).toBe(false);
  });

  it('con varios productos habla del de mayor cifra', () => {
    const cierres = [
      cierreDe('2026-09-14', {
        abreCiclo: true,
        lineas: [linea('Rachi', 30, 4, 9, 7.6), linea('Pancita', 30, 9, 9, 8)],
      }),
      cierreDe('2026-09-28', {
        abreCiclo: true,
        lineas: [linea('Rachi', 30, 4, 9, 7.6), linea('Pancita', 30, 7, 9, 8)],
      }),
    ];
    expect(regla('preparar').mensaje(ctxDe(cierres))).toBe(
      'Registraste sobrantes de Pancita en dos ciclos seguidos. Prepara 7 porciones menos.',
    );
  });

  it('la chicha se cuenta en vasos', () => {
    const chicha = producto('Chicha', 2, 1.6, { unidad: 'vaso' });
    expect(regla('preparar').mensaje(ctxDe(dosCiclos(6, 4, 'Chicha'), [chicha]))).toBe(
      'Registraste sobrantes de Chicha en dos ciclos seguidos. Prepara 4 vasos menos.',
    );
  });

  it('con un solo ciclo no aplica', () => {
    expect(regla('preparar').aplica(ctxDe([dosCiclos(9, 9)[1]]))).toBe(false);
  });
});

describe('regla retiro', () => {
  const ciclo = (inicio: FechaNegocio, venta: number, gasto: number): Cierre =>
    cierreDe(inicio, {
      abreCiclo: true,
      lineas: [linea('Anticucho', venta, 0, 1, 0)],
      gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
    });

  it('con un solo ciclo no aplica', () => {
    expect(regla('retiro').aplica(ctxDe([ciclo('2026-09-28', 412, 244)]))).toBe(false);
  });

  it('si el te queda es exactamente 0 no hubo ganancia', () => {
    const ctx = ctxDe([ciclo('2026-09-14', 244, 244), ciclo('2026-09-28', 10, 5)]);
    expect(regla('retiro').mensaje(ctx)).toBe(
      'El resultado registrado del ciclo no fue positivo. Revisa ventas, gastos y cobros pendientes antes de retirar dinero.',
    );
  });

  it('mira el último ciclo cerrado (el penúltimo), no el actual ni uno más viejo', () => {
    const cierres = [
      ciclo('2026-09-01', 100, 400), // más viejo, pérdida
      ciclo('2026-09-14', 412, 244), // último cerrado
      ciclo('2026-09-28', 10, 500), // actual, pérdida
    ];
    expect(regla('retiro').mensaje(ctxDe(cierres))).toBe(
      'El resultado registrado del ciclo fue S/ 168.00. Antes de retirar dinero, revisa los cobros pendientes.',
    );
  });
});

describe('regla comparacion', () => {
  const ciclo = (inicio: FechaNegocio, venta: number, gasto: number): Cierre =>
    cierreDe(inicio, {
      abreCiclo: true,
      lineas: [linea('Anticucho', venta, 0, 1, 0)],
      gastos: [{ categoria: 'mercaderia', monto: gasto }],
    });

  it('compara el ciclo actual con el penúltimo', () => {
    const cierres = [
      ciclo('2026-09-01', 900, 10),
      ciclo('2026-09-14', 314, 100),
      ciclo('2026-09-28', 362, 100),
    ];
    expect(regla('comparacion').mensaje(ctxDe(cierres))).toBe(
      'Resultado registrado S/ 48.00 más que el ciclo pasado',
    );
  });

  it('con un solo ciclo no aplica', () => {
    expect(regla('comparacion').aplica(ctxDe([ciclo('2026-09-28', 362, 100)]))).toBe(false);
  });
});

describe('regla diaFlojo', () => {
  // Dos días iguales de la semana (a 28 días) que ganan 10, más dos días siguientes que ganan 100:
  // promedio 55, el día flojo gana 45 menos.
  const NOMBRES: [FechaNegocio, string][] = [
    ['2026-09-14', 'lunes'],
    ['2026-09-15', 'martes'],
    ['2026-09-16', 'miércoles'],
    ['2026-09-17', 'jueves'],
    ['2026-09-18', 'viernes'],
    ['2026-09-19', 'sábados'],
    ['2026-09-20', 'domingos'],
  ];

  it.each(NOMBRES)('nombra el día de la semana de %s: %s', (f1, nombre) => {
    const f2 = restarDias(f1, -28);
    const cierres = [
      diaGana(f1, 10),
      diaGana(restarDias(f1, -1), 100),
      diaGana(restarDias(f2, -1), 100),
      diaGana(f2, 10),
    ];
    const ctx = ctxDe(cierres);
    expect(regla('diaFlojo').aplica(ctx)).toBe(true);
    expect(regla('diaFlojo').mensaje(ctx)).toBe(
      `Los ${nombre} el resultado estimado por producto fue S/ 45.00 menor que el promedio.`,
    );
  });

  // Lunes 14 y 21 de septiembre; el resto, miércoles. El último cierre decide la ventana.
  const conVentana = (ultimo: FechaNegocio): Cierre[] => [
    diaGana('2026-09-16', 100), // miércoles, el primero
    diaGana('2026-09-21', 10), // lunes
    diaGana('2026-09-22', 100), // martes
    diaGana('2026-09-28', 10), // lunes
    diaGana(ultimo, 100),
  ];

  it('28 días entre el primero y el último aplica; 27 no', () => {
    expect(diasEntre('2026-09-16', '2026-10-14')).toBe(28);
    expect(regla('diaFlojo').aplica(ctxDe(conVentana('2026-10-14')))).toBe(true);
    expect(regla('diaFlojo').aplica(ctxDe(conVentana('2026-10-13')))).toBe(false);
  });

  // Dos lunes (a 28 días) con `l` y dos martes con `m`.
  const conPorcentaje = (l: number, m: number): Cierre[] => [
    diaGana('2026-09-14', l),
    diaGana('2026-09-15', m),
    diaGana('2026-09-22', m),
    diaGana('2026-10-12', l),
  ];

  it('20 % por debajo del promedio aplica; 19 % no', () => {
    // 80 contra promedio 100: justo 20 %
    expect(regla('diaFlojo').aplica(ctxDe(conPorcentaje(80, 120)))).toBe(true);
    // 81 contra promedio 100: 19 %
    expect(regla('diaFlojo').aplica(ctxDe(conPorcentaje(81, 119)))).toBe(false);
  });

  it('un día de la semana con un solo cierre no cuenta', () => {
    const cierres = [
      diaGana('2026-09-14', 10), // el único lunes
      diaGana('2026-09-15', 100),
      diaGana('2026-09-22', 100),
      diaGana('2026-10-13', 100),
    ];
    expect(regla('diaFlojo').aplica(ctxDe(cierres))).toBe(false);
  });

  it('mide la ganancia del día, no el te queda (que depende de cuándo compró)', () => {
    // Los lunes tienen el mismo ganancia que el resto, pero gastaron S/ 500 en mercadería
    const gasto = [{ categoria: 'mercaderia' as const, monto: 500 }];
    const cierres = [
      diaGana('2026-09-14', 100, { gastos: gasto }),
      diaGana('2026-09-15', 100),
      diaGana('2026-09-22', 100),
      diaGana('2026-10-12', 100, { gastos: gasto }),
    ];
    expect(regla('diaFlojo').aplica(ctxDe(cierres))).toBe(false);
  });

  it('con varios días flojos habla del de mayor diferencia', () => {
    // lunes 60, miércoles 20, jueves 100 (×6): promedio 76 → ambos están 20 % o más por debajo
    const cierres = [
      diaGana('2026-09-14', 60),
      diaGana('2026-09-21', 60),
      diaGana('2026-09-16', 20),
      diaGana('2026-09-23', 20),
      ...['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24', '2026-10-01', '2026-10-08'].map(
        f => diaGana(f, 100),
      ),
    ];
    expect(regla('diaFlojo').mensaje(ctxDe(cierres))).toBe(
      'Los miércoles el resultado estimado por producto fue S/ 56.00 menor que el promedio.',
    );
  });

  it('sin cierres no aplica', () => {
    expect(regla('diaFlojo').aplica(ctxDe([]))).toBe(false);
  });
});

describe('evaluarReglas', () => {
  it('con un solo ciclo devuelve [] aunque haya cosas por cobrar', () => {
    const cierres = [
      cierreDe('2026-09-28', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 20, 0, 10, 8)],
        montoYape: 150,
        yapePendiente: true,
      }),
      cierreDe('2026-09-29', { lineas: [linea('Anticucho', 20, 0, 10, 8)] }),
    ];
    expect(evaluarReglas(ctxDe(cierres, [producto('Anticucho', 10, 8)]))).toEqual([]);
  });

  it('sin cierres devuelve []', () => {
    expect(evaluarReglas(ctxDe([]))).toEqual([]);
  });

  it('con dos ciclos devuelve retiro y comparacion, por prioridad', () => {
    const cierres = [
      cierreDe('2026-09-14', { abreCiclo: true, lineas: [linea('Anticucho', 100, 0, 1, 0)] }),
      cierreDe('2026-09-28', { abreCiclo: true, lineas: [linea('Anticucho', 150, 0, 1, 0)] }),
    ];
    expect(evaluarReglas(ctxDe(cierres)).map(r => [r.reglaId, r.prioridad])).toEqual([
      ['retiro', 4],
      ['comparacion', 6],
    ]);
  });

  it('las reglas están ordenadas y con prioridades distintas', () => {
    expect(REGLAS.map(r => [r.id, r.prioridad])).toEqual([
      ['cobro', 1],
      ['precio', 2],
      ['preparar', 3],
      ['retiro', 4],
      ['diaFlojo', 5],
      ['comparacion', 6],
    ]);
  });

  it('ignora el producto inactivo en la regla de precio', () => {
    const cierres = [
      cierreDe('2026-07-09', { abreCiclo: true, lineas: [linea('Anticucho', 10, 0, 10, 8.2)] }),
      cierreDe('2026-09-28', { abreCiclo: true, lineas: [linea('Anticucho', 10, 0, 10, 8.8)] }),
    ];
    const activo = evaluarReglas(ctxDe(cierres, [producto('Anticucho', 10, 8.8)]));
    const inactivo = evaluarReglas(
      ctxDe(cierres, [producto('Anticucho', 10, 8.8, { activo: false })]),
    );
    expect(activo.map(r => r.reglaId)).toContain('precio');
    expect(inactivo.map(r => r.reglaId)).not.toContain('precio');
  });
});

describe('ninguna función muta su entrada', () => {
  it('evaluarReglas, gananciaPorProducto, insight y compararCiclos reciben datos congelados', () => {
    const cierres = congelar([
      cierreDe('2026-07-09', { abreCiclo: true, lineas: [linea('Anticucho', 10, 3, 10, 8.2)] }),
      cierreDe('2026-09-20', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 10, 3, 10, 8.8), linea('Pancita', 50, 0, 9, 8)],
        montoYape: 150,
        yapePendiente: true,
        gastos: [{ categoria: 'mercaderia', monto: 50 }],
      }),
      cierreDe('2026-09-28', {
        abreCiclo: true,
        lineas: [linea('Anticucho', 10, 4, 10, 8.8), linea('Pancita', 40, 0, 9, 8)],
      }),
      cierreDe('2026-09-29', { lineas: [linea('Pancita', 40, 0, 9, 8)] }),
    ]);
    const productos = congelar([producto('Anticucho', 10, 8.8), producto('Pancita', 9, 8)]);
    const antes = JSON.stringify({ cierres, productos });

    const recomendaciones = evaluarReglas({ cierres, productos, hoy: HOY });
    const g = gananciaPorProducto(cierres, '2026-01-01');
    insight(g);
    insight(congelar(g));
    compararCiclos(
      congelar({ venta: 1, capital: 1, teQueda: 5, faltaParaCapital: 0 }),
      congelar({ venta: 1, capital: 1, teQueda: 3, faltaParaCapital: 0 }),
    );

    expect(recomendaciones.length).toBeGreaterThan(0);
    expect(JSON.stringify({ cierres, productos })).toBe(antes);
  });
});
