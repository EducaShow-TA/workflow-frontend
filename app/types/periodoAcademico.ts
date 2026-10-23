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
  estado: 'PLANIFICADO' | 'EN_CURSO' | 'FINALIZADO'
}

export interface SolicitudAperturaAnhio {
  anhio: number
  fechaInicio: string
  fechaFin: string
}
