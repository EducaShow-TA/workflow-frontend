import { formatearGrado } from '~/composables/useNombresSeccion'
import { useApi } from '~/composables/useApi'
import type { RespuestaPagina } from '~/types/matricula'
import type { EstudianteListado } from '~/types/estudiante'

interface EstudianteApi {
  estudianteId: number
  personaId: number
  dni: string
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  correo: string | null
  matriculas: { estado: string; periodoId: number }[]
}

interface PeriodoApi {
  periodoId: number
  numeroGrado: number
  nivelEducativo: string
  seccion: string
}

const RUTA_ESTUDIANTES = '/api/v1/estudiantes'

export function useListadoEstudiantes() {
  const { solicitar } = useApi()

  async function listarEstudiantes(): Promise<EstudianteListado[]> {
    const estudiantes: EstudianteListado[] = []
    const periodos = await solicitar<PeriodoApi[]>('/api/v1/periodos')
    const periodosPorId = new Map(periodos.map((periodo) => [periodo.periodoId, periodo]))
    let pagina = 0
    let paginasTotales = 1

    while (pagina < paginasTotales) {
      const respuesta = await solicitar<RespuestaPagina<EstudianteApi>>(`${RUTA_ESTUDIANTES}?page=${pagina}&size=100`)
      paginasTotales = respuesta.totalPages
      estudiantes.push(
        ...respuesta.content.map((estudiante) => {
          const matricula = estudiante.matriculas.filter((item) => item.estado !== 'RETIRADA').at(-1)
          const periodo = matricula ? periodosPorId.get(matricula.periodoId) : undefined

          return {
            estudianteId: estudiante.estudianteId,
            codigo: `EST-${estudiante.estudianteId}`,
            nombres: estudiante.nombre,
            apellidos: `${estudiante.apellidoPaterno} ${estudiante.apellidoMaterno}`.trim(),
            correoElectronico: estudiante.correo ?? '',
            numeroDocumento: estudiante.dni,
            grado: periodo ? formatearGrado(periodo.numeroGrado, periodo.nivelEducativo) : 'Sin asignar',
            seccion: periodo?.seccion ?? '—',
            estado: 'REGISTRADO' as const,
          }
        }),
      )
      pagina += 1
    }

    return estudiantes
  }

  return { listarEstudiantes }
}
