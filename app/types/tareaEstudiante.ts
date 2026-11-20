/** Estado de una tarea para el alumno (US-3.9). */
export type EstadoTareaEstudiante = 'PENDIENTE' | 'ENTREGADA' | 'VENCIDA'

/** Quién registró la entrega: el alumno con su archivo o el docente a mano. */
export type OrigenEntregaTarea = 'ALUMNO' | 'DOCENTE'

/** Respuesta de /api/v1/estudiantes/mis-tareas. */
export interface TareaEstudiante {
  id: number
  periodoId: number
  areaCodigo: string | null
  area: string | null
  competenciaCodigo: string
  competencia: string
  docente: string | null
  titulo: string
  descripcion: string
  fechaLimite: string
  ponderacion: number | null
  estado: EstadoTareaEstudiante
  fechaEntrega: string | null
  origen: OrigenEntregaTarea | null
  archivoNombre: string | null
  archivoTamanio: number | null
  puedeEntregar: boolean
}

export type CercaniaTareaEstudiante = 'hoy' | 'semana' | 'adelante'

/** Tareas por entregar agrupadas según qué tan pronto vencen. */
export interface GrupoTareasEstudiante {
  cercania: CercaniaTareaEstudiante
  titulo: string
  tareas: TareaEstudiante[]
}

/** Texto e intensidad de la cuenta regresiva de una tarea. */
export interface CuentaRegresivaTarea {
  texto: string
  nivel: 'hoy' | 'dias' | 'lejos' | 'vencida'
}
