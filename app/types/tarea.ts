/** Respuesta del backend para cada entrega vinculada a una tarea. */
export interface EntregaTarea {
  matriculaId: number
  estudianteId: number
  estudiante: string
  cumplida: boolean
  fechaCumplimiento: string | null
  origen?: 'ALUMNO' | 'DOCENTE' | null
  archivoNombre?: string | null
  archivoTamanio?: number | null
  archivoFecha?: string | null
  calificacionId?: number | null
  nota?: 'AD' | 'A' | 'B' | 'C' | null
  justificada?: boolean
  comentario?: string | null
  fechaCalificacion?: string | null
}

/** Respuesta de /api/v1/tareas. */
export interface Tarea {
  id: number
  periodoId: number
  competenciaCodigo: string
  competencia: string
  titulo: string
  descripcion: string
  fechaLimite: string
  ponderacion: number | null
  evaluacionParcialId?: number | null
  evaluacionTitulo?: string | null
  bimestre?: number | null
  entregas: EntregaTarea[]
}

/** Cuerpo de POST /api/v1/tareas. */
export interface SolicitudTarea {
  periodoId: number
  competenciaCodigo: string
  titulo: string
  descripcion: string
  fechaLimite: string
  ponderacion: number | null
  evaluacionParcialId?: number | null
}

/** Cuerpo de PUT /api/v1/tareas/{id}/entregas/{matriculaId}/calificacion. */
export interface SolicitudCalificacionTarea {
  nota: 'AD' | 'A' | 'B' | 'C' | null
  justificada: boolean
  motivo?: string | null
  comentario?: string | null
}
