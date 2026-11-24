export interface ParametrosSistema {
  fechaSistema: string
  fechaSimulada: boolean
  fechaSimuladaPermitida: boolean
  motivoFecha: string | null
  fechaSimuladaPor: string | null
  fechaSimuladaEn: string | null
  pagoEnLineaPermitido: boolean
  pagoEnLineaActivo: boolean
}

export interface EstadoSistema {
  fechaSistema: string
  fechaSimulada: boolean
  pagoEnLineaDisponible: boolean
}

export interface SolicitudFechaSistema {
  fecha: string
  motivo: string
}
