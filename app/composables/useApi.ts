import type { MetodoHttp, RespuestaErrorApi } from '~/types/api'
import { ErrorSolicitudApi } from '~/types/api'
import { useAutenticacionStore } from '~/stores/autenticacion'

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
  const autenticacion = useAutenticacionStore()

  async function solicitar<T>(ruta: string, opciones: OpcionesSolicitud = {}): Promise<T> {
    // Base vacía = mismo origen: en producción Nginx sirve la SPA y /api; en desarrollo lo hace el devProxy de Nuxt.
    const urlBase = String(configuracion.public.apiBase || '').replace(/\/+$/, '')

    if (!ruta.startsWith('/api/v1/')) {
      throw new ErrorSolicitudApi('La ruta debe utilizar el prefijo /api/v1/.', 0, ruta)
    }

    const cabeceras: Record<string, string> = {}
    if (opciones.cuerpo !== undefined) {
      cabeceras['Content-Type'] = 'application/json'
    }
    if (autenticacion.token) {
      cabeceras.Authorization = `Bearer ${autenticacion.token}`
    }

    try {
      return await $fetch<T>(`${urlBase}${ruta}`, {
        method: opciones.metodo ?? 'GET',
        body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
        headers: cabeceras,
      })
    } catch (error: unknown) {
      const errorApi = convertirErrorApi(error)
      // Token vencido o inválido: se descarta la sesión para que el middleware lleve al login.
      if (errorApi.estado === 401 && autenticacion.token) {
        autenticacion.cerrarSesion()
      }
      throw errorApi
    }
  }

  return {
    solicitar,
  }
}
