// Tipos de US-1.1. Siguen la clase PeriodoMatricula y el enum EstadoPeriodo del diagrama de clases.

export type EstadoPeriodo = 'PENDIENTE' | 'VIGENTE' | 'VENCIDO'

/** Respuesta de GET /api/v1/periodos-matricula. */
export interface PeriodoMatricula {
  id: number
  /** AnhioEscolar.anhio que habilita el periodo (asociacion "habilitado por", un periodo por anio). */
  anhio: number
  fechaInicio: string
  fechaFin: string
  /** Equivale a PeriodoMatricula.getEstado(), calculado por el backend con la fecha del servidor. */
  estado: EstadoPeriodo
}

/** Cuerpo de POST y PUT /api/v1/periodos-matricula. */
export interface SolicitudPeriodoMatricula {
  anhio: number
  fechaInicio: string
  fechaFin: string
}

export type ErroresPeriodoMatricula = Partial<Record<keyof SolicitudPeriodoMatricula, string>>
