/**
 * Reglas de arquitectura del sistema de diseño:
 *  - las pantallas nunca importan `@rneui/*` (RNE vive debajo de nuestros componentes);
 *  - no hay colores hexadecimales crudos fuera de src/theme;
 *  - el recorrido guiado se usa solo a través de nuestra API (PasoGuia, useRecorrido): ninguna
 *    pantalla ni la navegación depende de la librería ni del dibujo ni de la medición nativa.
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

  describe('recorrido guiado', () => {
    // Todo lo que no es componente ni contexto: pantallas, navegación, hooks, etc.
    const fuera = (f: string) => !/[\\/]src[\\/](components|context)[\\/]/.test(f);
    const leer = (f: string) => sinComentarios(fs.readFileSync(f, 'utf8'));

    it('nada importa react-native-copilot: el mecanismo es propio y se puede cambiar', () => {
      const culpables = archivos(SRC).filter(f => /react-native-copilot/.test(leer(f)));
      expect(culpables).toEqual([]);
      const paquete = fs.readFileSync(path.join(SRC, '..', 'package.json'), 'utf8');
      expect(paquete).not.toMatch(/react-native-copilot/);
    });

    it('pantallas y navegación no importan el dibujo (RecorridoOverlay) ni la medición (medir)', () => {
      const culpables = archivos(SRC)
        .filter(fuera)
        .filter(f => /RecorridoOverlay|PasoGuia[\\/]medir/.test(leer(f)))
        .map(f => path.relative(SRC, f));
      expect(culpables).toEqual([]);
    });

    it('pantallas y navegación no miden la ventana a mano (measureInWindow): eso lo hace PasoGuia', () => {
      const culpables = archivos(SRC)
        .filter(fuera)
        .filter(f => /measureInWindow/.test(leer(f)))
        .map(f => path.relative(SRC, f));
      expect(culpables).toEqual([]);
    });

    it('el recorrido no tiene temporizadores: nada avanza ni se cierra solo', () => {
      const delRecorrido = archivos(SRC).filter(f =>
        /[\\/](PasoGuia|RecorridoOverlay)[\\/]|RecorridoProvider/.test(f),
      );
      expect(delRecorrido.length).toBeGreaterThanOrEqual(5);
      const culpables = delRecorrido
        .filter(f => /setTimeout|setInterval/.test(leer(f)))
        .map(f => path.relative(SRC, f));
      expect(culpables).toEqual([]);
    });

    it('cada paso se declara con <PasoGuia {...PASOS.x}>: los textos viven en un solo lugar', () => {
      const culpables = archivos(SRC)
        .filter(fuera)
        .filter(f => /<PasoGuia\b(?![^>]*\{\.\.\.PASOS\.)/.test(leer(f)))
        .map(f => path.relative(SRC, f));
      expect(culpables).toEqual([]);
    });
  });
});
