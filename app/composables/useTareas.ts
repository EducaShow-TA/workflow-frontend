import { useApi } from '~/composables/useApi'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { SolicitudTarea, Tarea } from '~/types/tarea'

const RUTA_TAREAS = '/api/v1/tareas'

/** US-3.7: creación, consulta y seguimiento real de tareas. */
export function useTareas() {
  const { solicitar } = useApi()
  const configuracion = useRuntimeConfig()
  const autenticacion = useAutenticacionStore()

  function listarPorPeriodo(periodoId: number): Promise<Tarea[]> {
    return solicitar<Tarea[]>(`${RUTA_TAREAS}?periodoId=${periodoId}`)
  }

  function registrar(solicitud: SolicitudTarea): Promise<Tarea> {
    return solicitar<Tarea>(RUTA_TAREAS, { metodo: 'POST', cuerpo: solicitud })
  }

  function marcarEntrega(tareaId: number, matriculaId: number, cumplida: boolean): Promise<Tarea> {
    return solicitar<Tarea>(`${RUTA_TAREAS}/${tareaId}/entregas/${matriculaId}`, {
      metodo: 'PATCH',
      cuerpo: { cumplida },
    })
  }

  /** US-3.10: descarga el archivo que entregó el alumno. */
  async function descargarArchivoEntrega(tareaId: number, matriculaId: number, nombre: string): Promise<void> {
    const base = String(configuracion.public.apiBase || '').replace(/\/+$/, '')
    const respuesta = await fetch(`${base}${RUTA_TAREAS}/${tareaId}/entregas/${matriculaId}/archivo`, {
      headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
      cache: 'no-store',
    })
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      throw new Error('No se pudo descargar el archivo de la entrega.')
    }
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(await respuesta.blob())
    enlace.download = nombre
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  return { listarPorPeriodo, registrar, marcarEntrega, descargarArchivoEntrega }
}
