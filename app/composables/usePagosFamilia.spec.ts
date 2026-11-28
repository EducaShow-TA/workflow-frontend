import { describe, expect, it } from 'vitest'
import { alternarEnOrden, boletasPorPagar, seleccionInicial } from '~/composables/usePagosFamilia'
import type { BoletaFamilia, CompromisoFamilia, EstadoBoletaFamilia, TipoCargoBoletaFamilia } from '~/types/familia'

function boleta(
  boletaId: number,
  mes: string,
  estadoPago: EstadoBoletaFamilia = 'PENDIENTE',
  tipoCargo: TipoCargoBoletaFamilia = 'PENSION',
): BoletaFamilia {
  return {
    boletaId,
    mesCobro: `2026-${mes}`,
    fechaVencimiento: `2026-${mes}-28`,
    monto: 450,
    mora: 0,
    montoTotal: 450,
    estadoPago,
    tipoCargo,
    comprobante: null,
  }
}

function compromiso(boletas: BoletaFamilia[]): CompromisoFamilia {
  return { boletas } as CompromisoFamilia
}

const ANIO = [boleta(6, '06'), boleta(7, '07'), boleta(8, '08'), boleta(9, '09')]

describe('pagos del apoderado en orden', () => {
  it('ordena la matrícula primero y luego las pensiones de la más antigua a la más reciente', () => {
    const porPagar = boletasPorPagar(
      compromiso([
        boleta(7, '07'),
        boleta(3, '03', 'PAGADA'),
        boleta(10, '06', 'PENDIENTE', 'MATRICULA'),
        boleta(5, '05', 'EN_MORA'),
      ]),
    )
    expect(porPagar.map((b) => b.boletaId)).toEqual([10, 5, 7])
  })

  it('marca al entrar solo hasta la boleta que vence este mes', () => {
    expect(seleccionInicial(ANIO, '2026-06-10')).toEqual([6])
    expect(seleccionInicial(ANIO, '2026-08-01')).toEqual([6, 7, 8])
  })

  it('si nada vence todavía marca solo la siguiente, y nada si no hay deuda', () => {
    expect(seleccionInicial(ANIO, '2026-04-10')).toEqual([6])
    expect(seleccionInicial([], '2026-04-10')).toEqual([])
  })

  it('incluye las anteriores a una vencida aunque venzan después', () => {
    const porPagar = [boleta(10, '12', 'PENDIENTE', 'MATRICULA'), boleta(5, '05', 'EN_MORA'), boleta(6, '06')]
    expect(seleccionInicial(porPagar, '2026-06-10')).toEqual([10, 5, 6])
  })

  it('marcar un mes incluye los anteriores y desmarcarlo quita los siguientes', () => {
    expect(alternarEnOrden(ANIO, [6], 8)).toEqual([6, 7, 8])
    expect(alternarEnOrden(ANIO, [6, 7, 8, 9], 7)).toEqual([6])
    expect(alternarEnOrden(ANIO, [6], 6)).toEqual([])
  })
})
