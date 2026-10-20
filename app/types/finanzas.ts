export interface EstadoFinancieroPanel {
  pagosPendientes: number
  alumnosPendientes: number
  pagosVencidos: number
  alumnosVencidos: number
}

export interface PagoMensualPanel {
  mes: string
  recaudado: number
  proyectado: number
}

export interface ResumenFinancieroPanel {
  estadoFinanciero: EstadoFinancieroPanel
  tendenciaPagos: PagoMensualPanel[]
  escalaMaxima: number
}
