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

  it('rechaza inicios pasados y ventanas cuyo inicio queda más de un año antes del año destino', () => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    const isoAyer = [ayer.getFullYear(), String(ayer.getMonth() + 1).padStart(2, '0'), String(ayer.getDate()).padStart(2, '0')].join('-')
    expect(validarPeriodoMatricula({ fechaInicio: isoAyer, fechaLimite: `${ayer.getFullYear() + 1}-01-10` })).toHaveProperty('fechaInicio')

    const anhio = new Date().getFullYear()
    expect(
      validarPeriodoMatricula({ fechaInicio: `${anhio + 2}-01-10`, fechaLimite: `${anhio + 4}-01-20` }),
    ).toHaveProperty('fechaInicio')
  })

  it('acepta una ventana que empieza el año anterior al año escolar de destino', () => {
    const anhioDestino = new Date().getFullYear() + 2
    expect(
      validarPeriodoMatricula({ fechaInicio: `${anhioDestino - 1}-12-01`, fechaLimite: `${anhioDestino}-02-01` }),
    ).toEqual({})
  })
})
