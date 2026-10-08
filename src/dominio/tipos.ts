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

/** Cierres desde uno marcado "hoy compré mercadería" hasta el anterior al siguiente marcado. */
export interface Ciclo {
  inicio: FechaNegocio;
  fin: FechaNegocio;
  cierres: Cierre[];
}

export interface ResumenCiclo {
  venta: number;
  capital: number;
  teQueda: number;
  capitalRecuperadoEn?: FechaNegocio;
  faltaParaCapital: number;
}

/** Lo de un producto sumado en todo un ciclo: porciones y lo que costó lo que sobró. */
export interface MercaderiaProducto {
  productoId: string;
  nombre: string;
  preparadas: number;
  vendidas: number;
  sobranteSoles: number;
}

export type FiltroHistorial = 'todo' | 'ingresos' | 'gastos' | 'porCobrar';

/** Una fila del historial. Monto positivo = ingreso; negativo = gasto. */
export interface Movimiento {
  tipo: 'venta' | 'gasto';
  etiqueta: string;
  /** `null` en los gastos. */
  metodo: 'Efectivo' | 'Yape' | null;
  monto: number;
  porCobrar: boolean;
}

/** Los movimientos de un día (un cierre) con su neto. */
export interface GrupoDia {
  fecha: FechaNegocio;
  titulo: string;
  neto: number;
  cierreId: string;
  movimientos: Movimiento[];
}

/** Lo que Inicio muestra en "Yape por cobrar". */
export interface ResumenPorCobrar {
  total: number;
  pagos: number;
  /** Fecha del pago pendiente más antiguo. */
  desde?: FechaNegocio;
}

/** Lo de un producto en un periodo: lo que se vende, lo que deja por porción y lo que ganó en total. */
export interface GananciaProducto {
  productoId: string;
  nombre: string;
  /** Porciones vendidas en el periodo. */
  seVende: number;
  /** Ganancia por porción (ganancia / seVende), con los precios copiados en cada línea. */
  teDeja: number;
  ganancia: number;
}

export interface Recomendacion {
  reglaId: 'cobro' | 'precio' | 'preparar' | 'retiro' | 'diaFlojo' | 'comparacion';
  /** 1 es la más alta. */
  prioridad: number;
  /** Con verbo y monto en soles. */
  mensaje: string;
}

/** Todo lo que una regla puede mirar. La fecha de hoy entra por aquí: el motor no lee el reloj. */
export interface ContextoAnalisis {
  cierres: Cierre[];
  productos: Producto[];
  hoy: FechaNegocio;
}

/** Las doce preguntas que el chat "Preguntarle a mis datos" sabe responder (Sprint-08). */
export type IntencionId =
  | 'ventaDelDia'
  | 'mejorDia'
  | 'peorDia'
  | 'productoQueMasDeja'
  | 'productoQueMasSeVende'
  | 'cuantoPorCobrar'
  | 'cuantoSacarParaLaCasa'
  | 'cuantoPreparar'
  | 'compararCiclo'
  | 'revisarPrecio'
  | 'cuandoRecupereCapital'
  | 'noEntendi';

/** De qué día habla la pregunta; `ninguno` si no nombra ninguno. */
export type DiaConsulta =
  | 'hoy'
  | 'ayer'
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo'
  | 'ninguno';

/** Lo que el clasificador entendió de la pregunta: solo clasifica, nunca calcula. */
export interface Consulta {
  intencion: IntencionId;
  /** Id de producto ('p-rachi'); sin producto si la pregunta no nombra ninguno. */
  producto?: string;
  dia?: DiaConsulta;
  /** 0 a 1. */
  confianza: number;
}

/** La respuesta calculada por el código: la frase fija y todas las cifras que lleva. */
export interface Hecho {
  intencion: IntencionId;
  /** La plantilla ya escrita, con voz de Freddy. */
  frase: string;
  /** Todas las cifras de `frase`, normalizadas (`extraerCifras`): '205.00', '6', '1.80'. */
  cifras: string[];
}

/** Producto del JSON del Mock API: la fecha entra como `actualizadoDiasAtras`. */
export interface ProductoSemilla {
  id: string;
  nombre: string;
  unidad: 'porcion' | 'vaso';
  precioVenta: number;
  costoUnitario: number;
  actualizadoDiasAtras: number;
}

export interface LineaSemilla {
  productoId: string;
  preparadas: number;
  sobrantes: number;
  precioUnitario: number;
  costoUnitario: number;
}

export interface CierreSemilla {
  diasAtras: number;
  lineas: LineaSemilla[];
  montoYape: number;
  yapePendiente: boolean;
  gastos: Gasto[];
  abreCiclo: boolean;
  cobradoDiasAtras?: number;
}

/** El JSON del Mock API (sdd/api-contracts.md). */
export interface SemillaJSON {
  version: number;
  semilla: string;
  /** Día de la semana (`Date.getDay()`, 0 = domingo) de `diasAtras = 0` al generarla. */
  diaSemanaBase: number;
  productos: ProductoSemilla[];
  cierres: CierreSemilla[];
}

/** La semilla ya con fechas locales, ids e instantes: lista para guardar. */
export interface SemillaMaterializada {
  productos: Producto[];
  cierres: Cierre[];
}

/** Un mes completo que entró en los promedios del reporte. */
export interface MesCompleto {
  /** 'YYYY-MM'. */
  mes: string;
  /** Venta del mes (suma de la venta de cada cierre). */
  venta: number;
  /** "Te queda" del mes: venta menos gastos. No es el margen "te deja". */
  teQueda: number;
  /** Días distintos con cierre en ese mes. */
  dias: number;
}

/** Las señales que Freddy puede mostrarle al banco: aritmética sobre sus cierres, sin score (Arquitectura §4). */
export interface Senales {
  /** 0–100: días registrados sobre días transcurridos de los últimos 90. */
  constancia: number;
  /** Días distintos con cierre dentro de los últimos 90 días. */
  diasRegistrados: number;
  /** Denominador de la constancia: 90, o menos si el primer cierre es más nuevo que la ventana. */
  diasTranscurridos: number;
  ventaPromedioMensual: number;
  /** Promedio del "te queda" mensual (la palabra del banco es "ganancia"). */
  gananciaPromedioMensual: number;
  /** Hasta los 3 últimos meses completos, en orden cronológico: las barras de la pantalla. */
  meses: MesCompleto[];
  /** Cuántos meses entraron en los promedios (`meses.length`). */
  mesesCompletos: number;
  /** Primer y último cierre dentro de los últimos 90 días. */
  primerCierre?: FechaNegocio;
  ultimoCierre?: FechaNegocio;
  /** Primer cierre de todo el registro. */
  registraDesde?: FechaNegocio;
  /** Días desde `registraDesde` hasta hoy; 0 sin cierres. */
  antiguedadDias: number;
  /** Menos de 30 días registrados: el reporte aún no es convincente. */
  enConstruccion: boolean;
  /** Cuántos días más hacen falta para llegar a 30; nunca negativo. */
  diasFaltantes: number;
}
