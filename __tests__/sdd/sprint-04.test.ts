/**
 * Tests del Sprint-04. Generados desde sdd/spec/Sprint-04/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

describe('SPEC-04: Cobros pendientes y carga inicial desde el Mock API', () => {
  // @spec04_e1 — Total por cobrar
  it('spec04_e1 total por cobrar', () => {
    // Given: un cierre con S/ 50.00 de Yape por cobrar, otro con S/ 46.00 por cobrar y otro con S/ 30.00 ya cobrado
    // When: se calcula el total por cobrar
    // Then: el total es S/ 96.00 repartido en 2 pagos
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e2 — Marcar como cobrado
  it('spec04_e2 marcar como cobrado', () => {
    // Given: dos cierres con Yape por cobrar que suman S/ 96.00
    // When: se marcan como cobrados el 2026-10-07
    // Then: el total por cobrar es S/ 0.00 y ambos cierres tienen fecha de cobro 2026-10-07
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e3 — Carga la semilla en el primer arranque
  it('spec04_e3 carga la semilla en el primer arranque', () => {
    // Given: el almacenamiento vacío y un servidor que responde la semilla con 4 productos y 40 cierres
    // When: arranca la app
    // Then: quedan guardados 4 productos y 40 cierres, y la clave "@crecemos/seed" tiene la fecha de carga
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e4 — Sin internet la app abre igual
  it('spec04_e4 sin internet la app abre igual', () => {
    // Given: el almacenamiento vacío y la red caída
    // When: arranca la app
    // Then: la app queda lista con 0 cierres, no muestra ningún error técnico y ofrece el botón "Cargar datos de ejemplo"
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e5 — No descarga dos veces
  it('spec04_e5 no descarga dos veces', () => {
    // Given: la semilla ya se cargó en un arranque anterior
    // When: la app arranca de nuevo
    // Then: no se hace ninguna petición de red
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e6 — Las fechas de la semilla se calculan desde hoy
  it('spec04_e6 las fechas de la semilla se calculan desde hoy', () => {
    // Given: un cierre de la semilla con "diasAtras" 1 y hoy 2026-10-07
    // When: se materializa la semilla
    // Then: el cierre queda con fecha 2026-10-06
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e7 — La semilla pesa poco
  it('spec04_e7 la semilla pesa poco', () => {
    // Given: el archivo sdd/database/seed/semilla.json generado
    // When: se mide su tamaño
    // Then: pesa 50 KB o menos
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e8 — Una semilla inválida no guarda nada
  it('spec04_e8 una semilla invalida no guarda nada', () => {
    // Given: el almacenamiento vacío y un servidor que responde un JSON sin el campo "cierres"
    // When: arranca la app
    // Then: no se guarda ningún producto ni cierre y la app muestra "No pudimos cargar los datos de ejemplo"
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e9 — La semilla contiene lo que dijo Freddy
  it('spec04_e9 la semilla contiene lo que dijo freddy', () => {
    // Given: la semilla generada con la semilla fija "crecemos-20261007"
    // When: se analizan sus cierres
    // Then: la pancita tiene más porciones vendidas que el anticucho, el anticucho deja más por porción que la pancita, y el miércoles es el día de menor venta promedio
    throw new Error('Rojo: no implementado');
  });

  // @spec04_e10 — e2e: primer arranque con datos de ejemplo
  it('spec04_e10 e2e primer arranque con datos de ejemplo', () => {
    // Given: la app recién instalada y un servidor que responde la semilla
    // When: arranca la app y se abre Inicio
    // Then: Inicio muestra un monto en "Te queda" distinto de "S/ 0.00" y la tarjeta "Yape por cobrar" con su total
    throw new Error('Rojo: no implementado');
  });
});
