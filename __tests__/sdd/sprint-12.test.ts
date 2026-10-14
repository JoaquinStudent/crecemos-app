/**
 * Tests del Sprint-12. Generados desde sdd/spec/Sprint-12-auditoria/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * Los escenarios baratos de comprobar con código están implementados. El que necesita un APK
 * release queda como `it.todo` con su razón: no se puede medir desde Jest.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';

const RAIZ = join(__dirname, '..', '..');

/** Todos los archivos .ts y .tsx de una carpeta, de forma recursiva. */
const archivosDe = (carpeta: string): string[] =>
  readdirSync(carpeta).flatMap(nombre => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivosDe(ruta);
    return /\.tsx?$/.test(nombre) ? [ruta] : [];
  });

const relativa = (ruta: string) => ruta.slice(RAIZ.length + 1).split('\\').join('/');

// Contraste WCAG 2.x entre dos colores '#RRGGBB'.
const luminancia = (hex: string): number => {
  const [r, g, b] = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string): number => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};

describe('SPEC-12: Auditoría', () => {
  // @spec12_e1 — El contraste de la paleta pasa accesibilidad
  it('spec12_e1 el contraste de la paleta pasa accesibilidad', () => {
    // Given: los colores de src/theme/colors.ts
    // When: se calcula el contraste WCAG de texto, secundario, magenta, verde y rojo sobre el fondo y la superficie
    // Then: todos los pares dan 4.5 o más, y ningún estilo de texto del código usa el naranja "accent" como color de letra
    const letras = {
      text: colors.text,
      textMuted: colors.textMuted,
      primary: colors.primary,
      success: colors.success,
      danger: colors.danger,
    };
    const fondos = { background: colors.background, surface: colors.surface };
    for (const [letra, hexLetra] of Object.entries(letras)) {
      for (const [fondo, hexFondo] of Object.entries(fondos)) {
        expect({ par: `${letra} sobre ${fondo}`, ratio: contraste(hexLetra, hexFondo) >= 4.5 }).toEqual({
          par: `${letra} sobre ${fondo}`,
          ratio: true,
        });
      }
    }

    // El naranja es solo relleno o ícono, nunca letra: ningún <Text color="accent"> ni color: colors.accent.
    const comoLetra = archivosDe(join(RAIZ, 'src')).filter(ruta => {
      const fuente = readFileSync(ruta, 'utf8');
      return /<Text[^>]*\bcolor="accent"/.test(fuente) || /\bcolor:\s*colors\.accent\b/.test(fuente);
    });
    expect(comoLetra.map(relativa)).toEqual([]);
  });

  // @spec12_e2 — Ningún texto es más chico de lo permitido
  it('spec12_e2 ningun texto es mas chico de lo permitido', () => {
    // Given: los estilos de src/theme/typography.ts
    // When: se revisan los tamaños de letra
    // Then: ninguno es menor a 14, el texto base es 18 y el monto principal es 44
    for (const [nombre, estilo] of Object.entries(typography)) {
      expect({ nombre, ok: estilo.fontSize >= 14 }).toEqual({ nombre, ok: true });
    }
    expect(typography.body.fontSize).toBe(18);
    expect(typography.hero.fontSize).toBe(44);
  });

  // @spec12_e3 — Una sola puerta a la red
  it('spec12_e3 una sola puerta a la red', () => {
    // Given: todo el código bajo src/
    // When: se buscan llamadas a fetch
    // Then: las únicas llamadas están en src/services/seed.ts y src/services/jev.ts
    const conRed = archivosDe(join(RAIZ, 'src'))
      .filter(ruta => /(?<![\w.])fetch(Fn)?\s*\(|XMLHttpRequest|\baxios\b|WebSocket/.test(readFileSync(ruta, 'utf8')))
      .map(relativa)
      .sort();
    expect(conRed).toEqual(['src/services/jev.ts', 'src/services/seed.ts']);
  });

  // @spec12_e4 — Sin rastreadores
  it('spec12_e4 sin rastreadores', () => {
    // Given: las dependencias declaradas en package.json
    // When: se buscan paquetes de analytics, publicidad o reporte de errores
    // Then: no aparece ninguno de firebase, sentry, amplitude, mixpanel, segment, appsflyer, adjust ni admob
    const paquete = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
    const declaradas = Object.keys({ ...paquete.dependencies, ...paquete.devDependencies });
    const rastreadores = declaradas.filter(nombre =>
      /firebase|sentry|amplitude|mixpanel|segment|appsflyer|adjust|admob/i.test(nombre),
    );
    expect(rastreadores).toEqual([]);
  });

  // @spec12_e5 — Ninguna pestaña sin etiqueta
  it('spec12_e5 ninguna pestana sin etiqueta', () => {
    // Given: la configuración de la barra de navegación inferior
    // When: se revisa cada pestaña
    // Then: todas declaran una etiqueta de texto además de su ícono
    // La barra es propia (BarraNavegacion): cada pestaña de Tabs.tsx tiene su ranura con una
    // etiqueta de texto no vacía, y el botón central "Cerrar día" también.
    const tabs = readFileSync(join(RAIZ, 'src', 'navigation', 'Tabs.tsx'), 'utf8');
    const barra = readFileSync(
      join(RAIZ, 'src', 'components', 'organisms', 'BarraNavegacion', 'BarraNavegacion.tsx'),
      'utf8',
    );
    const nombres = [...tabs.matchAll(/<Tab\.Screen\s+name="(\w+)"/g)].map(m => m[1]);
    expect(nombres.length).toBeGreaterThanOrEqual(4);
    expect(tabs).toMatch(/tabBar=\{/);
    for (const nombre of nombres) {
      expect(barra).toMatch(new RegExp(`${nombre}:\\s*\\{\\s*etiqueta:\\s*'[^']+'`));
    }
    expect(barra).toMatch(/ETIQUETA_CERRAR\s*=\s*'[^']+'/);
    expect(barra).toMatch(/ETIQUETA_CERRADO\s*=\s*'[^']+'/);
  });

  // @spec12_e6 — La app cabe en un plan prepago
  it.todo(
    'spec12_e6 la app cabe en un plan prepago: requiere compilar el APK release de Android (Gradle), que no corre dentro de Jest; se mide a mano o en el CI de Android (APK <= 30 MB)',
  );
});
