import type { PeriodoMatricula } from '~/types/periodoMatricula'
import type { ResumenVacantes, SituacionPeriodo } from '~/types/resumenMatricula'
import type { Seccion } from '~/types/seccion'
import { calcularDiasEntre } from '~/composables/useFechas'
import { calcularVacantesDisponibles } from '~/composables/useSecciones'

export function obtenerSituacionPeriodo(periodos: PeriodoMatricula[]): SituacionPeriodo {
  const vigente = periodos.find((periodo) => periodo.estado === 'VIGENTE') ?? null
  const proximo =
    periodos
      .filter((periodo) => periodo.estado === 'PENDIENTE')
      .sort((primero, segundo) => primero.fechaInicio.localeCompare(segundo.fechaInicio))[0] ?? null

  return { vigente, proximo }
}

export function describirDiasRestantes(fechaFin: string, fechaHoy: string): string {
  const dias = calcularDiasEntre(fechaHoy, fechaFin)

  if (dias <= 0) {
    return 'Hoy es el último día para matricular.'
  }

  return dias === 1 ? 'Queda 1 día para matricular.' : `Quedan ${dias} días para matricular.`
}

export function describirDiasParaInicio(fechaInicio: string, fechaHoy: string): string {
  const dias = calcularDiasEntre(fechaHoy, fechaInicio)
  return dias === 1 ? 'Empieza mañana.' : `Empieza en ${dias} días.`
}

export function calcularResumenVacantes(secciones: Seccion[]): ResumenVacantes {
  return {
    capacidad: secciones.reduce((total, seccion) => total + seccion.vacantesTotales, 0),
    matriculados: secciones.reduce((total, seccion) => total + seccion.cantidadMatriculados, 0),
    vacantes: secciones.reduce((total, seccion) => total + calcularVacantesDisponibles(seccion), 0),
    seccionesSinVacantes: secciones.filter((seccion) => calcularVacantesDisponibles(seccion) === 0).length,
  }
}
