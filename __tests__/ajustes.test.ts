/**
 * Preferencias de la app (Perfil → Configuración): qué valen por defecto y cómo escalan la
 * tipografía sin romper la regla 4 de UX (ningún texto baja de 14).
 */
import {
  ajustesVisuales,
  escalarTexto,
  ESCALA_TAMANO,
  TAMANO_MINIMO,
  TAMANO_POR_DEFECTO,
  VARIANTES_QUE_NO_SE_ENCOGEN,
} from '@dominio/ajustes';
import { resumenConfiguracion } from '@dominio/perfilResumen';
import { typography } from '@theme';

describe('ajustesVisuales', () => {
  it('un perfil viejo, sin los campos, arranca en Normal, con vibración y con animaciones', () => {
    expect(ajustesVisuales({})).toEqual({
      tamanoLetra: 'normal',
      vibracion: true,
      reducirAnimaciones: false,
    });
    expect(TAMANO_POR_DEFECTO).toBe('normal');
  });

  it('respeta lo que la persona eligió', () => {
    expect(
      ajustesVisuales({ tamanoLetra: 'extra', vibracion: false, reducirAnimaciones: true }),
    ).toEqual({ tamanoLetra: 'extra', vibracion: false, reducirAnimaciones: true });
  });

  it('un tamaño ilegible cae en el de por defecto', () => {
    expect(ajustesVisuales({ tamanoLetra: 'gigante' as never }).tamanoLetra).toBe('normal');
  });
});

describe('escalarTexto', () => {
  it('"Grande" es la tipografía base tal cual (cuerpo en 18)', () => {
    expect(ESCALA_TAMANO.grande).toBe(1);
    expect(escalarTexto(typography.body, ESCALA_TAMANO.grande)).toBe(typography.body);
  });

  it('el cuerpo mide 16 en Normal, 18 en Grande y 20 en Extra grande', () => {
    expect(escalarTexto(typography.body, ESCALA_TAMANO.normal).fontSize).toBe(16);
    expect(escalarTexto(typography.body, ESCALA_TAMANO.grande).fontSize).toBe(18);
    expect(escalarTexto(typography.body, ESCALA_TAMANO.extra).fontSize).toBe(20);
  });

  it('ninguna variante baja de 14 en ningún tamaño', () => {
    for (const escala of Object.values(ESCALA_TAMANO)) {
      for (const estilo of Object.values(typography)) {
        expect(escalarTexto(estilo, escala).fontSize).toBeGreaterThanOrEqual(TAMANO_MINIMO);
      }
    }
  });

  it('el interlineado conserva la proporción con el tamaño', () => {
    const base = typography.body;
    const normal = escalarTexto(base, ESCALA_TAMANO.normal);
    expect(normal.lineHeight / normal.fontSize).toBeCloseTo(base.lineHeight / base.fontSize, 1);
  });

  it('el monto principal no se achica en Normal (44) y sí crece en Extra grande', () => {
    expect(escalarTexto(typography.hero, ESCALA_TAMANO.normal, true).fontSize).toBe(44);
    expect(escalarTexto(typography.hero, ESCALA_TAMANO.extra, true).fontSize).toBeGreaterThan(44);
    expect(VARIANTES_QUE_NO_SE_ENCOGEN.has('hero')).toBe(true);
    expect(VARIANTES_QUE_NO_SE_ENCOGEN.has('body')).toBe(false);
  });

  it('conserva el resto del estilo (familia, cifras tabulares)', () => {
    const hero = escalarTexto(typography.hero, ESCALA_TAMANO.normal);
    expect(hero.fontFamily).toBe(typography.hero.fontFamily);
    expect(hero.fontVariant).toEqual(typography.hero.fontVariant);
  });
});

describe('resumenConfiguracion', () => {
  it('dice el tamaño de letra vigente', () => {
    expect(resumenConfiguracion({})).toBe('Letra normal');
    expect(resumenConfiguracion({ tamanoLetra: 'grande' })).toBe('Letra grande');
    expect(resumenConfiguracion({ tamanoLetra: 'extra' })).toBe('Letra extra grande');
  });
});
