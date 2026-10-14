// src/dominio/perfilResumen.ts
// Las líneas cortas que cada opción del Perfil muestra debajo de su título ("Yape activado",
// "Activado · 9:30 p. m."...). Puras: salen de los datos reales y no inventan nada.
import { ajustesVisuales, OPCIONES_TAMANO } from './ajustes';
import { ajustesDeRecordatorio, etiquetaDeHora } from './recordatorio';
import type { DatosDeEjemplo } from './origen';
import type { Perfil, Producto } from './tipos';

export const RESUMEN_DATOS_VACIOS = 'Completa tus datos';
export const RESUMEN_AYUDA = 'Ver el recorrido';
export const RESUMEN_SIN_EJEMPLO = 'No hay datos de ejemplo';

const plural = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`;

/** "Nombre · Negocio", lo que haya, o una invitación a completarlos. */
export const resumenDatos = (perfil: Pick<Perfil, 'nombre' | 'negocio'>): string => {
  const partes = [perfil.nombre, perfil.negocio].map(p => p.trim()).filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : RESUMEN_DATOS_VACIOS;
};

/** "Yape activado" (y "sin número" si falta) o "Solo efectivo". */
export const resumenPagos = (perfil: Pick<Perfil, 'aceptaYape' | 'yapeNumero'>): string => {
  if (!perfil.aceptaYape) return 'Solo efectivo';
  return perfil.yapeNumero?.trim() ? 'Yape activado' : 'Yape activado · sin número';
};

/** "Activado · 9:30 p. m." o "Apagado". */
export const resumenRecordatorio = (
  perfil: Pick<Perfil, 'recordatorioActivo' | 'recordatorioHora'>,
): string => {
  const { activo, hora } = ajustesDeRecordatorio(perfil);
  return activo ? `Activado · ${etiquetaDeHora(hora)}` : 'Apagado';
};

/** "Letra normal", "Letra grande" o "Letra extra grande". */
export const resumenConfiguracion = (
  perfil: Pick<Perfil, 'tamanoLetra' | 'vibracion' | 'reducirAnimaciones'>,
): string => {
  const { tamanoLetra } = ajustesVisuales(perfil);
  const etiqueta = OPCIONES_TAMANO.find(o => o.valor === tamanoLetra)?.etiqueta ?? '';
  return `Letra ${etiqueta.toLowerCase()}`;
};

/** Cuántos productos están activos (los que se ofrecen al cerrar el día). */
export const resumenProductos = (productos: readonly Pick<Producto, 'activo'>[]): string => {
  const activos = productos.filter(p => p.activo).length;
  return activos === 0 ? 'Sin productos activos' : plural(activos, 'producto activo', 'productos activos');
};

/** Cuánto hay de ejemplo para borrar, o que no hay nada. */
export const resumenBorrar = (ejemplo: DatosDeEjemplo): string => {
  if (ejemplo.dias > 0) return plural(ejemplo.dias, 'día de ejemplo', 'días de ejemplo');
  if (ejemplo.productos > 0) {
    return plural(ejemplo.productos, 'producto de ejemplo', 'productos de ejemplo');
  }
  return RESUMEN_SIN_EJEMPLO;
};
