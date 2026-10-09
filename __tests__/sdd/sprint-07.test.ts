/**
 * Tests del Sprint-07. Generados desde sdd/spec/Sprint-07-foto-y-pdf/SPEC.md
 * Nombre obligatorio: 'spec<NN>_e<K> <descripcion>'. Ver sdd/domain.md
 *
 * ROJOS A PROPÓSITO (LEY 1 · SDD): el contrato existe antes que el código.
 * La tarea del sprint es ponerlos en verde sin relajar ninguna aserción.
 */

/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';
import { createElement } from 'react';
import ReactTestRenderer, { act, ReactTestInstance } from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { generatePDF } from 'react-native-html-to-pdf';
import { launchImageLibrary } from 'react-native-image-picker';
import Share from 'react-native-share';
import App from '../../App';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { armarFotoUri, avatarDe, FOTO_MAX_BYTES, quitarFoto, validarFoto } from '@dominio/foto';
import { formatoSoles } from '@dominio/formato';
import { materializarSemilla, validarSemilla } from '@dominio/semilla';
import type { Cierre, FechaNegocio, Perfil, Senales } from '@dominio/tipos';
import { htmlReporte, NOMBRE_ARCHIVO_PDF } from '@analisis/htmlReporte';
import { senalesBanco } from '@analisis/senales';
import { guardarCierre, guardarPerfil, importarSemilla, obtenerPerfil } from '@storage/repositorio';

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

// La app real, montada como en el teléfono (como en spec06_e5 y spec06_e6).
const RUTA_SEMILLA = join(__dirname, '..', '..', 'seed', 'semilla.json');
let montada: ReactTestRenderer.ReactTestRenderer | null = null;
const montarApp = async () => {
  await act(async () => {
    montada = ReactTestRenderer.create(createElement(App));
  });
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise(resolver => setTimeout(resolver, 0));
    });
  }
};
const desmontarApp = async () => {
  const app = montada;
  montada = null;
  if (app) await act(async () => app.unmount());
};
const raiz = (): ReactTestInstance => {
  if (!montada) throw new Error('La app no está montada');
  return (montada as ReactTestRenderer.ReactTestRenderer).root;
};
const tocarBoton = (testID: string) =>
  act(async () => {
    const nodo = raiz().findAll(
      n => n.props.testID === testID && typeof n.props.onPress === 'function',
    )[0];
    if (!nodo) throw new Error(`No hay nada con testID "${testID}" que responda a onPress`);
    await nodo.props.onPress();
  });
const textoCompleto = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(textoCompleto).join('');
const textosEnPantalla = (): string[] =>
  raiz()
    .findAll(n => (n.type as unknown) === 'Text')
    .map(textoCompleto);
const textoDe = (testID: string): string => {
  const nodo = raiz().findAll(n => (n.type as unknown) === 'Text' && n.props.testID === testID)[0];
  if (!nodo) throw new Error(`No hay ningún texto con testID "${testID}"`);
  return textoCompleto(nodo);
};
const hayNodo = (testID: string): boolean => raiz().findAll(n => n.props.testID === testID).length > 0;

// Todos los temporizadores quedan reales (la app y el almacenamiento esperan promesas de verdad);
// solo el reloj se fija, como en spec06_e5.
const SIN_FALSEAR = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

const generar = jest.mocked(generatePDF);
const abrirHoja = jest.mocked(Share.open);

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
  it('spec07_e2 guardar la foto la conserva', async () => {
    // Given: un perfil sin foto
    // When: se guarda una foto válida y se vuelve a abrir la app
    // Then: el perfil guardado trae exactamente la misma foto y el avatar de Inicio la muestra
    // La app real y el almacenamiento real de Jest: la foto entra por el selector de la galería
    // (simulado), se guarda desde Perfil, se desmonta la app y se vuelve a montar.
    clearAllMockStorages();
    await guardarPerfil(perfilDe({ nombre: 'Freddy' }));
    expect((await obtenerPerfil())?.fotoUri).toBeUndefined();

    const base64 = base64DeBytes(20 * 1024);
    const esperada = armarFotoUri(base64, 'image/jpg');
    expect(validarFoto(esperada)).toEqual({ ok: true });
    jest
      .mocked(launchImageLibrary)
      .mockResolvedValueOnce({ assets: [{ base64, type: 'image/jpg' }] });

    let app: ReactTestRenderer.ReactTestRenderer | null = null;
    const montar = async () => {
      await act(async () => {
        app = ReactTestRenderer.create(createElement(App));
      });
      for (let i = 0; i < 5; i += 1) {
        await act(async () => {
          await new Promise(resolver => setTimeout(resolver, 0));
        });
      }
    };
    const desmontar = async () => {
      const actual = app as ReactTestRenderer.ReactTestRenderer | null;
      app = null;
      if (actual) await act(async () => actual.unmount());
    };
    const hay = (testID: string): boolean =>
      (app as unknown as ReactTestRenderer.ReactTestRenderer).root.findAll(
        n => n.props.testID === testID,
      ).length > 0;
    const tocar = (testID: string) =>
      act(async () => {
        const nodo = (app as unknown as ReactTestRenderer.ReactTestRenderer).root.findAll(
          n => n.props.testID === testID && typeof n.props.onPress === 'function',
        )[0];
        if (!nodo) throw new Error(`No hay nada con testID "${testID}" que responda a onPress`);
        await nodo.props.onPress();
      });

    try {
      await montar();
      expect(hay('inicio-avatar-iniciales')).toBe(true);
      expect(hay('inicio-avatar-foto')).toBe(false);

      await tocar('abrir-perfil');
      await tocar('perfil-foto-galeria');
      expect((await obtenerPerfil())?.fotoUri).toBe(esperada);
    } finally {
      await desmontar();
    }

    // Se vuelve a abrir la app: lo guardado manda.
    expect((await obtenerPerfil())?.fotoUri).toBe(esperada);
    try {
      await montar();
      expect(hay('inicio-avatar-foto')).toBe(true);
      expect(hay('inicio-avatar-iniciales')).toBe(false);
      const imagen = (app as unknown as ReactTestRenderer.ReactTestRenderer).root.findAll(
        n => n.props.testID === 'inicio-avatar-foto' && n.props.source !== undefined,
      )[0];
      expect(imagen.props.source).toEqual({ uri: esperada });
    } finally {
      await desmontar();
    }
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
    return (async () => {
      clearAllMockStorages();
      generar.mockClear();
      abrirHoja.mockClear();
      // Hoy es el 7 de octubre; hay tres meses completos y el perfil de Freddy.
      jest.useFakeTimers({ doNotFake: [...SIN_FALSEAR], now: new Date('2026-10-07T12:00:00-05:00') });
      try {
        const cierres = tresMesesCompletos();
        for (const c of cierres) await guardarCierre(c);
        await guardarPerfil(perfilDe());

        await montarApp();
        // Resumen → "Mi reporte": la vista previa ya está generada.
        await tocarBoton('tab-resumen');
        await tocarBoton('resumen-mi-reporte');
        expect(hayNodo('reporte-hoja')).toBe(true);
        expect(textoDe('reporte-venta-promedio')).toBe('S/ 5,120.00');
        expect(textosEnPantalla()).toContain('Compartir reporte');

        // Abrir la pantalla no genera ni comparte nada.
        expect(generar).not.toHaveBeenCalled();
        expect(abrirHoja).not.toHaveBeenCalled();

        // Solo el botón lo hace: una vez cada uno, con un archivo .pdf.
        await tocarBoton('reporte-compartir-pdf');
        expect(generar).toHaveBeenCalledTimes(1);
        expect(abrirHoja).toHaveBeenCalledTimes(1);
        const hoja = abrirHoja.mock.calls[0][0];
        expect(hoja.url?.startsWith('file://')).toBe(true);
        expect(hoja.url?.endsWith('.pdf')).toBe(true);
        expect(hoja.type).toBe('application/pdf');
        // El documento que lo originó es el del reporte de hoy.
        expect(generar.mock.calls[0][0].html).toBe(
          htmlReporte(senalesBanco(cierres, HOY), perfilDe(), HOY),
        );
      } finally {
        jest.useRealTimers();
        await desmontarApp();
      }
    })();
  });

  // @spec07_e10 — e2e: del dato al PDF con la foto
  it('spec07_e10 e2e del dato al pdf con la foto', () => {
    // Given: la app con la semilla cargada y una foto de perfil guardada
    // When: se abre Mi reporte y se toca "Compartir reporte"
    // Then: la hoja de compartir recibe un archivo ".pdf" y el documento que lo originó lleva la foto y "Venta promedio mensual"
    return (async () => {
      clearAllMockStorages();
      generar.mockClear();
      abrirHoja.mockClear();
      const texto = readFileSync(RUTA_SEMILLA, 'utf8');
      const validada = validarSemilla(JSON.parse(texto));
      if (!validada.ok) throw new Error('La semilla del repositorio no valida');
      const fetchPorDefecto = global.fetch;
      global.fetch = jest.fn(
        async () => ({ ok: true, status: 200, text: async () => texto } as unknown as Response),
      ) as unknown as typeof fetch;
      try {
        // Una foto de perfil ya guardada, como la deja "Mi perfil".
        await importarSemilla(materializarSemilla(validada.semilla, new Date()), new Date().toISOString());
        const foto = armarFotoUri(base64DeBytes(2 * 1024), 'image/jpg');
        expect(validarFoto(foto)).toEqual({ ok: true });
        await guardarPerfil(perfilDe({ fotoUri: foto }));

        await montarApp();

        // Resumen → "Mi reporte".
        await tocarBoton('tab-resumen');
        await tocarBoton('resumen-mi-reporte');

        // Lo esperado sale del dominio, con la misma semilla y el mismo "hoy" que usa la app.
        const { cierres } = materializarSemilla(validada.semilla, new Date());
        const hoy = fechaLocal(new Date());
        const senales = senalesBanco(cierres, hoy);
        expect(senales.ventaPromedioMensual).toBeGreaterThan(0);
        expect(textoDe('reporte-venta-promedio')).toBe(formatoSoles(senales.ventaPromedioMensual));

        // La hoja de compartir recibe un archivo .pdf...
        await tocarBoton('reporte-compartir-pdf');
        expect(generar).toHaveBeenCalledTimes(1);
        expect(abrirHoja).toHaveBeenCalledTimes(1);
        const hoja = abrirHoja.mock.calls[0][0];
        expect(hoja.url?.startsWith('file://')).toBe(true);
        expect(hoja.url?.endsWith('.pdf')).toBe(true);
        expect(hoja.type).toBe('application/pdf');

        // ...y el documento que lo originó lleva la foto y las cifras del reporte.
        const documento = generar.mock.calls[0][0];
        expect(documento.fileName).toBe(NOMBRE_ARCHIVO_PDF(hoy));
        expect(documento.html).toContain('Venta promedio mensual');
        expect(documento.html).toContain(foto);
        expect(documento.html).toContain(formatoSoles(senales.ventaPromedioMensual));
        expect(documento.html).toBe(htmlReporte(senales, perfilDe({ fotoUri: foto }), hoy));
      } finally {
        global.fetch = fetchPorDefecto;
        await desmontarApp();
      }
    })();
  });
});
