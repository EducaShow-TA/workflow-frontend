export type EstadoPeriodoAcademico = 'PLANIFICADO' | 'EN_CURSO' | 'FINALIZADO'

/** Periodo de clases por grado y sección (API /api/v1/periodos). */
export interface PeriodoAcademico {
  periodoId: number
  gradoId: number
  numeroGrado: number
  nivelEducativo: string
  seccionId: number
  seccion: string
  fechaInicio: string
  fechaFin: string
  vacantesTotales: number
  matriculasActivas: number
  vacantesDisponibles: number
  hayVacantes: boolean
  estado: EstadoPeriodoAcademico
}

export interface SolicitudAperturaAnhio {
  anhio: number
  fechaInicio: string
  fechaFin: string
}

export type ErroresAperturaAnhio = Partial<Record<keyof SolicitudAperturaAnhio, string>>

/** Fechas de clases de un año escolar, desde el primer inicio hasta el último fin de sus periodos. */
export interface ResumenAnhioEscolar {
  anhio: number
  fechaInicio: string
  fechaFin: string
  estado: EstadoPeriodoAcademico
}
