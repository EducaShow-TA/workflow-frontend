export interface EvaluacionParcial {
  id: number
  periodoId: number
  competenciaCodigo: string
  titulo: string
  descripcion: string | null
  ponderacion: number
  bimestre: number | null
  tareaId?: number | null
  tareaTitulo?: string | null
}

/** Nota de un alumno en una evaluación parcial (API /api/v1/evaluaciones-parciales/{id}/calificaciones). */
export interface NotaEvaluacionParcial {
  id: number | null
  matriculaId: number
  estudianteId: number
  estudiante: string
  nota: 'AD' | 'A' | 'B' | 'C' | null
  justificada: boolean
  evidenciaTipo: 'ARCHIVO' | 'URL' | null
  evidenciaNombre: string | null
  evidenciaUrl: string | null
  evidenciaTamanio: number | null
  fechaRegistro: string | null
  comentario?: string | null
}

export interface SolicitudNotaParcial {
  nota: 'AD' | 'A' | 'B' | 'C' | null
  justificada: boolean
  evidenciaUrl?: string | null
  motivo?: string | null
}

export interface SolicitudEvaluacionParcial {
  periodoId: number
  competenciaCodigo: string
  titulo: string
  descripcion: string
  ponderacion: number
  bimestre: number
}
