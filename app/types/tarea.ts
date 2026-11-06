/** Respuesta del backend para cada entrega vinculada a una tarea. */
export interface EntregaTarea {
  matriculaId: number
  estudianteId: number
  estudiante: string
  cumplida: boolean
  fechaCumplimiento: string | null
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
}
