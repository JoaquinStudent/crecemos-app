/** Fase 4c: "Cuéntame tu día" llena el formulario para que se revise; nunca guarda ni sale a internet. */
import { StyleSheet } from 'react-native';
import { clearAllMockStorages } from '@react-native-async-storage/async-storage/jest';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { guardarProducto, listarCierres } from '@storage/repositorio';
import { desmontarApp, montarApp, textoCompleto } from '../testutils/app';

const FRASE = 'Preparé 60 anticuchos y me sobraron 5. Yape 120. Gasté 30 de carbón.';

describe('Cerrar mi día: Cuéntame tu día', () => {
  beforeEach(async () => {
    clearAllMockStorages();
    (global.fetch as jest.Mock).mockClear();
    await guardarProducto(PRODUCTOS_POR_DEFECTO[0]);
    await guardarProducto(PRODUCTOS_POR_DEFECTO[1]);
  });
  afterEach(desmontarApp);

  const abrir = async () => {
    const app = await montarApp();
    await app.tocar('tab-cerrar-dia');
    return app;
  };

  it('deja aire entre la pista del micrófono y el botón "Llenar mi cierre"', async () => {
    const app = await abrir();
    let nodo: ReturnType<typeof app.botonDe> | null = app.botonDe('cuentame-llenar');
    let margen = 0;
    while (nodo && margen === 0) {
      margen = StyleSheet.flatten(nodo.props.style)?.marginTop ?? 0;
      nodo = nodo.parent;
    }
    expect(margen).toBeGreaterThanOrEqual(8);
  });

  it('muestra el campo, la pista con texto y un botón secundario con nombre', async () => {
    const app = await abrir();
    expect(app.textos()).toContain('Cuéntame tu día');
    expect(app.textos()).toContain('Toca el micrófono de tu teclado para hablar');
    expect(textoCompleto(app.botonDe('cuentame-llenar'))).toBe('Llenar mi cierre');
    expect(app.propsDe('cuentame-texto').multiline).toBe(true);
  });

  it('rellena el formulario sin guardar nada y sin salir a internet', async () => {
    const app = await abrir();
    await app.escribir('cuentame-texto', FRASE);
    await app.tocar('cuentame-llenar');

    expect(app.valorDe('preparadas-p-anticucho')).toBe('60');
    expect(app.valorDe('sobrantes-p-anticucho')).toBe('5');
    expect(app.valorDe('monto-yape')).toBe('120');
    expect(app.textoDe('gasto-0-categoria')).toBe('Carbón');
    expect(app.textoDe('gasto-0-monto')).toBe('− S/ 30.00');
    expect(app.textoDe('cuentame-entendi')).toBe(
      'Entendí: 60 preparadas de anticucho, 5 sobrantes de anticucho, Yape S/ 120.00, gasto S/ 30.00 de carbón',
    );
    expect(app.existe('cuentame-no-entendi')).toBe(false);
    expect(await listarCierres()).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();

    await app.tocar('guardar-dia');
    await app.tocar('cierre-listo');
    const [cierre] = await listarCierres();
    expect(cierre.lineas[0]).toMatchObject({ productoId: 'p-anticucho', preparadas: 60, sobrantes: 5 });
    expect(cierre.montoYape).toBe(120);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('compré mercadería enciende el interruptor del ciclo', async () => {
    const app = await abrir();
    await app.escribir('cuentame-texto', 'Hoy compré mercadería');
    await app.tocar('cuentame-llenar');
    expect(app.interruptor('hoy-compre-mercaderia').props.value).toBe(true);
  });

  it('lista lo que no entendió', async () => {
    const app = await abrir();
    await app.escribir('cuentame-texto', 'Preparé 30 hamburguesas y 20 anticuchos');
    await app.tocar('cuentame-llenar');
    expect(app.valorDe('preparadas-p-anticucho')).toBe('20');
    expect(app.textoDe('cuentame-no-entendi')).toBe('No entendí: prepare 30 hamburguesas');
  });

  it('si no entiende nada, lo dice y no toca el formulario', async () => {
    const app = await abrir();
    await app.escribir('cuentame-texto', 'Hoy estuvo lento');
    await app.tocar('cuentame-llenar');
    expect(app.existe('cuentame-nada')).toBe(true);
    expect(app.valorDe('monto-yape')).toBe('');
  });

  it('no pisa lo ya escrito sin confirmar: "No, dejar como está" lo conserva', async () => {
    const app = await abrir();
    await app.escribir('preparadas-p-anticucho', '40');
    await app.escribir('cuentame-texto', FRASE);
    await app.tocar('cuentame-llenar');

    expect(app.textos()).toContain('Esto cambia lo que ya escribiste. ¿Continuar?');
    expect(app.valorDe('preparadas-p-anticucho')).toBe('40');
    expect(app.valorDe('monto-yape')).toBe('');

    await app.tocar('cuentame-dejar');
    expect(app.existe('cuentame-confirmar')).toBe(false);
    expect(app.valorDe('preparadas-p-anticucho')).toBe('40');
    expect(app.valorDe('monto-yape')).toBe('');
  });

  it('"Sí, reemplazar" aplica lo entendido', async () => {
    const app = await abrir();
    await app.escribir('preparadas-p-anticucho', '40');
    await app.escribir('cuentame-texto', FRASE);
    await app.tocar('cuentame-llenar');
    await app.tocar('cuentame-reemplazar');

    expect(app.valorDe('preparadas-p-anticucho')).toBe('60');
    expect(app.valorDe('monto-yape')).toBe('120');
    expect(app.existe('cuentame-confirmar')).toBe(false);
    expect(await listarCierres()).toEqual([]);
  });

  it('si lo escrito coincide, no pregunta', async () => {
    const app = await abrir();
    await app.escribir('preparadas-p-anticucho', '60');
    await app.escribir('cuentame-texto', FRASE);
    await app.tocar('cuentame-llenar');
    expect(app.existe('cuentame-confirmar')).toBe(false);
    expect(app.valorDe('sobrantes-p-anticucho')).toBe('5');
  });

  it('en modo edición también funciona, y pide confirmar porque ya hay datos', async () => {
    const app = await abrir();
    await app.escribir('preparadas-p-anticucho', '20');
    await app.tocar('guardar-dia');
    await app.tocar('cierre-listo');
    await app.tocar('tab-cerrar-dia');

    await app.escribir('cuentame-texto', 'Preparé 25 anticuchos');
    await app.tocar('cuentame-llenar');
    expect(app.existe('cuentame-confirmar')).toBe(true);
    await app.tocar('cuentame-reemplazar');
    expect(app.valorDe('preparadas-p-anticucho')).toBe('25');
    expect((await listarCierres())[0].lineas[0].preparadas).toBe(20);
  });
});
