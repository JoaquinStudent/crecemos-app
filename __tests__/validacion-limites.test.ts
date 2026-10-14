/** Límites del cierre (auditoría, P2): sin cantidades ni Yape negativos, y sin gastos en cero. */
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { DatosCierre } from '@dominio/tipos';
import { MENSAJES, validarCierre } from '@dominio/validacion';

const base = (cambios: Partial<DatosCierre> = {}): DatosCierre => ({
  lineas: [{ productoId: 'p-anticucho', preparadas: 10, sobrantes: 2 }],
  montoYape: 0,
  gastos: [],
  ...cambios,
});
const errores = (datos: DatosCierre) => {
  const r = validarCierre(datos, PRODUCTOS_POR_DEFECTO);
  return r.ok ? {} : r.errores;
};

describe('validarCierre: límites', () => {
  it('un cierre normal pasa', () => {
    expect(validarCierre(base(), PRODUCTOS_POR_DEFECTO)).toEqual({ ok: true });
  });

  it('rechaza preparadas negativas', () => {
    expect(errores(base({ lineas: [{ productoId: 'p-anticucho', preparadas: -1, sobrantes: -1 }] }))).toMatchObject({
      'lineas.0.preparadas': MENSAJES.negativo,
    });
  });

  it('rechaza sobrantes negativos', () => {
    expect(errores(base({ lineas: [{ productoId: 'p-anticucho', preparadas: 5, sobrantes: -2 }] }))).toEqual({
      'lineas.0.sobrantes': MENSAJES.negativo,
    });
  });

  it('rechaza un Yape negativo', () => {
    expect(errores(base({ montoYape: -5 }))).toEqual({ montoYape: MENSAJES.negativo });
  });

  it('rechaza un gasto de cero y uno negativo', () => {
    expect(errores(base({ gastos: [{ categoria: 'gas', monto: 0 }] }))).toEqual({
      'gastos.0.monto': MENSAJES.gasto,
    });
    expect(errores(base({ gastos: [{ categoria: 'gas', monto: -3 }] }))).toEqual({
      'gastos.0.monto': MENSAJES.gasto,
    });
  });

  it('un gasto positivo pasa', () => {
    expect(validarCierre(base({ gastos: [{ categoria: 'gas', monto: 0.5 }] }), PRODUCTOS_POR_DEFECTO)).toEqual({
      ok: true,
    });
  });
});
