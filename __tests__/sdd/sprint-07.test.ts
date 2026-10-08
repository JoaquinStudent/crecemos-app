/**
 * Tests del Sprint-07. Generados desde sdd/spec/Sprint-07-foto-y-pdf/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

import { restarDias } from '@dominio/fecha';
import { avatarDe, FOTO_MAX_BYTES, quitarFoto, validarFoto } from '@dominio/foto';
import { formatoSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, Perfil, Senales } from '@dominio/tipos';
import { htmlReporte } from '@analisis/htmlReporte';
import { senalesBanco } from '@analisis/senales';

// "Hoy" es explícito: el reloj no decide ningún resultado.
const HOY: FechaNegocio = '2026-10-07';
const INSTANTE = '2026-10-07T12:00:00-05:00';

/** Base64 de `bytes` bytes (todo ceros): el largo y el relleno `=` son los de una foto real de ese peso. */
const base64DeBytes = (bytes: number): string => {
  const grupos = Math.ceil(bytes / 3);
  const relleno = grupos * 3 - bytes;
  return 'A'.repeat(grupos * 4 - relleno) + '='.repeat(relleno);
};
const fotoDe = (bytes: number): string => `data:image/jpeg;base64,${base64DeBytes(bytes)}`;

/** Un cierre de un solo producto a S/ 10.00 la porción y sin sobrantes: venta = vendidas × 10. */
const cierreDe = (fecha: FechaNegocio, vendidas: number, gasto: number): Cierre => ({
  id: `c-${fecha}`,
  fecha,
  lineas: [
    {
      productoId: 'p-anticucho',
      nombre: 'Anticucho',
      preparadas: vendidas,
      sobrantes: 0,
      precioUnitario: 10,
      costoUnitario: 8,
    },
  ],
  montoYape: 0,
  yapePendiente: false,
  gastos: gasto > 0 ? [{ categoria: 'mercaderia', monto: gasto }] : [],
  abreCiclo: false,
  creadoEn: INSTANTE,
  actualizadoEn: INSTANTE,
});

/**
 * Los tres meses completos del escenario 2 del Sprint-06 (hoy es 7 de octubre), con montos
 * individuales que no coinciden con ningún promedio ni total mensual.
 *   julio 4,900 / 2,100 · agosto 5,100 / 2,200 · septiembre 5,360 / 2,240
 */
const tresMesesCompletos = (): Cierre[] => [
  cierreDe('2026-07-03', 245, 1000),
  cierreDe('2026-07-17', 245, 1800),
  cierreDe('2026-08-05', 310, 1500),
  cierreDe('2026-08-19', 200, 1400),
  cierreDe('2026-09-08', 286, 1500),
  cierreDe('2026-09-22', 250, 1620),
  cierreDe('2026-10-05', 120, 0),
];

const perfilDe = (extra: Partial<Perfil> = {}): Perfil => ({
  nombre: 'Freddy',
  negocio: 'Anticuchos Freddy',
  aceptaYape: true,
  yapeAjeno: false,
  actualizadoEn: INSTANTE,
  ...extra,
});

describe('SPEC-07: Foto de perfil y reporte en PDF', () => {
  // @spec07_e1 — Una foto pequeña es válida; una pesada o sin formato, no
  it('spec07_e1 una foto pequena es valida una pesada o sin formato no', () => {
    // Given: una foto en formato jpeg codificada como "data:image/jpeg;base64," de 20 KB, otra de 61 KB y un texto que no empieza con "data:image/"
    // When: se validan las tres
    // Then: la primera es válida; la de 61 KB se rechaza con "Esa foto es muy pesada. Elige otra." y el texto sin formato con "Esa no parece una foto. Elige otra."
    const valida = validarFoto(fotoDe(20 * 1024));
    const pesada = validarFoto(fotoDe(61 * 1024));
    const sinFormato = validarFoto('Esto no es una foto');

    expect(61 * 1024).toBeGreaterThan(FOTO_MAX_BYTES);
    expect(valida).toEqual({ ok: true });
    expect(pesada).toEqual({ ok: false, errores: { foto: 'Esa foto es muy pesada. Elige otra.' } });
    expect(sinFormato).toEqual({
      ok: false,
      errores: { foto: 'Esa no parece una foto. Elige otra.' },
    });
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
    const avatar = avatarDe(perfilDe({ nombre: 'Freddy' }));

    expect(avatar).toEqual({ tipo: 'iniciales', texto: 'F' });
  });

  // @spec07_e4 — Quitar la foto vuelve a la inicial
  it('spec07_e4 quitar la foto vuelve a la inicial', () => {
    // Given: un perfil con nombre "Freddy" y una foto guardada
    // When: se toca "Quitar foto" y se confirma
    // Then: el perfil queda sin foto y el avatar muestra la letra "F"
    // La parte del dominio: la pantalla pide confirmación y luego llama a quitarFoto.
    const conFoto = perfilDe({ nombre: 'Freddy', fotoUri: fotoDe(20 * 1024) });
    expect(avatarDe(conFoto)).toEqual({ tipo: 'foto', uri: fotoDe(20 * 1024) });

    const sinFoto = quitarFoto(conFoto);

    expect(sinFoto.fotoUri).toBeUndefined();
    expect('fotoUri' in sinFoto).toBe(false);
    expect(avatarDe(sinFoto)).toEqual({ tipo: 'iniciales', texto: 'F' });
  });

  // @spec07_e5 — El documento lleva las cifras del reporte
  it('spec07_e5 el documento lleva las cifras del reporte', () => {
    // Given: las señales de un reporte con venta promedio mensual de S/ 5,120.00, ganancia promedio mensual de S/ 2,180.00 y constancia de 64% con 58 días registrados
    // When: se genera el HTML del reporte
    // Then: el HTML contiene "S/ 5,120.00", "S/ 2,180.00", "64 %" y "58 días registrados"
    // Las señales del escenario 2 del Sprint-06 (venta 5,120.00 y ganancia 2,180.00), con 58 días.
    const senales: Senales = {
      constancia: 64,
      diasRegistrados: 58,
      diasTranscurridos: 90,
      ventaPromedioMensual: 5120,
      gananciaPromedioMensual: 2180,
      meses: [
        { mes: '2026-07', venta: 4900, teQueda: 2100, dias: 18 },
        { mes: '2026-08', venta: 5100, teQueda: 2200, dias: 18 },
        { mes: '2026-09', venta: 5360, teQueda: 2240, dias: 18 },
      ],
      mesesCompletos: 3,
      primerCierre: '2026-07-10',
      ultimoCierre: '2026-10-06',
      registraDesde: '2026-07-03',
      antiguedadDias: 96,
      enConstruccion: false,
      diasFaltantes: 0,
    };

    const html = htmlReporte(senales, perfilDe(), HOY);

    expect(html).toContain('S/ 5,120.00');
    expect(html).toContain('S/ 2,180.00');
    expect(html).toContain('64 %');
    expect(html).toContain('58 días registrados');
  });

  // @spec07_e6 — El documento no lleva datos que no son del reporte
  it('spec07_e6 el documento no lleva datos que no son del reporte', () => {
    // Given: un perfil con número de Yape "987654321", titular "Persona de prueba", parentesco "hermana" y ubicación "Afuera de la UTP"
    // When: se genera el HTML del reporte
    // Then: el HTML no contiene ninguno de esos cuatro textos ni el monto de ningún cierre individual
    const perfil = perfilDe({
      yapeNumero: '987654321',
      yapeTitular: 'Persona de prueba',
      yapeParentesco: 'hermana',
      ubicacion: 'Afuera de la UTP',
      yapeAjeno: true,
    });
    const cierres = tresMesesCompletos();
    const s = senalesBanco(cierres, HOY);
    expect(s.mesesCompletos).toBe(3);

    const html = htmlReporte(s, perfil, HOY);

    for (const privado of ['987654321', 'Persona de prueba', 'hermana', 'Afuera de la UTP']) {
      expect(html).not.toContain(privado);
    }
    // Ni la venta, ni el "te queda", ni los gastos de ningún cierre individual (ninguno coincide
    // con un promedio ni con el total de un mes).
    for (const c of cierres) {
      const venta = c.lineas.reduce((t, l) => t + (l.preparadas - l.sobrantes) * l.precioUnitario, 0);
      const gastos = c.gastos.reduce((t, g) => t + g.monto, 0);
      for (const monto of [venta, venta - gastos, gastos].filter(m => m > 0)) {
        expect(html).not.toContain(formatoSoles(monto));
      }
    }
    // Los únicos montos en soles del documento son los dos promedios y la venta de cada mes.
    const montos = new Set(html.match(/S\/ [\d,]+\.\d{2}/g));
    expect([...montos].sort()).toEqual(
      ['S/ 2,180.00', 'S/ 4,900.00', 'S/ 5,100.00', 'S/ 5,120.00', 'S/ 5,360.00'].sort(),
    );
  });

  // @spec07_e7 — El nombre y el negocio se escapan
  it('spec07_e7 el nombre y el negocio se escapan', () => {
    // Given: un perfil con nombre "Fre<b>dy & Co"
    // When: se genera el HTML del reporte
    // Then: el HTML contiene "Fre&lt;b&gt;dy &amp; Co" y no contiene la etiqueta "<b>"
    const html = htmlReporte(
      senalesBanco(tresMesesCompletos(), HOY),
      perfilDe({ nombre: 'Fre<b>dy & Co' }),
      HOY,
    );

    expect(html).toContain('Fre&lt;b&gt;dy &amp; Co');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('Fre<b>');
  });

  // @spec07_e8 — Con poco registro, el documento avisa
  it('spec07_e8 con poco registro el documento avisa', () => {
    // Given: 9 cierres registrados en total
    // When: se genera el HTML del reporte
    // Then: el HTML contiene "Te faltan 21 días de registro para que tu reporte sea convincente" y la hoja va atenuada
    // Nueve días seguidos, del 28 de septiembre al 6 de octubre.
    const cierres = Array.from({ length: 9 }, (_, i) => cierreDe(restarDias(HOY, i + 1), 20, 100));
    expect(cierres).toHaveLength(9);
    const s = senalesBanco(cierres, HOY);
    expect(s.enConstruccion).toBe(true);
    expect(s.diasFaltantes).toBe(21);

    const html = htmlReporte(s, perfilDe(), HOY);

    expect(html).toContain('Te faltan 21 días de registro para que tu reporte sea convincente');
    expect(html).toContain('opacity');
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
