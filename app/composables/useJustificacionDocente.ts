import { useApi } from '~/composables/useApi'

export interface RespuestaJustificacionDocente {
  asistenciaId: number
  estudianteId: number
  estado: 'JUSTIFICADA'
  motivo: string
  documentoNombre: string | null
  documentoTipo: string | null
  documentoTamanio: number | null
  documentoUrl: string | null
}

/** US-2.8: el docente justifica una ausencia de una de sus sesiones. */
export function useJustificacionDocente() {
  const { solicitar } = useApi()

  function justificar(
    asistenciaId: number,
    motivo: string,
    documento: File | null,
  ): Promise<RespuestaJustificacionDocente> {
    const cuerpo = new FormData()
    cuerpo.append('motivo', motivo.trim())
    if (documento) cuerpo.append('documento', documento, documento.name)

    return solicitar<RespuestaJustificacionDocente>(
      `/api/v1/asistencias-estudiantes/${asistenciaId}/justificacion-docente`,
      { metodo: 'PATCH', cuerpo },
    )
  }

  return { justificar }
}
