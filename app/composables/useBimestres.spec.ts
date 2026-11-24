import { describe, expect, it } from 'vitest'
import { bimestreEnFecha, proponerBimestres, validarBimestres } from './useBimestres'

describe('proponerBimestres', () => {
  it('reparte el año en cuatro bimestres consecutivos con dos semanas de vacaciones', () => {
    const bimestres = proponerBimestres('2026-03-02', '2026-12-18')

    expect(bimestres[0]?.fechaInicio).toBe('2026-03-02')
    expect(bimestres[3]?.fechaFin).toBe('2026-12-18')
    expect(validarBimestres(bimestres, '2026-03-02', '2026-12-18')).toBe('')
    expect(bimestres[2]!.fechaInicio > bimestres[1]!.fechaFin).toBe(true)
  })

  it('detecta bimestres que se cruzan', () => {
    const bimestres = proponerBimestres('2026-03-02', '2026-12-18')
    bimestres[1]!.fechaInicio = bimestres[0]!.fechaFin

    expect(validarBimestres(bimestres, '2026-03-02', '2026-12-18')).toContain('El bimestre 2 debe empezar después')
  })
})

describe('bimestreEnFecha', () => {
  it('en vacaciones sigue el último bimestre que empezó', () => {
    const calendario = [
      { numero: 1, fechaInicio: '2026-03-02' },
      { numero: 2, fechaInicio: '2026-05-18' },
      { numero: 3, fechaInicio: '2026-08-10' },
      { numero: 4, fechaInicio: '2026-10-12' },
    ]

    expect(bimestreEnFecha(calendario, '2026-07-30')).toBe(2)
    expect(bimestreEnFecha(calendario, '2026-08-10')).toBe(3)
    expect(bimestreEnFecha(calendario, '2026-01-15')).toBe(1)
  })
})
