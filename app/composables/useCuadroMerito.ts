import { useApi } from '~/composables/useApi'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { CuadroMerito } from '~/types/cuadroMerito'

export type FormatoCuadroMerito = 'pdf' | 'excel'

export function rutaCuadroMerito(periodoId: number, formato?: FormatoCuadroMerito): string {
  if (!Number.isSafeInteger(periodoId) || periodoId <= 0) {
    throw new Error('Selecciona un período académico válido.')
  }
  const ruta = `/api/v1/reportes/cuadro-merito${formato ? `/${formato}` : ''}`
  return `${ruta}?periodoId=${periodoId}`
}

export function useCuadroMerito() {
  const { solicitar } = useApi()
  const autenticacion = useAutenticacionStore()
  const configuracion = useRuntimeConfig()

  function consultar(periodoId: number): Promise<CuadroMerito> {
    return solicitar<CuadroMerito>(rutaCuadroMerito(periodoId))
  }

  async function descargar(periodoId: number, formato: FormatoCuadroMerito): Promise<Blob> {
    const ruta = rutaCuadroMerito(periodoId, formato)
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
        typeof mensaje === 'string' ? mensaje : `No fue posible descargar el archivo ${formato.toUpperCase()}.`,
      )
    }

    const tipoEsperado =
      formato === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    if (!respuesta.headers.get('content-type')?.toLowerCase().includes(tipoEsperado)) {
      throw new Error(`El servidor no devolvió un archivo ${formato.toUpperCase()} válido.`)
    }
    return respuesta.blob()
  }

  return { consultar, descargar }
}
