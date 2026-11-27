import { describe, expect, it } from 'vitest'
import { obtenerRecordatoriosPago } from '~/composables/useRecordatoriosPago'
import type { DeudaFamilia, EstadoBoletaFamilia } from '~/types/familia'

function deuda(id: number, fecha: string, estado: EstadoBoletaFamilia = 'PENDIENTE'): DeudaFamilia {
  return {
    estudianteId: id,
    nombreHijo: `Estudiante ${id}`,
    boleta: {
      boletaId: id,
      mesCobro: '2026-11',
      fechaVencimiento: fecha,
      monto: 500,
      mora: 0,
      montoTotal: 500,
      estadoPago: estado,
      tipoCargo: 'PENSION',
      comprobante: null,
    },
  }
}

describe('Recordatorios de pago US-1.11', () => {
  it('incluye hoy y el límite de anticipación, ordenados por vencimiento', () => {
    const filas = [deuda(1, '2026-11-24'), deuda(2, '2026-11-19'), deuda(3, '2026-11-25'), deuda(4, '2026-11-18')]
    expect(
      obtenerRecordatoriosPago(filas, '2026-11-19', 5).map(({ boleta, diasRestantes }) => [
        boleta.boletaId,
        diasRestantes,
      ]),
    ).toEqual([
      [2, 0],
      [1, 5],
    ])
  })

  it('retira la boleta al pagar y excluye moras y fechas inválidas', () => {
    const filas = [deuda(1, '2026-11-20'), deuda(2, '2026-11-20', 'EN_MORA'), deuda(3, '2026-02-30')]
    expect(obtenerRecordatoriosPago(filas, '2026-11-19', 5)).toHaveLength(1)
    filas[0]!.boleta.estadoPago = 'PAGADA'
    expect(obtenerRecordatoriosPago(filas, '2026-11-19', 5)).toEqual([])
  })

  it('respeta el plazo configurable incluso si es cero', () => {
    const filas = [deuda(1, '2026-11-19'), deuda(2, '2026-11-28')]
    expect(obtenerRecordatoriosPago(filas, '2026-11-19', 0)).toHaveLength(1)
    expect(obtenerRecordatoriosPago(filas, '2026-11-19', 9)).toHaveLength(2)
  })

  it('cuenta días calendario entre meses y años y usa diez días ante configuración inválida', () => {
    expect(obtenerRecordatoriosPago([deuda(1, '2027-01-03')], '2026-12-30', 5)[0]?.diasRestantes).toBe(4)
    expect(obtenerRecordatoriosPago([deuda(2, '2028-03-01')], '2028-02-28', 5)[0]?.diasRestantes).toBe(2)
    expect(obtenerRecordatoriosPago([deuda(3, '2026-11-24')], '2026-11-19', NaN)).toHaveLength(1)
  })
})
