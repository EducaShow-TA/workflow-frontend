import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  crearFiltrosReporteAsistencia,
  gradosDisponibles,
  guardarArchivo,
  rutaReporteAsistencia,
  seccionAjustadaAlGrado,
  seccionesDelGrado,
  useReporteAsistencia,
} from './useReporteAsistencia'
import { buscarReglaRuta, puedeAcceder, tienePermiso } from './usePermisosRol'
import type { FiltrosReporteAsistencia, SeccionReporteAsistencia } from '~/types/reporteAsistencia'

const { solicitar, cerrarSesion, autenticacion } = vi.hoisted(() => ({
  solicitar: vi.fn(),
  cerrarSesion: vi.fn(),
  autenticacion: { token: 'token-de-prueba' },
}))
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ solicitar }) }))
vi.mock('~/stores/autenticacion', () => ({
  useAutenticacionStore: () => ({ ...autenticacion, cerrarSesion }),
}))

const filtros: FiltrosReporteAsistencia = { desde: '2026-11-01', hasta: '2026-11-17', gradoId: null, seccionId: null }

const secciones: SeccionReporteAsistencia[] = [
  { seccionId: 7, seccion: 'A', gradoId: 3, grado: '3.° Secundaria' },
  { seccionId: 8, seccion: 'B', gradoId: 3, grado: '3.° Secundaria' },
  { seccionId: 9, seccion: 'A', gradoId: 4, grado: '4.° Secundaria' },
]

function respuestaCsv(cabeceras: Record<string, string>, estado = 200, cuerpo: BodyInit = 'Alumno\r\n'): Response {
  return new Response(cuerpo, { status: estado, headers: cabeceras })
}

describe('reporte de asistencia US-2.6', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: '' } }))
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('crea filtros del primer día del mes a hoy', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 17, 9, 30))

    expect(crearFiltrosReporteAsistencia()).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-17',
      gradoId: null,
      seccionId: null,
    })
  })

  it('arma la ruta con fechas y omite filtros vacíos', () => {
    expect(rutaReporteAsistencia(filtros)).toBe(
      '/api/v1/reportes/asistencia-estudiantes?desde=2026-11-01&hasta=2026-11-17',
    )
  })

  it('incluye grado y sección y la variante csv', () => {
    expect(rutaReporteAsistencia({ ...filtros, gradoId: 3, seccionId: 7 }, true)).toBe(
      '/api/v1/reportes/asistencia-estudiantes/csv?desde=2026-11-01&hasta=2026-11-17&gradoId=3&seccionId=7',
    )
  })

  it('consulta el reporte y el catálogo de secciones', async () => {
    const reporte = { desde: filtros.desde, hasta: filtros.hasta, totales: {}, alumnos: [] }
    solicitar.mockResolvedValueOnce(reporte).mockResolvedValueOnce(secciones)

    expect(await useReporteAsistencia().consultar({ ...filtros, seccionId: 7 })).toEqual(reporte)
    expect(solicitar).toHaveBeenNthCalledWith(
      1,
      '/api/v1/reportes/asistencia-estudiantes?desde=2026-11-01&hasta=2026-11-17&seccionId=7',
    )
    expect(await useReporteAsistencia().listarSecciones()).toEqual(secciones)
    expect(solicitar).toHaveBeenNthCalledWith(2, '/api/v1/reportes/asistencia-estudiantes/secciones')
  })

  it('descarga el csv con el nombre del Content-Disposition', async () => {
    vi.mocked(fetch).mockResolvedValue(
      respuestaCsv({
        'content-type': 'text/csv;charset=UTF-8',
        'content-disposition': 'attachment; filename="reporte-asistencia_2026-11-01_2026-11-17.csv"',
      }),
    )

    const { archivo, nombre } = await useReporteAsistencia().descargarCsv({ ...filtros, gradoId: 3 })

    expect(nombre).toBe('reporte-asistencia_2026-11-01_2026-11-17.csv')
    expect(await archivo.text()).toBe('Alumno\r\n')
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/reportes/asistencia-estudiantes/csv?desde=2026-11-01&hasta=2026-11-17&gradoId=3',
      expect.objectContaining({ headers: { Authorization: 'Bearer token-de-prueba' } }),
    )
  })

  it('usa un nombre por defecto si falta la cabecera', async () => {
    vi.mocked(fetch).mockResolvedValue(respuestaCsv({ 'content-type': 'text/csv' }))

    const { nombre } = await useReporteAsistencia().descargarCsv(filtros)

    expect(nombre).toBe('reporte-asistencia_2026-11-01_2026-11-17.csv')
  })

  it('propaga el mensaje del JSON de error y cierra sesión en 401', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        respuestaCsv(
          { 'content-type': 'application/json' },
          403,
          JSON.stringify({ message: 'No tiene permiso para consultar el reporte de esta sección' }),
        ),
      )
      .mockResolvedValueOnce(respuestaCsv({ 'content-type': 'application/json' }, 401, '{}'))

    await expect(useReporteAsistencia().descargarCsv(filtros)).rejects.toThrow(
      'No tiene permiso para consultar el reporte de esta sección',
    )
    expect(cerrarSesion).not.toHaveBeenCalled()
    await expect(useReporteAsistencia().descargarCsv(filtros)).rejects.toThrow()
    expect(cerrarSesion).toHaveBeenCalledOnce()
  })

  it('rechaza una respuesta que no es csv', async () => {
    vi.mocked(fetch).mockResolvedValue(respuestaCsv({ 'content-type': 'text/html' }))

    await expect(useReporteAsistencia().descargarCsv(filtros)).rejects.toThrow('CSV')
  })

  it('filtra secciones por grado y lista grados sin repetir', () => {
    expect(seccionesDelGrado(secciones, 3).map((s) => s.seccionId)).toEqual([7, 8])
    expect(seccionesDelGrado(secciones, null)).toEqual(secciones)
    expect(gradosDisponibles(secciones)).toEqual([
      { gradoId: 3, grado: '3.° Secundaria' },
      { gradoId: 4, grado: '4.° Secundaria' },
    ])
  })

  it('administrador y docente acceden al reporte de asistencia; alumno y apoderado no', () => {
    expect(buscarReglaRuta('/reportes/asistencia')?.permiso).toBe('REPORTE_ASISTENCIA_VER')
    expect(buscarReglaRuta('/docente/reporte-asistencia')?.permiso).toBe('REPORTE_ASISTENCIA_VER')
    expect(tienePermiso('ADMINISTRADOR', 'REPORTE_ASISTENCIA_VER')).toBe(true)
    expect(tienePermiso('DOCENTE', 'REPORTE_ASISTENCIA_VER')).toBe(true)
    expect(puedeAcceder('ADMINISTRADOR', '/reportes/asistencia')).toBe(true)
    expect(puedeAcceder('DOCENTE', '/docente/reporte-asistencia')).toBe(true)
    expect(puedeAcceder('ALUMNO', '/reportes/asistencia')).toBe(false)
    expect(puedeAcceder('APODERADO', '/docente/reporte-asistencia')).toBe(false)
  })

  it('limpia la sección si no pertenece al grado elegido', () => {
    expect(seccionAjustadaAlGrado(secciones, 4, 7)).toBeNull()
    expect(seccionAjustadaAlGrado(secciones, 3, 7)).toBe(7)
    expect(seccionAjustadaAlGrado(secciones, null, 7)).toBe(7)
    expect(seccionAjustadaAlGrado(secciones, 4, null)).toBeNull()
  })

  it('guarda el archivo con un enlace en el documento y libera la URL después', () => {
    vi.useFakeTimers()
    const enlace = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
    const documento = { createElement: vi.fn(() => enlace), body: { appendChild: vi.fn() } }
    const urls = { createObjectURL: vi.fn(() => 'blob:reporte'), revokeObjectURL: vi.fn() }

    guardarArchivo(new Blob(['x']), 'reporte.csv', documento as unknown as Document, urls)

    expect(documento.body.appendChild).toHaveBeenCalledWith(enlace)
    expect(enlace).toMatchObject({ href: 'blob:reporte', download: 'reporte.csv' })
    expect(enlace.click).toHaveBeenCalledOnce()
    expect(enlace.remove).toHaveBeenCalledOnce()
    expect(urls.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:reporte')
  })
})
