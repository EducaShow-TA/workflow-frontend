// Tipos de US-4.5: historial de cambios de horario. Siguen AuditoriaHorarioResponse del backend.

export type TipoVigenciaHorario = 'PERMANENTE' | 'TEMPORAL'

/** Elemento de GET /api/v1/horarios/auditoria. */
export interface RegistroAuditoriaHorario {
  id: number
  horarioId: number
  seccion: string
  /** CREACIÓN, ACTUALIZACIÓN o ELIMINACIÓN. */
  accion: string
  /** "yyyy-MM-ddTHH:mm:ss", hora del servidor. */
  fechaHora: string
  /** null cuando el cambio no tuvo una cuenta identificable. */
  usuarioCuentaId: number | null
  usuarioNombre: string
  detalle: string
  valoresAnteriores: string | null
  valoresNuevos: string | null
  vigenciaTipo: TipoVigenciaHorario
  /** "yyyy-MM-dd". */
  vigenteDesde: string | null
  vigenteHasta: string | null
}

export interface FiltrosAuditoriaHorario {
  horarioId?: number
  /** "yyyy-MM-dd", ambos inclusive. */
  desde: string
  hasta: string
}
