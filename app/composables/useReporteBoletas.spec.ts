import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearFiltrosReporte, useReporteBoletas, validarFechasReporte } from './useReporteBoletas'
import { puedeAcceder } from './usePermisosRol'
import type { ReporteBoletas } from '~/types/reporteBoletas'

const { solicitar } = vi.hoisted(() => ({ solicitar: vi.fn() }))
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ solicitar }) }))

const respuesta: ReporteBoletas = {
  pagina: { content: [], totalElements: 64, totalPages: 4, number: 2, size: 20 },
  montoPendiente: 27945,
  familiasMorosas: 16,
}

describe('reporte de cobranza paginado US-1.10', () => {
  beforeEach(() => {
    solicitar.mockReset()
  })

  it('consulta ambos estados en una sola petición y utiliza los totales globales del servidor', async () => {
    solicitar.mockResolvedValue(respuesta)
    const resultado = await useReporteBoletas().consultar(crearFiltrosReporte(), 2)
    expect(solicitar).toHaveBeenCalledExactlyOnceWith('/api/v1/reportes/boletas-pension/pagina?page=2&size=20')
    expect(resultado).toEqual(respuesta)
    expect(resultado.montoPendiente).toBe(27945)
    expect(resultado.familiasMorosas).toBe(16)
  })

  it('envía todos los filtros y la página sin mezclar estados ni paginar localmente', async () => {
    solicitar.mockResolvedValue(respuesta)
    await useReporteBoletas().consultar(
      {
        gradoId: '19',
        seccionId: '32',
        estado: 'EN_MORA',
        vencimientoDesde: '2026-10-01',
        vencimientoHasta: '2026-10-31',
      },
      1,
      10,
    )
    const parametros = new URL(solicitar.mock.lastCall?.[0], 'http://localhost').searchParams
    expect(Object.fromEntries(parametros)).toEqual({
      page: '1',
      size: '10',
      gradoId: '19',
      seccionId: '32',
      estado: 'EN_MORA',
      vencimientoDesde: '2026-10-01',
      vencimientoHasta: '2026-10-31',
    })
    expect(solicitar).toHaveBeenCalledTimes(1)
  })

  it('rechaza fechas inexistentes e invertidas antes de consultar y acepta el mismo día', async () => {
    const filtros = { ...crearFiltrosReporte(), vencimientoDesde: '2026-11-02', vencimientoHasta: '2026-11-01' }
    await expect(useReporteBoletas().consultar(filtros)).rejects.toThrow('fecha final')
    expect(solicitar).not.toHaveBeenCalled()
    expect(validarFechasReporte({ ...filtros, vencimientoDesde: '2026-02-30' })).toContain('válidas')
    expect(validarFechasReporte({ ...filtros, vencimientoHasta: '2026-11-02' })).toBe('')
  })

  it('propaga fallos sin convertirlos en totales cero ni hacer una segunda consulta', async () => {
    solicitar.mockRejectedValue(new Error('Servidor no disponible'))
    await expect(useReporteBoletas().consultar(crearFiltrosReporte())).rejects.toThrow('Servidor no disponible')
    expect(solicitar).toHaveBeenCalledTimes(1)
  })

  it('permite el reporte solo al administrador', () => {
    expect(puedeAcceder('ADMINISTRADOR', '/reportes/boletas')).toBe(true)
    for (const rol of ['DOCENTE', 'ALUMNO', 'APODERADO'] as const)
      expect(puedeAcceder(rol, '/reportes/boletas')).toBe(false)
  })
})
