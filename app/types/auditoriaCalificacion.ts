export type TipoCalificacionAuditoria = 'FINAL' | 'PARCIAL'

export type GrupoAccionAuditoria = 'RECTIFICACIONES' | 'REGISTROS' | 'AUTOMATICAS'

export interface RegistroAuditoriaCalificacion {
  id: number
  fechaHora: string
  usuario: string
  rolUsuario: string
  accion: string
  tipoCalificacion: TipoCalificacionAuditoria
  periodoId: number | null
  matriculaId: number | null
  estudianteId: number | null
  estudianteNombre?: string | null
  competenciaCodigo: string | null
  competenciaNombre?: string | null
  areaNombre?: string | null
  evaluacionId: number | null
  bimestre: number | null
  notaAnterior: string | null
  notaNueva: string | null
  puntajeAnterior: number | null
  puntajeNuevo: number | null
  consolidadaAnterior: boolean | null
  consolidadaNueva: boolean | null
  justificadaAnterior: boolean | null
  justificadaNueva: boolean | null
  observacionAnterior: string | null
  observacionNueva: string | null
  motivo?: string | null
}
