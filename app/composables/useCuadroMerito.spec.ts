import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rutaCuadroMerito, useCuadroMerito } from './useCuadroMerito'

const { solicitar, cerrarSesion, autenticacion } = vi.hoisted(() => ({
  solicitar: vi.fn(),
  cerrarSesion: vi.fn(),
  autenticacion: { token: 'token-de-prueba' },
}))
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ solicitar }) }))
vi.mock('~/stores/autenticacion', () => ({
  useAutenticacionStore: () => ({ ...autenticacion, cerrarSesion }),
}))

describe('cuadro de mérito por sección', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8080/' } }))
    vi.stubGlobal('fetch', vi.fn())
  })

  it('construye rutas y rechaza períodos inválidos antes de consultar', () => {
    expect(rutaCuadroMerito(12)).toBe('/api/v1/reportes/cuadro-merito?periodoId=12')
    expect(rutaCuadroMerito(12, 'excel')).toBe('/api/v1/reportes/cuadro-merito/excel?periodoId=12')
    for (const id of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => rutaCuadroMerito(id)).toThrow()
    }
  })

  it('consulta el resultado generado por el servidor sin recalcular el promedio localmente', async () => {
    const cuadro = { periodoId: 12, estudiantes: [{ puesto: 1, promedio: 3.125 }] }
    solicitar.mockResolvedValueOnce(cuadro)
    expect(await useCuadroMerito().consultar(12)).toBe(cuadro)
    expect(solicitar).toHaveBeenCalledExactlyOnceWith('/api/v1/reportes/cuadro-merito?periodoId=12')
  })

  it('descarga PDF y Excel autenticados con sus tipos de contenido', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(new Blob(['%PDF-1.4']), { headers: { 'Content-Type': 'application/pdf' } }))
      .mockResolvedValueOnce(
        new Response(new Blob(['PK']), {
          headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        }),
      )
    const api = useCuadroMerito()
    expect((await api.descargar(12, 'pdf')).type).toBe('application/pdf')
    expect((await api.descargar(12, 'excel')).size).toBeGreaterThan(0)
    expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:8080/api/v1/reportes/cuadro-merito/pdf?periodoId=12',
      'http://localhost:8080/api/v1/reportes/cuadro-merito/excel?periodoId=12',
    ])
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toEqual({
      headers: { Authorization: 'Bearer token-de-prueba' },
      cache: 'no-store',
    })
  })

  it('propaga errores del backend y no acepta una descarga con tipo incorrecto', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'El acta sigue abierta' }), { status: 409 }))
      .mockResolvedValueOnce(new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }))
    const api = useCuadroMerito()
    await expect(api.descargar(12, 'pdf')).rejects.toThrow('El acta sigue abierta')
    await expect(api.descargar(12, 'excel')).rejects.toThrow('archivo EXCEL válido')
  })
})
