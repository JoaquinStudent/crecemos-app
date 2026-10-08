// src/dominio/semilla.ts
// Mock API: valida el JSON de la semilla y lo vuelve datos reales (sdd/api-contracts.md).
import { z } from 'zod';
import { crearId } from './cierre';
import { fechaLocal } from './fecha';
import type { Cierre, Producto, SemillaJSON, SemillaMaterializada } from './tipos';

export type ResultadoSemilla = { ok: true; semilla: SemillaJSON } | { ok: false };

const dias = z.number().int().min(0);
const soles = z.number().min(0);

const esquemaSemilla = z.object({
  version: z.number(),
  semilla: z.string(),
  diaSemanaBase: z.number().int().min(0).max(6),
  productos: z
    .array(
      z.object({
        id: z.string(),
        nombre: z.string(),
        unidad: z.enum(['porcion', 'vaso']),
        precioVenta: soles,
        costoUnitario: soles,
        actualizadoDiasAtras: dias,
      }),
    )
    .min(1),
  cierres: z.array(
    z.object({
      diasAtras: dias,
      lineas: z.array(
        z
          .object({
            productoId: z.string(),
            preparadas: z.number().int().min(0),
            sobrantes: z.number().int().min(0),
            precioUnitario: soles,
            costoUnitario: soles,
          })
          .refine(l => l.sobrantes <= l.preparadas),
      ),
      montoYape: soles,
      yapePendiente: z.boolean(),
      gastos: z.array(
        z.object({
          categoria: z.enum(['mercaderia', 'carbon', 'movilidad', 'gas', 'otro']),
          monto: soles,
        }),
      ),
      abreCiclo: z.boolean(),
      cobradoDiasAtras: dias.optional(),
    }),
  ),
});

/** Acepta solo un JSON con la forma del contrato. Sin `cierres` (o sin productos) no vale. */
export const validarSemilla = (json: unknown): ResultadoSemilla => {
  const resultado = esquemaSemilla.safeParse(json);
  return resultado.success ? { ok: true, semilla: resultado.data } : { ok: false };
};

/**
 * Vuelve `diasAtras` fechas locales de hoy. Todos los días se corren hacia el pasado
 * lo mínimo (0 a 6) para que cada cierre caiga en el mismo día de la semana en que se
 * pensó: sin eso "el miércoles es el más flojo" solo valdría si hoy es miércoles.
 */
export const materializarSemilla = (s: SemillaJSON, ahora: Date): SemillaMaterializada => {
  const desplazamiento = (ahora.getDay() - s.diaSemanaBase + 7) % 7;
  const fechaDe = (diasAtras: number) =>
    fechaLocal(
      new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - diasAtras - desplazamiento),
    );
  const instante = ahora.toISOString();

  const productos: Producto[] = s.productos.map(p => ({
    id: p.id,
    nombre: p.nombre,
    unidad: p.unidad,
    precioVenta: p.precioVenta,
    costoUnitario: p.costoUnitario,
    actualizadoEn: fechaDe(p.actualizadoDiasAtras),
    activo: true,
  }));

  const cierres: Cierre[] = s.cierres.map(c => {
    const cierre: Cierre = {
      id: crearId(),
      fecha: fechaDe(c.diasAtras),
      lineas: c.lineas.map(l => ({
        productoId: l.productoId,
        nombre: s.productos.find(p => p.id === l.productoId)?.nombre ?? l.productoId,
        preparadas: l.preparadas,
        sobrantes: l.sobrantes,
        precioUnitario: l.precioUnitario,
        costoUnitario: l.costoUnitario,
      })),
      montoYape: c.montoYape,
      yapePendiente: c.yapePendiente,
      gastos: c.gastos.map(g => ({ categoria: g.categoria, monto: g.monto })),
      abreCiclo: c.abreCiclo,
      creadoEn: instante,
      actualizadoEn: instante,
    };
    if (c.cobradoDiasAtras !== undefined) cierre.cobradoEn = fechaDe(c.cobradoDiasAtras);
    return cierre;
  });

  return { productos, cierres };
};
