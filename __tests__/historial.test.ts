/**
 * Pruebas de apoyo del dominio del historial y de la edición de un día
 * (no son escenarios del SPEC): armarHistorial, editarCierre, mensajeBorrar y mercaderiaDelCiclo.
 */

import { calcularCierre, editarCierre, nuevoCierre } from '@dominio/cierre';
import { ETIQUETA_GASTO } from '@dominio/categorias';
import { mercaderiaDelCiclo } from '@dominio/ciclo';
import { armarHistorial, mensajeBorrar } from '@dominio/historial';
import { cambiarPrecio } from '@dominio/producto';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Ciclo, Cierre, DatosCierre, Gasto, LineaCierre, Perfil } from '@dominio/tipos';

const ahora = new Date('2026-10-07T12:00:00-05:00');

const linea = (nombre: string, vendidas: number, precioUnitario: number): LineaCierre => ({
  productoId: `p-${nombre.toLowerCase()}`,
  nombre,
  preparadas: vendidas,
  sobrantes: 0,
  precioUnitario,
  costoUnitario: 0,
});

const cierreDe = (
  fecha: string,
  extra: {
    lineas?: LineaCierre[];
    gastos?: Gasto[];
    montoYape?: number;
    yapePendiente?: boolean;
    cobradoEn?: string;
  } = {},
): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: extra.lineas ?? [],
  montoYape: extra.montoYape ?? 0,
  yapePendiente: extra.yapePendiente ?? false,
  cobradoEn: extra.cobradoEn,
  gastos: extra.gastos ?? [],
  abreCiclo: false,
  creadoEn: ahora.toISOString(),
  actualizadoEn: ahora.toISOString(),
});

describe('armarHistorial', () => {
  // 5 oct: venta S/ 200 (S/ 46 por Yape, por cobrar), gastos S/ 74 → neto 126
  const diaConYape = cierreDe('2026-10-05', {
    lineas: [linea('Anticucho', 20, 10)],
    montoYape: 46,
    yapePendiente: true,
    gastos: [
      { categoria: 'mercaderia', monto: 60 },
      { categoria: 'movilidad', monto: 14 },
    ],
  });
  // 6 oct: solo efectivo S/ 100, gasto S/ 10 → neto 90
  const diaEfectivo = cierreDe('2026-10-06', {
    lineas: [linea('Anticucho', 10, 10)],
    gastos: [{ categoria: 'gas', monto: 10 }],
  });
  // 4 oct: solo un gasto de carbón y otro → neto -30
  const diaSoloGastos = cierreDe('2026-10-04', {
    gastos: [
      { categoria: 'carbon', monto: 20 },
      { categoria: 'otro', monto: 10 },
    ],
  });
  const todos = [diaConYape, diaEfectivo, diaSoloGastos];

  it('sin cierres devuelve una lista vacia', () => {
    expect(armarHistorial([], 'todo')).toEqual([]);
  });

  it('ordena del mas reciente al mas antiguo y no muta la entrada', () => {
    const entrada = [...todos];
    const copia = JSON.stringify(entrada);

    const grupos = armarHistorial(entrada, 'todo');

    expect(grupos.map(g => g.fecha)).toEqual(['2026-10-06', '2026-10-05', '2026-10-04']);
    expect(grupos.map(g => g.cierreId)).toEqual(['c-2026-10-06', 'c-2026-10-05', 'c-2026-10-04']);
    expect(JSON.stringify(entrada)).toBe(copia);
  });

  it('el titulo es la fecha en palabras', () => {
    const [primero, , ultimo] = armarHistorial(todos, 'todo');
    expect(primero.titulo).toBe('Martes 6 de octubre');
    expect(ultimo.titulo).toBe('Domingo 4 de octubre');
  });

  it('todo: efectivo, Yape y un movimiento negativo por gasto, en ese orden', () => {
    const grupo = armarHistorial([diaConYape], 'todo')[0];

    expect(grupo.movimientos).toEqual([
      {
        tipo: 'venta',
        etiqueta: 'Venta del día',
        metodo: 'Efectivo',
        monto: 154,
        porCobrar: false,
      },
      { tipo: 'venta', etiqueta: 'Venta del día', metodo: 'Yape', monto: 46, porCobrar: true },
      { tipo: 'gasto', etiqueta: 'Mercadería', metodo: null, monto: -60, porCobrar: false },
      { tipo: 'gasto', etiqueta: 'Movilidad', metodo: null, monto: -14, porCobrar: false },
    ]);
  });

  it('no crea la venta en efectivo ni la de Yape cuando valen cero', () => {
    const soloYape = cierreDe('2026-10-05', {
      lineas: [linea('Anticucho', 5, 10)],
      montoYape: 50,
    });
    const soloEfectivo = armarHistorial([diaEfectivo], 'todo')[0];
    const grupoYape = armarHistorial([soloYape], 'todo')[0];

    expect(soloEfectivo.movimientos.map(m => m.metodo)).toEqual(['Efectivo', null]);
    expect(grupoYape.movimientos.map(m => m.metodo)).toEqual(['Yape']);
  });

  it('un dia sin venta ni gastos no tiene movimientos y no aparece', () => {
    expect(armarHistorial([cierreDe('2026-10-05')], 'todo')).toEqual([]);
  });

  it('usa la etiqueta de cada categoria de gasto', () => {
    const grupo = armarHistorial([diaSoloGastos], 'todo')[0];
    expect(grupo.movimientos.map(m => m.etiqueta)).toEqual([ETIQUETA_GASTO.carbon, 'Otros gastos']);
    expect(Object.values(ETIQUETA_GASTO)).toEqual([
      'Mercadería',
      'Carbón',
      'Movilidad',
      'Gas',
      'Otros gastos',
    ]);
  });

  it('el neto sin filtro coincide con "te queda" del cierre', () => {
    const grupos = armarHistorial(todos, 'todo');
    for (const grupo of grupos) {
      const cierre = todos.find(c => c.id === grupo.cierreId) as Cierre;
      expect(grupo.neto).toBe(calcularCierre(cierre).teQueda);
    }
    expect(grupos.map(g => g.neto)).toEqual([90, 126, -30]);
  });

  it('ingresos: solo ventas; el dia sin ventas no aparece y el neto es la suma de lo visible', () => {
    const grupos = armarHistorial(todos, 'ingresos');

    expect(grupos.map(g => g.fecha)).toEqual(['2026-10-06', '2026-10-05']);
    expect(grupos.every(g => g.movimientos.every(m => m.tipo === 'venta'))).toBe(true);
    expect(grupos.map(g => g.neto)).toEqual([100, 200]);
  });

  it('gastos: solo gastos y el neto sale negativo', () => {
    const grupos = armarHistorial(todos, 'gastos');

    expect(grupos.map(g => g.fecha)).toEqual(['2026-10-06', '2026-10-05', '2026-10-04']);
    expect(grupos.every(g => g.movimientos.every(m => m.tipo === 'gasto'))).toBe(true);
    expect(grupos.map(g => g.neto)).toEqual([-10, -74, -30]);
  });

  it('por cobrar: solo el Yape pendiente, y el neto es ese monto', () => {
    const grupos = armarHistorial(todos, 'porCobrar');

    expect(grupos).toHaveLength(1);
    expect(grupos[0].fecha).toBe('2026-10-05');
    expect(grupos[0].movimientos).toEqual([
      { tipo: 'venta', etiqueta: 'Venta del día', metodo: 'Yape', monto: 46, porCobrar: true },
    ]);
    expect(grupos[0].neto).toBe(46);
  });

  it('un Yape ya cobrado deja de estar por cobrar', () => {
    const cobrado = { ...diaConYape, cobradoEn: '2026-10-06' };

    expect(armarHistorial([cobrado], 'porCobrar')).toEqual([]);
    const yape = armarHistorial([cobrado], 'todo')[0].movimientos.find(m => m.metodo === 'Yape');
    expect(yape?.porCobrar).toBe(false);
  });

  it('un Yape que no esta marcado pendiente no esta por cobrar', () => {
    const propio = { ...diaConYape, yapePendiente: false };
    expect(armarHistorial([propio], 'porCobrar')).toEqual([]);
  });

  it('el neto se redondea a dos decimales', () => {
    const decimal = cierreDe('2026-10-05', {
      lineas: [{ ...linea('Chicha', 3, 0.1) }],
      gastos: [{ categoria: 'gas', monto: 0.2 }],
    });
    // 0.30000000000000004 − 0.2 → 0.1
    expect(armarHistorial([decimal], 'todo')[0].neto).toBe(0.1);
  });
});

describe('editarCierre', () => {
  const perfilPropio: Perfil = {
    nombre: 'P',
    negocio: 'N',
    aceptaYape: true,
    yapeAjeno: false,
    actualizadoEn: ahora.toISOString(),
  };
  const perfilAjeno: Perfil = { ...perfilPropio, yapeAjeno: true };
  const despues = new Date('2026-10-09T09:30:00-05:00');

  const datosBase: DatosCierre = {
    fecha: '2026-10-06',
    lineas: [{ productoId: 'p-anticucho', preparadas: 20, sobrantes: 2 }],
    montoYape: 0,
    gastos: [{ categoria: 'mercaderia', monto: 100 }],
    abreCiclo: true,
  };
  const original = nuevoCierre(datosBase, PRODUCTOS_POR_DEFECTO, perfilPropio, ahora);

  // Los precios de hoy: el anticucho sube de 10 a 12.
  const anticucho = PRODUCTOS_POR_DEFECTO.find(p => p.id === 'p-anticucho');
  if (!anticucho) throw new Error('Falta el anticucho por defecto');
  const productosCaros = PRODUCTOS_POR_DEFECTO.map(p =>
    p.id === 'p-anticucho' ? cambiarPrecio(anticucho, 12, 9, '2026-10-09') : p,
  );

  it('conserva id, creadoEn y fecha, y fecha el cambio con ahora', () => {
    const editado = editarCierre(
      original,
      { ...datosBase, fecha: '2026-10-08' },
      productosCaros,
      perfilPropio,
      despues,
    );

    expect(editado.id).toBe(original.id);
    expect(editado.creadoEn).toBe(original.creadoEn);
    expect(editado.fecha).toBe('2026-10-06'); // la del original, no la de datos
    expect(editado.actualizadoEn).toBe(despues.toISOString());
  });

  it('conserva precio, costo y nombre de la linea que ya estaba, aunque hoy cueste mas', () => {
    const editado = editarCierre(
      original,
      { ...datosBase, lineas: [{ productoId: 'p-anticucho', preparadas: 25, sobrantes: 1 }] },
      productosCaros,
      perfilPropio,
      despues,
    );

    expect(editado.lineas[0]).toEqual({
      productoId: 'p-anticucho',
      nombre: 'Anticucho',
      preparadas: 25,
      sobrantes: 1,
      precioUnitario: 10,
      costoUnitario: 8.2,
    });
    expect(calcularCierre(editado).venta).toBe(240);
  });

  it('una linea de un producto nuevo copia el precio y el costo vigentes', () => {
    const editado = editarCierre(
      original,
      {
        ...datosBase,
        lineas: [
          { productoId: 'p-anticucho', preparadas: 20, sobrantes: 2 },
          { productoId: 'p-chicha', preparadas: 10, sobrantes: 0 },
        ],
      },
      productosCaros,
      perfilPropio,
      despues,
    );
    const chicha = productosCaros.find(p => p.id === 'p-chicha');

    expect(editado.lineas[0].precioUnitario).toBe(10);
    expect(editado.lineas[1]).toMatchObject({
      productoId: 'p-chicha',
      nombre: chicha?.nombre,
      precioUnitario: chicha?.precioVenta,
      costoUnitario: chicha?.costoUnitario,
    });
  });

  it('un producto nuevo desconocido es un error, como en nuevoCierre', () => {
    expect(() =>
      editarCierre(
        original,
        { ...datosBase, lineas: [{ productoId: 'p-inexistente', preparadas: 1, sobrantes: 0 }] },
        PRODUCTOS_POR_DEFECTO,
        perfilPropio,
        despues,
      ),
    ).toThrow('Producto desconocido: p-inexistente');
  });

  it('abreCiclo y gastos salen de los datos', () => {
    const editado = editarCierre(
      original,
      { ...datosBase, abreCiclo: false, gastos: [{ categoria: 'gas', monto: 15 }] },
      PRODUCTOS_POR_DEFECTO,
      perfilPropio,
      despues,
    );

    expect(editado.abreCiclo).toBe(false);
    expect(editado.gastos).toEqual([{ categoria: 'gas', monto: 15 }]);

    const sinMarcar = editarCierre(
      original,
      { ...datosBase, abreCiclo: undefined },
      PRODUCTOS_POR_DEFECTO,
      perfilPropio,
      despues,
    );
    expect(sinMarcar.abreCiclo).toBe(false);
  });

  describe('Yape', () => {
    const conYape = nuevoCierre(
      { ...datosBase, montoYape: 40 },
      PRODUCTOS_POR_DEFECTO,
      perfilAjeno,
      ahora,
    );
    const cobrado: Cierre = { ...conYape, cobradoEn: '2026-10-08' };

    it('si ya tenia Yape y sigue teniendo, conserva yapePendiente y cobradoEn', () => {
      const editado = editarCierre(
        cobrado,
        { ...datosBase, montoYape: 60 },
        PRODUCTOS_POR_DEFECTO,
        perfilPropio, // el perfil de hoy ya no es ajeno: no debe cambiar nada
        despues,
      );

      expect(editado.montoYape).toBe(60);
      expect(editado.yapePendiente).toBe(true);
      expect(editado.cobradoEn).toBe('2026-10-08');
    });

    it('si antes no tenia Yape, aplica la regla de nuevoCierre con el perfil', () => {
      const ajeno = editarCierre(
        original,
        { ...datosBase, montoYape: 30 },
        PRODUCTOS_POR_DEFECTO,
        perfilAjeno,
        despues,
      );
      const propio = editarCierre(
        original,
        { ...datosBase, montoYape: 30 },
        PRODUCTOS_POR_DEFECTO,
        perfilPropio,
        despues,
      );
      const sinPerfil = editarCierre(
        original,
        { ...datosBase, montoYape: 30 },
        PRODUCTOS_POR_DEFECTO,
        null,
        despues,
      );

      expect(ajeno.yapePendiente).toBe(true);
      expect(ajeno.cobradoEn).toBeUndefined();
      expect(propio.yapePendiente).toBe(false);
      expect(sinPerfil.yapePendiente).toBe(false);
    });

    it('si el Yape queda en cero, no hay pendiente ni cobradoEn', () => {
      const editado = editarCierre(
        cobrado,
        { ...datosBase, montoYape: 0 },
        PRODUCTOS_POR_DEFECTO,
        perfilAjeno,
        despues,
      );

      expect(editado.montoYape).toBe(0);
      expect(editado.yapePendiente).toBe(false);
      expect('cobradoEn' in editado).toBe(false);
    });
  });

  it('no muta el original ni los datos', () => {
    const copiaOriginal = JSON.stringify(original);
    const datos: DatosCierre = {
      ...datosBase,
      lineas: [
        { productoId: 'p-anticucho', preparadas: 30, sobrantes: 5 },
        { productoId: 'p-rachi', preparadas: 5, sobrantes: 0 },
      ],
      montoYape: 20,
    };
    const copiaDatos = JSON.stringify(datos);

    const editado = editarCierre(original, datos, productosCaros, perfilAjeno, despues);

    expect(editado).not.toBe(original);
    expect(editado.lineas).not.toBe(original.lineas);
    expect(JSON.stringify(original)).toBe(copiaOriginal);
    expect(JSON.stringify(datos)).toBe(copiaDatos);
  });
});

describe('mensajeBorrar', () => {
  it('con te queda positivo dice cuanto se resta del ciclo', () => {
    const dia = cierreDe('2026-10-06', {
      lineas: [linea('Anticucho', 40, 10)],
      gastos: [{ categoria: 'mercaderia', monto: 232 }],
    });
    expect(mensajeBorrar(dia)).toBe(
      '¿Borrar el cierre del martes 6 de octubre? Se van a restar S/ 168.00 de tu ciclo.',
    );
  });

  it('con te queda negativo dice cuanto se suma, sin signo menos', () => {
    // 10 × S/ 10.00 − S/ 120.00 = −S/ 20.00
    const dia = cierreDe('2026-10-06', {
      lineas: [linea('Anticucho', 10, 10)],
      gastos: [{ categoria: 'mercaderia', monto: 120 }],
    });
    expect(calcularCierre(dia).teQueda).toBe(-20);
    expect(mensajeBorrar(dia)).toBe(
      '¿Borrar el cierre del martes 6 de octubre? Se van a sumar S/ 20.00 a tu ciclo.',
    );
  });

  it('con te queda en cero dice que el ciclo no cambia', () => {
    const dia = cierreDe('2026-10-05', {
      lineas: [linea('Anticucho', 10, 10)],
      gastos: [{ categoria: 'mercaderia', monto: 100 }],
    });
    expect(calcularCierre(dia).teQueda).toBe(0);
    expect(mensajeBorrar(dia)).toBe(
      '¿Borrar el cierre del lunes 5 de octubre? El resultado registrado del ciclo no cambia.',
    );
  });

  it('un te queda de centavos de diferencia cuenta como cero', () => {
    // 0.1 + 0.2 − 0.3: en punto flotante no es 0, pero a dos decimales sí.
    const dia = cierreDe('2026-10-05', {
      gastos: [
        { categoria: 'gas', monto: 0.1 },
        { categoria: 'gas', monto: 0.2 },
      ],
      lineas: [{ ...linea('Chicha', 1, 0.3), costoUnitario: 0 }],
    });
    expect(mensajeBorrar(dia)).toContain('El resultado registrado del ciclo no cambia.');
  });
});

describe('mercaderiaDelCiclo', () => {
  const lineaCon = (
    nombre: string,
    preparadas: number,
    sobrantes: number,
    costoUnitario: number,
  ): LineaCierre => ({
    productoId: `p-${nombre.toLowerCase()}`,
    nombre,
    preparadas,
    sobrantes,
    precioUnitario: 10,
    costoUnitario,
  });
  const cicloDe = (cierres: Cierre[]): Ciclo => ({
    inicio: cierres[0].fecha,
    fin: cierres[cierres.length - 1].fecha,
    cierres,
  });

  it('suma por producto las lineas de todos los dias del ciclo', () => {
    const dia1 = cierreDe('2026-10-05', {
      lineas: [lineaCon('Rachi', 16, 5, 7.6), lineaCon('Anticucho', 20, 2, 8.2)],
    });
    const dia2 = cierreDe('2026-10-06', {
      lineas: [lineaCon('Anticucho', 20, 0, 8.2), lineaCon('Rachi', 10, 1, 7.6)],
    });

    expect(mercaderiaDelCiclo(cicloDe([dia1, dia2]))).toEqual([
      {
        productoId: 'p-anticucho',
        nombre: 'Anticucho',
        preparadas: 40,
        vendidas: 38,
        sobranteSoles: 16.4,
      },
      { productoId: 'p-rachi', nombre: 'Rachi', preparadas: 26, vendidas: 20, sobranteSoles: 45.6 },
    ]);
  });

  it('el orden es por nombre de producto, no por el orden en que aparecen', () => {
    const dia = cierreDe('2026-10-05', {
      lineas: [
        lineaCon('Rachi', 5, 0, 7.6),
        lineaCon('Chicha', 5, 0, 1.6),
        lineaCon('Anticucho', 5, 0, 8.2),
      ],
    });

    expect(mercaderiaDelCiclo(cicloDe([dia])).map(m => m.nombre)).toEqual([
      'Anticucho',
      'Chicha',
      'Rachi',
    ]);
  });

  it('un ciclo sin lineas no tiene mercaderia', () => {
    expect(
      mercaderiaDelCiclo(
        cicloDe([cierreDe('2026-10-05', { gastos: [{ categoria: 'gas', monto: 5 }] })]),
      ),
    ).toEqual([]);
  });

  it('no deja un producto vendido sin sobrantes con sobrante en soles', () => {
    const dia = cierreDe('2026-10-05', { lineas: [lineaCon('Rachi', 9, 0, 7.6)] });
    expect(mercaderiaDelCiclo(cicloDe([dia]))[0]).toMatchObject({ vendidas: 9, sobranteSoles: 0 });
  });

  it('redondea el sobrante a dos decimales y no muta el ciclo', () => {
    const dia = cierreDe('2026-10-05', {
      lineas: [lineaCon('Anticucho', 3, 1, 0.1), lineaCon('Anticucho', 3, 1, 0.2)],
    });
    const ciclo = cicloDe([dia]);
    const copia = JSON.stringify(ciclo);

    // 1 × 0.1 + 1 × 0.2 = 0.30000000000000004 → 0.3
    expect(mercaderiaDelCiclo(ciclo)[0].sobranteSoles).toBe(0.3);
    expect(JSON.stringify(ciclo)).toBe(copia);
  });
});
