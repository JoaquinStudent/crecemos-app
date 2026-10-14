/**
 * Lo que se publica no lleva el nombre de la entidad financiera (se pueden usar los colores,
 * no el nombre). Recorre el código, los textos, los datos de ejemplo y los README.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Armada por partes para que esta prueba no se delate a sí misma.
const PROHIBIDA = new RegExp(['compar', 'tamos'].join(''), 'i');
const RAIZ = join(__dirname, '..');
const EXTENSIONES = /\.(tsx?|jsx?|json|md|js|toml|yml|yaml|html|txt)$/i;
const IGNORADAS = new Set(['node_modules', 'contexto-hack', 'Pods', 'build', '.git', 'package-lock.json']);

const archivos = (carpeta: string): string[] =>
  readdirSync(carpeta).flatMap(nombre => {
    if (IGNORADAS.has(nombre)) return [];
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return EXTENSIONES.test(nombre) ? [ruta] : [];
  });

describe('nombre público', () => {
  const carpetas = ['src', 'servidor', 'scripts', 'seed', '__tests__', 'testutils'];
  const sueltos = ['README.md', 'App.tsx', 'package.json', 'app.json', 'index.js'];

  it('ningún archivo publicado menciona a la entidad', () => {
    const todos = [
      ...carpetas.flatMap(c => archivos(join(RAIZ, c))),
      ...sueltos.map(x => join(RAIZ, x)),
    ];
    const infractores = todos.filter(ruta => PROHIBIDA.test(readFileSync(ruta, 'utf8')));
    expect(infractores).toEqual([]);
    expect(todos.length).toBeGreaterThan(100);
  });
});
