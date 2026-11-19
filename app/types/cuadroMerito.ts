export interface EstudianteRanking {
  puesto: number | null
  matriculaId: number
  estudianteId: number
  estudiante: string
  promedio: number | null
  competenciasCalificadas: number
}

export interface CuadroMerito {
  periodoId: number
  anhioEscolar: number
  gradoNumero: number
  nivelEducativo: string
  seccion: string
  fechaInicio: string
  fechaFin: string
  estudiantes: EstudianteRanking[]
}
