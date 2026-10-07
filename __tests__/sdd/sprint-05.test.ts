/**
 * Tests del Sprint-05. Generados desde sdd/spec/Sprint-05/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

describe('SPEC-05: Motor de decisiones', () => {
  // @spec05_e1 — Separa lo que se vende de lo que deja
  it('spec05_e1 separa lo que se vende de lo que deja', () => {
    // Given: en octubre, 410 porciones de pancita vendidas que dejan S/ 1.00 cada una y 270 de anticucho que dejan S/ 1.80 cada una
    // When: se calcula la ganancia por producto
    // Then: el que más se vende es "Pancita", el que más deja por porción es "Anticucho", y la ganancia del anticucho es S/ 486.00 contra S/ 410.00 de la pancita
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e2 — El insight dice la diferencia correcta
  it('spec05_e2 el insight dice la diferencia correcta', () => {
    // Given: los datos del escenario 1
    // When: se genera el insight
    // Then: el texto es "La pancita se vende más, pero el anticucho te deja S/ 0.80 más por porción."
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e3 — Regla de cuánto preparar
  it('spec05_e3 regla de cuanto preparar', () => {
    // Given: el rachi tuvo 5 sobrantes en el penúltimo ciclo y 6 en el último
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Te sobró rachi dos ciclos seguidos. Prepara 5 porciones menos."
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e4 — Regla de precio
  it('spec05_e4 regla de precio', () => {
    // Given: hoy 2026-10-07, el anticucho dejaba S/ 1.80 por porción en los cierres del 2026-07-09 y hoy deja S/ 1.20
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Tu anticucho te deja S/ 0.60 menos que en julio. ¿Revisas el precio?"
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e5 — Regla de retiro con ganancia
  it('spec05_e5 regla de retiro con ganancia', () => {
    // Given: un ciclo cerrado con venta de S/ 412.00 y gastos de S/ 244.00
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Puedes sacar S/ 168.00 para la casa sin tocar tu capital."
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e6 — Regla de retiro con pérdida
  it('spec05_e6 regla de retiro con perdida', () => {
    // Given: un ciclo cerrado con venta de S/ 200.00 y gastos de S/ 244.00
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Este ciclo no te dejó ganancia. Mejor no saques plata del negocio todavía."
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e7 — Regla de cobro
  it('spec05_e7 regla de cobro', () => {
    // Given: hoy 2026-10-07 y S/ 120.00 por cobrar, con el pago más antiguo del 2026-09-29
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Tienes S/ 120.00 por cobrar desde el 29 de septiembre."
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e8 — Regla del día flojo
  it('spec05_e8 regla del dia flojo', () => {
    // Given: 4 semanas de cierres donde los miércoles ganan en promedio S/ 40.00 y el promedio de todos los días es S/ 85.00
    // When: se evalúan las reglas
    // Then: aparece la recomendación "Los miércoles ganas S/ 45.00 menos que tu promedio."
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e9 — Comparación con el ciclo anterior
  it('spec05_e9 comparacion con el ciclo anterior', () => {
    // Given: el ciclo actual con "te queda" de S/ 262.00 y el anterior con S/ 214.00
    // When: se comparan los ciclos
    // Then: el texto es "Ganaste S/ 48.00 más que el ciclo pasado"
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e10 — Como máximo dos recomendaciones, por prioridad
  it('spec05_e10 como maximo dos recomendaciones por prioridad', () => {
    // Given: datos donde se activan las reglas cobro, precio, preparar, retiro y comparacion
    // When: se evalúan las reglas
    // Then: el motor devuelve exactamente 2 recomendaciones, la de cobro y la de precio, en ese orden
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e11 — Sin datos suficientes, no inventa
  it('spec05_e11 sin datos suficientes no inventa', () => {
    // Given: un solo ciclo registrado
    // When: se evalúan las reglas
    // Then: el motor devuelve 0 recomendaciones y la pantalla muestra "Cierra 2 ciclos para ver recomendaciones"
    throw new Error('Rojo: no implementado');
  });

  // @spec05_e12 — e2e: el insight aparece con los datos de ejemplo
  it('spec05_e12 e2e el insight aparece con los datos de ejemplo', () => {
    // Given: la app con la semilla cargada
    // When: se abre "Qué me deja cada uno"
    // Then: la etiqueta "El que más vendes" está en la tarjeta de Pancita, "El que más te deja" en la de Anticucho, y las 4 tarjetas están ordenadas por ganancia
    throw new Error('Rojo: no implementado');
  });
});
