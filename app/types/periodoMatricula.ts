// Tipos de US-1.1. Siguen la clase PeriodoMatricula y el enum EstadoPeriodoMatricula del backend.

export type EstadoPeriodo = 'PENDIENTE' | 'VIGENTE' | 'VENCIDO'

/** Respuesta de GET /api/v1/periodos-matricula: la ventana en la que se pueden registrar matrículas. */
export interface PeriodoMatricula {
  id: number
  fechaInicio: string
  fechaLimite: string
  /** Calculado por el backend con la fecha del servidor. */
  estado: EstadoPeriodo
  /** Hay matrículas registradas entre sus fechas; un periodo vencido con matrículas no se puede editar. */
  tieneMatriculas: boolean
}

/** Cuerpo de POST y PUT /api/v1/periodos-matricula. */
export interface SolicitudPeriodoMatricula {
  fechaInicio: string
  fechaLimite: string
}

export type ErroresPeriodoMatricula = Partial<Record<keyof SolicitudPeriodoMatricula, string>>
