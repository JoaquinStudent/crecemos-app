// src/storage/repositorio.ts
// La única puerta a AsyncStorage (sdd/api-contracts.md, "Repositorio").
// Claves y formato: sdd/database/esquema.md, "Claves de AsyncStorage".
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import { marcarCobrados } from '@dominio/cobro';
import type { Cierre, FechaNegocio, Perfil, Producto } from '@dominio/tipos';

const CLAVE_CIERRES = '@crecemos/cierres';
const CLAVE_PRODUCTOS = '@crecemos/productos';
const CLAVE_PERFIL = '@crecemos/perfil';

// Base propia de la app (D21). Se pide en cada operación: en nativo la instancia
// solo guarda el nombre, y en Jest el mock la reutiliza por nombre, así que
// clearAllMockStorages() deja al repositorio con una base vacía de verdad.
const base = () => createAsyncStorage('crecemos');

// T es el valor completo guardado: un arreglo (cierres, productos) o un objeto (perfil).
const leer = async <T>(clave: string): Promise<T | null> => {
  const json = await base().getItem(clave);
  return json === null ? null : (JSON.parse(json) as T);
};

export const listarCierres = async (): Promise<Cierre[]> =>
  (await leer<Cierre[]>(CLAVE_CIERRES)) ?? [];

/** Inserta o reemplaza el cierre de esa fecha (D9), en una sola escritura. */
export const guardarCierre = async (c: Cierre): Promise<void> => {
  const otros = (await listarCierres()).filter(existente => existente.fecha !== c.fecha);
  await base().setItem(CLAVE_CIERRES, JSON.stringify([...otros, c]));
};

/** Quita el cierre con ese id. Si no existe, no hace nada. */
export const eliminarCierre = async (id: string): Promise<void> => {
  const cierres = await listarCierres();
  const restantes = cierres.filter(c => c.id !== id);
  if (restantes.length === cierres.length) return;
  await base().setItem(CLAVE_CIERRES, JSON.stringify(restantes));
};

/** Pone `cobradoEn` en los cierres pedidos y reescribe la lista completa (e2). */
export const marcarCobrado = async (ids: string[], fecha: FechaNegocio): Promise<void> => {
  const cierres = await listarCierres();
  const cobrados = marcarCobrados(cierres, ids, fecha);
  if (cobrados.every((c, i) => c === cierres[i])) return; // nada pendiente que cobrar
  await base().setItem(CLAVE_CIERRES, JSON.stringify(cobrados));
};

/** Sin productos guardados devuelve los por defecto, sin escribirlos. */
export const listarProductos = async (): Promise<Producto[]> =>
  (await leer<Producto[]>(CLAVE_PRODUCTOS)) ?? PRODUCTOS_POR_DEFECTO;

/** `null` si el perfil nunca se guardó. */
export const obtenerPerfil = async (): Promise<Perfil | null> =>
  leer<Perfil>(CLAVE_PERFIL);

/** Reemplaza el perfil, en una sola escritura. */
export const guardarPerfil = async (p: Perfil): Promise<void> => {
  await base().setItem(CLAVE_PERFIL, JSON.stringify(p));
};

/**
 * Inserta o reemplaza por `id`, conservando el orden. Parte de `listarProductos()`
 * (que incluye los por defecto aunque nunca se hayan escrito) y reescribe la lista
 * completa: guardar solo el producto cambiado haría desaparecer a los demás.
 */
export const guardarProducto = async (p: Producto): Promise<void> => {
  const actuales = await listarProductos();
  const existe = actuales.some(existente => existente.id === p.id);
  const lista = existe
    ? actuales.map(existente => (existente.id === p.id ? p : existente))
    : [...actuales, p];
  await base().setItem(CLAVE_PRODUCTOS, JSON.stringify(lista));
};
