// src/analisis/planificador.ts
// "¿Cuánto preparo mañana?": cuántas porciones preparar mañana para sacar todo sin quedarse corto.
// Cuenta simple y explicable, sin reloj ni React (AGENTS.md, regla 3): `hoy` entra por parámetro.
//
// Método, por producto activo:
//  1. Muestras: los cierres del mismo día de la semana que mañana, en las últimas 8 semanas, que
//     tengan línea de ese producto. Vendidas = preparadas − sobrantes.
//  2. Promedio con pesos: la semana más reciente pesa 8 y la más lejana 1.
//  3. Sugerencia = promedio × 1.10 (colchón), redondeado; nunca menos que lo menos que se vendió.
//  4. Si en 2 de las 3 últimas muestras sobró, no se sube por encima de lo último que preparó.
//  5. Con menos de 3 muestras no se inventa: se dice que faltan datos.
import { diaSemana, restarDias } from '@dominio/fecha';
import { redondearSoles } from '@dominio/formato';
import type { Cierre, FechaNegocio, Producto } from '@dominio/tipos';
import { cantidadConUnidad } from '@dominio/unidades';

export const SEMANAS_DE_HISTORIAL = 8;
export const MUESTRAS_MINIMAS = 3;
export const COLCHON = 1.1;
/** Cuántas de las muestras más recientes miran los sobrantes, y en cuántas debe haber sobrado. */
const MUESTRAS_RECIENTES = 3;
const CON_SOBRANTE_PARA_NO_SUBIR = 2;

/** En minúscula, indexados como `diaSemana`: 0 = domingo. */
export const NOMBRES_DIA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

/** 'sábados', 'lunes': los que ya terminan en "s" no cambian. */
const plural = (dia: string): string => (dia.endsWith('s') ? dia : `${dia}s`);

export interface SugerenciaProducto {
  productoId: string;
  nombre: string;
  unidad: string;
  /** Porciones a preparar mañana; `null` si faltan datos. */
  porciones: number | null;
  /** Lo que preparó el último mismo día de la semana. */
  ultimaPreparada: number | null;
  /** `porciones − ultimaPreparada`; `null` si faltan datos. */
  diferencia: number | null;
  muestras: number;
  /** Porciones × costo actual: lo que pondría de mercadería. 0 si faltan datos. */
  capital: number;
  datosInsuficientes: boolean;
  /** "+8 más que el último sábado", o "Aún no tengo suficientes sábados para sugerirte". */
  texto: string;
}

export interface PlanManana {
  fecha: FechaNegocio;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  /** 'sábado' */
  dia: string;
  sugerencias: SugerenciaProducto[];
  /** Lo que pondría de mercadería sumando las sugerencias con datos. */
  capital: number;
  /** Ningún producto tiene datos suficientes. */
  datosInsuficientes: boolean;
}

/** '1 porción', '12 porciones', '3 vasos'. */
export const textoPorciones = (n: number, unidad: string): string => cantidadConUnidad(n, unidad);

const textoDiferencia = (diferencia: number, dia: string): string => {
  if (diferencia === 0) return `Igual que el último ${dia}`;
  return diferencia > 0
    ? `+${diferencia} más que el último ${dia}`
    : `${Math.abs(diferencia)} menos que el último ${dia}`;
};

interface Muestra {
  preparadas: number;
  sobrantes: number;
  vendidas: number;
  /** 1 = la semana más reciente. */
  semanasAtras: number;
}

const sugerir = (
  producto: Producto,
  muestras: Muestra[],
  dia: string,
): SugerenciaProducto => {
  const base = {
    productoId: producto.id,
    nombre: producto.nombre,
    unidad: producto.unidad,
    muestras: muestras.length,
  };
  if (muestras.length < MUESTRAS_MINIMAS) {
    return {
      ...base,
      porciones: null,
      ultimaPreparada: null,
      diferencia: null,
      capital: 0,
      datosInsuficientes: true,
      texto: `Aún no tengo suficientes ${plural(dia)} para sugerirte`,
    };
  }
  // De la más reciente a la más lejana.
  const recientes = [...muestras].sort((a, b) => a.semanasAtras - b.semanasAtras);
  let pesos = 0;
  let suma = 0;
  for (const m of recientes) {
    const peso = SEMANAS_DE_HISTORIAL + 1 - m.semanasAtras;
    pesos += peso;
    suma += peso * m.vendidas;
  }
  const menorVenta = Math.min(...recientes.map(m => m.vendidas));
  const ultimaPreparada = recientes[0].preparadas;
  let porciones = Math.max(Math.round((suma / pesos) * COLCHON), menorVenta);
  const sobro = recientes.slice(0, MUESTRAS_RECIENTES).filter(m => m.sobrantes > 0).length;
  if (sobro >= CON_SOBRANTE_PARA_NO_SUBIR) {
    // Sobró seguido: no se sube de lo último; pero nunca bajo lo menos que se vendió.
    porciones = Math.max(menorVenta, Math.min(porciones, ultimaPreparada));
  }
  const diferencia = porciones - ultimaPreparada;
  return {
    ...base,
    porciones,
    ultimaPreparada,
    diferencia,
    capital: redondearSoles(porciones * producto.costoUnitario),
    datosInsuficientes: false,
    texto: textoDiferencia(diferencia, dia),
  };
};

/** El plan para mañana (`hoy` + 1) de cada producto activo, en el orden de los productos. */
export const planificarManana = (
  cierres: Cierre[],
  productos: Producto[],
  hoy: FechaNegocio,
): PlanManana => {
  const fecha = restarDias(hoy, -1);
  const numeroDia = diaSemana(fecha);
  const dia = NOMBRES_DIA[numeroDia];
  // Las 8 fechas del mismo día de la semana: mañana − 7, − 14 … − 56.
  const semanasAtrasDe = new Map<FechaNegocio, number>();
  for (let k = 1; k <= SEMANAS_DE_HISTORIAL; k += 1) semanasAtrasDe.set(restarDias(fecha, 7 * k), k);

  const sugerencias = productos
    .filter(p => p.activo)
    .map(p => {
      const muestras: Muestra[] = [];
      for (const c of cierres) {
        const semanasAtras = semanasAtrasDe.get(c.fecha);
        if (semanasAtras === undefined) continue;
        const linea = c.lineas.find(l => l.productoId === p.id);
        if (!linea) continue;
        muestras.push({
          preparadas: linea.preparadas,
          sobrantes: linea.sobrantes,
          vendidas: Math.max(0, linea.preparadas - linea.sobrantes),
          semanasAtras,
        });
      }
      return sugerir(p, muestras, dia);
    });

  const conDatos = sugerencias.filter(s => !s.datosInsuficientes);
  return {
    fecha,
    diaSemana: numeroDia,
    dia,
    sugerencias,
    capital: redondearSoles(conDatos.reduce((total, s) => total + s.capital, 0)),
    datosInsuficientes: conDatos.length === 0,
  };
};
