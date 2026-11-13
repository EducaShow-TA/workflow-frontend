import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEvaluacionesParciales } from './useEvaluacionesParciales'

const { solicitar } = vi.hoisted(() => ({ solicitar: vi.fn() }))
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ solicitar }) }))

describe('evaluaciones parciales por bimestre', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista evaluaciones por período y competencia', async () => {
    const respuesta = [{ id: 8, bimestre: 2 }]
    solicitar.mockResolvedValueOnce(respuesta)

    await expect(useEvaluacionesParciales().listar(12, 'COMP-uno')).resolves.toBe(respuesta)
    expect(solicitar).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/evaluaciones-parciales?periodoId=12&competenciaCodigo=COMP-uno',
    )
  })

  it('envía el bimestre al crear y actualizar una evaluación', async () => {
    const solicitud = {
      periodoId: 12,
      competenciaCodigo: 'COMP-uno',
      titulo: 'Evidencia',
      descripcion: '',
      ponderacion: 40,
      bimestre: 3,
    }

    solicitar.mockResolvedValueOnce({ id: 1, ...solicitud })
    await useEvaluacionesParciales().crear(solicitud)
    expect(solicitar).toHaveBeenLastCalledWith('/api/v1/evaluaciones-parciales', {
      metodo: 'POST',
      cuerpo: solicitud,
    })

    solicitar.mockResolvedValueOnce({ id: 1, ...solicitud })
    await useEvaluacionesParciales().actualizar(1, solicitud)
    expect(solicitar).toHaveBeenLastCalledWith('/api/v1/evaluaciones-parciales/1', {
      metodo: 'PUT',
      cuerpo: solicitud,
    })
  })
})
