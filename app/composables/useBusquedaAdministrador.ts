import { formatearSeccion } from '~/composables/useNombresSeccion'
import { useApi } from '~/composables/useApi'
import type { RespuestaPagina } from '~/types/matricula'

export interface EstudianteEncontrado {
  estudianteId: number
  nombreCompleto: string
  iniciales: string
  dni: string
  aula: string
}

interface EstudianteBusquedaApi {
  estudianteId: number
  dni: string
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  matriculas: { estado: string; periodoId: number }[]
}

interface PeriodoBusquedaApi {
  periodoId: number
  numeroGrado: number
  seccion: string
}

export const MINIMO_CARACTERES_BUSQUEDA = 2
export const LIMITE_ESTUDIANTES_BUSQUEDA = 5

export function esBusquedaPorDni(consulta: string): boolean {
  return /^\d+$/.test(consulta.trim())
}

export function useBusquedaAdministrador() {
  const { solicitar } = useApi()
  let aulas: Promise<Map<number, string>> | null = null

  function cargarAulas(): Promise<Map<number, string>> {
    aulas ??= solicitar<PeriodoBusquedaApi[]>('/api/v1/periodos')
      .then(
        (periodos) =>
          new Map(
            periodos.map((periodo) => [periodo.periodoId, formatearSeccion(periodo.numeroGrado, periodo.seccion)]),
          ),
      )
      .catch(() => {
        aulas = null
        return new Map<number, string>()
      })
    return aulas
  }

  async function buscarEstudiantes(consulta: string): Promise<EstudianteEncontrado[]> {
    const texto = consulta.trim()
    const filtro = esBusquedaPorDni(texto) ? 'dni' : 'nombre'
    const [respuesta, aulasPorPeriodo] = await Promise.all([
      solicitar<RespuestaPagina<EstudianteBusquedaApi>>(
        `/api/v1/estudiantes?${filtro}=${encodeURIComponent(texto)}&page=0&size=${LIMITE_ESTUDIANTES_BUSQUEDA}`,
      ),
      cargarAulas(),
    ])
    return respuesta.content.map((estudiante) => {
      const matricula = estudiante.matriculas.filter((item) => item.estado !== 'RETIRADA').at(-1)
      return {
        estudianteId: estudiante.estudianteId,
        nombreCompleto: `${estudiante.apellidoPaterno} ${estudiante.apellidoMaterno}`.trim() + `, ${estudiante.nombre}`,
        iniciales: `${estudiante.nombre.charAt(0)}${estudiante.apellidoPaterno.charAt(0)}`.toUpperCase(),
        dni: estudiante.dni,
        aula: (matricula && aulasPorPeriodo.get(matricula.periodoId)) || 'Sin matrícula',
      }
    })
  }

  return { buscarEstudiantes }
}
