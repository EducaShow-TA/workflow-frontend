import { describe, expect, it } from 'vitest'
import { buscarCruce, calcularEstadoPeriodo, estaPeriodoVigente, validarPeriodoMatricula } from './usePeriodoMatricula'
import type { PeriodoMatricula } from '~/types/periodoMatricula'

const periodoExistente: PeriodoMatricula = {
  id: 1,
  fechaInicio: '2026-10-22',
  fechaLimite: '2026-10-31',
  estado: 'VIGENTE',
  tieneMatriculas: false,
}

describe('lógica de períodos de matrícula', () => {
  it('calcula los estados pendiente, vigente y vencido respetando los límites inclusivos', () => {
    expect(calcularEstadoPeriodo('2026-10-22', '2026-10-31', '2026-10-21')).toBe('PENDIENTE')
    expect(calcularEstadoPeriodo('2026-10-22', '2026-10-31', '2026-10-22')).toBe('VIGENTE')
    expect(calcularEstadoPeriodo('2026-10-22', '2026-10-31', '2026-10-31')).toBe('VIGENTE')
    expect(calcularEstadoPeriodo('2026-10-22', '2026-10-31', '2026-11-01')).toBe('VENCIDO')
  })

  it('considera vigente solo el período con estado VIGENTE', () => {
    expect(estaPeriodoVigente({ estado: 'VIGENTE' })).toBe(true)
    expect(estaPeriodoVigente({ estado: 'PENDIENTE' })).toBe(false)
    expect(estaPeriodoVigente({ estado: 'VENCIDO' })).toBe(false)
  })

  it('detecta cruces de fechas incluyendo los extremos, pero ignora el período editado', () => {
    expect(buscarCruce({ fechaInicio: '2026-10-31', fechaLimite: '2026-11-05' }, [periodoExistente])).toEqual(
      periodoExistente,
    )
    expect(buscarCruce({ fechaInicio: '2026-11-01', fechaLimite: '2026-11-05' }, [periodoExistente])).toBeUndefined()
    expect(buscarCruce({ fechaInicio: '2026-10-22', fechaLimite: '2026-10-31' }, [periodoExistente], 1)).toBeUndefined()
  })

  it('rechaza fechas inválidas, límites no posteriores y cruces', () => {
    expect(validarPeriodoMatricula({ fechaInicio: '2026-02-30', fechaLimite: '2026-03-01' })).toHaveProperty(
      'fechaInicio',
    )
    expect(validarPeriodoMatricula({ fechaInicio: '2026-10-31', fechaLimite: '2026-10-31' })).toHaveProperty(
      'fechaLimite',
    )
    expect(
      validarPeriodoMatricula({ fechaInicio: '2026-10-30', fechaLimite: '2026-11-02' }, [periodoExistente]),
    ).toHaveProperty('fechaInicio')
  })
})
