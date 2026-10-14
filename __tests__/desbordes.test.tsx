/**
 * Fase 1b: desbordes a 360 dp y fuentes grandes. Cada arreglo se fija por sus propiedades de
 * layout (flex, flexShrink, flexWrap, numberOfLines), porque el motor de pruebas no mide píxeles.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { StatusBar, StyleSheet } from 'react-native';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { nuevoCierre } from '@dominio/cierre';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarCierre, guardarProducto } from '@storage/repositorio';
import { desmontarApp, montarApp } from '../testutils/app';

const RAIZ = join(__dirname, '..');

const archivos = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name);
    return e.isDirectory() ? archivos(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });

const sembrarCiclo = async () => {
  for (const p of PRODUCTOS_POR_DEFECTO) await guardarProducto(p);
  const hoy = fechaLocal(new Date());
  const cierre = nuevoCierre(
    {
      fecha: restarDias(hoy, 2),
      lineas: [
        { productoId: 'p-anticucho', preparadas: 30, sobrantes: 0 },
        { productoId: 'p-pancita', preparadas: 50, sobrantes: 0 },
      ],
      montoYape: 0,
      gastos: [{ categoria: 'mercaderia', monto: 100 }],
      abreCiclo: true,
    },
    PRODUCTOS_POR_DEFECTO,
    null,
    new Date(),
  );
  await guardarCierre({ ...cierre, id: 'c-desborde' });
};

describe('tipografía: sin fontWeight en línea', () => {
  it('ni las pantallas ni la navegación ponen fontWeight (las fuentes ya traen el peso)', () => {
    const culpables = [
      ...archivos(join(RAIZ, 'src', 'screens')),
      ...archivos(join(RAIZ, 'src', 'navigation')),
      ...archivos(join(RAIZ, 'src', 'components', 'organisms', 'BarraNavegacion')),
    ].filter(f => /fontWeight/.test(readFileSync(f, 'utf8')));
    expect(culpables).toEqual([]);
  });
});

describe('desbordes a 360 dp', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(desmontarApp);

  it('Resumen: capital y resultado positivo se parten en dos líneas en vez de desbordar', async () => {
    await sembrarCiclo();
    const app = await montarApp();
    await app.tocar('tab-resumen');

    expect(app.estiloDe('resumen-capital-fila')).toMatchObject({ flexWrap: 'wrap' });
    expect(app.estiloTextoDe('resumen-capital').flexShrink).toBe(1);
    expect(app.estiloTextoDe('resumen-ganancia').flexShrink).toBe(1);
  });

  it('Resumen: "Ciclo actual" y su rango de fechas se parten en vez de recortarse', async () => {
    await sembrarCiclo();
    const app = await montarApp();
    await app.tocar('tab-resumen');

    expect(app.estiloDe('resumen-ciclo-fila')).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    expect(app.estiloTextoDe('resumen-rango').flexShrink).toBe(1);
  });

  it('Qué me deja cada uno: la etiqueta va arriba a todo el ancho y no hay anchos fijos', async () => {
    await sembrarCiclo();
    const app = await montarApp();
    await app.tocar('tab-resumen');
    await app.tocar('resumen-que-me-deja');

    expect(app.textoDe('queme-etiqueta-barra-deja-p-anticucho')).toBe('Lo que te deja en total');
    expect(app.estiloTextoDe('queme-etiqueta-barra-deja-p-anticucho').width).toBeUndefined();
    const cifra = app.estiloTextoDe('queme-cifra-deja-p-anticucho');
    expect(cifra.width).toBeUndefined();
    expect(cifra.minWidth).toBeUndefined();
    expect(cifra.flexShrink).toBe(0);
    // La etiqueta ocupa su propio renglón, encima de la fila barra + cifra.
    expect(
      app.enOrden([
        'queme-etiqueta-barra-deja-p-anticucho',
        'queme-barra-deja-p-anticucho',
        'queme-cifra-deja-p-anticucho',
      ]),
    ).toEqual([
      'queme-etiqueta-barra-deja-p-anticucho',
      'queme-barra-deja-p-anticucho',
      'queme-cifra-deja-p-anticucho',
    ]);
  });

  it('Cerrar mi día: el texto del resultado cede y el monto se achica en vez de salirse', async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');

    expect(app.estiloDe('cerrar-resultado-texto').flex).toBe(1);
    const monto = app.estiloTextoDe('cerrar-te-queda');
    expect(monto.flexShrink).toBe(0);
    expect(monto.maxWidth).toBe('55%');
  });

  it('Perfil: el nombre del producto cede ante el precio y los botones quedan alineados, sin sangría', async () => {
    await sembrarCiclo();
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-productos');

    const nombre = app.estiloTextoDe('producto-nombre-p-anticucho');
    expect(nombre.flex).toBe(1);
    expect(app.textoNodoProps('producto-nombre-p-anticucho').numberOfLines).toBe(2);
    const acciones = app.estiloDe('acciones-producto-p-anticucho');
    expect(acciones.flexWrap).toBeUndefined();
    expect(acciones.paddingLeft).toBeUndefined();
    expect(acciones.marginLeft).toBeUndefined();
    // Los tres siguen siendo botones con texto.
    expect(app.textos()).toEqual(expect.arrayContaining(['Cambiar precio', 'Editar', 'Desactivar']));
  });

  it('Perfil: "Unidad de venta" sigue funcionando al editar un producto', async () => {
    await sembrarCiclo();
    const app = await montarApp();
    await app.tocar('abrir-perfil');
    await app.tocar('perfil-opcion-productos');
    await app.tocar('editar-producto-p-anticucho');
    await app.escribir('producto-unidad', 'palito');

    expect(app.valorDe('producto-unidad')).toBe('palito');
    expect(app.textos()).toContain('Unidad de venta');
  });
});

describe('barra de estado en Perfil', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(desmontarApp);

  it('íconos claros sobre el encabezado magenta, y se restauran al salir', async () => {
    const espia = jest.spyOn(StatusBar, 'setBarStyle');
    const app = await montarApp();
    espia.mockClear();

    await app.tocar('abrir-perfil');
    expect(espia).toHaveBeenLastCalledWith('light-content');

    await app.tocar('perfil-atras');
    expect(espia).toHaveBeenLastCalledWith('dark-content');
    espia.mockRestore();
  });
});

describe('un solo nombre: "Qué me deja cada uno"', () => {
  beforeEach(() => {
    clearAllMockStorages();
  });
  afterEach(desmontarApp);

  it('el botón de Resumen y el título de la pantalla dicen lo mismo', async () => {
    await sembrarCiclo();
    const app = await montarApp();
    await app.tocar('tab-resumen');
    expect(app.textos()).toContain('Qué me deja cada uno');
    expect(app.textos()).not.toContain('Comparar productos');

    await app.tocar('resumen-que-me-deja');
    expect(app.textos().filter(t => t === 'Qué me deja cada uno').length).toBeGreaterThanOrEqual(2);
    expect(app.textos()).not.toContain('Comparar productos');
  });

  it('el enlace de Inicio también', () => {
    const fuente = readFileSync(join(RAIZ, 'src', 'screens', 'InicioScreen.tsx'), 'utf8');
    expect(fuente).not.toMatch(/Ver qué me deja cada uno/);
    expect(fuente).toMatch(/Qué me deja cada uno/);
    expect(StyleSheet).toBeDefined();
  });
});
