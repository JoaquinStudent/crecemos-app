// src/dominio/cierre.ts
import { fechaLocal } from './fecha';
import { redondearSoles } from './formato';
import type { Cierre, DatosCierre, Perfil, Producto, ResumenCierre } from './tipos';

export const calcularCierre = (c: Cierre): ResumenCierre => {
  const vendidasPorProducto: Record<string, number> = {};
  let venta = 0;
  for (const linea of c.lineas) {
    const vendidas = linea.preparadas - linea.sobrantes;
    vendidasPorProducto[linea.productoId] = vendidas;
    venta += vendidas * linea.precioUnitario;
  }
  const gastoTotal = c.gastos.reduce((total, gasto) => total + gasto.monto, 0);
  return {
    venta: redondearSoles(venta),
    efectivo: redondearSoles(venta - c.montoYape),
    montoYape: redondearSoles(c.montoYape),
    gastoTotal: redondearSoles(gastoTotal),
    teQueda: redondearSoles(venta - gastoTotal),
    vendidasPorProducto,
  };
};

// ponytail: no es criptográfico; suficiente para ids de un solo dispositivo. Usar crypto si se sincroniza.
export const crearId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, caracter => {
    const r = Math.floor(Math.random() * 16);
    // Los bits de variante del UUID v4 (10xx) se fijan con operaciones de bits.
    // eslint-disable-next-line no-bitwise
    return (caracter === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

/** Arma el cierre copiando nombre, precio y costo vigentes de cada producto (D2). */
export const nuevoCierre = (
  datos: DatosCierre,
  productos: Producto[],
  perfil: Perfil | null,
  ahora: Date,
): Cierre => {
  const instante = ahora.toISOString(); // instante, no fecha del negocio
  return {
    id: crearId(),
    fecha: datos.fecha ?? fechaLocal(ahora),
    lineas: datos.lineas.map(linea => {
      const producto = productos.find(p => p.id === linea.productoId);
      if (!producto) {
        throw new Error(`Producto desconocido: ${linea.productoId}`);
      }
      return {
        productoId: linea.productoId,
        nombre: producto.nombre,
        preparadas: linea.preparadas,
        sobrantes: linea.sobrantes,
        precioUnitario: producto.precioVenta,
        costoUnitario: producto.costoUnitario,
      };
    }),
    montoYape: datos.montoYape,
    yapePendiente: !!perfil?.yapeAjeno && datos.montoYape > 0,
    gastos: datos.gastos,
    abreCiclo: datos.abreCiclo ?? false,
    creadoEn: instante,
    actualizadoEn: instante,
  };
};

/**
 * Reemplaza un día conservando su id, su creación y su fecha. Las líneas de
 * productos que ya estaban conservan nombre, precio y costo con que se cerró el
 * día: solo los productos nuevos copian los vigentes (D2).
 */
export const editarCierre = (
  original: Cierre,
  datos: DatosCierre,
  productos: Producto[],
  perfil: Perfil | null,
  ahora: Date,
): Cierre => {
  const nuevo = nuevoCierre({ ...datos, fecha: original.fecha }, productos, perfil, ahora);
  const lineas = nuevo.lineas.map(linea => {
    const previa = original.lineas.find(l => l.productoId === linea.productoId);
    return previa
      ? {
          ...linea,
          nombre: previa.nombre,
          precioUnitario: previa.precioUnitario,
          costoUnitario: previa.costoUnitario,
        }
      : linea;
  });
  const conservaYape = datos.montoYape > 0 && original.montoYape > 0;
  const editado: Cierre = {
    ...nuevo,
    id: original.id,
    creadoEn: original.creadoEn,
    lineas,
    yapePendiente: conservaYape ? original.yapePendiente : nuevo.yapePendiente,
  };
  if (conservaYape && original.cobradoEn !== undefined) editado.cobradoEn = original.cobradoEn;
  return editado;
};
