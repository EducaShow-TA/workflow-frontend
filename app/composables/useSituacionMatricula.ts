import type { SituacionMatricula } from '~/types/situacionMatricula'
import { useApi } from '~/composables/useApi'

/** Un estudiante sin historial es nuevo y entra a cualquier grado; los demás, solo al que les toca. */
export function correspondeAlGrado(situacion: SituacionMatricula | undefined, grado: number): boolean {
  if (!situacion || situacion.situacion === 'NUEVO') return true
  return situacion.gradoDestino === grado
}

export function etiquetaSituacion(situacion: SituacionMatricula | undefined): string {
  if (!situacion || situacion.situacion === 'NUEVO') return 'Nuevo'
  if (situacion.situacion === 'PROMOVIDO') return `Aprobó ${situacion.gradoAnterior}.º`
  return `Repite ${situacion.gradoAnterior}.º`
}

export function motivoNoCorresponde(situacion: SituacionMatricula): string {
  if (situacion.situacion === 'EGRESADO') return `egresó en ${situacion.anhioAnterior}`
  if (situacion.situacion === 'BLOQUEADO') return situacion.motivo ?? 'no se puede matricular todavía'
  if (situacion.situacion === 'REPITE') return `repite ${situacion.gradoDestino}.º`
  return `pasa a ${situacion.gradoDestino}.º`
}

export function useSituacionMatricula() {
  const { solicitar } = useApi()

  async function listarSituaciones(anhio: number): Promise<Map<number, SituacionMatricula>> {
    const situaciones = await solicitar<SituacionMatricula[]>(`/api/v1/matriculas/situacion?anhio=${anhio}`)
    return new Map(situaciones.map((situacion) => [situacion.estudianteId, situacion]))
  }

  return { listarSituaciones }
}
