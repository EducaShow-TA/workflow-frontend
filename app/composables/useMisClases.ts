import { useApi } from '~/composables/useApi'
import type { AlumnoClase, MiClase, NotaCualitativa, RiesgoAcademico } from '~/types/calificacion'

const RUTA = '/api/v1/docentes/mis-clases'

export const NOTAS: { valor: NotaCualitativa; descripcion: string }[] = [
  { valor: 'AD', descripcion: 'Logro destacado' },
  { valor: 'A', descripcion: 'Logro esperado' },
  { valor: 'B', descripcion: 'En proceso' },
  { valor: 'C', descripcion: 'En inicio' },
]

/** "3.° A" a partir del grado y la sección de la clase. */
export function nombreClase(clase: Pick<MiClase, 'gradoNumero' | 'seccionCodigo'>): string {
  return `${clase.gradoNumero}.° ${clase.seccionCodigo}`
}

export function claveClase(clase: Pick<MiClase, 'periodoId' | 'areaCodigo'>): string {
  return `${clase.periodoId}:${clase.areaCodigo}`
}

/** HU 3.2: clases y alumnos del docente autenticado. */
export function useMisClases() {
  const { solicitar } = useApi()

  function listar(): Promise<MiClase[]> {
    return solicitar<MiClase[]>(RUTA)
  }

  function listarAlumnos(periodoId: number): Promise<AlumnoClase[]> {
    return solicitar<AlumnoClase[]>(`${RUTA}/${periodoId}/alumnos`)
  }

  function obtenerRiesgo(periodoId: number, areaCodigo: string, umbral: number): Promise<RiesgoAcademico> {
    const parametros = new URLSearchParams({ areaCodigo, umbral: String(umbral) })
    return solicitar<RiesgoAcademico>(`${RUTA}/${periodoId}/riesgo-academico?${parametros}`)
  }

  return { listar, listarAlumnos, obtenerRiesgo }
}
