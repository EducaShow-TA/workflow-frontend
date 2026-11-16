export interface EvaluacionParcial {
  id: number
  periodoId: number
  competenciaCodigo: string
  titulo: string
  descripcion: string | null
  ponderacion: number
  bimestre: number | null
}

export interface SolicitudEvaluacionParcial {
  periodoId: number
  competenciaCodigo: string
  titulo: string
  descripcion: string
  ponderacion: number
  bimestre: number
}
