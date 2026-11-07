export interface AccionRapidaPanel {
  id: string
  titulo: string
  icono: string
  colorFondo: string
}

export interface MetricaPanel {
  id: string
  titulo: string
  valor: string
  icono: string
  detalle: string
  colorDetalle: 'negativo' | 'positivo' | 'neutro'
  iconoDetalle?: string
  porcentajeProgreso?: number
}

export interface ResumenPanel {
  acciones: AccionRapidaPanel[]
  metricas: MetricaPanel[]
}
