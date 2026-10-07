// src/dominio/validacion.ts
import { z } from 'zod';
import { redondearSoles } from './formato';
import type { DatosCierre, Producto } from './tipos';

// Mensajes exactos de sdd/api-contracts.md ("Mensajes de validación").
export const MENSAJES = {
  sobrantes: 'No te pueden sobrar más de los que preparaste',
  vacio: 'Anota al menos una venta o un gasto',
  yape: 'El Yape no puede ser más que lo que vendiste',
  enteras: 'Anota porciones enteras',
  precio: 'El precio tiene que ser mayor a cero',
  costo: 'El costo no puede ser negativo',
  numeroYape: 'El número de Yape tiene 9 dígitos',
} as const;

export type ResultadoValidacion = { ok: true } | { ok: false; errores: Record<string, string> };

const esquemaCierre = (productos: Producto[]) =>
  z
    .object({
      fecha: z.string().optional(),
      lineas: z.array(
        z.object({ productoId: z.string(), preparadas: z.number(), sobrantes: z.number() }),
      ),
      montoYape: z.number(),
      gastos: z.array(
        z.object({
          categoria: z.enum(['mercaderia', 'carbon', 'movilidad', 'gas', 'otro']),
          monto: z.number(),
        }),
      ),
      abreCiclo: z.boolean().optional(),
    })
    .superRefine((datos, ctx) => {
      // Primero cada línea; las reglas del cierre completo solo con líneas válidas.
      let lineasValidas = true;
      datos.lineas.forEach((linea, i) => {
        for (const campo of ['preparadas', 'sobrantes'] as const) {
          if (!Number.isInteger(linea[campo])) {
            lineasValidas = false;
            ctx.addIssue({ code: 'custom', message: MENSAJES.enteras, path: ['lineas', i, campo] });
          }
        }
        if (linea.sobrantes > linea.preparadas) {
          lineasValidas = false;
          ctx.addIssue({ code: 'custom', message: MENSAJES.sobrantes, path: ['lineas', i, 'sobrantes'] });
        }
      });
      if (!lineasValidas) return;

      let vendidas = 0;
      let venta = 0;
      for (const linea of datos.lineas) {
        const precio = productos.find(p => p.id === linea.productoId)?.precioVenta ?? 0;
        vendidas += linea.preparadas - linea.sobrantes;
        venta += (linea.preparadas - linea.sobrantes) * precio;
      }
      if (vendidas === 0 && datos.gastos.length === 0) {
        ctx.addIssue({ code: 'custom', message: MENSAJES.vacio, path: ['cierre'] });
      }
      if (redondearSoles(datos.montoYape) > redondearSoles(venta)) {
        ctx.addIssue({ code: 'custom', message: MENSAJES.yape, path: ['montoYape'] });
      }
    });

/**
 * Valida lo que entrega el formulario. Recibe `productos` para conocer la
 * venta con la que se compara el Yape (decisión propuesta: el contrato decía
 * `validarCierre(datos)`).
 */
export const validarCierre = (datos: DatosCierre, productos: Producto[]): ResultadoValidacion => {
  const resultado = esquemaCierre(productos).safeParse(datos);
  if (resultado.success) return { ok: true };
  const errores: Record<string, string> = {};
  for (const issue of resultado.error.issues) {
    const campo = issue.path.join('.') || 'cierre';
    errores[campo] ??= issue.message;
  }
  return { ok: false, errores };
};

const esquemaProducto = z.object({
  precioVenta: z.number().gt(0, MENSAJES.precio),
  costoUnitario: z.number().min(0, MENSAJES.costo),
});

/** Valida el formulario "Cambiar precio" (decisión propuesta: no estaba en el contrato). */
export const validarProducto = (datos: {
  precioVenta: number;
  costoUnitario: number;
}): ResultadoValidacion => {
  const resultado = esquemaProducto.safeParse(datos);
  if (resultado.success) return { ok: true };
  const errores: Record<string, string> = {};
  for (const issue of resultado.error.issues) {
    errores[issue.path.join('.')] ??= issue.message;
  }
  return { ok: false, errores };
};

/** Vacío vale (borrar el número); si hay algo, tienen que ser 9 dígitos. Devuelve el mensaje o null. */
export const validarNumeroYape = (numero: string): string | null =>
  numero === '' || /^\d{9}$/.test(numero) ? null : MENSAJES.numeroYape;
