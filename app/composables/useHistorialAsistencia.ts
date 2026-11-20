import { useApi } from '~/composables/useApi'

export interface AsistenciaHistorial {
  asistenciaId: number
  fecha: string
  horaInicio: string
  horaFin: string
  seccionCodigo: string
  areaNombre: string
  docenteNombre: string
  estado: 'PENDIENTE_MARCAJE' | 'PRESENTE' | 'AUSENTE' | 'TARDANZA' | 'JUSTIFICADA'
  motivoJustificacion: string | null
}

export function useHistorialAsistencia() {
  const { solicitar } = useApi()

  function listarVinculados() {
    return solicitar<{ estudianteId: number; nombreCompleto: string }[]>('/api/v1/apoderados/mis-estudiantes')
  }

  function consultar(estudianteId: number, desde: string, hasta: string) {
    const parametros = new URLSearchParams()
    if (desde) parametros.set('desde', desde)
    if (hasta) parametros.set('hasta', hasta)
    const consulta = parametros.size ? `?${parametros}` : ''
    return solicitar<AsistenciaHistorial[]>(`/api/v1/asistencias-estudiantes/${estudianteId}/historial${consulta}`)
  }

  return { listarVinculados, consultar }
}
