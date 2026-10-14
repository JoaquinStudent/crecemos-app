/**
 * La barra inferior es una capa SOBRE el contenido: la zona de arriba (donde solo sobresale el
 * círculo "Cerrar día") es transparente, el único fondo sólido va detrás de la fila de pestañas y
 * toda pantalla de pestaña con scroll deja al final el sitio de la barra + la mitad del saliente.
 */
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { colors } from '@theme';
import { nuevoCierre } from '@dominio/cierre';
import { fechaLocal, restarDias } from '@dominio/fecha';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarCierre } from '@storage/repositorio';
import {
  ALTO_RANURA,
  medidasBarra,
  rellenoInferior,
  SALIENTE,
} from '@navigation/medidasBarra';
import { desmontarApp, montarApp } from '../../testutils/app';

const esHost = (n: ReactTestRenderer.ReactTestInstance, nombre: string) =>
  (n.type as unknown) === nombre;

describe('medidasBarra: el helper que usan las pantallas', () => {
  it('el relleno de contenido es la barra (ranura + inset) más la mitad de lo que sobresale el círculo', () => {
    const m = medidasBarra(0, 'ios');
    expect(m.alturaBarra).toBe(ALTO_RANURA);
    expect(m.saliente).toBe(SALIENTE);
    expect(m.rellenoContenido).toBe(ALTO_RANURA + Math.round(SALIENTE / 2));
    expect(m.alturaTotal).toBe(ALTO_RANURA + SALIENTE);
  });

  it('suma el inset de gestos y, en Android, nunca baja de spacing.sm', () => {
    expect(medidasBarra(34, 'android').alturaBarra).toBe(ALTO_RANURA + 34);
    expect(medidasBarra(0, 'android').alturaBarra).toBe(ALTO_RANURA + rellenoInferior(0, 'android'));
    expect(medidasBarra(0, 'android').alturaBarra).toBe(ALTO_RANURA + 8);
    expect(medidasBarra(34, 'android').rellenoContenido).toBeGreaterThan(
      medidasBarra(0, 'android').rellenoContenido,
    );
  });
});

describe('BarraNavegacion superpuesta', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    const hoy = fechaLocal(new Date());
    const cierre = nuevoCierre(
      {
        fecha: restarDias(hoy, 2),
        lineas: [{ productoId: 'p-anticucho', preparadas: 30, sobrantes: 0 }],
        montoYape: 0,
        gastos: [{ categoria: 'mercaderia', monto: 100 }],
        abreCiclo: true,
      },
      PRODUCTOS_POR_DEFECTO,
      null,
      new Date(),
    );
    await guardarCierre({ ...cierre, id: 'c-barra' });
  });
  afterEach(desmontarApp);

  it('es absoluta, pegada abajo y SIN fondo propio: la zona del círculo es transparente', async () => {
    const app = await montarApp();
    const barra = app.estiloDe('barra-navegacion');
    expect(barra.position).toBe('absolute');
    expect(barra.bottom).toBe(0);
    expect(barra.left).toBe(0);
    expect(barra.right).toBe(0);
    expect(barra.backgroundColor).toBeUndefined();
    expect(barra.borderTopWidth).toBeUndefined();
  });

  it('la capa deja pasar los toques por donde no hay ranuras: el contenido de abajo sigue vivo', async () => {
    const app = await montarApp();
    expect(app.propsDe('barra-navegacion').pointerEvents).toBe('box-none');
  });

  it('el único fondo sólido es el de la fila de pestañas: blanco, con borde arriba, bajo el saliente', async () => {
    const app = await montarApp();
    const estilo = StyleSheet.flatten(
      app.buscar(n => esHost(n, 'View') && StyleSheet.flatten(n.props.style)?.top === SALIENTE)[0]
        .props.style,
    );
    expect(estilo.backgroundColor).toBe(colors.background);
    expect(estilo.borderTopWidth).toBeGreaterThan(0);
    expect(estilo.bottom).toBe(0);
    // Nada pinta de gris la zona de arriba.
    expect(app.fondosDe('barra-navegacion')).not.toContain(colors.surface);
  });

  it('Inicio, Resumen e Historial dejan al final el sitio de la barra + la mitad del círculo', async () => {
    const esperado = medidasBarra(0).rellenoContenido;
    const app = await montarApp();
    await app.tocar('tab-historial');
    await app.tocar('tab-resumen');
    const conRelleno = (testID?: string) =>
      app
        .buscar(n => esHost(n, 'RCTScrollView') && (testID === undefined || n.props.testID === testID))
        .filter(n => StyleSheet.flatten(n.props.contentContainerStyle)?.paddingBottom === esperado);
    // Historial (SectionList con testID) y al menos Inicio + Resumen.
    expect(conRelleno('historial-lista').length).toBe(1);
    expect(conRelleno().length).toBeGreaterThanOrEqual(3);
  });
});
