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

/** Competencia activa del área de una clase del docente. */
export interface CompetenciaClase {
  codigo: string
  nombre: string
}

/** Respuesta de /api/v1/docentes/mis-clases: un área dictada en una sección, con su periodo vigente. */
export interface MiClase {
  periodoId: number
  seccionId: number
  gradoNumero: number
  seccionCodigo: string
  anhio: number
  areaCodigo: string
  areaNombre: string
  totalAlumnos: number
  competencias: CompetenciaClase[]
}

/** Respuesta de /api/v1/docentes/mis-clases/{periodoId}/alumnos. */
export interface AlumnoClase {
  matriculaId: number
  estudianteId: number
  dni: string
  nombreCompleto: string
}

/** Resultado del análisis de riesgo académico para un área y periodo. */
export interface RiesgoAcademico {
  periodoId: number
  areaCodigo: string
  umbral: number
  totalAlumnos: number
  alumnosEnRiesgo: number
  alumnos: Array<AlumnoClase & { notasC: number; enRiesgo: boolean }>
}
