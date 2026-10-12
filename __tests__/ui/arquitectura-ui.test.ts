/**
 * Reglas de arquitectura del sistema de diseño:
 *  - las pantallas nunca importan `@rneui/*` (RNE vive debajo de nuestros componentes);
 *  - no hay colores hexadecimales crudos fuera de src/theme.
 */
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..', 'src');

const archivos = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });

const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('arquitectura de UI', () => {
  it('ninguna pantalla importa @rneui/*', () => {
    const culpables = archivos(path.join(SRC, 'screens')).filter(f =>
      /from\s+['"]@rneui\//.test(fs.readFileSync(f, 'utf8')),
    );
    expect(culpables).toEqual([]);
  });

  it('solo src/components y src/theme importan @rneui/*', () => {
    const culpables = archivos(SRC)
      .filter(f => !/[\\/]src[\\/](components|theme)[\\/]/.test(f))
      .filter(f => /['"]@rneui\//.test(fs.readFileSync(f, 'utf8')));
    expect(culpables).toEqual([]);
  });

  it('no hay hexadecimales crudos en componentes ni pantallas', () => {
    const culpables = archivos(SRC)
      .filter(f => /[\\/]src[\\/](components|screens)[\\/]/.test(f))
      .filter(f => /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/.test(sinComentarios(fs.readFileSync(f, 'utf8'))))
      .map(f => path.relative(SRC, f));
    expect(culpables).toEqual([]);
  });

  it('nada usa react-native-vector-icons', () => {
    const culpables = archivos(SRC).filter(f =>
      /react-native-vector-icons/.test(fs.readFileSync(f, 'utf8')),
    );
    expect(culpables).toEqual([]);
  });
});
