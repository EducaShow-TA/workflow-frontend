/** Estado del cierre de actas de un periodo (API /api/v1/periodos/{periodoId}/cierre-actas). */
export interface CierreActas {
  periodoId: number
  actasCerradas: boolean
  fechaCierre: string | null
  usuario: string | null
}
