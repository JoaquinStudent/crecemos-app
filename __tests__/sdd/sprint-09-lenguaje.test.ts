import { agruparCiclos, mercaderiaDelCiclo } from '@dominio/ciclo';
import { gananciaPorProducto, insight, compararCiclos } from '@analisis/metricas';
import { textoReporte } from '@analisis/senales';
import type { Cierre, Producto, ResumenCiclo } from '@dominio/tipos';

const producto: Producto = {
  id: 'p-1', nombre: 'Plato especial', unidad: 'porcion', precioVenta: 20,
  costoUnitario: 8, actualizadoEn: '2026-10-09', activo: false,
};
const cierre: Cierre = {
  id: 'c-1', fecha: '2026-10-08',
  lineas: [{ productoId: 'p-1', nombre: 'Anticucho', preparadas: 10, sobrantes: 2,
    precioUnitario: 10, costoUnitario: 6 }],
  montoYape: 30, yapePendiente: true,
  gastos: [{ categoria: 'mercaderia', monto: 20 }], abreCiclo: true,
  creadoEn: '2026-10-08T12:00:00-05:00', actualizadoEn: '2026-10-08T12:00:00-05:00',
};

describe('SPEC-09 · nombres y lenguaje', () => {
  it('spec09_e5 usa el nombre actual incluso si el producto está inactivo y conserva los importes', () => {
    const original = JSON.parse(JSON.stringify(cierre));
    const ciclo = mercaderiaDelCiclo(agruparCiclos([cierre])[0], [producto]);
    const analisis = gananciaPorProducto([cierre], '2026-10-01', [producto]);
    expect(ciclo[0]).toMatchObject({ nombre: 'Plato especial', vendidas: 8, sobranteSoles: 12 });
    expect(analisis[0]).toMatchObject({ nombre: 'Plato especial', seVende: 8, ganancia: 32, teDeja: 4 });
    expect(cierre).toEqual(original);
  });

  it('spec09_e7 explica el resultado registrado y la diferencia estimada sin llamarlos efectivo', () => {
    const actual: ResumenCiclo = { venta: 80, capital: 20, teQueda: 60, faltaParaCapital: 0 };
    const anterior: ResumenCiclo = { venta: 50, capital: 20, teQueda: 30, faltaParaCapital: 0 };
    expect(compararCiclos(actual, anterior)).toContain('Resultado registrado');
    expect(compararCiclos(actual, anterior)).not.toContain('Ganaste');
    const frase = insight([
      { productoId: 'a', nombre: 'Plato', seVende: 10, teDeja: 2, ganancia: 20 },
      { productoId: 'b', nombre: 'Vaso', seVende: 5, teDeja: 4, ganancia: 20 },
    ]);
    expect(frase).toContain('diferencia estimada');
    expect(textoReporte({ constancia: 0, diasRegistrados: 0, diasTranscurridos: 0,
      ventaPromedioMensual: 0, gananciaPromedioMensual: 0, meses: [], mesesCompletos: 0,
      antiguedadDias: 0, enConstruccion: true, diasFaltantes: 30 }, null))
      .toContain('Resultado registrado promedio mensual');
  });
});
