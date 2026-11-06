// Contrato de /api/v1/asistencias-docentes (HU 2.4).

export type EstadoAsistenciaDocente = 'PENDIENTE_MARCAJE' | 'PRESENTE' | 'TARDANZA' | 'INASISTENCIA'

/** Estados que el administrador registra o ajusta a mano. */
export type EstadoAjustable = Exclude<EstadoAsistenciaDocente, 'PENDIENTE_MARCAJE'>

export interface AsistenciaDocente {
  id: number
  docenteId: number
  docenteNombre: string
  fecha: string
  horaEntrada: string | null
  horaSalida: string | null
  estado: EstadoAsistenciaDocente
  motivoAjuste: string | null
}

/** Cuerpo de POST /api/v1/asistencias-docentes. */
export interface SolicitudRegistroAsistenciaDocente {
  docenteId: number
  fecha: string
  estado: EstadoAjustable
  horaEntrada: string | null
  horaSalida: string | null
  motivoAjuste: string
}

/** Cuerpo de PATCH /api/v1/asistencias-docentes/{id}. */
export interface SolicitudAjusteAsistenciaDocente {
  estado: EstadoAjustable
  motivoAjuste: string
}

export interface FormularioMarcaje {
  docenteId: number | null
  fecha: string
  estado: EstadoAjustable
  horaEntrada: string
  horaSalida: string
  motivoAjuste: string
}

export type ErroresMarcaje = Partial<Record<keyof FormularioMarcaje, string>>
