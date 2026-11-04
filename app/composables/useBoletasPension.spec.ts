import { beforeEach, describe, expect, it, vi } from 'vitest'
import { crearFiltrosBoletas, useBoletasPension, validarPagoBoleta } from './useBoletasPension'
import { puedeAcceder } from './usePermisosRol'
import type { BoletaPension } from '~/types/boletaPension'

const { solicitar } = vi.hoisted(() => ({ solicitar: vi.fn() }))
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ solicitar }) }))

const boleta: BoletaPension = {
  id: 17,
  compromisoId: 5,
  matriculaId: 8,
  estudianteId: 4,
  estudiante: 'Estudiante de prueba',
  apoderadoId: 3,
  apoderado: 'Apoderado de prueba',
  grado: 1,
  seccion: 'A',
  mesCobro: '2026-11',
  monto: 500,
  mora: 25,
  montoTotal: 525,
  fechaVencimiento: '2026-11-01',
  estadoPago: 'EN_MORA',
  mecanismoGeneracion: 'MANUAL',
  fechaGeneracion: '2026-10-01T10:00:00',
}

describe('gestión de boletas US-1.5', () => {
  it('consulta la página y el catálogo ligero sin descargar todas las boletas', async () => {
    solicitar.mockReset()
    const pagina = { content: [boleta], totalElements: 95, totalPages: 5, number: 1, size: 20 }
    solicitar.mockResolvedValueOnce(pagina).mockResolvedValueOnce([{ id: 4, nombre: boleta.estudiante }])
    expect(await useBoletasPension().listarPagina({ ...crearFiltrosBoletas(), estado: 'EN_MORA' }, 1)).toEqual(pagina)
    expect(solicitar).toHaveBeenNthCalledWith(1, '/api/v1/boletas-pension/pagina?page=1&size=20&estado=EN_MORA')
    expect(await useBoletasPension().estudiantes()).toEqual([{ id: 4, nombre: boleta.estudiante }])
    expect(solicitar).toHaveBeenNthCalledWith(2, '/api/v1/boletas-pension/estudiantes')
  })
  beforeEach(() => {
    solicitar.mockReset()
  })

  it('consulta todas las boletas sin excluir las pagadas', async () => {
    solicitar.mockResolvedValue([{ ...boleta, estadoPago: 'PAGADA' }])
    const resultado = await useBoletasPension().listar()
    expect(solicitar).toHaveBeenCalledExactlyOnceWith('/api/v1/boletas-pension')
    expect(resultado[0]?.estadoPago).toBe('PAGADA')
  })

  it('envía estudiante, período, mes y cada estado seleccionado al backend', async () => {
    solicitar.mockResolvedValue([])
    for (const estado of ['PENDIENTE', 'EN_MORA', 'PAGADA'] as const) {
      await useBoletasPension().listar({ estudianteId: '4', periodoId: '9', mes: '2026-11', estado })
      const ruta = solicitar.mock.lastCall?.[0]
      const parametros = new URL(ruta, 'http://localhost').searchParams
      expect(parametros.get('estudianteId')).toBe('4')
      expect(parametros.get('periodoId')).toBe('9')
      expect(parametros.get('mes')).toBe('2026-11')
      expect(parametros.get('estado')).toBe(estado)
    }
    expect(crearFiltrosBoletas().estado).toBe('')
  })

  it('consulta detalle y comprobantes en sus endpoints', async () => {
    solicitar.mockResolvedValueOnce(boleta).mockResolvedValueOnce([])
    const api = useBoletasPension()
    expect(await api.obtener(17)).toEqual(boleta)
    expect(await api.comprobantes(17)).toEqual([])
    expect(solicitar.mock.calls.map(([ruta]) => ruta)).toEqual([
      '/api/v1/boletas-pension/17',
      '/api/v1/boletas-pension/17/comprobantes',
    ])
  })

  it('registra el total con mora y conserva el estado local hasta volver a consultar al servidor', async () => {
    solicitar.mockResolvedValue({ id: 12, numeroComprobante: 'LOCAL-12' })
    await useBoletasPension().registrarPago(boleta, { monto: 525, medioPago: 'PRESENCIAL', referencia: ' LOCAL-12 ' })
    expect(solicitar).toHaveBeenCalledExactlyOnceWith('/api/v1/boletas-pension/17/pagos', {
      metodo: 'POST',
      cuerpo: { monto: 525, medioPago: 'PRESENCIAL', referencia: 'LOCAL-12' },
    })
    expect(boleta.estadoPago).toBe('EN_MORA')
  })

  it('impide pago parcial y un segundo pago de una boleta pagada antes de enviar la petición', async () => {
    await expect(useBoletasPension().registrarPago(boleta, { monto: 500, medioPago: 'PRESENCIAL' })).rejects.toThrow(
      'importe total',
    )
    await expect(
      useBoletasPension().registrarPago({ ...boleta, estadoPago: 'PAGADA' }, { monto: 525, medioPago: 'VIRTUAL' }),
    ).rejects.toThrow('pagada')
    expect(solicitar).not.toHaveBeenCalled()
  })

  it('rechaza importes inválidos y comprobantes demasiado largos', () => {
    for (const monto of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(validarPagoBoleta(boleta, { monto, medioPago: 'PRESENCIAL' })).not.toBe('')
    }
    expect(validarPagoBoleta(boleta, { monto: 525, medioPago: 'PRESENCIAL', referencia: 'a'.repeat(41) })).toContain(
      '40',
    )
  })

  it('propaga el error del servidor sin reintentar pagos ni inventar un comprobante', async () => {
    solicitar.mockRejectedValue(new Error('El número de comprobante ya está registrado'))
    await expect(useBoletasPension().registrarPago(boleta, { monto: 525, medioPago: 'PRESENCIAL' })).rejects.toThrow(
      'ya está registrado',
    )
    expect(solicitar).toHaveBeenCalledTimes(1)
  })

  it('restringe Finanzas al administrador', () => {
    expect(puedeAcceder('ADMINISTRADOR', '/finanzas')).toBe(true)
    for (const rol of ['DOCENTE', 'ALUMNO', 'APODERADO'] as const) expect(puedeAcceder(rol, '/finanzas')).toBe(false)
  })
})
