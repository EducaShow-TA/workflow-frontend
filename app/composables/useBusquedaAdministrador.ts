import { useApi } from '~/composables/useApi'
import { normalizarParaComparar } from '~/composables/useCompetencias'
import type { RespuestaPagina } from '~/types/matricula'

export interface EstudianteEncontrado {
  estudianteId: number
  nombreCompleto: string
  iniciales: string
  dni: string
  aula: string
}

export interface PantallaAdministrador {
  titulo: string
  detalle: string
  destino: string
  icono: string
  claves?: string
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

export const PANTALLAS_ADMINISTRADOR: PantallaAdministrador[] = [
  { titulo: 'Panel', detalle: 'Resumen del colegio', destino: '/panel', icono: '🏠', claves: 'inicio resumen' },
  { titulo: 'Estudiantes', detalle: 'Lista de estudiantes', destino: '/estudiantes', icono: '🎓', claves: 'alumnos' },
  {
    titulo: 'Registrar estudiante',
    detalle: 'Estudiantes',
    destino: '/estudiantes/nuevo',
    icono: '＋',
    claves: 'nuevo alumno',
  },
  { titulo: 'Matrícula', detalle: 'Lista de matrículas', destino: '/matriculas', icono: '📝' },
  {
    titulo: 'Crear matrícula',
    detalle: 'Matrícula',
    destino: '/matriculas/nueva',
    icono: '＋',
    claves: 'nueva matricula',
  },
  {
    titulo: 'Periodo de matrícula',
    detalle: 'Matrícula',
    destino: '/matriculas/periodo',
    icono: '📅',
    claves: 'ventana fechas',
  },
  {
    titulo: 'Grados y secciones',
    detalle: 'Vacantes por sección',
    destino: '/secciones',
    icono: '🏫',
    claves: 'aulas vacantes',
  },
  {
    titulo: 'Áreas y competencias',
    detalle: 'Catálogo curricular',
    destino: '/competencias',
    icono: '📚',
    claves: 'cursos materias',
  },
  {
    titulo: 'Reglas de consolidación',
    detalle: 'Áreas y competencias',
    destino: '/competencias/reglas',
    icono: '⚖️',
    claves: 'pesos logro',
  },
  { titulo: 'Tareas', detalle: 'Tareas y entregas', destino: '/tareas', icono: '📋' },
  {
    titulo: 'Calificaciones',
    detalle: 'Notas por competencia',
    destino: '/calificaciones',
    icono: '✏️',
    claves: 'notas',
  },
  {
    titulo: 'Libretas de notas',
    detalle: 'Calificaciones',
    destino: '/calificaciones/libretas',
    icono: '📘',
    claves: 'informe progreso',
  },
  { titulo: 'Cierre de actas', detalle: 'Calificaciones', destino: '/calificaciones/cierre-actas', icono: '🔒' },
  {
    titulo: 'Auditoría de calificaciones',
    detalle: 'Calificaciones',
    destino: '/calificaciones/auditoria',
    icono: '🔎',
    claves: 'logs cambios notas rectificaciones',
  },
  { titulo: 'Horarios', detalle: 'Plantillas y grilla', destino: '/horarios', icono: '🗓️' },
  { titulo: 'Horario por sección', detalle: 'Horarios', destino: '/horario-secciones', icono: '🗓️' },
  {
    titulo: 'Sesiones de clase',
    detalle: 'Asistencia de alumnos',
    destino: '/sesiones-clase',
    icono: '✅',
    claves: 'asistencia alumnos',
  },
  {
    titulo: 'Asistencia docente',
    detalle: 'Marcajes',
    destino: '/asistencia-docentes',
    icono: '🕘',
    claves: 'marcaje profesores',
  },
  {
    titulo: 'Configuración de marcaje',
    detalle: 'Asistencia docente',
    destino: '/asistencia-docentes/configuracion',
    icono: '⚙️',
    claves: 'tolerancia ventana',
  },
  {
    titulo: 'Finanzas',
    detalle: 'Boletas y pagos',
    destino: '/finanzas',
    icono: '💳',
    claves: 'pensiones pagos boletas',
  },
  {
    titulo: 'Auditoría financiera',
    detalle: 'Finanzas',
    destino: '/finanzas/auditoria',
    icono: '🔎',
    claves: 'logs pagos transacciones',
  },
  {
    titulo: 'Reporte de boletas',
    detalle: 'Reportes',
    destino: '/reportes/boletas',
    icono: '📄',
    claves: 'mora cobranza pendientes',
  },
  {
    titulo: 'Reporte de asistencia',
    detalle: 'Reportes',
    destino: '/reportes/asistencia',
    icono: '📄',
    claves: 'inasistencias tardanzas',
  },
  {
    titulo: 'Cuadro de mérito',
    detalle: 'Reportes',
    destino: '/reportes/cuadro-merito',
    icono: '🏆',
    claves: 'ranking',
  },
  { titulo: 'Usuarios', detalle: 'Cuentas del sistema', destino: '/usuarios', icono: '👤', claves: 'cuentas' },
  {
    titulo: 'Carga masiva de usuarios',
    detalle: 'Usuarios',
    destino: '/usuarios/carga-masiva',
    icono: '⬆️',
    claves: 'csv',
  },
  { titulo: 'Roles y permisos', detalle: 'Seguridad', destino: '/roles-permisos', icono: '🛡️' },
  { titulo: 'Logs del sistema', detalle: 'Errores técnicos', destino: '/logs-sistema', icono: '🧾', claves: 'errores' },
]

export function buscarPantallasAdministrador(consulta: string, limite = 4): PantallaAdministrador[] {
  const criterio = normalizarParaComparar(consulta)
  if (criterio.length < MINIMO_CARACTERES_BUSQUEDA) return []
  return PANTALLAS_ADMINISTRADOR.filter((pantalla) =>
    normalizarParaComparar(`${pantalla.titulo} ${pantalla.claves ?? ''}`).includes(criterio),
  )
    .sort(
      (a, b) =>
        Number(!normalizarParaComparar(a.titulo).startsWith(criterio)) -
        Number(!normalizarParaComparar(b.titulo).startsWith(criterio)),
    )
    .slice(0, limite)
}

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
          new Map(periodos.map((periodo) => [periodo.periodoId, `${periodo.numeroGrado}.° ${periodo.seccion}`])),
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

export function resaltarCoincidencia(texto: string, consulta: string): { texto: string; marcado: boolean }[] {
  const base = [...texto].map((letra) => normalizarParaComparar(letra) || letra).join('')
  const criterio = normalizarParaComparar(consulta)
  const inicio = criterio ? base.indexOf(criterio) : -1
  if (inicio < 0 || base.length !== texto.length) return [{ texto, marcado: false }]
  const fin = inicio + criterio.length
  return [
    { texto: texto.slice(0, inicio), marcado: false },
    { texto: texto.slice(inicio, fin), marcado: true },
    { texto: texto.slice(fin), marcado: false },
  ].filter((parte) => parte.texto)
}
