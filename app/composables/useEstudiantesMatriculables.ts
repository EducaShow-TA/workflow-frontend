import { useApi } from '~/composables/useApi'
import type { EstudianteMatriculable, RespuestaPagina } from '~/types/matricula'

const RUTA_ESTUDIANTES = '/api/v1/estudiantes'

/** Consulta estudiantes reales con el resumen de sus matrículas. */
export function useEstudiantesMatriculables() {
  const { solicitar } = useApi()

  async function listar(): Promise<EstudianteMatriculable[]> {
    const estudiantes: EstudianteMatriculable[] = []
    let pagina = 0
    let totalPaginas = 1

    while (pagina < totalPaginas) {
      const respuesta = await solicitar<RespuestaPagina<EstudianteMatriculable>>(
        `${RUTA_ESTUDIANTES}?page=${pagina}&size=100`,
      )
      estudiantes.push(...respuesta.content)
      totalPaginas = respuesta.totalPages
      pagina += 1
    }

    return estudiantes
  }

  return { listar }
}
