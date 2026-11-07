import { useApi } from '~/composables/useApi'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { LibretaNotas } from '~/types/libreta'

export function rutaLibreta(estudianteId: number, periodoId: number, pdf = false): string {
  if (![estudianteId, periodoId].every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw new Error('Selecciona un estudiante y un periodo válidos.')
  }
  return `/api/v1/estudiantes/${estudianteId}/libreta${pdf ? '/pdf' : ''}?periodoId=${periodoId}`
}

/** US-3.3: consulta y descarga autenticadas; las notas y el PDF provienen del servidor. */
export function useLibretas() {
  const { solicitar } = useApi()
  const autenticacion = useAutenticacionStore()
  const configuracion = useRuntimeConfig()

  function consultar(estudianteId: number, periodoId: number): Promise<LibretaNotas> {
    return solicitar<LibretaNotas>(rutaLibreta(estudianteId, periodoId))
  }

  async function descargar(estudianteId: number, periodoId: number): Promise<Blob> {
    const ruta = rutaLibreta(estudianteId, periodoId, true)
    const base = String(configuracion.public.apiBase || '').replace(/\/+$/, '')
    const respuesta = await fetch(`${base}${ruta}`, {
      headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
      cache: 'no-store',
    })
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      const detalle: unknown = await respuesta.json().catch(() => null)
      const mensaje = detalle && typeof detalle === 'object' && 'message' in detalle ? detalle.message : null
      throw new Error(
        typeof mensaje === 'string' ? mensaje : 'No fue posible descargar la libreta. Vuelve a consultar.',
      )
    }
    if (!respuesta.headers.get('content-type')?.toLowerCase().includes('application/pdf')) {
      throw new Error('El servidor no devolvió un documento PDF válido.')
    }
    return respuesta.blob()
  }

  return { consultar, descargar }
}
