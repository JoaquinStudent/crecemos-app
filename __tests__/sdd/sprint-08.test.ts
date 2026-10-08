/**
 * Tests del Sprint-08. Generados desde sdd/spec/Sprint-08-jev/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

describe('SPEC-08: Chat "Preguntarle a mis datos" con Jev', () => {
  // @spec08_e1 — Una pregunta sobre un día se responde con la cifra del dominio
  it('spec08_e1 una pregunta sobre un dia se responde con la cifra del dominio', () => {
    // Given: hoy 2026-10-07, un cierre del 2026-10-06 con venta de S/ 205.00, y que Jev interpreta "¿cuánto vendí ayer?" como la intención "venta de un día" con el día "ayer"
    // When: se calcula la respuesta
    // Then: la respuesta es "Ayer, martes 6 de octubre, vendiste S/ 205.00."
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e2 — El peor día sale del día flojo
  it('spec08_e2 el peor dia sale del dia flojo', () => {
    // Given: 4 semanas de cierres donde los miércoles ganan en promedio S/ 40.00 y el promedio de todos los días es S/ 85.00, y que Jev interpreta "¿qué día me va peor?" como la intención "peor día"
    // When: se calcula la respuesta
    // Then: la respuesta es "Los miércoles son tu día más flojo: ganas S/ 45.00 menos que tu promedio."
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e3 — El producto que más deja sale de la ganancia por producto
  it('spec08_e3 el producto que mas deja sale de la ganancia por producto', () => {
    // Given: 410 porciones de pancita que dejan S/ 1.00 cada una y 270 de anticucho que dejan S/ 1.80 cada una, y que Jev interpreta "¿cuál me deja más?" como la intención "producto que más deja"
    // When: se calcula la respuesta
    // Then: la respuesta es "El anticucho es el que más te deja: S/ 1.80 por porción, S/ 486.00 en total."
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e4 — Lo que tiene por cobrar sale de los cobros
  it('spec08_e4 lo que tiene por cobrar sale de los cobros', () => {
    // Given: hoy 2026-10-07 y S/ 120.00 por cobrar con el pago más antiguo del 2026-09-29, y que Jev interpreta "¿cuánto me deben?" como la intención "cuánto por cobrar"
    // When: se calcula la respuesta
    // Then: la respuesta es "Tienes S/ 120.00 por cobrar desde el 29 de septiembre."
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e5 — Con poca confianza, no inventa
  it('spec08_e5 con poca confianza no inventa', () => {
    // Given: que Jev responde la intención con una confianza de 0.4 (el mínimo es 0.6)
    // When: se interpreta la pregunta
    // Then: la pantalla dice "No entendí tu pregunta. Prueba con una de estas:", muestra las preguntas sugeridas y no muestra ninguna cifra
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e6 — Sin internet, el apartado lo dice sin error técnico
  it('spec08_e6 sin internet el apartado lo dice sin error tecnico', () => {
    // Given: la red caída
    // When: se abre "Preguntarle a mis datos" y se toca "Preguntar"
    // Then: la pantalla dice "Necesitas internet para esto" y no muestra ningún código ni mensaje técnico
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e7 — A Jev solo viaja el texto de la pregunta
  it('spec08_e7 a jev solo viaja el texto de la pregunta', () => {
    // Given: un perfil con nombre, número de Yape y 75 cierres
    // When: se pregunta "¿cuánto vendí ayer?"
    // Then: la petición para interpretar es exactamente el tipo "interpretar" con ese texto, y no contiene el nombre, el Yape ni ningún monto de un cierre
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e8 — Al redactor solo viaja el hecho ya calculado
  it('spec08_e8 al redactor solo viaja el hecho ya calculado', () => {
    // Given: la respuesta calculada "Ayer, martes 6 de octubre, vendiste S/ 205.00."
    // When: se pide la redacción
    // Then: la petición es exactamente el tipo "redactar" con la intención y las cifras de ese hecho, y no contiene el perfil, el Yape ni ningún cierre
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e9 — Una redacción con una cifra distinta se descarta
  it('spec08_e9 una redaccion con una cifra distinta se descarta', () => {
    // Given: el hecho "vendiste S/ 205.00" y un redactor que responde "Ayer vendiste S/ 250.00"
    // When: se valida la redacción
    // Then: se descarta y la pantalla muestra la frase fija con "S/ 205.00"
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e10 — Si el redactor falla o tarda, se muestra la frase fija
  it('spec08_e10 si el redactor falla o tarda se muestra la frase fija', () => {
    // Given: un redactor que no responde en 8 segundos o devuelve un error
    // When: se pide la redacción
    // Then: la pantalla muestra la frase fija con la cifra calculada, sin ningún mensaje técnico
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e11 — Nada se envía sin tocar el botón
  it('spec08_e11 nada se envia sin tocar el boton', () => {
    // Given: la pantalla "Preguntarle a mis datos" con una pregunta escrita
    // When: se abre la pantalla y luego se toca "Preguntar"
    // Then: no hay ninguna petición de red al abrir ni al escribir, y al tocar el botón se hace 1 petición para interpretar y, si hay respuesta, 1 para redactar
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e12 — e2e: preguntar con los datos de ejemplo
  it('spec08_e12 e2e preguntar con los datos de ejemplo', () => {
    // Given: la app con la semilla cargada y servidores simulados de Jev y del redactor
    // When: se abre "Preguntarle a mis datos" y se pregunta "¿qué día me va peor?"
    // Then: la pantalla muestra una respuesta que nombra "miércoles" y una cifra en soles que coincide con la calculada por el código
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e13 — El chat muestra la pregunta y la respuesta, en orden
  it('spec08_e13 el chat muestra la pregunta y la respuesta en orden', () => {
    // Given: el chat abierto y la respuesta calculada "Ayer, martes 6 de octubre, vendiste S/ 205.00."
    // When: se escribe "¿cuánto vendí ayer?" y se toca "Preguntar"
    // Then: aparecen dos burbujas en orden, primero la pregunta y debajo la respuesta, y el campo de texto queda vacío y listo para otra pregunta
    throw new Error('Rojo: no implementado');
  });

  // @spec08_e14 — El botón flotante de Inicio abre el chat
  it('spec08_e14 el boton flotante de inicio abre el chat', () => {
    // Given: la app con la semilla cargada, en Inicio
    // When: se toca el botón flotante "Preguntar"
    // Then: se abre el chat con las preguntas sugeridas visibles, y "Atrás" vuelve a Inicio sin haber enviado ninguna petición
    throw new Error('Rojo: no implementado');
  });
});
