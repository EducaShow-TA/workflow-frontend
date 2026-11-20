import { useApi } from '~/composables/useApi'
import { ErrorSolicitudApi } from '~/types/api'
import type { ResultadoCargaAsistencia } from '~/types/cargaMasivaAsistencia'

const RUTA_DOCENTES = '/api/v1/asistencias-docentes/carga-masiva'
export const MAXIMO_BYTES_ASISTENCIA = 2 * 1024 * 1024

function rutaAlumnos(sesionId: number): string {
  return `/api/v1/sesiones-clase/${sesionId}/asistencias/carga-masiva`
}

/** Revisión previa en el navegador; devuelve el motivo del rechazo o vacío si el archivo se puede enviar. */
export function validarArchivoCsv(archivo: { name: string; size: number }): string {
  if (!archivo.name.toLowerCase().endsWith('.csv')) return 'El archivo debe tener extensión .csv.'
  if (archivo.size === 0) return 'El archivo está vacío.'
  if (archivo.size > MAXIMO_BYTES_ASISTENCIA) return 'El archivo supera los 2 MB permitidos.'
  return ''
}

export function esResultadoCargaAsistencia(datos: unknown): datos is ResultadoCargaAsistencia {
  return (
    typeof datos === 'object' &&
    datos !== null &&
    'totalFilas' in datos &&
    'errores' in datos &&
    Array.isArray((datos as { errores: unknown }).errores)
  )
}

function plural(cantidad: number, singular: string, pluralTexto: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`
}

/** Mensaje de resumen para mostrar al validar o al guardar. */
export function resumirResultadoCarga(resultado: ResultadoCargaAsistencia): string {
  if (resultado.errores.length > 0) {
    return `${plural(resultado.filasRechazadas, 'fila tiene', 'filas tienen')} errores de ${resultado.totalFilas}. No se guardó nada: corrígelas y vuelve a validar.`
  }
  const detalle = `${plural(resultado.registrosNuevos, 'registro nuevo', 'registros nuevos')} y ${plural(resultado.registrosActualizados, 'actualización', 'actualizaciones')}`
  return resultado.guardado
    ? `Asistencia guardada: ${detalle}.`
    : `Archivo válido: ${plural(resultado.filasValidas, 'fila lista', 'filas listas')} para guardar (${detalle}).`
}

/** Carga masiva de asistencia desde CSV (US-2.2 alumnos y US-2.5 docentes). */
export function useCargaMasivaAsistencia() {
  const { solicitar } = useApi()

  /** El backend responde 422 con el detalle por fila cuando hay errores: se devuelve como resultado. */
  async function enviar(ruta: string, archivo: File, soloValidar: boolean): Promise<ResultadoCargaAsistencia> {
    const formulario = new FormData()
    formulario.append('archivo', archivo)

    try {
      return await solicitar<ResultadoCargaAsistencia>(`${ruta}?soloValidar=${soloValidar}`, {
        metodo: 'POST',
        cuerpo: formulario,
      })
    } catch (error: unknown) {
      if (error instanceof ErrorSolicitudApi && error.estado === 422 && esResultadoCargaAsistencia(error.datos)) {
        return error.datos
      }
      throw error
    }
  }

  function cargarDocentes(archivo: File, soloValidar: boolean): Promise<ResultadoCargaAsistencia> {
    return enviar(RUTA_DOCENTES, archivo, soloValidar)
  }

  function cargarAlumnos(sesionId: number, archivo: File, soloValidar: boolean): Promise<ResultadoCargaAsistencia> {
    return enviar(rutaAlumnos(sesionId), archivo, soloValidar)
  }

  function obtenerPlantillaDocentes(): Promise<string> {
    return solicitar<string>(`${RUTA_DOCENTES}/plantilla`)
  }

  /** Trae los alumnos matriculados de la sesión con el estado vacío por completar. */
  function obtenerPlantillaAlumnos(sesionId: number): Promise<string> {
    return solicitar<string>(`${rutaAlumnos(sesionId)}/plantilla`)
  }

  return { cargarDocentes, cargarAlumnos, obtenerPlantillaDocentes, obtenerPlantillaAlumnos }
}
