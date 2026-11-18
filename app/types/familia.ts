/** Periodo (grado y sección de un año) en el que está matriculado un hijo del apoderado. */
export interface PeriodoVinculado {
  periodoId: number
  gradoNumero: number
  seccion: string
  fechaInicio: string
  fechaFin: string
}

/** Hijo vinculado al apoderado autenticado (API /api/v1/apoderados/mis-estudiantes). */
export interface HijoVinculado {
  estudianteId: number
  nombreCompleto: string
  periodos: PeriodoVinculado[]
}

export type EstadoAsistenciaHijo = 'PRESENTE' | 'TARDANZA' | 'AUSENTE' | 'JUSTIFICADA'

/** Asistencia de un alumno en una clase (API /api/v1/asistencias-estudiantes/{id}/historial). */
export interface RegistroAsistencia {
  asistenciaId: number
  fecha: string
  horaInicio: string
  horaFin: string
  seccionId: number
  seccionCodigo: string
  areaCodigo: string
  areaNombre: string
  docenteNombre: string
  estado: EstadoAsistenciaHijo
  motivoJustificacion: string | null
  documentoNombre: string | null
  documentoUrl: string | null
}

export interface ResumenAsistencia {
  total: number
  PRESENTE: number
  TARDANZA: number
  AUSENTE: number
  JUSTIFICADA: number
  porcentaje: number | null
}

export interface DiaAsistencia {
  fecha: string
  registros: RegistroAsistencia[]
  resumen: ResumenAsistencia
}

export type AtajoRango = 'SEMANA' | 'MES' | 'MES_ANTERIOR' | 'ANIO'
