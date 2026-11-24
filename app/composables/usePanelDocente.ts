import { formatearSeccion } from '~/composables/useNombresSeccion'
import { ref } from 'vue'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { useMiAsistenciaDocente } from '~/composables/useMiAsistenciaDocente'
import { claveClase, nombreClase, useMisClases } from '~/composables/useMisClases'
import { normalizarParaComparar } from '~/composables/useCompetencias'
import {
  formatearHora,
  horaDeMomento,
  obtenerSituacion,
  ordenarPorHora,
  useSesionesClase,
} from '~/composables/useSesionesClase'
import { useTareas } from '~/composables/useTareas'
import type { AsistenciaDocente } from '~/types/asistenciaDocente'
import type { AlumnoClase, MiClase } from '~/types/calificacion'
import type { SesionClaseResumen } from '~/types/sesionClase'
import type { Tarea } from '~/types/tarea'

export interface ClaseDocentePanel {
  clave: string
  clase: MiClase
  nombre: string
  alumnosEnRiesgo: number
}

export interface TareaDocentePanel {
  tarea: Tarea
  clave: string
  nombreClase: string
  entregadas: number
  vigente: boolean
  venceHoy: boolean
}

export interface AlumnoDocentePanel {
  alumno: AlumnoClase
  clave: string
  nombreClase: string
}

export interface AlumnoRiesgoPanel {
  nombre: string
  notasC: number
  clave: string
  nombreClase: string
}

export interface DatosPanelDocente {
  clases: ClaseDocentePanel[]
  sesionesHoy: SesionClaseResumen[]
  tareas: TareaDocentePanel[]
  alumnos: AlumnoDocentePanel[]
  enRiesgo: AlumnoRiesgoPanel[]
  marcajeHoy: AsistenciaDocente | null
  actualizado: Date
}

export interface PendienteDocente {
  clave: string
  cantidad: number
  tono: 'rojo' | 'ambar' | 'azul'
  titulo: string
  detalle: string
  enlace: string
  destino: string
}

export interface PantallaDocente {
  titulo: string
  detalle: string
  destino: string
  icono: string
  claves?: string
}

export const PANTALLAS_DOCENTE: PantallaDocente[] = [
  { titulo: 'Mi panel', detalle: 'Resumen del día', destino: '/docente', icono: '🏠', claves: 'inicio' },
  {
    titulo: 'Tareas',
    detalle: 'Crear tareas y ver entregas',
    destino: '/docente/tareas',
    icono: '📋',
    claves: 'entregas',
  },
  {
    titulo: 'Calificaciones',
    detalle: 'Notas y evidencias',
    destino: '/docente/calificaciones',
    icono: '🏅',
    claves: 'notas rectificar',
  },
  {
    titulo: 'Asistencia de alumnos',
    detalle: 'Tomar asistencia por clase',
    destino: '/docente/asistencia',
    icono: '✅',
  },
  {
    titulo: 'Reporte de asistencia',
    detalle: 'Faltas y tardanzas',
    destino: '/docente/reporte-asistencia',
    icono: '📊',
    claves: 'inasistencias tardanzas',
  },
  {
    titulo: 'Libretas e informes',
    detalle: 'Progreso por competencia',
    destino: '/docente/libretas',
    icono: '📘',
    claves: 'libreta informe',
  },
  {
    titulo: 'Mi marcaje',
    detalle: 'Entrada y salida',
    destino: '/docente/marcaje',
    icono: '🕘',
    claves: 'entrada salida',
  },
  {
    titulo: 'Mi horario',
    detalle: 'Agenda semanal',
    destino: '/docente/horario',
    icono: '🗓️',
    claves: 'clases semana',
  },
]

const MINIMO_BUSQUEDA_DOCENTE = 2

const datos = ref<DatosPanelDocente | null>(null)
let pendiente: Promise<DatosPanelDocente> | null = null

function incluye(texto: string, criterio: string): boolean {
  return normalizarParaComparar(texto).includes(criterio)
}

export function usePanelDocente() {
  const misClases = useMisClases()
  const sesiones = useSesionesClase()
  const tareasApi = useTareas()
  const marcaje = useMiAsistenciaDocente()

  async function consultar(): Promise<DatosPanelDocente> {
    const hoy = obtenerFechaHoyIso()
    const [clases, sesionesHoy, marcajes] = await Promise.all([
      misClases.listar(),
      sesiones.listarMias(hoy).catch(() => [] as SesionClaseResumen[]),
      marcaje.listar(hoy, hoy).catch(() => [] as AsistenciaDocente[]),
    ])
    const periodos = [...new Set(clases.map((clase) => clase.periodoId))]
    const [tareasPorPeriodo, alumnosPorPeriodo, riesgos] = await Promise.all([
      Promise.all(periodos.map((periodo) => tareasApi.listarPorPeriodo(periodo).catch(() => [] as Tarea[]))),
      Promise.all(periodos.map((periodo) => misClases.listarAlumnos(periodo).catch(() => [] as AlumnoClase[]))),
      Promise.all(clases.map((clase) => misClases.obtenerRiesgo(clase.periodoId, clase.areaCodigo).catch(() => null))),
    ])

    const ordenadas = [...clases].sort(
      (a, b) =>
        a.areaNombre.localeCompare(b.areaNombre) ||
        a.gradoNumero - b.gradoNumero ||
        a.seccionCodigo.localeCompare(b.seccionCodigo),
    )
    const riesgoPorClave = new Map(clases.map((clase, indice) => [claveClase(clase), riesgos[indice]]))
    const claseDeTarea = (tarea: Tarea) =>
      clases.find(
        (clase) =>
          clase.periodoId === tarea.periodoId &&
          clase.competencias.some((competencia) => competencia.codigo === tarea.competenciaCodigo),
      )
    const ahora = Date.now()
    const tareas = tareasPorPeriodo
      .flat()
      .map((tarea) => {
        const clase = claseDeTarea(tarea)
        if (!clase) return null
        const limite = new Date(tarea.fechaLimite)
        return {
          tarea,
          clave: claveClase(clase),
          nombreClase: `${clase.areaNombre} · ${nombreClase(clase)}`,
          entregadas: tarea.entregas.filter((entrega) => entrega.cumplida).length,
          vigente: limite.getTime() >= ahora,
          venceHoy: limite.getTime() >= ahora && tarea.fechaLimite.slice(0, 10) === hoy,
        }
      })
      .filter((tarea): tarea is TareaDocentePanel => tarea !== null)
      .sort((a, b) => a.tarea.fechaLimite.localeCompare(b.tarea.fechaLimite))

    const alumnos: AlumnoDocentePanel[] = []
    periodos.forEach((periodo, indice) => {
      for (const clase of ordenadas.filter((item) => item.periodoId === periodo)) {
        for (const alumno of alumnosPorPeriodo[indice] ?? []) {
          alumnos.push({ alumno, clave: claveClase(clase), nombreClase: `${clase.areaNombre} · ${nombreClase(clase)}` })
        }
      }
    })

    const enRiesgo: AlumnoRiesgoPanel[] = ordenadas.flatMap((clase) =>
      (riesgoPorClave.get(claveClase(clase))?.alumnos ?? [])
        .filter((alumno) => alumno.enRiesgo)
        .map((alumno) => ({
          nombre: alumno.nombreCompleto,
          notasC: alumno.notasC,
          clave: claveClase(clase),
          nombreClase: `${clase.areaNombre} · ${nombreClase(clase)}`,
        })),
    )

    return {
      clases: ordenadas.map((clase) => ({
        clave: claveClase(clase),
        clase,
        nombre: `${clase.areaNombre} · ${nombreClase(clase)}`,
        alumnosEnRiesgo: riesgoPorClave.get(claveClase(clase))?.alumnosEnRiesgo ?? 0,
      })),
      sesionesHoy: ordenarPorHora(sesionesHoy),
      tareas,
      alumnos,
      enRiesgo,
      marcajeHoy: marcajes[0] ?? null,
      actualizado: new Date(),
    }
  }

  async function cargar(forzar = false): Promise<DatosPanelDocente> {
    if (datos.value && !forzar) return datos.value
    pendiente ??= consultar().finally(() => {
      pendiente = null
    })
    datos.value = await pendiente
    return datos.value
  }

  return { datos, cargar }
}

export function listarPendientesDocente(panel: DatosPanelDocente, ahora = Date.now()): PendienteDocente[] {
  const lista: PendienteDocente[] = []
  const abiertas = panel.sesionesHoy.filter((sesion) => obtenerSituacion(sesion, ahora) === 'ABIERTA')
  if (abiertas.length) {
    const primera = abiertas[0]!
    lista.push({
      clave: 'asistencia',
      cantidad: abiertas.length,
      tono: 'rojo',
      titulo: abiertas.length === 1 ? 'Asistencia por tomar ahora' : 'Asistencias por tomar ahora',
      detalle: `${primera.areaNombre} · ${formatearSeccion(primera.gradoNumero, primera.seccionCodigo)} · hasta las ${horaDeMomento(primera.ventanaCierre)}`,
      enlace: 'Tomar',
      destino: abiertas.length === 1 ? `/docente/asistencia/${primera.id}` : '/docente/asistencia',
    })
  }
  if (panel.sesionesHoy.length && !panel.marcajeHoy?.horaEntrada) {
    lista.push({
      clave: 'marcaje',
      cantidad: 1,
      tono: 'rojo',
      titulo: 'Aún no marcas tu entrada',
      detalle: `Tu primera clase es a las ${formatearHora(panel.sesionesHoy[0]!.horaInicio)}`,
      enlace: 'Marcar',
      destino: '/docente/marcaje',
    })
  }
  const hoy = panel.tareas.filter((tarea) => tarea.venceHoy)
  if (hoy.length) {
    const primera = hoy[0]!
    lista.push({
      clave: 'tareas',
      cantidad: hoy.length,
      tono: 'ambar',
      titulo: hoy.length === 1 ? 'Tarea que vence hoy' : 'Tareas que vencen hoy',
      detalle: `${primera.tarea.titulo} · ${primera.entregadas} / ${primera.tarea.entregas.length} entregadas`,
      enlace: 'Ver',
      destino: `/docente/tareas?clase=${encodeURIComponent(primera.clave)}&tarea=${primera.tarea.id}`,
    })
  }
  if (panel.enRiesgo.length) {
    const clases = [...new Set(panel.enRiesgo.map((alumno) => alumno.nombreClase))]
    lista.push({
      clave: 'riesgo',
      cantidad: panel.enRiesgo.length,
      tono: 'azul',
      titulo: panel.enRiesgo.length === 1 ? 'Alumno en riesgo académico' : 'Alumnos en riesgo académico',
      detalle: clases.length === 1 ? clases[0]! : `${clases.length} clases`,
      enlace: 'Ver',
      destino: `/docente/calificaciones?clase=${encodeURIComponent(panel.enRiesgo[0]!.clave)}&filtro=riesgo`,
    })
  }
  return lista
}

export type ResultadoBusquedaDocente =
  | { tipo: 'alumno'; clave: string; titulo: string; detalle: string; etiqueta: string; destino: string }
  | { tipo: 'clase'; clave: string; titulo: string; detalle: string; etiqueta: string; destino: string }
  | { tipo: 'tarea'; clave: string; titulo: string; detalle: string; etiqueta: string; destino: string }
  | { tipo: 'pantalla'; clave: string; titulo: string; detalle: string; etiqueta: string; destino: string }

export function buscarEnPanelDocente(panel: DatosPanelDocente | null, consulta: string): ResultadoBusquedaDocente[] {
  const criterio = normalizarParaComparar(consulta)
  if (criterio.length < MINIMO_BUSQUEDA_DOCENTE) return []
  const soloNumeros = /^\d+$/.test(criterio)
  const alumnos = (panel?.alumnos ?? [])
    .filter(({ alumno }) => (soloNumeros ? alumno.dni.includes(criterio) : incluye(alumno.nombreCompleto, criterio)))
    .slice(0, 5)
    .map(({ alumno, clave, nombreClase: clase }) => ({
      tipo: 'alumno' as const,
      clave: `a-${clave}-${alumno.matriculaId}`,
      titulo: alumno.nombreCompleto,
      detalle: `DNI ${alumno.dni}`,
      etiqueta: clase,
      destino: `/docente/calificaciones?clase=${encodeURIComponent(clave)}&alumno=${encodeURIComponent(alumno.dni)}`,
    }))
  if (soloNumeros) return alumnos
  const clases = (panel?.clases ?? [])
    .filter((item) =>
      incluye(`${item.nombre} ${formatearSeccion(item.clase.gradoNumero, item.clase.seccionCodigo)}`, criterio),
    )
    .slice(0, 3)
    .map((item) => ({
      tipo: 'clase' as const,
      clave: `c-${item.clave}`,
      titulo: item.nombre,
      detalle: `${item.clase.totalAlumnos} alumnos`,
      etiqueta: 'Clase',
      destino: `/docente/tareas?clase=${encodeURIComponent(item.clave)}`,
    }))
  const tareas = (panel?.tareas ?? [])
    .filter((item) => incluye(item.tarea.titulo, criterio))
    .slice(0, 3)
    .map((item) => ({
      tipo: 'tarea' as const,
      clave: `t-${item.tarea.id}`,
      titulo: item.tarea.titulo,
      detalle: item.nombreClase,
      etiqueta: item.vigente ? 'Vigente' : 'Vencida',
      destino: `/docente/tareas?clase=${encodeURIComponent(item.clave)}&tarea=${item.tarea.id}`,
    }))
  const pantallas = PANTALLAS_DOCENTE.filter((pantalla) =>
    incluye(`${pantalla.titulo} ${pantalla.claves ?? ''}`, criterio),
  )
    .slice(0, 3)
    .map((pantalla) => ({
      tipo: 'pantalla' as const,
      clave: `p-${pantalla.destino}`,
      titulo: pantalla.titulo,
      detalle: pantalla.detalle,
      etiqueta: pantalla.icono,
      destino: pantalla.destino,
    }))
  return [...alumnos, ...clases, ...tareas, ...pantallas]
}

export const GRUPOS_BUSQUEDA_DOCENTE: Record<ResultadoBusquedaDocente['tipo'], string> = {
  alumno: 'Mis alumnos',
  clase: 'Mis clases',
  tarea: 'Mis tareas',
  pantalla: 'Ir a',
}

export function limpiarPanelDocente(): void {
  datos.value = null
}
