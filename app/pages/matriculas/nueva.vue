<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type {
  ErrorConfirmacionMatricula,
  EstudianteMatriculable,
  IncidenciaConfirmacionMatricula,
} from '~/types/matricula'
import type { SolicitudCompromisoPago } from '~/types/compromisoPago'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useEstudiantesMatriculables } from '~/composables/useEstudiantesMatriculables'
import { useMatriculas } from '~/composables/useMatriculas'
import { obtenerAnhio } from '~/composables/useAnhioEscolar'
import { usePeriodoMatricula } from '~/composables/usePeriodoMatricula'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { ErrorSolicitudApi } from '~/types/api'

definePageMeta({ middleware: 'autenticacion' })

const { listar } = useEstudiantesMatriculables()
const { listarPorAnhio } = usePeriodosAcademicos()
const { obtenerPeriodoVigente } = usePeriodoMatricula()
const { registrarMasivamente, retirar, confirmarMasivamente } = useMatriculas()

const estudiantes = ref<EstudianteMatriculable[]>([])
const periodos = ref<PeriodoAcademico[]>([])
const ventanaVigente = ref<Awaited<ReturnType<typeof obtenerPeriodoVigente>>>(null)
const periodoId = ref<number | null>(null)
const gradoSeleccionado = ref(1)
const busquedaEstudiante = ref('')
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
const aviso = ref('')
const avisoSeleccion = ref('')
const confirmacionExitosa = ref(false)
const modalCompromisoAbierto = ref(false)
const errorCompromiso = ref('')
const incidenciasCompromiso = ref<IncidenciaConfirmacionMatricula[]>([])
const seleccionPendientes = ref<number[]>([])
const estudiantesSeleccionados = ref<number[]>([])

const anhioMatricula = computed(() => (ventanaVigente.value ? obtenerAnhio(ventanaVigente.value.fechaLimite) : null))
const grados = computed(() => [...new Set(periodos.value.map((periodo) => periodo.numeroGrado))].sort((a, b) => a - b))
const periodosDelGrado = computed(() =>
  periodos.value.filter((periodo) => periodo.numeroGrado === gradoSeleccionado.value),
)
const periodoSeleccionado = computed(() =>
  periodosDelGrado.value.find((periodo) => periodo.periodoId === periodoId.value),
)
const idsPeriodosDelAnhio = computed(() => new Set(periodos.value.map((periodo) => periodo.periodoId)))
// Un estudiante con matrícula activa en cualquier sección del año ya no está disponible: el back no impide dos secciones.
const estudiantesDisponibles = computed(() => {
  if (!periodoSeleccionado.value) return []

  return estudiantes.value.filter(
    (estudiante) =>
      !estudiante.matriculas.some(
        (matricula) => idsPeriodosDelAnhio.value.has(matricula.periodoId) && matricula.estado !== 'RETIRADA',
      ),
  )
})
const pendientesDeConfirmacion = computed(() => {
  if (!periodoSeleccionado.value) return []
  return estudiantes.value.filter((e) =>
    e.matriculas.some((m) => m.periodoId === periodoSeleccionado.value!.periodoId && m.estado === 'EN_REGISTRO'),
  )
})
const todosPendientesSeleccionados = computed(
  () =>
    pendientesDeConfirmacion.value.length > 0 &&
    pendientesDeConfirmacion.value.every((estudiante) => seleccionPendientes.value.includes(estudiante.estudianteId)),
)

const estudiantesAgregados = computed(() =>
  estudiantesSeleccionados.value
    .map((id) => estudiantesDisponibles.value.find((estudiante) => estudiante.estudianteId === id))
    .filter((estudiante): estudiante is EstudianteMatriculable => Boolean(estudiante)),
)
const resultadosBusqueda = computed(() => {
  const termino = busquedaEstudiante.value.trim().toLocaleLowerCase()
  if (termino.length < 2) return []
  return estudiantesDisponibles.value
    .filter((estudiante) => !estudiantesSeleccionados.value.includes(estudiante.estudianteId))
    .filter((estudiante) => `${nombreCompleto(estudiante)} ${estudiante.dni}`.toLocaleLowerCase().includes(termino))
    .slice(0, 8)
})

const vacantesDisponibles = computed(() => periodoSeleccionado.value?.vacantesDisponibles ?? 0)
const capacidadMaxima = computed(() => periodoSeleccionado.value?.vacantesTotales ?? 0)
const matriculados = computed(() => periodoSeleccionado.value?.matriculasActivas ?? 0)
const ocupacion = computed(() =>
  capacidadMaxima.value > 0 ? Math.min(100, Math.round((matriculados.value / capacidadMaxima.value) * 100)) : 0,
)

watch(periodoId, () => {
  seleccionPendientes.value = []
  incidenciasCompromiso.value = []
  estudiantesSeleccionados.value = []
  busquedaEstudiante.value = ''
  avisoSeleccion.value = ''
})
watch(
  seleccionPendientes,
  () => {
    incidenciasCompromiso.value = []
  },
  { deep: true },
)
watch(gradoSeleccionado, () => {
  const siguientePeriodo =
    periodosDelGrado.value.find((periodo) => periodo.vacantesDisponibles > 0) ?? periodosDelGrado.value[0]
  periodoId.value = siguientePeriodo?.periodoId ?? null
})
const maximoSeleccion = computed(() => Math.min(vacantesDisponibles.value, estudiantesDisponibles.value.length))
const disponiblesSinAgregar = computed(() =>
  estudiantesDisponibles.value.filter(
    (estudiante) => !estudiantesSeleccionados.value.includes(estudiante.estudianteId),
  ),
)
const seccionCorta = computed(() =>
  periodoSeleccionado.value ? `${periodoSeleccionado.value.numeroGrado}.° ${periodoSeleccionado.value.seccion}` : '',
)
const destinoConfirmacion = computed(() =>
  periodoSeleccionado.value
    ? `${periodoSeleccionado.value.numeroGrado}.° ${periodoSeleccionado.value.seccion} · año escolar ${anhioMatricula.value ?? ''}`
    : '',
)

const estadoCupos = computed(() => {
  if (!periodoSeleccionado.value) return 'sin-datos'
  if (vacantesDisponibles.value === 0) return 'agotado'
  if (vacantesDisponibles.value <= 2) return 'limitado'
  return 'disponible'
})

const etiquetaEstado = computed(() => {
  if (estadoCupos.value === 'agotado') return 'Sin vacantes'
  if (estadoCupos.value === 'limitado') return 'Pocos cupos'
  if (estadoCupos.value === 'disponible') return 'Disponible'
  return 'Sin datos'
})

const mensajeCupos = computed(() => {
  if (!periodoSeleccionado.value) return 'No hay periodos académicos disponibles para seleccionar.'
  if (vacantesDisponibles.value === 0) {
    return 'Esta sección no dispone de vacantes. Selecciona otra sección.'
  }
  if (vacantesDisponibles.value <= 2) {
    return `Sección próxima a completarse. Quedan ${vacantesDisponibles.value} vacantes.`
  }
  return `Hay ${vacantesDisponibles.value} vacantes disponibles en esta sección.`
})

const nombreCompleto = (estudiante: EstudianteMatriculable) =>
  [estudiante.nombre, estudiante.apellidoPaterno, estudiante.apellidoMaterno].filter(Boolean).join(' ')

function agregarEstudiante(estudiante: EstudianteMatriculable): void {
  if (estudiantesSeleccionados.value.length >= maximoSeleccion.value) return
  estudiantesSeleccionados.value.push(estudiante.estudianteId)
  busquedaEstudiante.value = ''
}

function quitarEstudiante(id: number): void {
  estudiantesSeleccionados.value = estudiantesSeleccionados.value.filter((seleccionado) => seleccionado !== id)
  avisoSeleccion.value = ''
}

function agregarTodosDisponibles(): void {
  const espacio = maximoSeleccion.value - estudiantesSeleccionados.value.length
  const candidatos = disponiblesSinAgregar.value
  const agregados = candidatos.slice(0, Math.max(0, espacio))

  estudiantesSeleccionados.value.push(...agregados.map((estudiante) => estudiante.estudianteId))
  busquedaEstudiante.value = ''

  const fuera = candidatos.length - agregados.length
  avisoSeleccion.value =
    fuera > 0
      ? `Se agregaron ${agregados.length} hasta completar las vacantes. ${fuera === 1 ? 'Quedó 1 estudiante disponible' : `Quedaron ${fuera} estudiantes disponibles`} fuera de esta sección: matricúlalos en otra.`
      : ''
}

function quitarTodos(): void {
  estudiantesSeleccionados.value = []
  avisoSeleccion.value = ''
}

function alternarSeleccionPendientes(): void {
  seleccionPendientes.value = todosPendientesSeleccionados.value
    ? []
    : pendientesDeConfirmacion.value.map((estudiante) => estudiante.estudianteId)
}

async function retirarPendiente(estudiante: EstudianteMatriculable): Promise<void> {
  const periodo = periodoSeleccionado.value
  if (!periodo || guardando.value) return

  const nombre = nombreCompleto(estudiante)
  const mensaje = `¿Retirar la matrícula pendiente de ${nombre}? El estudiante volverá a estar disponible para matricularse.`
  if (!window.confirm(mensaje)) {
    return
  }

  guardando.value = true
  error.value = ''
  aviso.value = ''
  try {
    await retirar(periodo.periodoId, estudiante.estudianteId)
    seleccionPendientes.value = seleccionPendientes.value.filter((id) => id !== estudiante.estudianteId)
    await cargarDatos()
    aviso.value = `Se retiró la matrícula pendiente de ${nombre}. El estudiante volvió a estar disponible.`
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, `No se pudo retirar la matrícula pendiente de ${nombre}.`)
  } finally {
    guardando.value = false
  }
}

async function cargarDatos(): Promise<void> {
  cargando.value = true
  error.value = ''
  aviso.value = ''
  confirmacionExitosa.value = false

  try {
    const vigente = await obtenerPeriodoVigente()
    ventanaVigente.value = vigente
    if (!vigente) {
      estudiantes.value = []
      periodos.value = []
      gradoSeleccionado.value = 1
      periodoId.value = null
      return
    }

    const [estudiantesCargados, periodosCargados] = await Promise.all([
      listar(),
      listarPorAnhio(obtenerAnhio(vigente.fechaLimite)),
    ])
    estudiantes.value = estudiantesCargados
    periodos.value = periodosCargados
    gradoSeleccionado.value = periodosCargados.some((periodo) => periodo.numeroGrado === 1)
      ? 1
      : Math.min(...periodosCargados.map((periodo) => periodo.numeroGrado))
    const periodosPrimerGrado = periodosCargados.filter((periodo) => periodo.numeroGrado === gradoSeleccionado.value)
    periodoId.value =
      (periodosPrimerGrado.find((periodo) => periodo.vacantesDisponibles > 0) ?? periodosPrimerGrado[0])?.periodoId ??
      null
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar estudiantes y vacantes.')
  } finally {
    cargando.value = false
  }
}

async function registrarSeleccion(): Promise<void> {
  if (
    !periodoSeleccionado.value ||
    estudiantesSeleccionados.value.length === 0 ||
    estudiantesSeleccionados.value.length > vacantesDisponibles.value
  )
    return
  guardando.value = true
  error.value = ''
  aviso.value = ''
  avisoSeleccion.value = ''
  confirmacionExitosa.value = false
  try {
    const resultados = await registrarMasivamente(periodoSeleccionado.value.periodoId, estudiantesSeleccionados.value)
    estudiantesSeleccionados.value = []
    await cargarDatos()
    aviso.value = `Se registraron ${resultados.length} matrículas en la sección seleccionada; quedan pendientes de confirmación.`
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron registrar las matrículas seleccionadas.')
  } finally {
    guardando.value = false
  }
}

function abrirCompromiso(): void {
  if (!periodoSeleccionado.value || seleccionPendientes.value.length === 0) return
  errorCompromiso.value = ''
  modalCompromisoAbierto.value = true
}

async function confirmarSeleccion(compromiso: SolicitudCompromisoPago): Promise<void> {
  if (!periodoSeleccionado.value || seleccionPendientes.value.length === 0) return
  guardando.value = true
  error.value = ''
  errorCompromiso.value = ''
  incidenciasCompromiso.value = []
  try {
    const resultados = await confirmarMasivamente(
      periodoSeleccionado.value.periodoId,
      seleccionPendientes.value,
      compromiso,
    )
    modalCompromisoAbierto.value = false
    seleccionPendientes.value = []
    incidenciasCompromiso.value = []
    await cargarDatos()
    aviso.value =
      resultados.length === 1
        ? `Se confirmó 1 matrícula. Se creó su compromiso "${compromiso.concepto}" y la primera boleta.`
        : `Se confirmaron ${resultados.length} matrículas. Se creó el compromiso "${compromiso.concepto}" y la primera boleta de cada estudiante.`
    confirmacionExitosa.value = true
  } catch (fallo: unknown) {
    if (fallo instanceof ErrorSolicitudApi && fallo.datos && typeof fallo.datos === 'object') {
      const respuesta = fallo.datos as Partial<ErrorConfirmacionMatricula>
      if (Array.isArray(respuesta.incidencias)) {
        incidenciasCompromiso.value = respuesta.incidencias as IncidenciaConfirmacionMatricula[]
      }
    }
    errorCompromiso.value = obtenerMensajeError(
      fallo,
      'No se pudieron confirmar las matrículas. Ninguna fue confirmada; revisa los datos e inténtalo nuevamente.',
    )
  } finally {
    guardando.value = false
  }
}

async function cancelar(): Promise<void> {
  await navigateTo('/matriculas')
}

onMounted(cargarDatos)
</script>

<template>
  <main class="pagina-matricula">
    <header class="encabezado-pagina">
      <div>
        <h1>Crear Matrícula</h1>
        <p>Elige la sección, agrega estudiantes y confirma sus matrículas.</p>
      </div>
      <span class="etiqueta-anhio">Año escolar {{ anhioMatricula ?? '—' }}</span>
    </header>

    <section class="tarjeta" aria-labelledby="titulo-parametros">
      <div class="encabezado-tarjeta">
        <h2 id="titulo-parametros"><span class="numero-paso" aria-hidden="true">1</span>Destino de la matrícula</h2>
        <p>Los estudiantes que agregues irán a esta sección.</p>
      </div>

      <div class="contenido-tarjeta">
        <div class="cuadricula-campos">
          <div class="campo">
            <label for="anhio-academico">Año Académico</label>
            <input
              id="anhio-academico"
              :value="anhioMatricula ?? ''"
              type="text"
              readonly
              aria-describedby="ayuda-anhio"
            />
            <small id="ayuda-anhio">Año de la ventana de matrícula vigente.</small>
          </div>
          <div class="campo">
            <label for="grado-matricula">Grado</label>
            <select id="grado-matricula" v-model.number="gradoSeleccionado">
              <option v-for="grado in grados" :key="grado" :value="grado">{{ grado }}.° de secundaria</option>
            </select>
          </div>
          <div class="campo">
            <label for="seccion-matricula">Sección</label>
            <select id="seccion-matricula" v-model.number="periodoId">
              <option v-for="periodo in periodosDelGrado" :key="periodo.periodoId" :value="periodo.periodoId">
                Sección {{ periodo.seccion }}
              </option>
            </select>
          </div>
        </div>

        <div class="panel-vacantes">
          <span class="etiqueta-estado" :class="estadoCupos">{{ etiquetaEstado }}</span>
          <div
            class="barra-progreso"
            role="progressbar"
            :aria-valuenow="ocupacion"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Ocupación de ${seccionCorta}`"
          >
            <div class="avance-progreso" :class="estadoCupos" :style="{ width: `${ocupacion}%` }" />
          </div>
          <p class="resumen-cupos" role="status" aria-live="polite">
            <strong>{{ matriculados }}</strong> de {{ capacidadMaxima }} matriculados ·
            <strong>{{ vacantesDisponibles }}</strong> vacantes
          </p>
          <p v-if="estadoCupos !== 'disponible'" class="mensaje-disponibilidad" :class="estadoCupos">
            {{ mensajeCupos }}
          </p>
        </div>
      </div>
    </section>

    <section class="tarjeta" aria-labelledby="titulo-estudiante">
      <div class="encabezado-tarjeta">
        <h2 id="titulo-estudiante">
          <span class="numero-paso" aria-hidden="true">2</span>Estudiantes para {{ seccionCorta || 'la sección' }}
        </h2>
        <p>Busca por nombre, apellido o DNI, o agrega a todos los disponibles hasta completar las vacantes.</p>
      </div>

      <div v-if="!cargando" class="contenido-tarjeta">
        <div v-if="periodoSeleccionado" class="selector-estudiantes">
          <div class="encabezado-seleccion">
            <label for="buscar-estudiante">Nombre, apellido o DNI</label>
            <span>{{ estudiantesSeleccionados.length }} seleccionados · {{ vacantesDisponibles }} vacantes</span>
          </div>
          <div class="fila-busqueda">
            <input
              id="buscar-estudiante"
              v-model="busquedaEstudiante"
              type="search"
              autocomplete="off"
              placeholder="Escribe al menos 2 caracteres"
            />
            <button
              type="button"
              class="boton-agregar-todos"
              :disabled="
                guardando || !disponiblesSinAgregar.length || estudiantesSeleccionados.length >= maximoSeleccion
              "
              @click="agregarTodosDisponibles"
            >
              + Agregar todos los disponibles ({{ disponiblesSinAgregar.length }})
            </button>
          </div>
          <NuxtLink to="/estudiantes/nuevo" class="enlace-registro"
            >¿No lo encuentras? Registrar nuevo estudiante →</NuxtLink
          >
          <AvisoMensaje v-if="avisoSeleccion" :mensaje="avisoSeleccion" tipo="advertencia" />
          <p v-if="vacantesDisponibles === 0" class="aviso-neutral">La sección no tiene vacantes disponibles.</p>
          <ul v-else-if="resultadosBusqueda.length" class="resultados-busqueda">
            <li v-for="estudiante in resultadosBusqueda" :key="estudiante.estudianteId">
              <span>{{ nombreCompleto(estudiante) }} — DNI {{ estudiante.dni }}</span>
              <button
                type="button"
                class="boton-agregar"
                :disabled="estudiantesSeleccionados.length >= maximoSeleccion"
                @click="agregarEstudiante(estudiante)"
              >
                Agregar
              </button>
            </li>
          </ul>
          <p v-else-if="busquedaEstudiante.trim().length >= 2" class="aviso-neutral">
            No hay estudiantes disponibles que coincidan con la búsqueda.
          </p>
          <p v-else class="aviso-neutral">Escribe un nombre o DNI para buscar entre los estudiantes disponibles.</p>

          <div class="lista-seleccion-estudiantes">
            <div class="encabezado-lista">
              <strong>Estudiantes seleccionados</strong>
              <button v-if="estudiantesAgregados.length" type="button" class="boton-quitar" @click="quitarTodos">
                Quitar todos
              </button>
            </div>
            <p v-if="!estudiantesAgregados.length" class="aviso-neutral">Aún no agregaste estudiantes.</p>
            <ul v-else>
              <li v-for="estudiante in estudiantesAgregados" :key="estudiante.estudianteId">
                <span>{{ nombreCompleto(estudiante) }} — DNI {{ estudiante.dni }}</span>
                <button
                  type="button"
                  class="boton-quitar"
                  :aria-label="`Quitar a ${nombreCompleto(estudiante)}`"
                  @click="quitarEstudiante(estudiante.estudianteId)"
                >
                  Quitar
                </button>
              </li>
            </ul>
            <button
              type="button"
              class="boton-confirmar"
              :disabled="guardando || !estudiantesSeleccionados.length"
              @click="registrarSeleccion"
            >
              {{ guardando ? 'Registrando...' : `Registrar seleccionados (${estudiantesSeleccionados.length})` }}
            </button>
          </div>
        </div>
        <p v-else class="aviso-neutral">No hay secciones registradas para el grado seleccionado.</p>
      </div>
    </section>

    <PanelEstadoCarga v-if="cargando" :cargando="true" texto-carga="Cargando estudiantes y vacantes..." />
    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <IncidenciasMatricula :incidencias="incidenciasCompromiso" />
    <div v-if="aviso" class="aviso-exito">
      <AvisoMensaje :mensaje="aviso" tipo="exito" />
      <NuxtLink v-if="confirmacionExitosa" to="/finanzas" class="enlace-finanzas">Ver boletas en Finanzas →</NuxtLink>
    </div>
    <section v-if="pendientesDeConfirmacion.length" class="tarjeta" aria-labelledby="titulo-pendientes">
      <div class="encabezado-tarjeta">
        <h2 id="titulo-pendientes">
          <span class="numero-paso" aria-hidden="true">3</span>Pendientes de confirmación en
          {{ seccionCorta || 'la sección' }}
        </h2>
      </div>
      <div class="contenido-tarjeta">
        <p class="ayuda-pendientes">
          Al confirmar se definen los términos del compromiso de pago y se emite la primera boleta.
        </p>
        <button type="button" class="boton-agregar" :disabled="guardando" @click="alternarSeleccionPendientes">
          {{ todosPendientesSeleccionados ? 'Quitar selección' : 'Seleccionar todos' }}
        </button>
        <div v-for="estudiante in pendientesDeConfirmacion" :key="estudiante.estudianteId" class="fila-pendiente">
          <label class="seleccion-pendiente">
            <input
              v-model="seleccionPendientes"
              type="checkbox"
              :value="estudiante.estudianteId"
              :disabled="guardando"
            />
            {{ nombreCompleto(estudiante) }} — DNI {{ estudiante.dni }}
          </label>
          <button
            type="button"
            class="boton-quitar"
            :disabled="guardando"
            :aria-label="`Retirar matrícula pendiente de ${nombreCompleto(estudiante)}`"
            @click="retirarPendiente(estudiante)"
          >
            {{ guardando ? 'Procesando…' : 'Retirar' }}
          </button>
        </div>
        <button
          type="button"
          class="boton-confirmar"
          :disabled="guardando || !seleccionPendientes.length"
          @click="abrirCompromiso"
        >
          Confirmar seleccionadas ({{ seleccionPendientes.length }})…
        </button>
      </div>
    </section>
    <AvisoMensaje
      v-if="!cargando && !ventanaVigente"
      mensaje="No hay un periodo de matrícula vigente. Configura uno antes de registrar matrículas."
      tipo="advertencia"
    />
    <AvisoMensaje
      v-if="!cargando && ventanaVigente && periodos.length === 0"
      mensaje="No hay periodos académicos abiertos para el año de matrícula vigente."
      tipo="advertencia"
    />

    <div class="acciones-matricula">
      <button type="button" class="boton-cancelar" @click="cancelar">Cancelar</button>
    </div>

    <ModalCompromisoPago
      v-if="anhioMatricula"
      :abierta="modalCompromisoAbierto"
      :cantidad="seleccionPendientes.length"
      :anhio-escolar="anhioMatricula"
      :destino="destinoConfirmacion"
      :procesando="guardando"
      :error="errorCompromiso"
      :incidencias="incidenciasCompromiso"
      @confirmar="confirmarSeleccion"
      @cerrar="modalCompromisoAbierto = false"
    />
  </main>
</template>

<style scoped>
.pagina-matricula {
  display: flex;
  width: 100%;
  max-width: 1000px;
  flex-direction: column;
  gap: 24px;
  margin: 0 auto;
  padding: 32px;
}
.seleccion-pendiente {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}
.fila-pendiente {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e2e5ef;
}
.lista-seleccion-estudiantes {
  display: grid;
  gap: 4px;
  margin-top: 20px;
  padding: 16px;
  border: 1px solid #c3c6d7;
  border-radius: 10px;
}
.encabezado-seleccion,
.encabezado-lista {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.fila-busqueda {
  display: flex;
  gap: 12px;
}
.fila-busqueda input {
  min-width: 0;
  min-height: 44px;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font-size: 14px;
}
.fila-busqueda input:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}
.lista-seleccion-estudiantes ul {
  max-height: 320px;
  overflow: auto;
}
.boton-agregar-todos {
  flex-shrink: 0;
  padding: 0 14px;
  border: 1px solid #004ac6;
  border-radius: 8px;
  background: white;
  color: #004ac6;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.boton-agregar-todos:disabled {
  border-color: #c3c6d7;
  color: #7a7d8a;
  cursor: not-allowed;
}
.aviso-exito {
  display: grid;
  gap: 8px;
}
.enlace-finanzas {
  justify-self: start;
  color: #004ac6;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}
.enlace-finanzas:hover {
  text-decoration: underline;
}
.ayuda-pendientes {
  margin: 0 0 8px;
  color: #434655;
  font-size: 14px;
}
.selector-estudiantes {
  display: grid;
  gap: 10px;
  margin-top: 20px;
}
.resultados-busqueda,
.lista-seleccion-estudiantes ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.resultados-busqueda li,
.lista-seleccion-estudiantes li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #e2e5ef;
}
.boton-agregar,
.boton-quitar {
  border: 0;
  background: transparent;
  color: #004ac6;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.boton-agregar:disabled {
  color: #7a7d8a;
  cursor: not-allowed;
}
.boton-quitar:disabled {
  color: #7a7d8a;
  cursor: not-allowed;
}
.encabezado-pagina,
.nombre-estudiante,
.acciones-matricula {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.encabezado-pagina h1 {
  margin: 0 0 6px;
  color: #191c1e;
  font-size: 28px;
}
.encabezado-pagina p,
.datos-estudiante p {
  margin: 0;
  color: #434655;
  font-size: 14px;
}
.etiqueta-anhio {
  padding: 7px 12px;
  border-radius: 20px;
  background: #eef2ff;
  color: #1e40af;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.tarjeta {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}
.encabezado-tarjeta {
  margin: 0 24px;
  padding: 20px 0 16px;
  border-bottom: 1px solid #e5e7eb;
}
.encabezado-tarjeta h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: #191c1e;
  font-size: 20px;
}

.encabezado-tarjeta p {
  margin: 6px 0 0 38px;
  color: #434655;
  font-size: 14px;
}

.numero-paso {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #dbeafe;
  color: #1e40af;
  font-size: 14px;
}

.enlace-registro {
  justify-self: end;
  color: #004ac6;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.enlace-registro:hover {
  text-decoration: underline;
}

.resumen-cupos {
  margin: 0;
  color: #434655;
  font-size: 14px;
  white-space: nowrap;
}

.resumen-cupos strong {
  color: #191c1e;
}
.contenido-tarjeta {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
}
.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}
.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}
.campo select,
.campo input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font-size: 14px;
}
.campo input[readonly] {
  background: #f2f4f6;
}
.campo small {
  color: #6b7280;
  font-size: 12px;
}
.campo select:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}
.perfil-estudiante {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f7f9fb;
}
.avatar-estudiante {
  display: flex;
  width: 90px;
  height: 90px;
  flex: 0 0 90px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-iniciales {
  background: #dbeafe;
  color: #1e40af;
  font-size: 24px;
  font-weight: 700;
}
.detalle-estudiante {
  min-width: 0;
  flex: 1;
}
.nombre-estudiante {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.nombre-estudiante h3 {
  margin: 0;
  font-size: 20px;
}
.etiqueta-activo {
  padding: 5px 10px;
  border-radius: 20px;
  background: #e8f5e9;
  color: #2e7d32;
  font-size: 12px;
  font-weight: 600;
}
.datos-estudiante {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 20px;
}
.datos-estudiante p {
  overflow-wrap: anywhere;
}
.cuadricula-campos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.panel-vacantes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 10px;
  background: #f2f4f6;
}

.panel-vacantes .barra-progreso {
  min-width: 160px;
  flex: 1;
}

.panel-vacantes .mensaje-disponibilidad {
  width: 100%;
  margin: 0;
}
.etiqueta-estado {
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.etiqueta-estado.disponible {
  background: #dcfce7;
  color: #166534;
}
.etiqueta-estado.limitado {
  background: #fef3c7;
  color: #92400e;
}
.etiqueta-estado.agotado {
  background: #fee2e2;
  color: #991b1b;
}
.etiqueta-estado.sin-datos {
  background: #e5e7eb;
  color: #374151;
}
.mensaje-disponibilidad {
  margin: 0;
  font-size: 14px;
}
.mensaje-disponibilidad.agotado {
  color: #b91c1c;
}
.mensaje-disponibilidad.limitado {
  color: #92400e;
}
.mensaje-disponibilidad.disponible {
  color: #166534;
}
.barra-progreso {
  height: 12px;
  overflow: hidden;
  border-radius: 20px;
  background: #d1d5db;
}
.avance-progreso {
  height: 100%;
  border-radius: 20px;
  background: #22c55e;
  transition: width 0.2s ease;
}
.avance-progreso.limitado {
  background: #f59e0b;
}
.avance-progreso.agotado {
  background: #dc2626;
}
.aviso-neutral,
.aviso-integracion {
  margin: 0;
  padding: 16px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: #f7f9fb;
  color: #434655;
  font-size: 13px;
  line-height: 1.6;
}
.acciones-matricula {
  justify-content: flex-end;
}
.boton-cancelar,
.boton-confirmar {
  min-height: 42px;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.boton-cancelar {
  border: 1px solid #c3c6d7;
  background: white;
  color: #434655;
}
.boton-confirmar {
  border: none;
  background: #004ac6;
  color: white;
}
.boton-confirmar:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 760px) {
  .cuadricula-campos,
  .datos-estudiante {
    grid-template-columns: 1fr;
  }
  .encabezado-pagina {
    align-items: flex-start;
    flex-direction: column;
  }
  .encabezado-tarjeta p {
    margin-left: 0;
  }
  .enlace-registro {
    justify-self: start;
  }
  .resumen-cupos {
    white-space: normal;
  }
  .perfil-estudiante {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 520px) {
  .pagina-matricula {
    padding: 20px 14px;
  }
  .contenido-tarjeta {
    padding: 16px;
  }
  .acciones-matricula,
  .fila-busqueda {
    align-items: stretch;
    flex-direction: column;
  }
  .boton-agregar-todos {
    min-height: 44px;
  }
}
</style>
