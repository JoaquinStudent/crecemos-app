/**
 * "¿Y si subo el precio?" a 360 dp y con fuente grande: los botones de subir/bajar van lado a lado
 * y ceden (flex, minWidth, una línea que se achica) y los productos son una fila que se desliza.
 * Se fija por propiedades de layout: el motor de pruebas no mide píxeles.
 */
import { StyleSheet } from 'react-native';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { nuevoCierre } from '@dominio/cierre';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarCierre, guardarProducto } from '@storage/repositorio';
import { desmontarApp, montarApp } from '../../testutils/app';

describe('Qué me deja cada uno: simulador de precio sin desbordes', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    for (const p of PRODUCTOS_POR_DEFECTO) await guardarProducto(p);
    const cierre = nuevoCierre(
      {
        fecha: restarDias(fechaLocal(new Date()), 2),
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
    await guardarCierre({ ...cierre, id: 'c-sim' });
  });
  afterEach(desmontarApp);

  const abrir = async () => {
    const app = await montarApp();
    await app.tocar('tab-resumen');
    await app.tocar('resumen-que-me-deja');
    return app;
  };

  it('los dos botones comparten fila a partes iguales, con mínimo y salto de línea si no caben', async () => {
    const app = await abrir();
    // El envoltorio animado de cada botón es quien reparte el ancho: flex 1 y un mínimo.
    const reparten = app.buscar(n => {
      const e = StyleSheet.flatten(n.props.style);
      return typeof n.type === 'string' && e?.flex === 1 && (e?.minWidth ?? 0) > 0;
    });
    expect(reparten.length).toBeGreaterThanOrEqual(2);
    const fila = app.buscar(n => {
      const e = StyleSheet.flatten(n.props.style);
      return typeof n.type === 'string' && e?.flexDirection === 'row' && e?.flexWrap === 'wrap' && e?.gap === 12;
    });
    expect(fila.length).toBeGreaterThan(0);
  });

  it('el texto de cada botón es de una línea, se achica en vez de salirse y la etiqueta dice todo', async () => {
    const app = await abrir();
    for (const [id, titulo] of [
      ['queme-sim-bajar', 'Bajar S/ 0.50'],
      ['queme-sim-subir', 'Subir S/ 0.50'],
    ]) {
      const boton = app.buscar(n => n.props.testID === id && typeof n.type === 'string')[0];
      expect(boton.props.accessibilityLabel).toBe(titulo);
      const textos = boton.findAll(n => (n.type as unknown) === 'Text');
      expect(textos.length).toBeGreaterThan(0);
      for (const t of textos) {
        expect(t.props.numberOfLines).toBe(1);
        expect(t.props.adjustsFontSizeToFit).toBe(true);
        expect(t.props.minimumFontScale).toBeLessThan(1);
        expect(StyleSheet.flatten(t.props.style).flexShrink).toBe(1);
      }
    }
  });

  it('los productos van en una fila que se desliza hasta el borde de la tarjeta', async () => {
    const app = await abrir();
    expect(app.existe('queme-sim-producto-scroll')).toBe(true);
    const scroll = app.buscar(
      n => n.props.testID === 'queme-sim-producto-scroll' && n.props.horizontal === true,
    )[0];
    expect(scroll).toBeDefined();
    // Margen negativo = relleno de la tarjeta (16): el último chip asoma por el borde.
    expect(StyleSheet.flatten(scroll.props.style).marginHorizontal).toBe(-16);
    expect(app.existe('queme-sim-producto-p-anticucho')).toBe(true);
    expect(app.existe('queme-sim-producto-p-pancita')).toBe(true);
  });
});
