// src/dominio/tipos.ts
// Tipos del dominio. Fuente: sdd/database/esquema.md. Nombres: sdd/domain.md.

export type FechaNegocio = string; // 'YYYY-MM-DD', fecha local del teléfono
export type Instante = string; // ISO 8601 con zona

export interface Perfil {
  nombre: string;
  negocio: string;
  ubicacion?: string;
  fotoUri?: string;
  aceptaYape: boolean;
  yapeAjeno: boolean;
  /** Número donde recibe Yape: 9 dígitos. Se guarda solo en el teléfono. */
  yapeNumero?: string;
  /** Si el Yape no está a su nombre: de quién es y qué es para Freddy (hermana, esposa…). */
  yapeTitular?: string;
  yapeParentesco?: string;
  actualizadoEn: Instante;
}

export interface Producto {
  id: string;
  nombre: string;
  unidad: 'porcion' | 'vaso';
  precioVenta: number;
  costoUnitario: number;
  actualizadoEn: FechaNegocio;
  activo: boolean;
}

export interface LineaCierre {
  productoId: string;
  nombre: string;
  preparadas: number;
  sobrantes: number;
  precioUnitario: number;
  costoUnitario: number;
}

export type CategoriaGasto = 'mercaderia' | 'carbon' | 'movilidad' | 'gas' | 'otro';

export interface Gasto {
  categoria: CategoriaGasto;
  monto: number;
}

export interface Cierre {
  id: string;
  fecha: FechaNegocio;
  lineas: LineaCierre[];
  montoYape: number;
  yapePendiente: boolean;
  cobradoEn?: FechaNegocio;
  gastos: Gasto[];
  abreCiclo: boolean;
  creadoEn: Instante;
  actualizadoEn: Instante;
}

/** Lo que entrega el formulario de cierre, antes de copiar precios y costos. */
export interface DatosCierre {
  fecha?: FechaNegocio;
  lineas: { productoId: string; preparadas: number; sobrantes: number }[];
  montoYape: number;
  gastos: Gasto[];
  abreCiclo?: boolean;
}

export interface ResumenCierre {
  venta: number;
  efectivo: number;
  montoYape: number;
  gastoTotal: number;
  teQueda: number;
  vendidasPorProducto: Record<string, number>;
}
