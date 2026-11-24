export interface VentanaMatriculaPanel {
  fechaInicio: string
  fechaLimite: string
  estado: 'PENDIENTE' | 'VIGENTE'
}

export interface PendientesPanelAdministrador {
  matriculasPorConfirmar: number
  /** Años escolares de las matrículas por confirmar. */
  anhiosPorConfirmar: number[]
  familiasEnMora: number
  montoEnMora: number
  docentesSinMarcar: number
  erroresUltimas24h: number
  erroresCriticos24h: number
}

export interface IndicadoresPanelAdministrador {
  /** Vacantes ocupadas del año: confirmados y por confirmar. */
  estudiantesMatriculados: number
  estudiantesConfirmados: number
  vacantesTotales: number
  pensionMesEmitida: number
  pensionMesCobrada: number
  asistenciasSemana: number
  presentesSemana: number
  tardanzasSemana: number
  docentesConClaseHoy: number
  docentesPresentesHoy: number
  docentesTardanzaHoy: number
}

export interface CobranzaMesPanel {
  mes: number
  pagado: number
  vencido: number
  porVencer: number
}

export interface OcupacionGradoPanel {
  nivelEducativo: string
  grado: number
  secciones: number
  matriculados: number
  vacantes: number
  pendientes: number
}

export type TipoActividadPanel = 'PAGO' | 'MORA' | 'RECTIFICACION'

export interface ActividadPanel {
  tipo: TipoActividadPanel
  titulo: string
  detalle: string
  fecha: string
}

export interface PanelAdministrador {
  fecha: string
  anio: number
  ventanaMatricula: VentanaMatriculaPanel | null
  pendientes: PendientesPanelAdministrador
  indicadores: IndicadoresPanelAdministrador
  cobranza: CobranzaMesPanel[]
  ocupacion: OcupacionGradoPanel[]
  actividad: ActividadPanel[]
}
