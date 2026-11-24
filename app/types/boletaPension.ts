export type EstadoBoleta = 'PENDIENTE' | 'EN_MORA' | 'PAGADA'
export type MedioPago = 'PRESENCIAL' | 'VIRTUAL'

/** Contrato del backend BoletaPensionResponse. */
export interface BoletaPension {
  id: number
  compromisoId: number
  matriculaId: number
  estudianteId: number
  estudiante: string
  apoderadoId: number
  apoderado: string
  grado: number
  seccion: string
  mesCobro: string
  monto: number
  mora: number
  montoTotal: number
  fechaVencimiento: string
  estadoPago: EstadoBoleta
  mecanismoGeneracion: 'AUTOMATICO' | 'MANUAL'
  fechaGeneracion: string
}

export interface FiltrosBoletas {
  estudianteId: string
  periodoId: string
  mes: string
  estado: '' | EstadoBoleta
}

export interface PagoBoleta {
  monto: number
  medioPago: MedioPago
  referencia?: string
}

export interface ComprobanteBoleta {
  id: number
  boletaId: number
  fechaEmision: string
  montoPagado: number
  medioPago: MedioPago
  numeroComprobante: string
}

/** Contrato del backend HistorialBoletasResponse. */
export interface HistorialBoletas {
  estudianteId: number
  estudiante: string
  mesCorte: string
  boletasGeneradas: number
  boletasEnMora: number
  totales: TotalesHistorial
  matriculas: MatriculaHistorial[]
}

export interface TotalesHistorial {
  pagado: number
  pendiente: number
  enMora: number
}

export interface MatriculaHistorial {
  matriculaId: number
  anio: number
  grado: number
  seccion: string
  fechaMatricula: string
  estado: 'EN_REGISTRO' | 'CONFIRMADA' | 'RETIRADA' | 'FINALIZADA'
  compromiso: CompromisoHistorial | null
  boletas: BoletaHistorial[]
}

export interface CompromisoHistorial {
  id: number
  concepto: string
  numeroCuotas: number
  mesInicio: string
}

export interface BoletaHistorial {
  id: number
  mesCobro: string
  fechaVencimiento: string
  montoTotal: number
  estadoPago: EstadoBoleta
  mecanismoGeneracion: 'AUTOMATICO' | 'MANUAL'
  numeroComprobante: string | null
}
