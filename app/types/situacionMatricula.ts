/** Respuesta de GET /api/v1/matriculas/situacion: qué grado le corresponde a cada estudiante en el año. */
export type TipoSituacionMatricula = 'NUEVO' | 'PROMOVIDO' | 'REPITE' | 'EGRESADO' | 'BLOQUEADO'

export interface SituacionMatricula {
  estudianteId: number
  situacion: TipoSituacionMatricula
  gradoAnterior: number | null
  gradoDestino: number | null
  anhioAnterior: number | null
  /** Solo en BLOQUEADO: por qué todavía no se puede matricular. */
  motivo: string | null
}
