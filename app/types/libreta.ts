/** Contrato de LibretaNotasResponse del backend, sin calificaciones calculadas en el cliente. */
export interface CompetenciaLibreta {
  codigo: string
  nombre: string
  nota: string | null
  puntajeConsolidado: number | null
  observacion: string | null
}
export interface PeriodoLibreta {
  periodoId: number
  fechaInicio: string
  fechaFin: string
  gradoNumero: number
  seccion: string
  actasCerradas: boolean
  areas: { codigo: string; nombre: string; competencias: CompetenciaLibreta[] }[]
}
export interface LibretaNotas {
  estudianteId: number
  estudiante: string
  periodoSolicitadoId: number
  anhioEscolar: number
  periodos: PeriodoLibreta[]
}
