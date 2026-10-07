/**
 * Tests del Sprint-02. Generados desde sdd/spec/Sprint-02/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

describe('SPEC-02: Perfil y productos con precio vigente', () => {
  // @spec02_e1 — Cambiar el precio registra desde cuándo rige
  it('spec02_e1 cambiar el precio registra desde cuando rige', () => {
    // Given: el producto "Anticucho" a S/ 10.00, actualizado el 2026-07-15
    // When: se cambia su precio a S/ 11.00 el 2026-10-07
    // Then: el producto queda con precio de venta 11 y fecha de actualización 2026-10-07
    throw new Error('Rojo: no implementado');
  });

  // @spec02_e2 — El historial no cambia al subir un precio
  it('spec02_e2 el historial no cambia al subir un precio', () => {
    // Given: un cierre del 2026-10-05 con 18 anticuchos vendidos a S/ 10.00
    // When: el precio del anticucho se cambia a S/ 11.00
    // Then: la venta de ese cierre sigue siendo S/ 180.00
    throw new Error('Rojo: no implementado');
  });

  // @spec02_e3 — Los cierres nuevos usan el precio vigente
  it('spec02_e3 los cierres nuevos usan el precio vigente', () => {
    // Given: el anticucho cambió a S/ 11.00 el 2026-10-07
    // When: se crea un cierre ese día con 10 anticuchos vendidos
    // Then: la línea del cierre guarda precio unitario 11 y la venta es S/ 110.00
    throw new Error('Rojo: no implementado');
  });

  // @spec02_e4 — Avisa un precio sin revisar
  it('spec02_e4 avisa un precio sin revisar', () => {
    // Given: el producto "Rachi" actualizado el 2026-03-02 y hoy 2026-10-07
    // When: se evalúa si su precio requiere revisión
    // Then: el resultado indica revisar y el mensaje es "No cambias este precio desde hace 7 meses. ¿Sigue siendo correcto?"
    throw new Error('Rojo: no implementado');
  });

  // @spec02_e5 — No avisa un precio reciente
  it('spec02_e5 no avisa un precio reciente', () => {
    // Given: el producto "Anticucho" actualizado el 2026-09-07 y hoy 2026-10-07
    // When: se evalúa si su precio requiere revisión
    // Then: el resultado indica no revisar y no trae mensaje
    throw new Error('Rojo: no implementado');
  });

  // @spec02_e6 — Sin foto, el avatar muestra la inicial
  it('spec02_e6 sin foto el avatar muestra la inicial', () => {
    // Given: un perfil con nombre "Freddy" y sin foto
    // When: se calcula el avatar
    // Then: el avatar muestra la letra "F"
    throw new Error('Rojo: no implementado');
  });

  // @spec02_e7 — Con Yape ajeno, el Yape nace por cobrar
  it('spec02_e7 con yape ajeno el yape nace por cobrar', () => {
    // Given: un perfil con la opción "El Yape no está a mi nombre" activada
    // When: se registra un cierre con S/ 50.00 por Yape
    // Then: el cierre queda guardado con el Yape marcado como por cobrar
    throw new Error('Rojo: no implementado');
  });

  // @spec02_e8 — Rechaza un precio de venta de cero
  it('spec02_e8 rechaza un precio de venta de cero', () => {
    // Given: el formulario de "Cambiar precio" del anticucho
    // When: se intenta guardar un precio de S/ 0.00
    // Then: la validación falla con el mensaje "El precio tiene que ser mayor a cero"
    throw new Error('Rojo: no implementado');
  });

  // @spec02_e9 — e2e: cambiar el precio no toca ayer
  it('spec02_e9 e2e cambiar el precio no toca ayer', () => {
    // Given: la app con el anticucho a S/ 10.00 y un cierre de ayer con 18 anticuchos vendidos
    // When: se cambia el precio a S/ 11.00 desde Perfil y se registra hoy un cierre con 10 anticuchos vendidos
    // Then: el cierre de ayer muestra S/ 180.00 de venta y el de hoy muestra S/ 110.00
    throw new Error('Rojo: no implementado');
  });
});
