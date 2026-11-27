import type { PaginaRespuesta } from '~/types/paginacion'
import type { TipoCargoBoleta } from '~/types/boletaPension'

export type EstadoBoletaCobranza = 'PENDIENTE' | 'EN_MORA'

export interface FiltrosReporteBoletas {
  gradoId: string
  seccionId: string
  estado: '' | EstadoBoletaCobranza
  vencimientoDesde: string
  vencimientoHasta: string
}

/** Contrato de BoletaPensionResponse. Los importes JSON corresponden a BigDecimal en el backend. */
export interface BoletaReporte {
  id: number
  estudianteId: number
  estudiante: string
  apoderadoId: number
  apoderado: string
  grado: number
  seccion: string
  mesCobro: string
  tipoCargo: TipoCargoBoleta
  monto: number
  mora: number
  montoTotal: number
  fechaVencimiento: string
  estadoPago: EstadoBoletaCobranza | 'PAGADA'
}

export interface ReporteBoletas {
  pagina: PaginaRespuesta<BoletaReporte>
  montoPendiente: number
  familiasMorosas: number
}
