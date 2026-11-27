import { useAutenticacionStore } from '~/stores/autenticacion'

export function useConstanciaMatricula() {
  const autenticacion = useAutenticacionStore()
  const configuracion = useRuntimeConfig()

  async function descargar(matriculaId: number, esApoderado = false): Promise<void> {
    if (!Number.isSafeInteger(matriculaId) || matriculaId <= 0) {
      throw new Error('No se encontró una matrícula válida para descargar la constancia.')
    }

    const ruta = esApoderado
      ? `/api/v1/apoderados/matriculas/${matriculaId}/constancia`
      : `/api/v1/matriculas/${matriculaId}/constancia`
    const base = String(configuracion.public.apiBase || '').replace(/\/+$/, '')
    const respuesta = await fetch(`${base}${ruta}`, {
      headers: autenticacion.token ? { Authorization: `Bearer ${autenticacion.token}` } : {},
      cache: 'no-store',
    })
    if (!respuesta.ok) {
      if (respuesta.status === 401) autenticacion.cerrarSesion()
      const detalle: unknown = await respuesta.json().catch(() => null)
      const mensaje = detalle && typeof detalle === 'object' && 'message' in detalle ? detalle.message : null
      throw new Error(typeof mensaje === 'string' ? mensaje : 'No se pudo descargar la constancia de matrícula.')
    }
    if (!respuesta.headers.get('content-type')?.toLowerCase().includes('application/pdf')) {
      throw new Error('El servidor no devolvió una constancia PDF válida.')
    }

    const url = URL.createObjectURL(await respuesta.blob())
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `constancia-matricula-${matriculaId}.pdf`
    enlace.click()
    URL.revokeObjectURL(url)
  }

  return { descargar }
}
