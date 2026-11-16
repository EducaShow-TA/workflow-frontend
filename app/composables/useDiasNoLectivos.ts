import { useApi } from '~/composables/useApi'
import { esFechaIsoValida } from '~/composables/useFechas'
import type { DiaNoLectivo, SolicitudDiaNoLectivo } from '~/types/sesionClase'

const RUTA_DIAS = '/api/v1/calendario-escolar/dias-no-lectivos'
export const MAXIMO_DESCRIPCION_DIA = 120

export type ErroresDiaNoLectivo = Partial<Record<keyof SolicitudDiaNoLectivo, string>>

/** Valida en el front lo mismo que el back: fecha válida y no pasada, motivo de 1 a 120 caracteres. */
export function validarDiaNoLectivo(
  solicitud: SolicitudDiaNoLectivo,
  existentes: DiaNoLectivo[],
  fechaHoy: string,
): ErroresDiaNoLectivo {
  const errores: ErroresDiaNoLectivo = {}
  const descripcion = solicitud.descripcion.trim()

  if (!esFechaIsoValida(solicitud.fecha)) {
    errores.fecha = 'Ingresa una fecha válida.'
  } else if (solicitud.fecha < fechaHoy) {
    errores.fecha = 'No se pueden agregar fechas pasadas.'
  } else if (existentes.some((dia) => dia.fecha === solicitud.fecha)) {
    errores.fecha = 'Esa fecha ya está registrada.'
  }

  if (!descripcion) {
    errores.descripcion = 'Escribe el motivo.'
  } else if (descripcion.length > MAXIMO_DESCRIPCION_DIA) {
    errores.descripcion = `El motivo admite hasta ${MAXIMO_DESCRIPCION_DIA} caracteres.`
  }

  return errores
}

/** Días no lectivos de todo el colegio: la generación de sesiones los salta. Solo para el administrador. */
export function useDiasNoLectivos() {
  const { solicitar } = useApi()

  function listar(desde: string, hasta: string): Promise<DiaNoLectivo[]> {
    return solicitar<DiaNoLectivo[]>(`${RUTA_DIAS}?desde=${desde}&hasta=${hasta}`)
  }

  function crear(solicitud: SolicitudDiaNoLectivo): Promise<DiaNoLectivo> {
    return solicitar<DiaNoLectivo>(RUTA_DIAS, {
      metodo: 'POST',
      cuerpo: { fecha: solicitud.fecha, descripcion: solicitud.descripcion.trim() },
    })
  }

  async function eliminar(id: number): Promise<void> {
    await solicitar<unknown>(`${RUTA_DIAS}/${id}`, { metodo: 'DELETE' })
  }

  return { listar, crear, eliminar }
}
