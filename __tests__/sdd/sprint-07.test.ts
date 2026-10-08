/**
 * Tests del Sprint-07. Generados desde sdd/spec/Sprint-07-foto-y-pdf/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

describe('SPEC-07: Foto de perfil y reporte en PDF', () => {
  // @spec07_e1 — Una foto pequeña es válida; una pesada o sin formato, no
  it('spec07_e1 una foto pequena es valida una pesada o sin formato no', () => {
    // Given: una foto en formato jpeg codificada como "data:image/jpeg;base64," de 20 KB, otra de 61 KB y un texto que no empieza con "data:image/"
    // When: se validan las tres
    // Then: la primera es válida; la de 61 KB se rechaza con "Esa foto es muy pesada. Elige otra." y el texto sin formato con "Esa no parece una foto. Elige otra."
    throw new Error('Rojo: no implementado');
  });

  // @spec07_e2 — Guardar la foto la conserva
  it('spec07_e2 guardar la foto la conserva', () => {
    // Given: un perfil sin foto
    // When: se guarda una foto válida y se vuelve a abrir la app
    // Then: el perfil guardado trae exactamente la misma foto y el avatar de Inicio la muestra
    throw new Error('Rojo: no implementado');
  });

  // @spec07_e3 — Sin foto, el avatar muestra la inicial
  it('spec07_e3 sin foto el avatar muestra la inicial', () => {
    // Given: un perfil con nombre "Freddy" y sin foto
    // When: se calcula qué muestra el avatar
    // Then: el avatar es de tipo iniciales y muestra la letra "F"
    throw new Error('Rojo: no implementado');
  });

  // @spec07_e4 — Quitar la foto vuelve a la inicial
  it('spec07_e4 quitar la foto vuelve a la inicial', () => {
    // Given: un perfil con nombre "Freddy" y una foto guardada
    // When: se toca "Quitar foto" y se confirma
    // Then: el perfil queda sin foto y el avatar muestra la letra "F"
    throw new Error('Rojo: no implementado');
  });

  // @spec07_e5 — El documento lleva las cifras del reporte
  it('spec07_e5 el documento lleva las cifras del reporte', () => {
    // Given: las señales de un reporte con venta promedio mensual de S/ 5,120.00, ganancia promedio mensual de S/ 2,180.00 y constancia de 64% con 58 días registrados
    // When: se genera el HTML del reporte
    // Then: el HTML contiene "S/ 5,120.00", "S/ 2,180.00", "64 %" y "58 días registrados"
    throw new Error('Rojo: no implementado');
  });

  // @spec07_e6 — El documento no lleva datos que no son del reporte
  it('spec07_e6 el documento no lleva datos que no son del reporte', () => {
    // Given: un perfil con número de Yape "987654321", titular "Persona de prueba", parentesco "hermana" y ubicación "Afuera de la UTP"
    // When: se genera el HTML del reporte
    // Then: el HTML no contiene ninguno de esos cuatro textos ni el monto de ningún cierre individual
    throw new Error('Rojo: no implementado');
  });

  // @spec07_e7 — El nombre y el negocio se escapan
  it('spec07_e7 el nombre y el negocio se escapan', () => {
    // Given: un perfil con nombre "Fre<b>dy & Co"
    // When: se genera el HTML del reporte
    // Then: el HTML contiene "Fre&lt;b&gt;dy &amp; Co" y no contiene la etiqueta "<b>"
    throw new Error('Rojo: no implementado');
  });

  // @spec07_e8 — Con poco registro, el documento avisa
  it('spec07_e8 con poco registro el documento avisa', () => {
    // Given: 9 cierres registrados en total
    // When: se genera el HTML del reporte
    // Then: el HTML contiene "Te faltan 21 días de registro para que tu reporte sea convincente" y la hoja va atenuada
    throw new Error('Rojo: no implementado');
  });

  // @spec07_e9 — El PDF no se genera ni se comparte sin tocar el botón
  it('spec07_e9 el pdf no se comparte sin tocar el boton', () => {
    // Given: la pantalla Mi reporte con la vista previa generada
    // When: se abre la pantalla y luego se toca "Compartir reporte"
    // Then: ni generar el PDF ni abrir la hoja de compartir se llaman al abrir la pantalla, y se llaman 1 sola vez al tocar el botón, con un archivo que termina en ".pdf"
    throw new Error('Rojo: no implementado');
  });

  // @spec07_e10 — e2e: del dato al PDF con la foto
  it('spec07_e10 e2e del dato al pdf con la foto', () => {
    // Given: la app con la semilla cargada y una foto de perfil guardada
    // When: se abre Mi reporte y se toca "Compartir reporte"
    // Then: la hoja de compartir recibe un archivo ".pdf" y el documento que lo originó lleva la foto y "Venta promedio mensual"
    throw new Error('Rojo: no implementado');
  });
});
