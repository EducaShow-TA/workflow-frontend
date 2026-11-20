export interface BloqueHorarioDocente {
  id: number
  horarioId: number
  seccionId: number
  bloqueId: number
  aulaId: number
  dia: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY'
  horaInicio: string
  horaFin: string
  areaCodigo: string
  areaNombre: string
  gradoNumero: number
  seccionCodigo: string
  aulaCodigo: string
}
