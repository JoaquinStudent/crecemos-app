/**
 * Tests del Sprint-09. Generados desde sdd/spec/Sprint-09-auditoria/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

describe('SPEC-09: Auditoría', () => {
  // @spec09_e1 — El contraste de la paleta pasa accesibilidad
  it('spec09_e1 el contraste de la paleta pasa accesibilidad', () => {
    // Given: los colores de src/theme/colors.ts
    // When: se calcula el contraste WCAG de texto, secundario, magenta, verde y rojo sobre el fondo y la superficie
    // Then: todos los pares dan 4.5 o más, y ningún estilo de texto del código usa el naranja "accent" como color de letra
    throw new Error('Rojo: no implementado');
  });

  // @spec09_e2 — Ningún texto es más chico de lo permitido
  it('spec09_e2 ningun texto es mas chico de lo permitido', () => {
    // Given: los estilos de src/theme/typography.ts
    // When: se revisan los tamaños de letra
    // Then: ninguno es menor a 14, el texto base es 18 y el monto principal es 44
    throw new Error('Rojo: no implementado');
  });

  // @spec09_e3 — Una sola puerta a la red
  it('spec09_e3 una sola puerta a la red', () => {
    // Given: todo el código bajo src/
    // When: se buscan llamadas a fetch
    // Then: las únicas llamadas están en src/services/seed.ts y src/services/jev.ts
    throw new Error('Rojo: no implementado');
  });

  // @spec09_e4 — Sin rastreadores
  it('spec09_e4 sin rastreadores', () => {
    // Given: las dependencias declaradas en package.json
    // When: se buscan paquetes de analytics, publicidad o reporte de errores
    // Then: no aparece ninguno de firebase, sentry, amplitude, mixpanel, segment, appsflyer, adjust ni admob
    throw new Error('Rojo: no implementado');
  });

  // @spec09_e5 — Ninguna pestaña sin etiqueta
  it('spec09_e5 ninguna pestana sin etiqueta', () => {
    // Given: la configuración de la barra de navegación inferior
    // When: se revisa cada pestaña
    // Then: todas declaran una etiqueta de texto además de su ícono
    throw new Error('Rojo: no implementado');
  });

  // @spec09_e6 — La app cabe en un plan prepago
  it('spec09_e6 la app cabe en un plan prepago', () => {
    // Given: el APK release de Android generado en el Sprint-06
    // When: se mide su tamaño
    // Then: el APK pesa 30 MB o menos
    throw new Error('Rojo: no implementado');
  });
});
