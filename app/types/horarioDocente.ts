export interface BloqueHorarioDocente {
  id: number
  dia: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'
  horaInicio: string
  horaFin: string
  areaCodigo: string
  areaNombre: string
  gradoNumero: number
  seccionCodigo: string
  aulaCodigo: string
}
