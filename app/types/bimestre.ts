export type EstadoBimestre = 'PROXIMO' | 'EN_CURSO' | 'POR_CERRAR' | 'CERRADO'

/** Bimestre del calendario del año escolar (API /api/v1/bimestres). */
export interface BimestreAcademico {
  anhio: number
  numero: number
  fechaInicio: string
  fechaFin: string
  estado: EstadoBimestre
  configurado: boolean
  fechaCierre: string | null
  usuarioCierre: string | null
}

export interface CierreBimestre {
  bimestre: BimestreAcademico
  notasCompletadas: number
}
