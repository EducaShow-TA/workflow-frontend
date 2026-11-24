import { useApi } from '~/composables/useApi'
import { LIMITE_ESTUDIANTES_BUSQUEDA, MINIMO_CARACTERES_BUSQUEDA } from '~/composables/useBusquedaAdministrador'
import type { HistorialBoletas } from '~/types/boletaPension'

/** Evita listar a todos los alumnos con un texto vacío o de un solo carácter. */
export function esBusquedaValida(texto: string): boolean {
  return texto.trim().length >= MINIMO_CARACTERES_BUSQUEDA
}

/** El servidor corta la búsqueda: sin este aviso se creería que el alumno no existe. */
export function avisarLimiteBusqueda(cantidad: number): string {
  if (cantidad < LIMITE_ESTUDIANTES_BUSQUEDA) return ''
  return `Se muestran los primeros ${LIMITE_ESTUDIANTES_BUSQUEDA} alumnos. Si no aparece el que buscas, escribe sus nombres y apellidos completos o su DNI.`
}

export function describirHistorial(
  historial: Pick<HistorialBoletas, 'boletasGeneradas' | 'boletasEnMora' | 'matriculas'>,
): string {
  if (!historial.matriculas.length) return 'El alumno no tiene matrículas registradas.'

  const { boletasGeneradas: generadas, boletasEnMora: enMora } = historial
  const pasaron = enMora === 1 ? 'pasó a mora' : 'pasaron a mora'
  if (!generadas && !enMora) return 'No había boletas por generar ni por pasar a mora.'
  if (!generadas) return `${enMora} ${enMora === 1 ? 'boleta' : 'boletas'} ${pasaron}.`

  const emitidas = generadas === 1 ? 'Se generó 1 boleta' : `Se generaron ${generadas} boletas`
  return enMora ? `${emitidas} y ${enMora} ${pasaron}.` : `${emitidas}.`
}

/** US-1.4 / US-1.5: el servidor completa las boletas según el compromiso y devuelve todo el historial. */
export function useHistorialBoletas() {
  const { solicitar } = useApi()

  function generar(estudianteId: number): Promise<HistorialBoletas> {
    return solicitar<HistorialBoletas>('/api/v1/boletas-pension/historiales', {
      metodo: 'POST',
      cuerpo: { estudianteId },
    })
  }

  return { generar }
}
