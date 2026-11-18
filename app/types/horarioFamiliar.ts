export type DiaHorario = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'

export interface BloqueHorarioFamiliar {
  id: number
  dia: DiaHorario
  horaInicio: string
  horaFin: string
  areaNombre: string
  aulaCodigo: string
  docenteNombre: string
}

export interface HorarioFamiliar {
  estudianteId: number
  estudianteNombre: string
  gradoNumero: number
  seccionCodigo: string
  anio: number
  horarioDisponible: boolean
  bloques: BloqueHorarioFamiliar[]
}
