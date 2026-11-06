// Contrato de /api/v1/sesiones-clase y /api/v1/docentes (HU 2.1).

export type EstadoAsistenciaAlumno = 'PRESENTE' | 'TARDANZA' | 'AUSENTE' | 'JUSTIFICADA'

/** Estados que el docente marca en la lista; la justificación es de la HU 2.8. */
export type EstadoMarcable = Exclude<EstadoAsistenciaAlumno, 'JUSTIFICADA'>

/** SesionClaseResumenResponse: la sesión con el avance de su asistencia. */
export interface SesionClaseResumen {
  id: number
  seccionId: number
  seccionCodigo: string
  gradoNumero: number
  areaCodigo: string
  areaNombre: string
  docenteId: number
  docenteNombre: string
  fecha: string
  horaInicio: string
  horaFin: string
  totalAlumnos: number
  registrados: number
  presentes: number
  tardanzas: number
  ausentes: number
  justificadas: number
  ventanaApertura: string
  ventanaCierre: string
  ventanaAbierta: boolean
  registradaEn: string | null
}

export interface FilaListaAsistencia {
  estudianteId: number
  dni: string
  /** "Apellidos, Nombres". */
  nombreCompleto: string
  asistenciaId: number | null
  /** Nulo mientras no se haya registrado. */
  estado: EstadoAsistenciaAlumno | null
  matriculado: boolean
}

export interface ListaAsistencia {
  sesion: SesionClaseResumen
  registradaPor: string | null
  corregidaEn: string | null
  corregidaPor: string | null
  alumnos: FilaListaAsistencia[]
}

/** Cuerpo de PUT /api/v1/sesiones-clase/{id}/asistencias. */
export interface SolicitudGuardarAsistencia {
  asistencias: { estudianteId: number; estado: EstadoMarcable }[]
}

/** Cuerpo de POST /api/v1/sesiones-clase. */
export interface SolicitudSesionClase {
  seccionId: number
  areaCodigo: string
  docenteId: number
  fecha: string
  horaInicio: string
  horaFin: string
}

export type ErroresSesionClase = Partial<Record<keyof SolicitudSesionClase, string>>

export interface DocenteOpcion {
  id: number
  cuentaId: number
  username: string
  nombreCompleto: string
  dni: string
}

export interface AreaOpcion {
  codigo: string
  nombre: string
  activo: boolean
}

/**
 * Situación de una sesión para el docente: ya registrada, con la ventana abierta,
 * por abrir o cerrada sin registro.
 */
export type SituacionSesion = 'REGISTRADA' | 'ABIERTA' | 'POR_ABRIR' | 'CERRADA'
