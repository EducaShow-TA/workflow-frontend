import type { PeriodoMatricula } from '~/types/periodoMatricula'

export interface SituacionPeriodo {
  vigente: PeriodoMatricula | null
  proximo: PeriodoMatricula | null
}

export interface ResumenVacantes {
  capacidad: number
  matriculados: number
  vacantes: number
  seccionesSinVacantes: number
}
