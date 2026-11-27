<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AlumnoClase, Calificacion, MiClase, NotaCualitativa, RiesgoAcademico } from '~/types/calificacion'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { formatearFecha } from '~/composables/useFechas'
import { guardarArchivo } from '~/composables/useReporteAsistencia'
import { useCalificaciones } from '~/composables/useCalificaciones'
import { useEvaluacionesParciales } from '~/composables/useEvaluacionesParciales'
import type { EvaluacionParcial, NotaEvaluacionParcial } from '~/types/evaluacionParcial'
import { NOTAS, claveClase, nombreClase, useMisClases } from '~/composables/useMisClases'
import { obtenerEtiquetaEstadoBimestre, useBimestres } from '~/composables/useBimestres'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { BimestreAcademico } from '~/types/bimestre'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const CLAVE_RECORDADA = 'educashow.docente.calificaciones'

type FiltroNota = NotaCualitativa | 'SIN_NOTA' | 'RIESGO' | ''

const autenticacion = useAutenticacionStore()
const { listar: listarClases, listarAlumnos, obtenerRiesgo } = useMisClases()
const {
  listar: listarNotas,
  descargarEvidencia,
  cargaMasiva,
  descargarPlantillaCargaMasiva,
} = useCalificaciones()
const { listar: listarEvaluaciones, listarNotas: listarNotasParciales } = useEvaluacionesParciales()
const { listar: listarBimestres } = useBimestres()
const ruta = useRoute()
const esDocente = computed(() => autenticacion.usuario?.rol === 'DOCENTE')

const clases = ref<MiClase[]>([])
const areaElegida = ref('')
const claseElegida = ref('')
const competenciaElegida = ref('')
const alumnos = ref<AlumnoClase[]>([])
const notasPorCompetencia = ref<Record<string, Calificacion[]>>({})
const riesgoAcademico = ref<RiesgoAcademico | null>(null)
const bimestresClase = ref<BimestreAcademico[]>([])
const bimestreElegido = ref<number | null>(null)
const bimestreVisto = computed(() => bimestreElegido.value ?? riesgoAcademico.value?.bimestre ?? 1)
const datosBimestreVisto = computed(() => bimestresClase.value.find((item) => item.numero === bimestreVisto.value))
const bimestreCerrado = computed(() => datosBimestreVisto.value?.estado === 'CERRADO')
const busqueda = ref('')
const filtroNota = ref<FiltroNota>('')
const cargando = ref(true)
const cargandoClase = ref(false)
const error = ref('')
const aviso = ref('')

const modalAbierto = ref(false)
const alumnoEnEdicion = ref<AlumnoClase | null>(null)
const rectificacionAbierta = ref(false)
const historialAbierto = ref(false)
const matriculaResaltada = ref<number | null>(null)
const evaluacionesCompetencia = ref<EvaluacionParcial[]>([])
const notasParciales = ref<Record<number, NotaEvaluacionParcial[]>>({})
const cargandoParciales = ref(false)
const ventanaParcial = ref<{ evaluacion: EvaluacionParcial; alumno: AlumnoClase } | null>(null)
const cargandoCsv = ref(false)
const descargandoPlantillaNotas = ref(false)
const inputCsv = ref<HTMLInputElement | null>(null)
let solicitudParciales = 0
let temporizadorResaltado: ReturnType<typeof setTimeout> | undefined

const areas = computed(() => {
  const mapa = new Map<string, { codigo: string; nombre: string; secciones: number }>()
  for (const clase of clases.value) {
    const area = mapa.get(clase.areaCodigo)
    if (area) area.secciones += 1
    else mapa.set(clase.areaCodigo, { codigo: clase.areaCodigo, nombre: clase.areaNombre, secciones: 1 })
  }
  return [...mapa.values()]
})
const clasesDelArea = computed(() => clases.value.filter((clase) => clase.areaCodigo === areaElegida.value))
const clase = computed(() => clases.value.find((item) => claveClase(item) === claseElegida.value) ?? null)
const competencia = computed(
  () => clase.value?.competencias.find((item) => item.codigo === competenciaElegida.value) ?? null,
)
const notas = computed(() => notasPorCompetencia.value[competenciaElegida.value] ?? [])
const evaluacionesBimestre = computed(() =>
  evaluacionesCompetencia.value.filter((item) => item.bimestre === bimestreVisto.value),
)
const modoParcial = computed(() => evaluacionesBimestre.value.length > 0)
const ponderacionBimestre = computed(() =>
  evaluacionesBimestre.value.map((item) => `${Number(item.ponderacion)} %`).join(' + '),
)
const notaPorMatricula = computed(() => new Map(notas.value.map((nota) => [nota.matriculaId, nota])))

const conteo = computed(() => {
  const resultado: Record<NotaCualitativa | 'SIN_NOTA', number> = { AD: 0, A: 0, B: 0, C: 0, SIN_NOTA: 0 }
  for (const alumno of alumnos.value) {
    const nota = notaPorMatricula.value.get(alumno.matriculaId)
    resultado[nota ? nota.nota : 'SIN_NOTA'] += 1
  }
  return resultado
})

const riesgoPorMatricula = computed(
  () => new Map((riesgoAcademico.value?.alumnos ?? []).map((alumno) => [alumno.matriculaId, alumno])),
)
const enRiesgo = computed(
  () =>
    new Set(
      (riesgoAcademico.value?.alumnos ?? []).filter((alumno) => alumno.enRiesgo).map((alumno) => alumno.matriculaId),
    ),
)

const alumnosFiltrados = computed(() => {
  const texto = normalizar(busqueda.value)
  return alumnos.value.filter((alumno) => {
    const nota = notaPorMatricula.value.get(alumno.matriculaId)
    if (filtroNota.value === 'RIESGO') {
      if (!enRiesgo.value.has(alumno.matriculaId)) return false
    } else if (filtroNota.value === 'SIN_NOTA') {
      if (nota) return false
    } else if (filtroNota.value && nota?.nota !== filtroNota.value) return false
    return !texto || normalizar(alumno.nombreCompleto).includes(texto) || alumno.dni.includes(texto)
  })
})

const pendientes = computed(() => alumnos.value.filter((alumno) => !notaPorMatricula.value.has(alumno.matriculaId)))
const contexto = computed(() =>
  clase.value && competencia.value
    ? `${clase.value.areaNombre} · ${formatearSeccionCompleta(clase.value.gradoNumero, clase.value.seccionCodigo)} · ${competencia.value.nombre}`
    : '',
)
const haySiguiente = computed(() =>
  pendientes.value.some((alumno) => alumno.matriculaId !== alumnoEnEdicion.value?.matriculaId),
)

function notaParcial(evaluacionId: number, matriculaId: number): NotaEvaluacionParcial | null {
  return (
    (notasParciales.value[evaluacionId] ?? []).find(
      (nota) => nota.matriculaId === matriculaId && (nota.nota || nota.justificada),
    ) ?? null
  )
}

function porcentajeFaltante(matriculaId: number): number {
  return evaluacionesBimestre.value
    .filter((evaluacion) => !notaParcial(evaluacion.id, matriculaId))
    .reduce((suma, evaluacion) => suma + Number(evaluacion.ponderacion), 0)
}

async function cargarParciales(): Promise<void> {
  const actual = clase.value
  const codigo = competenciaElegida.value
  const turno = ++solicitudParciales
  evaluacionesCompetencia.value = []
  notasParciales.value = {}
  if (!actual || !codigo) return
  cargandoParciales.value = true
  try {
    const lista = await listarEvaluaciones(actual.periodoId, codigo)
    const bimestre = bimestreVisto.value
    const delBimestre = lista.filter((item) => item.bimestre === bimestre)
    const notas = await Promise.all(delBimestre.map((item) => listarNotasParciales(item.id)))
    if (turno !== solicitudParciales) return
    evaluacionesCompetencia.value = lista
    notasParciales.value = Object.fromEntries(delBimestre.map((item, indice) => [item.id, notas[indice] ?? []]))
  } catch (fallo: unknown) {
    if (turno === solicitudParciales) {
      error.value = obtenerMensajeError(fallo, 'No se pudieron cargar las evaluaciones parciales.')
    }
  } finally {
    if (turno === solicitudParciales) cargandoParciales.value = false
  }
}

function abrirParcial(evaluacion: EvaluacionParcial, alumno: AlumnoClase): void {
  aviso.value = ''
  ventanaParcial.value = { evaluacion, alumno }
}

async function alGuardarParcial(): Promise<void> {
  const ventana = ventanaParcial.value
  ventanaParcial.value = null
  const actual = clase.value
  if (!ventana || !actual) return
  aviso.value = `Nota de ${ventana.alumno.nombreCompleto} guardada en “${ventana.evaluacion.titulo}”.`
  try {
    const [notasEvaluacion, logros] = await Promise.all([
      listarNotasParciales(ventana.evaluacion.id),
      listarNotas(actual.periodoId, competenciaElegida.value, bimestreVisto.value),
    ])
    notasParciales.value = { ...notasParciales.value, [ventana.evaluacion.id]: notasEvaluacion }
    notasPorCompetencia.value = { ...notasPorCompetencia.value, [competenciaElegida.value]: logros }
    riesgoAcademico.value = await obtenerRiesgo(actual.periodoId, actual.areaCodigo)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo actualizar el logro del bimestre.')
  }
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function calificados(codigo: string): number {
  const matriculas = new Set(alumnos.value.map((alumno) => alumno.matriculaId))
  return (notasPorCompetencia.value[codigo] ?? []).filter((nota) => matriculas.has(nota.matriculaId)).length
}

function recordar(): void {
  try {
    localStorage.setItem(
      CLAVE_RECORDADA,
      JSON.stringify({ clase: claseElegida.value, competencia: competenciaElegida.value }),
    )
  } catch {
    /* el navegador puede bloquear el almacenamiento */
  }
}

function leerRecordada(): { clase?: string; competencia?: string } {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_RECORDADA) || '{}')
  } catch {
    return {}
  }
}

function elegirArea(codigo: string): void {
  if (areaElegida.value === codigo) return
  areaElegida.value = codigo
  const primera = clasesDelArea.value[0]
  if (primera) void elegirClase(claveClase(primera))
}

async function elegirClase(clave: string, competenciaPreferida = ''): Promise<void> {
  const nueva = clases.value.find((item) => claveClase(item) === clave)
  if (!nueva) return
  claseElegida.value = clave
  areaElegida.value = nueva.areaCodigo
  competenciaElegida.value =
    nueva.competencias.find((item) => item.codigo === competenciaPreferida)?.codigo ??
    nueva.competencias[0]?.codigo ??
    ''
  filtroNota.value = ''
  busqueda.value = ''
  aviso.value = ''
  recordar()
  await cargarClase()
}

function aplicarConsulta(): void {
  if (typeof ruta.query.alumno === 'string') busqueda.value = ruta.query.alumno
  if (ruta.query.filtro === 'riesgo') filtroNota.value = 'RIESGO'
}

watch(
  () => ruta.query,
  async (consulta) => {
    if (!clases.value.length || typeof consulta.clase !== 'string') return
    if (consulta.clase !== claseElegida.value) await elegirClase(consulta.clase)
    aplicarConsulta()
  },
)

function elegirCompetencia(codigo: string): void {
  competenciaElegida.value = codigo
  filtroNota.value = ''
  recordar()
  void cargarParciales()
}

async function cargarClase(): Promise<void> {
  const actual = clase.value
  if (!actual) return
  cargandoClase.value = true
  error.value = ''
  alumnos.value = []
  notasPorCompetencia.value = {}
  riesgoAcademico.value = null
  bimestreElegido.value = null
  try {
    const [lista, riesgo, calendario] = await Promise.all([
      listarAlumnos(actual.periodoId),
      obtenerRiesgo(actual.periodoId, actual.areaCodigo),
      listarBimestres(actual.anhio).catch(() => []),
    ])
    const porCompetencia = await Promise.all(
      actual.competencias.map((item) => listarNotas(actual.periodoId, item.codigo, riesgo.bimestre)),
    )
    if (claveClase(actual) !== claseElegida.value) return
    alumnos.value = lista
    riesgoAcademico.value = riesgo
    bimestresClase.value = calendario
    notasPorCompetencia.value = Object.fromEntries(
      actual.competencias.map((item, indice) => [item.codigo, porCompetencia[indice] ?? []]),
    )
    void cargarParciales()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar la lista de alumnos.')
  } finally {
    cargandoClase.value = false
  }
}

async function verBimestre(numero: number): Promise<void> {
  const actual = clase.value
  if (!actual || numero === bimestreVisto.value) return
  bimestreElegido.value = numero
  cargandoClase.value = true
  error.value = ''
  try {
    const porCompetencia = await Promise.all(
      actual.competencias.map((item) => listarNotas(actual.periodoId, item.codigo, numero)),
    )
    if (claveClase(actual) !== claseElegida.value || bimestreVisto.value !== numero) return
    notasPorCompetencia.value = Object.fromEntries(
      actual.competencias.map((item, indice) => [item.codigo, porCompetencia[indice] ?? []]),
    )
    void cargarParciales()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar las notas del bimestre.')
  } finally {
    cargandoClase.value = false
  }
}

function textoFiltro(valor: FiltroNota): string {
  if (valor === 'SIN_NOTA') return 'Sin nota'
  if (valor === 'RIESGO') return 'En riesgo'
  return valor
}

function alternarFiltro(valor: FiltroNota): void {
  filtroNota.value = filtroNota.value === valor ? '' : valor
}

function abrir(alumno: AlumnoClase): void {
  alumnoEnEdicion.value = alumno
  aviso.value = ''
  if (notaPorMatricula.value.has(alumno.matriculaId)) rectificacionAbierta.value = true
  else modalAbierto.value = true
}

function verHistorial(alumno: AlumnoClase): void {
  alumnoEnEdicion.value = alumno
  aviso.value = ''
  historialAbierto.value = true
}

async function rectificarDesdeHistorial(): Promise<void> {
  historialAbierto.value = false
  await nextTick()
  rectificacionAbierta.value = true
}

function textoRectificada(cantidad: number): string {
  return cantidad === 1 ? 'Rectificada · ver historial' : `Rectificada ${cantidad} veces · ver historial`
}

function actualizarNota(calificacion: Calificacion): void {
  const codigo = competenciaElegida.value
  const lista = (notasPorCompetencia.value[codigo] ?? []).filter(
    (nota) => nota.matriculaId !== calificacion.matriculaId,
  )
  notasPorCompetencia.value = { ...notasPorCompetencia.value, [codigo]: [...lista, calificacion] }
  if (clase.value) {
    void obtenerRiesgo(clase.value.periodoId, clase.value.areaCodigo)
      .then((resultado) => {
        riesgoAcademico.value = resultado
      })
      .catch((fallo: unknown) => {
        error.value = obtenerMensajeError(fallo, 'No se pudo actualizar el análisis de riesgo académico.')
      })
  }
}

function alRectificar(calificacion: Calificacion, notaAnterior: NotaCualitativa): void {
  actualizarNota(calificacion)
  const nombre = alumnoEnEdicion.value?.nombreCompleto ?? 'el alumno'
  aviso.value =
    notaAnterior === calificacion.nota
      ? `Calificación de ${nombre} rectificada; se mantiene la nota ${calificacion.nota}.`
      : `Nota de ${nombre} rectificada de ${notaAnterior} a ${calificacion.nota}.`
  rectificacionAbierta.value = false
  matriculaResaltada.value = calificacion.matriculaId
  clearTimeout(temporizadorResaltado)
  temporizadorResaltado = setTimeout(() => {
    matriculaResaltada.value = null
  }, 3000)
}

function calificarPendientes(): void {
  const primero = pendientes.value[0]
  if (primero) abrir(primero)
}

function abrirCsv(): void {
  inputCsv.value?.click()
}

async function cargarCsv(evento: Event): Promise<void> {
  const entrada = evento.target as HTMLInputElement
  const archivo = entrada.files?.[0]
  const actual = clase.value
  if (!archivo || !actual || !competencia.value || bimestreCerrado.value) return
  cargandoCsv.value = true
  error.value = ''
  try {
    const resultado = await cargaMasiva(
      actual.periodoId,
      competenciaElegida.value,
      bimestreVisto.value,
      archivo,
    )
    const notasActualizadas = await listarNotas(
      actual.periodoId,
      competenciaElegida.value,
      bimestreVisto.value,
    )
    notasPorCompetencia.value = {
      ...notasPorCompetencia.value,
      [competenciaElegida.value]: notasActualizadas,
    }
    aviso.value =
      resultado.filasRechazadas === 0
        ? `Se cargaron ${resultado.filasValidas} notas desde el CSV.`
        : `Se cargaron ${resultado.filasValidas} notas; ${resultado.filasRechazadas} filas fueron rechazadas.`
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar el archivo de notas.')
  } finally {
    cargandoCsv.value = false
    entrada.value = ''
  }
}

async function descargarPlantillaNotas(formato: 'csv' | 'xlsx'): Promise<void> {
  const actual = clase.value
  if (!actual || !competencia.value || modoParcial.value || bimestreCerrado.value) return
  descargandoPlantillaNotas.value = true
  error.value = ''
  try {
    const archivo = await descargarPlantillaCargaMasiva(
      actual.periodoId,
      competenciaElegida.value,
      bimestreVisto.value,
      formato,
    )
    guardarArchivo(
      archivo,
      `plantilla-notas-${actual.gradoNumero}-${actual.seccionCodigo}-bimestre-${bimestreVisto.value}.${formato}`,
    )
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo descargar la plantilla de notas.')
  } finally {
    descargandoPlantillaNotas.value = false
  }
}

function alGuardar(calificacion: Calificacion, siguiente: boolean): void {
  actualizarNota(calificacion)
  aviso.value = `Nota ${calificacion.nota} guardada para ${alumnoEnEdicion.value?.nombreCompleto ?? 'el alumno'}.`

  const proximo = siguiente ? pendientes.value[0] : undefined
  if (proximo) {
    alumnoEnEdicion.value = proximo
    modalAbierto.value = false
    requestAnimationFrame(() => {
      modalAbierto.value = true
    })
  } else {
    modalAbierto.value = false
  }
}

async function descargar(calificacion: Calificacion): Promise<void> {
  try {
    await descargarEvidencia(calificacion)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo descargar la evidencia.')
  }
}

onBeforeUnmount(() => clearTimeout(temporizadorResaltado))

onMounted(async () => {
  if (!esDocente.value) {
    cargando.value = false
    return
  }
  try {
    clases.value = await listarClases()
    const recordada = leerRecordada()
    const pedida = typeof ruta.query.clase === 'string' ? ruta.query.clase : ''
    const inicial =
      clases.value.find((item) => claveClase(item) === pedida) ??
      clases.value.find((item) => claveClase(item) === recordada.clase) ??
      clases.value[0]
    if (inicial) {
      await elegirClase(claveClase(inicial), pedida ? '' : recordada.competencia)
      aplicarConsulta()
    }
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar tus clases.')
  } finally {
    cargando.value = false
  }
})
</script>

<template>
  <main class="docente-vista">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">Evaluación por competencias</span>
        <h1>Calificaciones</h1>
        <p>Elige tu clase y la competencia; registra la nota de cada alumno con su evidencia.</p>
      </div>
      <span class="docente-insignia">Escala AD · A · B · C</span>
    </header>

    <DocenteEstadoVacio
      v-if="!esDocente"
      titulo="Solo para docentes"
      descripcion="Ingresa con una cuenta docente para calificar a tus alumnos."
    />

    <p v-else-if="cargando" class="docente-texto-secundario" role="status">Cargando tus clases…</p>

    <template v-else>
      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

      <DocenteEstadoVacio
        v-if="!clases.length && !error"
        titulo="Aún no tienes clases asignadas"
        descripcion="Tus clases aparecen aquí cuando el administrador te asigna sesiones en una sección."
      />

      <section v-else-if="clases.length" class="docente-tarjeta selector" aria-label="Elegir clase">
        <div class="fila">
          <span id="etiqueta-curso" class="etiqueta">Curso</span>
          <div class="pastillas" role="group" aria-labelledby="etiqueta-curso">
            <button
              v-for="area in areas"
              :key="area.codigo"
              type="button"
              class="pastilla"
              :aria-pressed="area.codigo === areaElegida"
              @click="elegirArea(area.codigo)"
            >
              {{ area.nombre }} <span class="contador">{{ area.secciones }}</span>
            </button>
          </div>
        </div>
        <div class="fila">
          <span id="etiqueta-seccion" class="etiqueta">Sección</span>
          <div class="secciones" role="group" aria-labelledby="etiqueta-seccion">
            <button
              v-for="item in clasesDelArea"
              :key="claveClase(item)"
              type="button"
              class="seccion"
              :aria-pressed="claveClase(item) === claseElegida"
              @click="elegirClase(claveClase(item))"
            >
              <strong>{{ nombreClase(item) }}</strong>
              <small>{{ item.totalAlumnos }} {{ item.totalAlumnos === 1 ? 'alumno' : 'alumnos' }}</small>
            </button>
          </div>
        </div>
      </section>

      <section v-if="clase" class="docente-tarjeta" :aria-busy="cargandoClase" aria-labelledby="titulo-clase">
        <div class="docente-tarjeta__titulo docente-tarjeta__titulo--wrap">
          <h2 id="titulo-clase">
            {{ clase.areaNombre }} · {{ formatearSeccionCompleta(clase.gradoNumero, clase.seccionCodigo) }} ·
            {{ clase.anhio }}
          </h2>
          <div class="acciones-notas">
            <input
              ref="inputCsv"
              class="entrada-csv"
              type="file"
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              @change="cargarCsv"
            />
            <button
              v-if="!modoParcial"
              type="button"
              class="docente-boton secundario"
              :disabled="cargandoCsv || descargandoPlantillaNotas || cargandoClase || !competencia || bimestreCerrado"
              @click="abrirCsv"
            >
              {{ cargandoCsv ? 'Cargando…' : 'Subir notas CSV/Excel' }}
            </button>
            <button
              v-if="!modoParcial"
              type="button"
              class="docente-boton secundario"
              :disabled="cargandoCsv || descargandoPlantillaNotas || cargandoClase || !competencia || bimestreCerrado"
              @click="descargarPlantillaNotas('csv')"
            >
              {{ descargandoPlantillaNotas ? 'Descargando…' : 'Plantilla CSV' }}
            </button>
            <button
              v-if="!modoParcial"
              type="button"
              class="docente-boton secundario"
              :disabled="cargandoCsv || descargandoPlantillaNotas || cargandoClase || !competencia || bimestreCerrado"
              @click="descargarPlantillaNotas('xlsx')"
            >
              {{ descargandoPlantillaNotas ? 'Descargando…' : 'Plantilla Excel' }}
            </button>
            <button
              v-if="!modoParcial"
              type="button"
              class="docente-boton"
              :disabled="cargandoClase || !competencia || !pendientes.length || bimestreCerrado"
              @click="calificarPendientes"
            >
              {{ pendientes.length ? `Calificar pendientes (${pendientes.length})` : 'Todos calificados' }}
            </button>
          </div>
        </div>

        <p v-if="!clase.competencias.length" class="docente-texto-secundario">
          El área no tiene competencias activas. Pide al administrador que las registre.
        </p>

        <template v-else>
          <div class="competencia-filtro">
            <label for="competencia-elegida">Competencia</label>
            <select
              id="competencia-elegida"
              :value="competenciaElegida"
              :disabled="cargandoClase"
              @change="elegirCompetencia(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="item in clase.competencias" :key="item.codigo" :value="item.codigo">
                {{ item.nombre }}{{ cargandoClase ? '' : ` · ${calificados(item.codigo)}/${alumnos.length}` }}
              </option>
            </select>
            <small v-if="!cargandoClase && competencia">
              {{ calificados(competencia.codigo) }} de {{ alumnos.length }} alumnos calificados ·
              {{ clase.competencias.length }} {{ clase.competencias.length === 1 ? 'competencia' : 'competencias' }} en
              el curso
            </small>
          </div>

          <div v-if="bimestresClase.length" class="bimestres-clase" role="group" aria-label="Bimestre">
            <span class="bimestres-clase__etiqueta">Bimestre</span>
            <div class="bimestres-clase__chips">
              <button
                v-for="item in bimestresClase"
                :key="item.numero"
                type="button"
                :class="['chip-bimestre', { 'chip-bimestre--activo': item.numero === bimestreVisto }]"
                :aria-pressed="item.numero === bimestreVisto"
                :disabled="item.estado === 'PROXIMO' || cargandoClase"
                @click="verBimestre(item.numero)"
              >
                Bimestre {{ item.numero }} · {{ obtenerEtiquetaEstadoBimestre(item.estado).toLowerCase() }}
              </button>
            </div>
          </div>
          <AvisoMensaje
            v-if="bimestreCerrado && datosBimestreVisto"
            tipo="informacion"
            :mensaje="`Bimestre ${datosBimestreVisto.numero} cerrado${datosBimestreVisto.fechaCierre ? ` el ${formatearFecha(datosBimestreVisto.fechaCierre.slice(0, 10)).slice(0, 5)}` : ''}: las notas se muestran en solo lectura. Si hay un error, el administrador puede rectificarlo.`"
          />

          <p v-if="cargandoClase" class="docente-texto-secundario" role="status">Cargando alumnos y notas…</p>

          <template v-else>
            <div :class="['riesgo', { 'riesgo--sin': !enRiesgo.size }]" role="region" aria-label="Riesgo académico">
              <div class="riesgo__texto">
                <strong>
                  {{
                    (riesgoAcademico?.alumnosEnRiesgo ?? 0)
                      ? `${riesgoAcademico?.alumnosEnRiesgo} ${(riesgoAcademico?.alumnosEnRiesgo ?? 0) === 1 ? 'alumno en riesgo académico' : 'alumnos en riesgo académico'}`
                      : 'Ningún alumno en riesgo académico'
                  }}
                </strong>
                <span>
                  Acumulan más de {{ riesgoAcademico?.umbral ?? 1 }} notas C del bimestre
                  {{ riesgoAcademico?.bimestre ?? 'actual' }} en las competencias de {{ clase.areaNombre }}. Incluye
                  calificaciones manuales y parciales; no cuenta tardanzas ni inasistencias.
                </span>
              </div>
              <div class="riesgo__acciones">
                <button
                  type="button"
                  class="docente-boton docente-boton--secundario"
                  :aria-pressed="filtroNota === 'RIESGO'"
                  :disabled="!enRiesgo.size"
                  @click="alternarFiltro('RIESGO')"
                >
                  {{ filtroNota === 'RIESGO' ? 'Ver a todos' : 'Ver solo en riesgo' }}
                </button>
              </div>
            </div>

            <p id="ayuda-filtro" class="ayuda-filtro">
              Toca una nota para ver solo esos alumnos; tócala de nuevo para ver a todos.
            </p>
            <div class="resumen" role="group" aria-label="Filtrar por nota" aria-describedby="ayuda-filtro">
              <button
                v-for="opcion in NOTAS"
                :key="opcion.valor"
                type="button"
                :class="['kpi', `kpi--${opcion.valor}`]"
                :aria-pressed="filtroNota === opcion.valor"
                @click="alternarFiltro(opcion.valor)"
              >
                <strong>{{ conteo[opcion.valor] }}</strong>
                <span>{{ opcion.valor }} · {{ opcion.descripcion }}</span>
              </button>
              <button
                type="button"
                class="kpi kpi--SIN"
                :aria-pressed="filtroNota === 'SIN_NOTA'"
                @click="alternarFiltro('SIN_NOTA')"
              >
                <strong>{{ conteo.SIN_NOTA }}</strong>
                <span>Sin nota</span>
              </button>
            </div>

            <div class="herramientas">
              <label class="buscador">
                <span class="solo-lectores">Buscar alumno</span>
                <input v-model="busqueda" type="search" placeholder="Buscar por apellido, nombre o DNI" />
              </label>
              <span class="docente-texto-secundario">
                {{ alumnosFiltrados.length }} de {{ alumnos.length }} alumnos
                <template v-if="filtroNota">· filtro {{ textoFiltro(filtroNota) }}</template>
                <button v-if="filtroNota" type="button" class="enlace" @click="filtroNota = ''">Quitar filtro</button>
              </span>
            </div>

            <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />

            <p v-if="cargandoParciales" class="docente-texto-secundario" role="status">
              Consultando evaluaciones parciales…
            </p>

            <template v-else-if="modoParcial">
              <AvisoMensaje
                tipo="advertencia"
                :mensaje="`Esta competencia se calcula con las evaluaciones parciales del bimestre ${bimestreVisto} que definió el administrador (${ponderacionBimestre}). Califica cada evaluación; el logro del bimestre se obtiene automáticamente.`"
              />
              <div class="docente-tabla-contenedor tabla-desplazable">
                <table class="docente-tabla tabla-parciales">
                  <thead>
                    <tr>
                      <th scope="col">N.°</th>
                      <th scope="col">Alumno</th>
                      <th v-for="evaluacion in evaluacionesBimestre" :key="evaluacion.id" scope="col">
                        {{ evaluacion.titulo }}
                        <small class="columna-detalle">
                          {{ Number(evaluacion.ponderacion) }} %
                          <span v-if="evaluacion.tareaId" class="marca-tarea">Tarea</span>
                        </small>
                      </th>
                      <th scope="col">Logro del bimestre</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!alumnosFiltrados.length">
                      <td :colspan="evaluacionesBimestre.length + 3" class="docente-tabla__vacia">
                        {{ alumnos.length ? 'Ningún alumno coincide con el filtro.' : 'La sección no tiene alumnos.' }}
                      </td>
                    </tr>
                    <tr v-for="alumno in alumnosFiltrados" :key="alumno.matriculaId">
                      <td class="numero">{{ alumnos.indexOf(alumno) + 1 }}</td>
                      <td>
                        <strong class="nombre">{{ alumno.nombreCompleto }}</strong>
                        <small class="dni">DNI {{ alumno.dni }}</small>
                      </td>
                      <td v-for="evaluacion in evaluacionesBimestre" :key="evaluacion.id">
                        <button
                          v-if="notaParcial(evaluacion.id, alumno.matriculaId) || evaluacion.tareaId"
                          type="button"
                          class="celda-nota"
                          :disabled="bimestreCerrado"
                          :aria-label="`${evaluacion.titulo} de ${alumno.nombreCompleto}`"
                          @click="abrirParcial(evaluacion, alumno)"
                        >
                          {{
                            notaParcial(evaluacion.id, alumno.matriculaId)?.justificada
                              ? 'Just.'
                              : (notaParcial(evaluacion.id, alumno.matriculaId)?.nota ?? '—')
                          }}
                          <span
                            v-if="notaParcial(evaluacion.id, alumno.matriculaId)?.comentario"
                            title="Tiene comentario"
                            aria-hidden="true"
                            >💬</span
                          >
                        </button>
                        <button
                          v-else
                          type="button"
                          class="docente-boton boton-calificar"
                          :disabled="bimestreCerrado"
                          @click="abrirParcial(evaluacion, alumno)"
                        >
                          Calificar
                        </button>
                      </td>
                      <td>
                        <strong class="logro">{{ notaPorMatricula.get(alumno.matriculaId)?.nota ?? '—' }}</strong>
                        <small
                          v-if="notaPorMatricula.get(alumno.matriculaId) && porcentajeFaltante(alumno.matriculaId) > 0"
                          class="provisional"
                        >
                          provisional · faltan {{ porcentajeFaltante(alumno.matriculaId) }} %
                        </small>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="docente-texto-secundario nota-pie">
                Las columnas de tareas también se pueden calificar desde Tareas: es la misma nota. Mientras falten
                notas, el logro es provisional; al cerrar actas, las que faltan pasan a C.
              </p>
            </template>

            <div v-else class="docente-tabla-contenedor tabla-desplazable">
              <table class="docente-tabla">
                <thead>
                  <tr>
                    <th scope="col">N.°</th>
                    <th scope="col">Alumno</th>
                    <th scope="col">Nota</th>
                    <th scope="col">Evidencia</th>
                    <th scope="col">Registrada</th>
                    <th scope="col"><span class="solo-lectores">Acción</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!alumnosFiltrados.length">
                    <td colspan="6" class="docente-tabla__vacia">
                      {{ alumnos.length ? 'Ningún alumno coincide con el filtro.' : 'La sección no tiene alumnos.' }}
                    </td>
                  </tr>
                  <tr
                    v-for="alumno in alumnosFiltrados"
                    :key="alumno.matriculaId"
                    :class="{
                      'fila-riesgo': enRiesgo.has(alumno.matriculaId),
                      'fila-rectificada': matriculaResaltada === alumno.matriculaId,
                    }"
                  >
                    <td class="numero">{{ alumnos.indexOf(alumno) + 1 }}</td>
                    <td>
                      <strong class="nombre">{{ alumno.nombreCompleto }}</strong>
                      <small class="dni">DNI {{ alumno.dni }}</small>
                      <button
                        v-if="(notaPorMatricula.get(alumno.matriculaId)?.rectificaciones ?? 0) > 0"
                        type="button"
                        class="ver-historial solo-movil"
                        @click="verHistorial(alumno)"
                      >
                        {{ textoRectificada(notaPorMatricula.get(alumno.matriculaId)!.rectificaciones) }}
                      </button>
                      <span v-if="enRiesgo.has(alumno.matriculaId)" class="marca-riesgo">
                        En riesgo · {{ riesgoPorMatricula.get(alumno.matriculaId)?.notasC ?? 0 }} C
                      </span>
                    </td>
                    <template v-if="notaPorMatricula.get(alumno.matriculaId)">
                      <td>
                        <span :class="['chip', `chip--${notaPorMatricula.get(alumno.matriculaId)!.nota}`]">
                          {{ notaPorMatricula.get(alumno.matriculaId)!.nota }}
                        </span>
                      </td>
                      <td>
                        <a
                          v-if="notaPorMatricula.get(alumno.matriculaId)!.evidenciaTipo === 'URL'"
                          class="enlace"
                          :href="notaPorMatricula.get(alumno.matriculaId)!.evidenciaUrl ?? undefined"
                          target="_blank"
                          rel="noopener noreferrer"
                          >Enlace</a
                        >
                        <button
                          v-else
                          type="button"
                          class="enlace"
                          @click="descargar(notaPorMatricula.get(alumno.matriculaId)!)"
                        >
                          {{ notaPorMatricula.get(alumno.matriculaId)!.evidenciaNombre || 'Archivo' }}
                        </button>
                      </td>
                      <td class="fecha">
                        {{ formatearFecha(notaPorMatricula.get(alumno.matriculaId)!.fechaRegistro.slice(0, 10)) }}
                        <button
                          v-if="notaPorMatricula.get(alumno.matriculaId)!.rectificaciones > 0"
                          type="button"
                          class="ver-historial"
                          @click="verHistorial(alumno)"
                        >
                          {{ textoRectificada(notaPorMatricula.get(alumno.matriculaId)!.rectificaciones) }}
                        </button>
                      </td>
                    </template>
                    <template v-else>
                      <td><span class="chip chip--vacio">Sin nota</span></td>
                      <td class="tenue">—</td>
                      <td class="tenue">—</td>
                    </template>
                    <td class="accion">
                      <span
                        v-if="notaPorMatricula.get(alumno.matriculaId)?.consolidada"
                        class="tenue"
                        title="La nota se calcula a partir de las evaluaciones parciales"
                        >Calculada</span
                      >
                      <button
                        v-else
                        type="button"
                        :class="[
                          'docente-boton',
                          { 'docente-boton--secundario': notaPorMatricula.has(alumno.matriculaId) },
                        ]"
                        :disabled="bimestreCerrado"
                        @click="abrir(alumno)"
                      >
                        {{ notaPorMatricula.has(alumno.matriculaId) ? 'Rectificar' : 'Registrar' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>
      </section>
    </template>

    <ModalCalificacion
      v-if="clase && competencia"
      :abierta="modalAbierto"
      :alumno="alumnoEnEdicion"
      :contexto="contexto"
      :periodo-id="clase.periodoId"
      :bimestre="bimestreVisto"
      :competencia-codigo="competencia.codigo"
      :actual="null"
      :hay-siguiente="haySiguiente"
      @cerrar="modalAbierto = false"
      @guardada="alGuardar"
    />

    <ModalRectificarCalificacion
      v-if="clase && competencia"
      :abierta="rectificacionAbierta"
      :alumno="alumnoEnEdicion"
      :contexto="contexto"
      :periodo-id="clase.periodoId"
      :bimestre="bimestreVisto"
      :competencia-codigo="competencia.codigo"
      :actual="alumnoEnEdicion ? (notaPorMatricula.get(alumnoEnEdicion.matriculaId) ?? null) : null"
      @cerrar="rectificacionAbierta = false"
      @guardada="alRectificar"
    />

    <ModalNotaParcial
      v-if="ventanaParcial"
      :abierta="Boolean(ventanaParcial)"
      :titulo="`Calificar · ${ventanaParcial.evaluacion.titulo}`"
      :descripcion="`${ventanaParcial.alumno.nombreCompleto} · ${competencia?.nombre ?? ''} · bimestre ${ventanaParcial.evaluacion.bimestre} · ${Number(ventanaParcial.evaluacion.ponderacion)} %`"
      :evaluacion-id="ventanaParcial.evaluacion.id"
      :matricula-id="ventanaParcial.alumno.matriculaId"
      :tarea-id="ventanaParcial.evaluacion.tareaId ?? null"
      :actual="notaParcial(ventanaParcial.evaluacion.id, ventanaParcial.alumno.matriculaId)"
      @cerrar="ventanaParcial = null"
      @guardada="alGuardarParcial"
    />

    <ModalHistorialCalificacion
      v-if="clase && competencia"
      :abierta="historialAbierto"
      :alumno="alumnoEnEdicion"
      :contexto="contexto"
      :bimestre="bimestreVisto"
      :actual="alumnoEnEdicion ? (notaPorMatricula.get(alumnoEnEdicion.matriculaId) ?? null) : null"
      @cerrar="historialAbierto = false"
      @rectificar="rectificarDesdeHistorial"
    />
  </main>
</template>

<style scoped>
.acciones-notas {
  display: flex;
  align-items: center;
  gap: 8px;
}
.entrada-csv {
  display: none;
}
.bimestres-clase {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.bimestres-clase__etiqueta {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.bimestres-clase__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip-bimestre {
  padding: 6px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 999px;
  background: white;
  color: #434655;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.chip-bimestre--activo {
  border-color: #004ac6;
  background: #004ac6;
  color: white;
}

.chip-bimestre:disabled {
  background: #f2f4f6;
  color: #94a3b8;
  cursor: not-allowed;
}
.tabla-parciales th {
  vertical-align: bottom;
}

.columna-detalle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  color: #64748b;
  font-size: 11.5px;
  font-weight: 500;
}

.marca-tarea {
  padding: 1px 8px;
  border-radius: 999px;
  background: #ede9fe;
  color: #5b21b6;
  font-size: 11px;
  font-weight: 700;
}

.celda-nota {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 44px;
  justify-content: center;
  padding: 4px 10px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #0f172a;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.celda-nota:hover {
  border-color: #004ac6;
  background: #eff6ff;
}

.celda-nota:focus-visible {
  outline: 3px solid #93c5fd;
  outline-offset: 2px;
}

.boton-calificar {
  padding: 6px 12px;
  font-size: 13px;
}

.logro {
  font-size: 15px;
}

.provisional {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.nota-pie {
  margin: 8px 0 0;
  font-size: 12.5px;
}

.selector {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.fila {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}

.etiqueta {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pastillas,
.secciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pastilla {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.contador {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  border-radius: 999px;
  background: #e2e8f0;
  font-size: 12px;
}

.pastilla[aria-pressed='true'] {
  border-color: #1e40af;
  background: #1e40af;
  color: #fff;
}

.pastilla[aria-pressed='true'] .contador {
  background: rgb(255 255 255 / 0.22);
}

.seccion {
  display: flex;
  min-width: 92px;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #fff;
  color: #0f172a;
  cursor: pointer;
}

.seccion strong {
  font-size: 16px;
}

.seccion small {
  color: #64748b;
  font-size: 12px;
}

.seccion[aria-pressed='true'] {
  border-color: #1e40af;
  background: #eaf1ff;
  box-shadow: inset 0 0 0 1px #1e40af;
}

.pastilla:focus-visible,
.seccion:focus-visible,
.kpi:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.competencia-filtro {
  display: flex;
  max-width: 640px;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0 18px;
}

.competencia-filtro label {
  color: #0f172a;
  font-size: 14px;
  font-weight: 600;
}

.competencia-filtro select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #0f172a;
  font: inherit;
  font-size: 14px;
}

.competencia-filtro select:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.competencia-filtro small,
.ayuda-filtro {
  color: #64748b;
  font-size: 12px;
}

.ayuda-filtro {
  margin: 0 0 8px;
}

.resumen {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.kpi {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-left-width: 4px;
  border-radius: 10px;
  background: #fff;
  color: #0f172a;
  text-align: left;
  cursor: pointer;
}

.kpi strong {
  font-size: 22px;
}

.kpi span {
  color: #64748b;
  font-size: 12px;
}

.kpi--AD {
  border-left-color: #047857;
}

.kpi--A {
  border-left-color: #1d4ed8;
}

.kpi--B {
  border-left-color: #b45309;
}

.kpi--C {
  border-left-color: #b91c1c;
}

.riesgo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 20px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid #fecaca;
  border-left: 4px solid #b91c1c;
  border-radius: 10px;
  background: #fef2f2;
}

.riesgo--sin {
  border-color: #e2e8f0;
  border-left-color: #94a3b8;
  background: #f8fafc;
}

.riesgo__texto {
  display: flex;
  min-width: 240px;
  flex: 1 1 320px;
  flex-direction: column;
  gap: 2px;
}

.riesgo__texto strong {
  color: #7f1d1d;
  font-size: 15px;
}

.riesgo--sin .riesgo__texto strong {
  color: #334155;
}

.riesgo__texto span {
  color: #475569;
  font-size: 12px;
}

.riesgo__acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.riesgo__acciones label {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.riesgo__acciones select {
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  font: inherit;
  font-size: 13px;
}

.riesgo__acciones .docente-boton[aria-pressed='true'] {
  border-color: #b91c1c;
  color: #b91c1c;
}

.fila-riesgo td {
  background: #fff7f7;
}

.fila-riesgo td:first-child {
  box-shadow: inset 3px 0 0 #b91c1c;
}

.docente-tabla tr td {
  transition: background-color 0.6s ease;
}

.fila-rectificada td {
  background: #f0fdf4;
}

.fila-rectificada td:first-child {
  box-shadow: inset 4px 0 0 #16a34a;
}

.ver-historial {
  display: block;
  margin-top: 3px;
  padding: 0;
  border: 0;
  background: none;
  color: #1e40af;
  font: inherit;
  font-size: 12px;
  text-align: left;
  text-decoration: underline;
  cursor: pointer;
}

.ver-historial:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.solo-movil {
  display: none;
}

.marca-riesgo {
  display: inline-block;
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 11px;
  font-weight: 700;
}

.kpi--SIN {
  border-left-color: #94a3b8;
}

.kpi:hover {
  background: #f8fafc;
}

.kpi[aria-pressed='true'] {
  background: #eaf1ff;
  box-shadow: inset 0 0 0 2px #1e40af;
}

.herramientas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.buscador {
  flex: 1 1 260px;
  max-width: 380px;
}

.buscador input {
  width: 100%;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: #1e40af;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

.herramientas .enlace {
  margin-left: 8px;
}

.tabla-desplazable {
  position: relative;
}

.docente-tabla td {
  padding: 12px;
  vertical-align: middle;
}

.numero {
  width: 48px;
  color: #64748b;
}

.nombre {
  display: block;
  color: #0f172a;
}

.dni,
.tenue,
.fecha {
  color: #64748b;
  font-size: 12px;
}

.accion {
  text-align: right;
}

.accion .docente-boton {
  min-height: 34px;
  padding: 6px 14px;
}

.chip {
  display: inline-grid;
  white-space: nowrap;
  min-width: 38px;
  padding: 4px 10px;
  place-items: center;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.chip--AD {
  background: #d1fae5;
  color: #065f46;
}

.chip--A {
  background: #dbeafe;
  color: #1e3a8a;
}

.chip--B {
  background: #fef3c7;
  color: #92400e;
}

.chip--C {
  background: #fee2e2;
  color: #991b1b;
}

.chip--vacio {
  background: #f1f5f9;
  color: #64748b;
  font-weight: 600;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 760px) {
  .fila {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .resumen {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .docente-tabla :is(th, td):is(:nth-child(1), :nth-child(4), :nth-child(5)):not(.docente-tabla__vacia) {
    display: none;
  }

  .solo-movil {
    display: block;
  }
}
</style>
