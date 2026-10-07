/**
 * Tests del Sprint-03. Generados desde sdd/spec/Sprint-03/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

describe('SPEC-03: Historial y ciclos de compra', () => {
  // @spec03_e1 — Agrupa cierres en ciclos de compra
  it('spec03_e1 agrupa cierres en ciclos de compra', () => {
    // Given: cierres del 1, 2, 3 y 4 de octubre de 2026, con "hoy compré mercadería" marcado el 1 y el 3
    // When: se agrupan en ciclos
    // Then: resultan 2 ciclos, el primero con los cierres del 1 y 2, y el segundo con los del 3 y 4
    throw new Error('Rojo: no implementado');
  });

  // @spec03_e2 — Capital y te queda del ciclo
  it('spec03_e2 capital y te queda del ciclo', () => {
    // Given: un ciclo con gastos de mercadería por S/ 220.00, otros gastos por S/ 24.00 y venta total de S/ 412.00
    // When: se resume el ciclo
    // Then: el capital es S/ 244.00 y "te queda" es S/ 168.00
    throw new Error('Rojo: no implementado');
  });

  // @spec03_e3 — Cuándo recuperó su capital
  it('spec03_e3 cuando recupero su capital', () => {
    // Given: un ciclo con capital de S/ 244.00, venta de S/ 180.00 el 2026-10-05 y de S/ 232.00 el 2026-10-06
    // When: se calcula la recuperación del capital
    // Then: el capital se recuperó el 2026-10-06
    throw new Error('Rojo: no implementado');
  });

  // @spec03_e4 — Todavía no recupera su capital
  it('spec03_e4 todavia no recupera su capital', () => {
    // Given: un ciclo en curso con capital de S/ 244.00 y venta de S/ 180.00 en su único día
    // When: se calcula la recuperación del capital
    // Then: falta S/ 64.00 y el texto es "Te falta S/ 64.00 para recuperar tu capital"
    throw new Error('Rojo: no implementado');
  });

  // @spec03_e5 — Historial por día, del más reciente al más antiguo
  it('spec03_e5 historial por dia del mas reciente al mas antiguo', () => {
    // Given: cierres del 4, 5 y 6 de octubre de 2026
    // When: se arma el historial sin filtro
    // Then: el primer grupo se titula "Martes 6 de octubre", el último "Domingo 4 de octubre", y cada grupo muestra su neto en soles
    throw new Error('Rojo: no implementado');
  });

  // @spec03_e6 — Filtra lo que está por cobrar
  it('spec03_e6 filtra lo que esta por cobrar', () => {
    // Given: 3 cierres, de los cuales solo el del 2026-10-05 tiene Yape por cobrar
    // When: se arma el historial con el filtro "Por cobrar"
    // Then: el historial tiene 1 grupo, titulado "Lunes 5 de octubre"
    throw new Error('Rojo: no implementado');
  });

  // @spec03_e7 — Borrar dice la consecuencia en soles
  it('spec03_e7 borrar dice la consecuencia en soles', () => {
    // Given: el cierre del martes 6 de octubre con "te queda" de S/ 168.00
    // When: se pide la confirmación para borrarlo
    // Then: el mensaje es "¿Borrar el cierre del martes 6 de octubre? Se van a restar S/ 168.00 de tu ciclo."
    throw new Error('Rojo: no implementado');
  });

  // @spec03_e8 — Lo que sobró, en soles
  it('spec03_e8 lo que sobro en soles', () => {
    // Given: una línea de "Rachi" con 16 preparadas, 5 sobrantes y costo de S/ 7.60 por porción
    // When: se calcula el sobrante en soles
    // Then: el sobrante es S/ 38.00 y el texto es "Te sobró S/ 38.00 en rachi"
    throw new Error('Rojo: no implementado');
  });

  // @spec03_e9 — Fechas y montos en palabras de Freddy
  it('spec03_e9 fechas y montos en palabras de freddy', () => {
    // Given: la fecha 2026-10-06 y el monto 1240
    // When: se formatean para la pantalla
    // Then: la fecha se muestra como "Martes 6 de octubre" y el monto como "S/ 1,240.00"
    throw new Error('Rojo: no implementado');
  });

  // @spec03_e10 — e2e: ver el ciclo después de dos cierres
  it('spec03_e10 e2e ver el ciclo despues de dos cierres', () => {
    // Given: la app sin datos, con el anticucho a S/ 10.00
    // When: se registra un cierre marcado "hoy compré mercadería" con S/ 150.00 de gasto y 20 anticuchos vendidos, luego otro al día siguiente con 15 vendidos, y se abre Resumen
    // Then: Resumen muestra el ciclo con capital "S/ 150.00" y "te queda" "S/ 200.00", e Historial muestra 2 grupos
    throw new Error('Rojo: no implementado');
  });
});
