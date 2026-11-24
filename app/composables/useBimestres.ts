import { useApi } from '~/composables/useApi'
import { calcularDiasEntre, formatearFecha } from '~/composables/useFechas'
import type { BimestreAcademico, CierreBimestre, EstadoBimestre } from '~/types/bimestre'
import type { VarianteInsignia } from '~/types/interfaz'
import type { FechasBimestre } from '~/types/periodoAcademico'

const RUTA = '/api/v1/bimestres'
const DIAS_VACACIONES = 14
const DIAS_MINIMOS_CON_VACACIONES = 120

function sumarDias(fechaIso: string, dias: number): string {
  const [anhio, mes, dia] = fechaIso.split('-').map(Number) as [number, number, number]
  const fecha = new Date(Date.UTC(anhio, mes - 1, dia + dias))
  return fecha.toISOString().slice(0, 10)
}

function diaSemana(fechaIso: string): number {
  const [anhio, mes, dia] = fechaIso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(anhio, mes - 1, dia)).getUTCDay()
}

/** Lleva un fin de bimestre al viernes de esa semana o al anterior. */
function terminarEnViernes(fechaIso: string): string {
  return sumarDias(fechaIso, -((diaSemana(fechaIso) + 2) % 7))
}

/** Lleva un inicio de bimestre que cae en fin de semana al lunes siguiente. */
function empezarEnLunes(fechaIso: string): string {
  const dia = diaSemana(fechaIso)
  return dia === 6 ? sumarDias(fechaIso, 2) : dia === 0 ? sumarDias(fechaIso, 1) : fechaIso
}

/**
 * Propone cuatro bimestres de duración similar entre el inicio y el fin de clases, con dos semanas
 * de vacaciones entre el segundo y el tercero cuando el año es lo bastante largo.
 */
export function proponerBimestres(fechaInicio: string, fechaFin: string): FechasBimestre[] {
  const total = calcularDiasEntre(fechaInicio, fechaFin) + 1
  const vacaciones = total >= DIAS_MINIMOS_CON_VACACIONES ? DIAS_VACACIONES : 0
  const porBimestre = Math.floor((total - vacaciones) / 4)
  const finUno = terminarEnViernes(sumarDias(fechaInicio, porBimestre - 1))
  const inicioDos = empezarEnLunes(sumarDias(finUno, 1))
  const finDos = terminarEnViernes(sumarDias(fechaInicio, 2 * porBimestre - 1))
  const inicioTres = empezarEnLunes(sumarDias(finDos, 1 + vacaciones))
  const finTres = terminarEnViernes(sumarDias(fechaInicio, 3 * porBimestre + vacaciones - 1))
  const inicioCuatro = empezarEnLunes(sumarDias(finTres, 1))
  return [
    { numero: 1, fechaInicio, fechaFin: finUno },
    { numero: 2, fechaInicio: inicioDos, fechaFin: finDos },
    { numero: 3, fechaInicio: inicioTres, fechaFin: finTres },
    { numero: 4, fechaInicio: inicioCuatro, fechaFin },
  ]
}

/** Mismas reglas que el backend: en orden, sin cruces y del inicio al fin de clases. */
export function validarBimestres(bimestres: FechasBimestre[], fechaInicio: string, fechaFin: string): string {
  for (const [indice, bimestre] of bimestres.entries()) {
    if (!bimestre.fechaInicio || !bimestre.fechaFin) return `Completa las fechas del bimestre ${bimestre.numero}.`
    if (bimestre.fechaFin < bimestre.fechaInicio) return `El bimestre ${bimestre.numero} termina antes de empezar.`
    const anterior = bimestres[indice - 1]
    if (anterior && bimestre.fechaInicio <= anterior.fechaFin) {
      return `El bimestre ${bimestre.numero} debe empezar después del ${formatearFecha(anterior.fechaFin)}, cuando termina el bimestre ${anterior.numero}.`
    }
  }
  if (bimestres[0]?.fechaInicio !== fechaInicio) return 'El bimestre 1 debe empezar con las clases.'
  if (bimestres.at(-1)?.fechaFin !== fechaFin) return 'El bimestre 4 debe terminar con las clases.'
  return ''
}

/** Bimestre de una fecha según el calendario: en vacaciones sigue el último que empezó. */
export function bimestreEnFecha(
  bimestres: Pick<BimestreAcademico, 'numero' | 'fechaInicio'>[],
  fechaIso: string,
): number {
  return bimestres.filter((bimestre) => bimestre.fechaInicio <= fechaIso).at(-1)?.numero ?? 1
}

export function obtenerEtiquetaEstadoBimestre(estado: EstadoBimestre): string {
  const etiquetas: Record<EstadoBimestre, string> = {
    PROXIMO: 'Próximo',
    EN_CURSO: 'En curso',
    POR_CERRAR: 'Por cerrar',
    CERRADO: 'Cerrado',
  }
  return etiquetas[estado]
}

export function obtenerVarianteEstadoBimestre(estado: EstadoBimestre): VarianteInsignia {
  const variantes: Record<EstadoBimestre, VarianteInsignia> = {
    PROXIMO: 'neutro',
    EN_CURSO: 'informacion',
    POR_CERRAR: 'advertencia',
    CERRADO: 'exito',
  }
  return variantes[estado]
}

export function useBimestres() {
  const { solicitar } = useApi()

  return {
    listar: (anhio: number) => solicitar<BimestreAcademico[]>(`${RUTA}?anhio=${anhio}`),
    cerrar: (anhio: number, numero: number) =>
      solicitar<CierreBimestre>(`${RUTA}/${anhio}/${numero}/cierre`, { metodo: 'POST' }),
  }
}
