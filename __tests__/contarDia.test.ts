import { interpretarDia, resumenEntendido } from '../src/analisis/contarDia';
import { PRODUCTOS_POR_DEFECTO } from '../src/dominio/productosPorDefecto';
import type { Producto } from '../src/dominio/tipos';

const P = PRODUCTOS_POR_DEFECTO;
const A = 'p-anticucho';
const PA = 'p-pancita';
const R = 'p-rachi';
const CH = 'p-chicha';

type Esperado = {
  cantidades?: Record<string, { preparadas?: number; sobrantes?: number }>;
  yape?: number;
  gastos?: { categoria: string; monto: number }[];
  abre?: boolean;
  noEntendido?: string[];
};

const casos: [string, string, Esperado][] = [
  ['ejemplo del placeholder', 'Preparé 60 anticuchos y me sobraron 5. Yape 120. Gasté 30 de carbón.', {
    cantidades: { [A]: { preparadas: 60, sobrantes: 5 } }, yape: 120, gastos: [{ categoria: 'carbon', monto: 30 }] }],
  ['sin tildes ni mayúsculas', 'prepare 60 anticuchos y me sobraron 5 yape 120 gaste 30 de carbon', {
    cantidades: { [A]: { preparadas: 60, sobrantes: 5 } }, yape: 120, gastos: [{ categoria: 'carbon', monto: 30 }] }],
  ['palabras de número', 'Saqué cuarenta y cinco anticuchos y me quedaron cinco', {
    cantidades: { [A]: { preparadas: 45, sobrantes: 5 } } }],
  ['ciento veinte', 'Hice ciento veinte anticuchos', { cantidades: { [A]: { preparadas: 120 } } }],
  ['docientos tolerado', 'Llevé docientos anticuchos', { cantidades: { [A]: { preparadas: 200 } } }],
  ['varios productos', 'Hice 60 anticuchos, 40 pancita y 30 rachi', {
    cantidades: { [A]: { preparadas: 60 }, [PA]: { preparadas: 40 }, [R]: { preparadas: 30 } } }],
  ['sobrantes de varios', 'Me sobraron 5 de pancita y 3 de rachi', {
    cantidades: { [PA]: { sobrantes: 5 }, [R]: { sobrantes: 3 } } }],
  ['plural y singular', 'Preparé 20 chichas', { cantidades: { [CH]: { preparadas: 20 } } }],
  ['producto primero', 'Preparé anticuchos 60 y pancita 40', {
    cantidades: { [A]: { preparadas: 60 }, [PA]: { preparadas: 40 } } }],
  ['vendí todo', 'Preparé 60 anticuchos y 40 pancita. Vendí todo', {
    cantidades: { [A]: { preparadas: 60, sobrantes: 0 }, [PA]: { preparadas: 40, sobrantes: 0 } } }],
  ['no sobró nada de un producto', 'Hice 50 pancita y 40 rachi. No sobró nada de pancita', {
    cantidades: { [PA]: { preparadas: 50, sobrantes: 0 }, [R]: { preparadas: 40 } } }],
  ['yape con soles', 'Me entró por yape 120 soles', { yape: 120 }],
  ['yape al final', 'Fueron 85 de yape', { yape: 85 }],
  ['yape decimal con coma', 'Yape 120,50', { yape: 120.5 }],
  ['yape S/', 'Yape S/ 95.50', { yape: 95.5 }],
  ['yape en palabras', 'yape ciento cincuenta soles', { yape: 150 }],
  ['y medio', 'Gasté dos y medio soles de movilidad', { gastos: [{ categoria: 'movilidad', monto: 2.5 }] }],
  ['taxi es movilidad', 'Gasté 15 soles de taxi', { gastos: [{ categoria: 'movilidad', monto: 15 }] }],
  ['pasaje', 'Pagué 8 soles de pasaje', { gastos: [{ categoria: 'movilidad', monto: 8 }] }],
  ['balón es gas', 'Compré un balón de gas por 50 soles', { gastos: [{ categoria: 'gas', monto: 50 }] }],
  ['gas con S/', 'Gasté S/ 45 en gas', { gastos: [{ categoria: 'gas', monto: 45 }] }],
  ['categoría primero', 'Carbón 30, gas 20', { gastos: [{ categoria: 'carbon', monto: 30 }, { categoria: 'gas', monto: 20 }] }],
  ['dos gastos', 'Gasté treinta soles de carbón y 20 de movilidad', {
    gastos: [{ categoria: 'carbon', monto: 30 }, { categoria: 'movilidad', monto: 20 }] }],
  ['compré mercadería sin monto', 'Hoy compré mercadería', { abre: true }],
  ['compré mercadería con monto', 'Compré mercadería por 200 soles', { abre: true, gastos: [{ categoria: 'mercaderia', monto: 200 }] }],
  ['no compré mercadería', 'Hoy no compré mercadería', {}],
  ['gasto sin categoría', 'Gasté 12 soles', { gastos: [{ categoria: 'otro', monto: 12 }] }],
  ['lucas no se interpretan', 'Yape 3 lucas', { noEntendido: ['3 lucas'] }],
  ['producto desconocido', 'Preparé 30 hamburguesas y 60 anticuchos', {
    cantidades: { [A]: { preparadas: 60 } }, noEntendido: ['prepare 30 hamburguesas'] }],
  ['número sin decir qué es', 'Hice 60 anticuchos. 5 pancita', { cantidades: { [A]: { preparadas: 60 } }, noEntendido: ['5 pancita'] }],
  ['sobraron sin producto con varios', 'Sobraron 5', { noEntendido: ['sobraron 5'] }],
  ['cantidad con decimales no vale', 'Preparé 2.5 anticuchos', { noEntendido: ['prepare 2,5 anticuchos'] }],
  ['contradicción', 'Preparé 60 anticuchos y preparé 50 anticuchos', {
    cantidades: { [A]: { preparadas: 60 } }, noEntendido: ['prepare 50 anticuchos'] }],
  ['vendí todo sin nada preparado', 'Vendí todo', { noEntendido: ['vendi todo'] }],
  ['vendí 50 no es preparar', 'Vendí 50 anticuchos', { noEntendido: ['50 anticuchos'] }],
  ['ambiguo entre producto y número', 'Preparé anticuchos 60 pancita 40', { noEntendido: ['anticuchos 60 pancita 40'] }],
  ['solo comentario', 'Hoy estuvo lento', { noEntendido: ['Hoy estuvo lento'] }],
  ['vacío', '', {}],
  ['solo espacios', '   ', {}],
  ['basura', '!!!??? ...', {}],
  ['un yape no es 1', 'Me hicieron un yape de 20', { yape: 20 }],
];

describe('interpretarDia (tabla de frases)', () => {
  it.each(casos)('%s', (_n, frase, esp) => {
    const r = interpretarDia(frase, P);
    expect(r.cantidades).toEqual(esp.cantidades ?? {});
    expect(r.montoYape).toBe(esp.yape);
    expect(r.gastos).toEqual(esp.gastos ?? []);
    expect(r.abreCiclo).toBe(esp.abre);
    expect(r.noEntendido).toEqual(esp.noEntendido ?? []);
  });
});

describe('interpretarDia (otros)', () => {
  it('con un solo producto, "sobraron 5" se le asigna a ese', () => {
    const solo: Producto[] = [P[0]];
    const r = interpretarDia('Preparé 60 y me sobraron 5', solo);
    expect(r.cantidades).toEqual({ [A]: { preparadas: 60, sobrantes: 5 } });
    expect(r.notas.length).toBeGreaterThan(0);
  });

  it('nombre parcial: "chicha" encuentra "Chicha morada"; si hay dos, no adivina', () => {
    const morada: Producto = { ...P[3], id: 'p-morada', nombre: 'Chicha morada' };
    expect(interpretarDia('Hice 10 chichas', [morada]).cantidades).toEqual({ 'p-morada': { preparadas: 10 } });
    const dos: Producto[] = [morada, { ...P[3], id: 'p-jora', nombre: 'Chicha de jora' }];
    const r = interpretarDia('Hice 10 chichas', dos);
    expect(r.cantidades).toEqual({});
    expect(r.noEntendido.length).toBe(1);
  });

  it('el nombre completo gana sobre el parcial', () => {
    const dos: Producto[] = [{ ...P[3], id: 'c1', nombre: 'Chicha' }, { ...P[3], id: 'c2', nombre: 'Chicha morada' }];
    expect(interpretarDia('Hice 10 chicha morada y 5 chicha', dos).cantidades).toEqual({
      c2: { preparadas: 10 }, c1: { preparadas: 5 } });
  });

  it('avisa si los sobrantes superan lo preparado', () => {
    const r = interpretarDia('Preparé 5 anticuchos y me sobraron 9', P);
    expect(r.notas.some(n => n.includes('anticucho'))).toBe(true);
  });

  it('el resumen está en palabras simples', () => {
    const r = interpretarDia('Preparé 60 anticuchos y me sobraron 5. Yape 120. Gasté 30 de carbón.', P);
    expect(resumenEntendido(r, P)).toBe(
      '60 preparadas de anticucho, 5 sobrantes de anticucho, Yape S/ 120.00, gasto S/ 30.00 de carbón',
    );
  });

  it('propiedad: nunca produce negativos, NaN ni infinitos', () => {
    const trozos = ['preparé', 'sobraron', 'yape', 'gasté', 'compré', 'mercadería', 'anticuchos', 'pancita',
      'soles', 'S/', 'de', 'y', 'medio', '60', '1.200', '30,5', 'cuarenta', 'mil', 'cien', 'ciento', 'un', 'todo',
      'vendí', 'nada', '-5', '.', ',', 'carbón', 'taxi', '0', '9999999999', 'lucas', 'no'];
    let semilla = 12345;
    const azar = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    for (let n = 0; n < 500; n++) {
      const largo = 1 + Math.floor(azar() * 12);
      const frase = Array.from({ length: largo }, () => trozos[Math.floor(azar() * trozos.length)]).join(' ');
      const r = interpretarDia(frase, P);
      const numeros = [
        ...Object.values(r.cantidades).flatMap(c => [c.preparadas, c.sobrantes]),
        r.montoYape,
        ...r.gastos.map(g => g.monto),
      ].filter((v): v is number => v !== undefined);
      for (const v of numeros) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
      for (const g of r.gastos) expect(g.monto).toBeGreaterThan(0);
    }
  });
});
