/**
 * Tipografía: Inter (cuerpo y montos) y Outfit (títulos), empaquetadas y enlazadas en Android e iOS.
 */
import fs from 'fs';
import path from 'path';
import { fuentes, typography } from '@theme';

const RAIZ = path.join(__dirname, '..', '..');

describe('tipografía', () => {
  it('cada familia usada existe como TTF en assets/fonts y en las assets de Android', () => {
    for (const familia of Object.values(fuentes)) {
      expect(fs.existsSync(path.join(RAIZ, 'assets', 'fonts', `${familia}.ttf`))).toBe(true);
      expect(
        fs.existsSync(path.join(RAIZ, 'android', 'app', 'src', 'main', 'assets', 'fonts', `${familia}.ttf`)),
      ).toBe(true);
    }
  });

  it('iOS declara las fuentes en Info.plist', () => {
    const plist = fs.readFileSync(path.join(RAIZ, 'ios', 'CuadramosApp', 'Info.plist'), 'utf8');
    expect(plist).toContain('UIAppFonts');
    for (const familia of Object.values(fuentes)) expect(plist).toContain(`${familia}.ttf`);
  });

  it('las licencias OFL viajan con las fuentes', () => {
    expect(fs.existsSync(path.join(RAIZ, 'assets', 'licencias', 'Inter-OFL.txt'))).toBe(true);
    expect(fs.existsSync(path.join(RAIZ, 'assets', 'licencias', 'Outfit-OFL.txt'))).toBe(true);
  });

  it('títulos en Outfit; cuerpo y montos en Inter', () => {
    expect(typography.display.fontFamily).toMatch(/^Outfit/);
    expect(typography.h1.fontFamily).toMatch(/^Outfit/);
    expect(typography.h2.fontFamily).toMatch(/^Outfit/);
    expect(typography.h3.fontFamily).toMatch(/^Outfit/);
    for (const v of ['body', 'bodyStrong', 'bodySmall', 'label', 'caption', 'amount', 'hero'] as const) {
      expect(typography[v].fontFamily).toMatch(/^Inter/);
    }
  });

  it('con fuentes personalizadas no se pide fontWeight (el peso va en la familia)', () => {
    for (const estilo of Object.values(typography)) {
      expect(estilo).not.toHaveProperty('fontWeight');
    }
  });

  it('los montos mantienen cifras tabulares y ninguna variante baja de 14', () => {
    expect(typography.amount.fontVariant).toContain('tabular-nums');
    expect(typography.hero.fontVariant).toContain('tabular-nums');
    for (const estilo of Object.values(typography)) expect(estilo.fontSize).toBeGreaterThanOrEqual(14);
  });
});
