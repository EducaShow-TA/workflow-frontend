import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearFiltrosReporte, useReporteBoletas, validarFechasReporte } from './useReporteBoletas'
import { puedeAcceder } from './usePermisosRol'
import type { ReporteBoletas } from '~/types/reporteBoletas'

const { solicitar } = vi.hoisted(() => ({ solicitar: vi.fn() }))
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ solicitar }) }))

const vacio: ReporteBoletas = { boletas: [], montoPendiente: 0, familiasMorosas: 0 }

describe('reporte de cobranza US-1.10', () => {
  beforeEach(() => solicitar.mockReset())

  it('consulta ambos estados con los mismos filtros y suma los totales sin error de decimales', async () => {
    solicitar
      .mockResolvedValueOnce({ ...vacio, montoPendiente: 0.1 })
      .mockResolvedValueOnce({ ...vacio, montoPendiente: 0.2, familiasMorosas: 2 })
    const resultado = await useReporteBoletas().consultar({
      ...crearFiltrosReporte(),
      gradoId: '19',
      seccionId: '32',
      vencimientoDesde: '2026-10-01',
      vencimientoHasta: '2026-10-31',
    })
    expect(solicitar).toHaveBeenCalledTimes(2)
    for (const [ruta] of solicitar.mock.calls) {
      const parametros = new URL(ruta, 'http://localhost').searchParams
      expect(parametros.get('gradoId')).toBe('19')
      expect(parametros.get('seccionId')).toBe('32')
      expect(parametros.get('vencimientoDesde')).toBe('2026-10-01')
      expect(parametros.get('vencimientoHasta')).toBe('2026-10-31')
    }
    expect(solicitar.mock.calls.map(([ruta]) => new URL(ruta, 'http://localhost').searchParams.get('estado'))).toEqual([
      'PENDIENTE',
      'EN_MORA',
    ])
    expect(resultado.montoPendiente).toBe(0.3)
    expect(resultado.familiasMorosas).toBe(2)
  })

  it('consulta solo el estado elegido y omite filtros vacíos', async () => {
    solicitar.mockResolvedValue(vacio)
    await useReporteBoletas().consultar({ ...crearFiltrosReporte(), estado: 'EN_MORA' })
    expect(solicitar).toHaveBeenCalledExactlyOnceWith('/api/v1/reportes/boletas-pension?estado=EN_MORA')
  })

  it('rechaza fechas inexistentes o invertidas sin consultar y acepta el mismo día', async () => {
    const filtros = { ...crearFiltrosReporte(), vencimientoDesde: '2026-11-02', vencimientoHasta: '2026-11-01' }
    await expect(useReporteBoletas().consultar(filtros)).rejects.toThrow('fecha final')
    expect(solicitar).not.toHaveBeenCalled()
    expect(validarFechasReporte({ ...filtros, vencimientoDesde: '2026-02-30' })).toContain('válidas')
    expect(validarFechasReporte({ ...filtros, vencimientoHasta: '2026-11-02' })).toBe('')
  })

  it('no devuelve totales parciales si una consulta falla', async () => {
    solicitar.mockResolvedValueOnce(vacio).mockRejectedValueOnce(new Error('Servidor no disponible'))
    await expect(useReporteBoletas().consultar(crearFiltrosReporte())).rejects.toThrow('Servidor no disponible')
  })

  it('permite el reporte solo al administrador', () => {
    expect(puedeAcceder('ADMINISTRADOR', '/reportes/boletas')).toBe(true)
    for (const rol of ['DOCENTE', 'ALUMNO', 'APODERADO'] as const) {
      expect(puedeAcceder(rol, '/reportes/boletas')).toBe(false)
    }
  })
})
