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
