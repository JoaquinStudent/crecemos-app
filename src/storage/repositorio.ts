// src/storage/repositorio.ts
// La única puerta a AsyncStorage (sdd/api-contracts.md, "Repositorio").
// Claves y formato: sdd/database/esquema.md, "Claves de AsyncStorage".
import { createAsyncStorage } from '@react-native-async-storage/async-storage';
import { PRODUCTOS_POR_DEFECTO } from '@dominio/productosPorDefecto';
import type { Cierre, Producto } from '@dominio/tipos';

const CLAVE_CIERRES = '@crecemos/cierres';
const CLAVE_PRODUCTOS = '@crecemos/productos';

// Base propia de la app (D21). Se pide en cada operación: en nativo la instancia
// solo guarda el nombre, y en Jest el mock la reutiliza por nombre, así que
// clearAllMockStorages() deja al repositorio con una base vacía de verdad.
const base = () => createAsyncStorage('crecemos');

const leer = async <T>(clave: string): Promise<T[] | null> => {
  const json = await base().getItem(clave);
  return json === null ? null : (JSON.parse(json) as T[]);
};

export const listarCierres = async (): Promise<Cierre[]> =>
  (await leer<Cierre>(CLAVE_CIERRES)) ?? [];

/** Inserta o reemplaza el cierre de esa fecha (D9), en una sola escritura. */
export const guardarCierre = async (c: Cierre): Promise<void> => {
  const otros = (await listarCierres()).filter(existente => existente.fecha !== c.fecha);
  await base().setItem(CLAVE_CIERRES, JSON.stringify([...otros, c]));
};

/** Sin productos guardados devuelve los por defecto, sin escribirlos. */
export const listarProductos = async (): Promise<Producto[]> =>
  (await leer<Producto>(CLAVE_PRODUCTOS)) ?? PRODUCTOS_POR_DEFECTO;
