import type { EstadoAsistenciaHijo, HijoVinculado, RegistroAsistencia } from '~/types/familia'

/** Alumno autenticado y sus periodos con matrícula confirmada (API /api/v1/estudiantes/mi-ficha). */
export type FichaEstudiante = HijoVinculado

export type EstadoClaseEstudiante = EstadoAsistenciaHijo | 'PENDIENTE_MARCAJE'

/** Clase del historial del alumno; puede seguir sin marcar. */
export interface ClaseEstudiante extends Omit<RegistroAsistencia, 'estado'> {
  estado: EstadoClaseEstudiante
}

export interface DiaCalendarioEstudiante {
  fecha: string
  numero: number
  clases: ClaseEstudiante[]
  esHoy: boolean
  esFuturo: boolean
}

/** Celda del calendario de lunes a viernes; null rellena los días previos al primero del mes. */
export type CeldaCalendarioEstudiante = DiaCalendarioEstudiante | null

/** Falta, tardanza o justificación del mes; las justificadas de un día con el mismo motivo van juntas. */
export interface IncidenciaEstudiante {
  clave: string
  fecha: string
  estado: EstadoAsistenciaHijo
  clases: ClaseEstudiante[]
  motivo: string | null
}
