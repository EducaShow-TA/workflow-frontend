export interface ReporteAnualNotas {
  estudianteId: number
  estudiante: string
  periodoId: number
  anhioEscolar: number
  ultimoBimestre: number
  gradoNumero: number
  seccion: string
  actasCerradas: boolean
  cursos: CursoReporteAnual[]
}

export interface CursoReporteAnual {
  codigo: string
  nombre: string
  competencias: CompetenciaReporteAnual[]
}

export interface CompetenciaReporteAnual {
  codigo: string
  nombre: string
  notasPorBimestre: Array<'AD' | 'A' | 'B' | 'C' | null>
}
