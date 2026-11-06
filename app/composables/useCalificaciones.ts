import { useApi } from '~/composables/useApi'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { Calificacion, SolicitudCalificacion } from '~/types/calificacion'

const RUTA = '/api/v1/calificaciones'

/** US-3.8: calificaciones con evidencia pedagógica y seguimiento por competencia. */
export function useCalificaciones() {
  const { solicitar } = useApi()
  const autenticacion = useAutenticacionStore()
  const configuracion = useRuntimeConfig()

  function listar(periodoId: number, competenciaCodigo: string): Promise<Calificacion[]> {
    return solicitar<Calificacion[]>(
      `/api/v1/seguimiento/competencias/${encodeURIComponent(competenciaCodigo)}?periodoId=${periodoId}`,
    )
  }

  function registrar(solicitud: SolicitudCalificacion, archivo: File | null): Promise<Calificacion> {
    // Spring Boot espera @RequestPart("datos") JSON, no un campo de texto plano.
    const cuerpo = new FormData()
    const datos = new Blob([JSON.stringify(solicitud)], { type: 'application/json' })
    cuerpo.append('datos', datos, 'datos.json')
    if (archivo) cuerpo.append('archivo', archivo, archivo.name)
    // useApi no fija Content-Type para FormData: el navegador genera el boundary multipart.
    return solicitar<Calificacion>(RUTA, { metodo: 'POST', cuerpo })
  }

  async function descargarEvidencia(calificacion: Calificacion): Promise<void> {
    if (calificacion.evidenciaTipo !== 'ARCHIVO') return
    if (!calificacion.evidenciaUrl?.startsWith('/api/v1/evidencias/')) {
      throw new Error('No se encontró una ruta válida para descargar esta evidencia.')
    }
    const base = String(configuracion.public.apiBase || '').replace(/\/+$/, '')
    const respuesta = await fetch(`${base}${calificacion.evidenciaUrl}`, {
      headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
    })
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      throw new Error('No fue posible descargar la evidencia adjunta.')
    }
    const objetoUrl = URL.createObjectURL(await respuesta.blob())
    const enlace = document.createElement('a')
    enlace.href = objetoUrl
    enlace.download = calificacion.evidenciaNombre || `evidencia-${calificacion.id}`
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    window.setTimeout(() => URL.revokeObjectURL(objetoUrl), 1000)
  }

  return { listar, registrar, descargarEvidencia }
}
