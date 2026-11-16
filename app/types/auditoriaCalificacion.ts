export type TipoCalificacionAuditoria = 'FINAL' | 'PARCIAL'

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
  competenciaCodigo: string | null
  evaluacionId: number | null
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
}
