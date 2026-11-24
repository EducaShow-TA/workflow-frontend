import { beforeEach, describe, expect, it, vi } from 'vitest'
import { avisarLimiteBusqueda, describirHistorial, esBusquedaValida, useHistorialBoletas } from './useHistorialBoletas'
import type { MatriculaHistorial } from '~/types/boletaPension'

const { solicitar } = vi.hoisted(() => ({ solicitar: vi.fn() }))
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ solicitar }) }))

const matricula: MatriculaHistorial = {
  matriculaId: 8,
  anio: 2026,
  grado: 1,
  seccion: 'A',
  fechaMatricula: '2026-09-01',
  estado: 'CONFIRMADA',
  compromiso: null,
  boletas: [],
}

describe('historial de boletas US-1.4 / US-1.5', () => {
  beforeEach(() => {
    solicitar.mockReset()
  })

  it('pide completar y devolver el historial del alumno elegido', async () => {
    const historial = { estudianteId: 4, matriculas: [matricula] }
    solicitar.mockResolvedValueOnce(historial)

    expect(await useHistorialBoletas().generar(4)).toEqual(historial)
    expect(solicitar).toHaveBeenCalledExactlyOnceWith('/api/v1/boletas-pension/historiales', {
      metodo: 'POST',
      cuerpo: { estudianteId: 4 },
    })
  })

  it.each([
    [2, 1, 'Se generaron 2 boletas y 1 pasó a mora.'],
    [1, 2, 'Se generó 1 boleta y 2 pasaron a mora.'],
    [3, 0, 'Se generaron 3 boletas.'],
    [0, 2, '2 boletas pasaron a mora.'],
    [0, 1, '1 boleta pasó a mora.'],
    [0, 0, 'No había boletas por generar ni por pasar a mora.'],
  ])('describe %i generadas y %i en mora', (boletasGeneradas, boletasEnMora, texto) => {
    expect(describirHistorial({ boletasGeneradas, boletasEnMora, matriculas: [matricula] })).toBe(texto)
  })

  it('avisa cuando el alumno no tiene matrículas', () => {
    expect(describirHistorial({ boletasGeneradas: 0, boletasEnMora: 0, matriculas: [] })).toBe(
      'El alumno no tiene matrículas registradas.',
    )
  })

  it.each([
    ['', false],
    ['  ', false],
    [' a ', false],
    ['An', true],
    ['12345678', true],
  ])('valida la búsqueda "%s"', (texto, esperado) => {
    expect(esBusquedaValida(texto)).toBe(esperado)
  })

  it('avisa que la lista puede estar incompleta solo al llegar al límite de resultados', () => {
    expect(avisarLimiteBusqueda(4)).toBe('')
    expect(avisarLimiteBusqueda(5)).toBe(
      'Se muestran los primeros 5 alumnos. Si no aparece el que buscas, escribe sus nombres y apellidos completos o su DNI.',
    )
  })
})
