/**
 * Tests del Sprint-06. Generados desde sdd/spec/Sprint-06/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

describe('SPEC-06: Reporte para el banco y cierre de entrega', () => {
  // @spec06_e1 — Constancia de registro
  it('spec06_e1 constancia de registro', () => {
    // Given: hoy 2026-10-07 y 58 cierres con fecha dentro de los últimos 90 días
    // When: se calculan las señales para el banco
    // Then: la constancia es 64% y los días registrados son 58
    throw new Error('Rojo: no implementado');
  });

  // @spec06_e2 — Promedios mensuales
  it('spec06_e2 promedios mensuales', () => {
    // Given: tres meses completos con ventas de S/ 4,900.00, S/ 5,100.00 y S/ 5,360.00, y "te queda" de S/ 2,100.00, S/ 2,200.00 y S/ 2,240.00
    // When: se calculan las señales para el banco
    // Then: la venta promedio mensual es S/ 5,120.00 y la ganancia promedio mensual es S/ 2,180.00
    throw new Error('Rojo: no implementado');
  });

  // @spec06_e3 — El reporte lleva solo totales
  it('spec06_e3 el reporte lleva solo totales', () => {
    // Given: el perfil "Freddy" con negocio "Anticuchos Freddy" y las señales del escenario 2
    // When: se genera el texto del reporte
    // Then: el texto contiene "Venta promedio mensual: S/ 5,120.00", no contiene el monto de ningún cierre individual y tiene 2,000 caracteres o menos
    throw new Error('Rojo: no implementado');
  });

  // @spec06_e4 — Con poco registro, el reporte avisa
  it('spec06_e4 con poco registro el reporte avisa', () => {
    // Given: 9 cierres registrados en total
    // When: se generan las señales para el banco
    // Then: el reporte queda marcado como en construcción con el texto "Te faltan 21 días de registro para que tu reporte sea convincente"
    throw new Error('Rojo: no implementado');
  });

  // @spec06_e5 — Nada se comparte sin tocar el botón
  it('spec06_e5 nada se comparte sin tocar el boton', () => {
    // Given: la pantalla Mi reporte con la vista previa generada
    // When: se abre la pantalla y luego se toca "Compartir reporte"
    // Then: la función de compartir no se llama al abrir la pantalla y se llama 1 sola vez, con el texto del reporte, al tocar el botón
    throw new Error('Rojo: no implementado');
  });

  // @spec06_e6 — e2e: del dato al reporte
  it('spec06_e6 e2e del dato al reporte', () => {
    // Given: la app con la semilla cargada
    // When: se abre Mi reporte y se toca "Compartir reporte"
    // Then: la pantalla muestra "Venta promedio mensual" con un monto en soles y la hoja de compartir recibe un texto que empieza con "Reporte de actividad del negocio"
    throw new Error('Rojo: no implementado');
  });
});
