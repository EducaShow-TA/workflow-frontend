import type { MetodoHttp, RespuestaErrorApi } from '~/types/api'
import { ErrorSolicitudApi } from '~/types/api'

interface OpcionesSolicitud {
  metodo?: MetodoHttp
  cuerpo?: unknown
}

function convertirErrorApi(error: unknown): ErrorSolicitudApi {
  const detalle = error as {
    statusCode?: number
    data?: Partial<RespuestaErrorApi>
    response?: {
      _data?: Partial<RespuestaErrorApi>
    }
  }

  const estado = detalle?.statusCode ?? 0
  const respuesta = detalle?.data ?? detalle?.response?._data

  const mensaje =
    typeof respuesta?.message === 'string' && respuesta.message.trim()
      ? respuesta.message
      : estado === 0
        ? 'No fue posible conectar con el servidor.'
        : 'No se pudo completar la operación solicitada.'

  return new ErrorSolicitudApi(mensaje, estado, typeof respuesta?.path === 'string' ? respuesta.path : '')
}

export function useApi() {
  const configuracion = useRuntimeConfig()

  async function solicitar<T>(ruta: string, opciones: OpcionesSolicitud = {}): Promise<T> {
    const urlBase = String(configuracion.public.apiBase || '').replace(/\/+$/, '')

    if (!urlBase) {
      throw new ErrorSolicitudApi('La URL del backend todavía no está configurada.', 0, ruta)
    }

    if (!ruta.startsWith('/api/v1/')) {
      throw new ErrorSolicitudApi('La ruta debe utilizar el prefijo /api/v1/.', 0, ruta)
    }

    try {
      return await $fetch<T>(`${urlBase}${ruta}`, {
        method: opciones.metodo ?? 'GET',
        body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
        headers: opciones.cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      })
    } catch (error: unknown) {
      throw convertirErrorApi(error)
    }
  }

  return {
    solicitar,
  }
}
