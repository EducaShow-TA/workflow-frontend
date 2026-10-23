export interface CupoSeccion {
  grado: string
  seccion: string
  capacidadMaxima: number
  matriculados: number
}

export type EstadoMatriculaApi = 'EN_REGISTRO' | 'CONFIRMADA' | 'RETIRADA' | 'FINALIZADA'

export interface MatriculaEstudianteResumen {
  matriculaId: number
  estudianteId: number
  periodoId: number
  fechaMatricula: string
  estado: EstadoMatriculaApi
}

export interface EstudianteMatriculable {
  estudianteId: number
  personaId: number
  dni: string
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  correo: string | null
  matriculas: MatriculaEstudianteResumen[]
}

export interface RespuestaPagina<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface MatriculaApi {
  matriculaId: number
  estudianteId: number
  periodoId: number
  fechaMatricula: string
  estado: EstadoMatriculaApi
}

export function calcularVacantes(cupo: CupoSeccion): number {
  return Math.max(0, cupo.capacidadMaxima - cupo.matriculados)
}

export function porcentajeOcupacion(cupo: CupoSeccion): number {
  if (cupo.capacidadMaxima === 0) {
    return 0
  }

  return Math.min(100, Math.round((cupo.matriculados / cupo.capacidadMaxima) * 100))
}
