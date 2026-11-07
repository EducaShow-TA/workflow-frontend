import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rutaLibreta, useLibretas } from './useLibretas'
import { obtenerRutaInicio, puedeAcceder } from './usePermisosRol'

const { solicitar, cerrarSesion, autenticacion } = vi.hoisted(() => ({
  solicitar: vi.fn(),
  cerrarSesion: vi.fn(),
  autenticacion: { token: 'token-de-prueba' },
}))
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ solicitar }) }))
vi.mock('~/stores/autenticacion', () => ({
  useAutenticacionStore: () => ({ ...autenticacion, cerrarSesion }),
}))

describe('libretas US-3.3', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8080/' } }))
    vi.stubGlobal('fetch', vi.fn())
  })

  it('consulta los identificadores elegidos sin calcular ni reemplazar las notas del servidor', async () => {
    const libreta = {
      estudianteId: 7,
      estudiante: 'Alumno de prueba',
      periodoSolicitadoId: 12,
      anhioEscolar: 2026,
      periodos: [],
    }
    solicitar.mockResolvedValueOnce(libreta)
    expect(await useLibretas().consultar(7, 12)).toBe(libreta)
    expect(solicitar).toHaveBeenCalledExactlyOnceWith('/api/v1/estudiantes/7/libreta?periodoId=12')
  })

  it('impide construir consultas con IDs vacíos, negativos, fraccionarios o no seguros', () => {
    for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => rutaLibreta(id, 2)).toThrow()
      expect(() => rutaLibreta(2, id)).toThrow()
    }
    expect(solicitar).not.toHaveBeenCalled()
  })

  it('descarga el PDF autenticado desde la API sin persistir el token', async () => {
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    vi.mocked(fetch).mockResolvedValueOnce(new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } }))
    expect((await useLibretas().descargar(7, 12)).type).toBe('application/pdf')
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      'http://localhost:8080/api/v1/estudiantes/7/libreta/pdf?periodoId=12',
      {
        headers: { Authorization: 'Bearer token-de-prueba' },
        cache: 'no-store',
      },
    )
  })

  it('propaga el rechazo de acceso sin descargar un archivo falso', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Sin vínculo activo' }), { status: 403 }),
    )
    await expect(useLibretas().descargar(7, 12)).rejects.toThrow('Sin vínculo activo')
    expect(cerrarSesion).not.toHaveBeenCalled()
  })

  it('descarta una sesión vencida al recibir 401 y admite errores sin JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Sin sesión', { status: 401 }))
    await expect(useLibretas().descargar(7, 12)).rejects.toThrow('No fue posible descargar')
    expect(cerrarSesion).toHaveBeenCalledOnce()
  })

  it('rechaza una respuesta HTML aunque tenga estado 200', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } }),
    )
    await expect(useLibretas().descargar(7, 12)).rejects.toThrow('PDF válido')
  })

  it('da acceso al apoderado sin habilitarle la gestión de calificaciones ni los catálogos administrativos', () => {
    expect(obtenerRutaInicio('APODERADO')).toBe('/libretas')
    expect(puedeAcceder('APODERADO', '/libretas')).toBe(true)
    expect(puedeAcceder('APODERADO', '/calificaciones')).toBe(false)
    expect(puedeAcceder('APODERADO', '/estudiantes')).toBe(false)
    expect(puedeAcceder('ADMINISTRADOR', '/calificaciones/libretas')).toBe(true)
    expect(puedeAcceder('DOCENTE', '/docente/libretas')).toBe(true)
    expect(puedeAcceder('ALUMNO', '/libretas')).toBe(false)
  })
})
