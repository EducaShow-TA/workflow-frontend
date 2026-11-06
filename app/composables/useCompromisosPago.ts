import { useApi } from '~/composables/useApi'
import type { BoletaPension } from '~/types/boletaPension'
import type { CompromisoPagoApi, MesCompromiso } from '~/types/compromisoPago'

const NOMBRES_MES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/** "2027-03" + 2 → "2027-05". */
export function sumarMesesIso(mes: string, cantidad: number): string {
  const [anhio, numero] = mes.split('-').map(Number) as [number, number]
  const indice = anhio * 12 + (numero - 1) + cantidad
  return `${Math.floor(indice / 12)}-${String((indice % 12) + 1).padStart(2, '0')}`
}

export function nombreMes(mes: string): string {
  const [anhio, numero] = mes.split('-').map(Number) as [number, number]
  return `${NOMBRES_MES[numero - 1]} ${anhio}`
}

/** Cronograma del compromiso: un mes por cuota, con la boleta ya emitida para ese mes (si la hay). */
export function construirMesesCompromiso(compromiso: CompromisoPagoApi, boletas: BoletaPension[]): MesCompromiso[] {
  const propias = boletas.filter((boleta) => boleta.compromisoId === compromiso.id)
  return Array.from({ length: compromiso.numeroCuotas }, (_, indice) => {
    const mes = sumarMesesIso(compromiso.mesInicio.slice(0, 7), indice)
    const boleta = propias.find((item) => item.mesCobro.slice(0, 7) === mes)
    return {
      mes,
      numeroCuota: indice + 1,
      boleta: boleta ? { id: boleta.id, estado: boleta.estadoPago, mecanismo: boleta.mecanismoGeneracion } : null,
    }
  })
}

/** Compromisos de pago y generación manual de boletas (HU 1.3 y 1.4). */
export function useCompromisosPago() {
  const { solicitar } = useApi()

  function listarPorEstudiante(estudianteId: number): Promise<CompromisoPagoApi[]> {
    return solicitar<CompromisoPagoApi[]>(`/api/v1/compromisos-pago?estudianteId=${estudianteId}`)
  }

  function generarBoletaManual(matriculaId: number, mesCobro: string): Promise<BoletaPension> {
    return solicitar<BoletaPension>('/api/v1/boletas-pension/manual', {
      metodo: 'POST',
      cuerpo: { matriculaId, mesCobro },
    })
  }

  return { listarPorEstudiante, generarBoletaManual }
}
