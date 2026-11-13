import { describe, expect, it } from 'vitest'
import { validarUmbralesConsolidacion } from './useReglasConsolidacion'

describe('validación de umbrales de consolidación', () => {
  it('acepta los límites válidos y umbrales crecientes', () => {
    expect(validarUmbralesConsolidacion({ umbralB: 1.01, umbralA: 2, umbralAd: 4 })).toBe('')
  })

  it('rechaza valores no numéricos y umbrales fuera de orden o rango', () => {
    expect(validarUmbralesConsolidacion({ umbralB: Number.NaN, umbralA: 2.5, umbralAd: 3.5 })).toContain('valor válido')
    expect(validarUmbralesConsolidacion({ umbralB: 2.5, umbralA: 2.5, umbralAd: 3.5 })).toContain('1 < B < A')
    expect(validarUmbralesConsolidacion({ umbralB: 1, umbralA: 2.5, umbralAd: 3.5 })).toContain('1 < B < A')
    expect(validarUmbralesConsolidacion({ umbralB: 1.5, umbralA: 2.5, umbralAd: 4.01 })).toContain('1 < B < A')
  })
})
