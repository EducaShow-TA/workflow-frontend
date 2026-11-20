/** US-2.6: reflejo de los DTOs de /api/v1/reportes/asistencia-estudiantes. Se cuentan sesiones de clase. */
export interface TotalesAsistencia {
  presentes: number
  tardanzas: number
  inasistencias: number
  justificadas: number
  totalSesiones: number
}

export interface FilaReporteAsistencia extends TotalesAsistencia {
  estudianteId: number
  nombreCompleto: string
  gradoId: number
  grado: string
  seccionId: number
  seccion: string
  /** Solo faltas sin justificar, con un decimal. */
  porcentajeInasistencia: number
}

export interface ReporteAsistencia {
  desde: string
  hasta: string
  totales: TotalesAsistencia
  alumnos: FilaReporteAsistencia[]
}

export interface SeccionReporteAsistencia {
  seccionId: number
  seccion: string
  gradoId: number
  grado: string
}

export interface FiltrosReporteAsistencia {
  desde: string
  hasta: string
  gradoId: number | null
  seccionId: number | null
}
