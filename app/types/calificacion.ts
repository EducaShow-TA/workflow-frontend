/** Calificaciones cualitativas permitidas por el backend (US-3.2 / US-3.8). */
export type NotaCualitativa = 'AD' | 'A' | 'B' | 'C'

/** Solicitud para asociar una calificación y una evidencia a una matrícula confirmada. */
export interface SolicitudCalificacion {
  periodoId: number
  matriculaId: number
  competenciaCodigo: string
  nota: NotaCualitativa
  observacion: string
  evidenciaUrl: string | null
}

/** Respuesta de /api/v1/seguimiento/competencias/{codigo}. */
export interface Calificacion {
  id: number
  matriculaId: number
  estudianteId: number
  estudiante: string
  competenciaCodigo: string
  nota: NotaCualitativa
  observacion: string | null
  evidenciaTipo: 'URL' | 'ARCHIVO'
  evidenciaNombre: string | null
  evidenciaUrl: string | null
  evidenciaTamanio: number | null
  fechaRegistro: string
}
