<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { ErroresSeccion, Seccion, SolicitudSeccion } from '~/types/seccion'
import type {
  ErroresAperturaAnhio,
  FechasBimestre,
  PeriodoAcademico,
  SolicitudAperturaAnhio,
} from '~/types/periodoAcademico'
import type { BimestreAcademico } from '~/types/bimestre'
import {
  obtenerEtiquetaEstadoBimestre,
  obtenerVarianteEstadoBimestre,
  proponerBimestres,
  useBimestres,
  validarBimestres,
} from '~/composables/useBimestres'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import { usePeriodoMatricula } from '~/composables/usePeriodoMatricula'
import {
  convertirEnSecciones,
  determinarAnhioEscolar,
  obtenerAnhio,
  obtenerAnhiosAbiertos,
  obtenerEtiquetaEstadoAnhio,
  obtenerSeccionesPendientes,
  obtenerVarianteEstadoAnhio,
  resumirAnhio,
  calcularLimitesFechasAnhio,
  validarAperturaAnhio,
} from '~/composables/useAnhioEscolar'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import {
  GRADOS_SECUNDARIA,
  calcularConfirmados,
  calcularPorcentajeOcupacion,
  calcularVacantesDisponibles,
  obtenerEstadoCupos,
  obtenerEtiquetaEstadoCupos,
  obtenerNombreGrado,
  obtenerVarianteEstadoCupos,
  useSecciones,
  validarNuevaCapacidad,
  validarSeccion,
} from '~/composables/useSecciones'
import { tieneErrores } from '~/composables/useValidacion'

definePageMeta({
  middleware: 'autenticacion',
})

const { listarSecciones, registrarSeccion, actualizarVacantes } = useSecciones()
const { listar: listarPeriodosAcademicos, abrirAnhio, actualizarAnhio } = usePeriodosAcademicos()
const { listarPeriodos } = usePeriodoMatricula()
const { listar: listarBimestres, cerrar: cerrarBimestre } = useBimestres()
const ruta = useRoute()
const enrutador = useRouter()

const fechaHoy = obtenerFechaHoyIso()

const seccionesRegistradas = ref<Seccion[]>([])
const periodosAcademicos = ref<PeriodoAcademico[]>([])
const anhioSeleccionado = ref<number | null>(null)
const cargando = ref(true)
const errorCarga = ref('')
const mensajeExito = ref('')
const gradoFiltro = ref<number | ''>('')

function leerAnhioDeRuta(): number | null {
  const valor = Number(ruta.query.anhio)
  return Number.isInteger(valor) && valor > 0 ? valor : null
}

async function cargarSecciones(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    const [secciones, periodos, ventanas] = await Promise.all([
      listarSecciones(),
      listarPeriodosAcademicos(),
      listarPeriodos(),
    ])
    seccionesRegistradas.value = secciones
    periodosAcademicos.value = periodos
    anhioSeleccionado.value ??=
      leerAnhioDeRuta() ?? determinarAnhioEscolar(ventanas, obtenerAnhiosAbiertos(periodos), fechaHoy)
  } catch (error: unknown) {
    errorCarga.value = obtenerMensajeError(error, 'No se pudieron cargar las secciones.')
  } finally {
    cargando.value = false
  }
}

onMounted(async () => {
  await cargarSecciones()

  if (ruta.query.abrir === '1') {
    abrirApertura()
  }
})

const anhioActual = computed(() => anhioSeleccionado.value ?? obtenerAnhio(fechaHoy))

watch(anhioSeleccionado, (anhio) => {
  if (anhio !== null && anhio !== leerAnhioDeRuta()) {
    void enrutador.replace({ query: { anhio: String(anhio) } })
  }
})

watch(
  () => ruta.query.anhio,
  () => {
    const anhio = leerAnhioDeRuta()

    if (anhio !== null) {
      anhioSeleccionado.value = anhio
    }
  },
)

const anhiosDisponibles = computed(() => {
  const anhios = new Set([...obtenerAnhiosAbiertos(periodosAcademicos.value), anhioActual.value])
  return [...anhios].sort((primero, segundo) => segundo - primero)
})

function obtenerPeriodosDelAnhio(anhio: number): PeriodoAcademico[] {
  return periodosAcademicos.value.filter((periodo) => obtenerAnhio(periodo.fechaInicio) === anhio)
}

const periodosDelAnhio = computed(() => obtenerPeriodosDelAnhio(anhioActual.value))
const anhioAbierto = computed(() => periodosDelAnhio.value.length > 0)
const diasNoLectivosAbierto = ref(false)

// Calendario de bimestres del año: se configura al abrir o editar el año y se cierra uno por uno.
const bimestresAnhio = ref<BimestreAcademico[]>([])
const bimestresAbierto = ref(false)
const bimestreAConfirmar = ref<number | null>(null)
const cerrandoBimestre = ref(false)
const errorBimestres = ref('')

async function cargarBimestres(): Promise<void> {
  if (!anhioAbierto.value) {
    bimestresAnhio.value = []
    return
  }
  try {
    bimestresAnhio.value = await listarBimestres(anhioActual.value)
  } catch {
    bimestresAnhio.value = []
  }
}

watch([anhioActual, anhioAbierto], () => void cargarBimestres())

const bimestreVigente = computed(
  () =>
    bimestresAnhio.value.find((bimestre) => bimestre.estado === 'EN_CURSO') ??
    bimestresAnhio.value.find((bimestre) => bimestre.estado === 'POR_CERRAR'),
)
const bimestreParaCerrar = computed(() =>
  bimestresAnhio.value.find(
    (bimestre, indice) =>
      bimestre.estado === 'POR_CERRAR' &&
      bimestresAnhio.value.slice(0, indice).every((anterior) => anterior.estado === 'CERRADO'),
  ),
)

function abrirBimestres(): void {
  bimestreAConfirmar.value = null
  errorBimestres.value = ''
  bimestresAbierto.value = true
}

async function confirmarCierreBimestre(numero: number): Promise<void> {
  cerrandoBimestre.value = true
  errorBimestres.value = ''
  try {
    const resultado = await cerrarBimestre(anhioActual.value, numero)
    bimestreAConfirmar.value = null
    bimestresAbierto.value = false
    mensajeExito.value =
      resultado.notasCompletadas === 0
        ? `Bimestre ${numero} cerrado.`
        : `Bimestre ${numero} cerrado: ${resultado.notasCompletadas === 1 ? '1 nota faltante se registró' : `${resultado.notasCompletadas} notas faltantes se registraron`} como C.`
    await cargarBimestres()
  } catch (error: unknown) {
    errorBimestres.value = obtenerMensajeError(error, 'No se pudo cerrar el bimestre.')
  } finally {
    cerrandoBimestre.value = false
  }
}

function editarFechasBimestres(): void {
  bimestresAbierto.value = false
  editarPeriodoAnhio()
}
const resumenAnhio = computed(() => resumirAnhio(anhioActual.value, periodosDelAnhio.value, fechaHoy))
const secciones = computed(() => convertirEnSecciones(periodosDelAnhio.value))

const seccionesFiltradas = computed(() =>
  gradoFiltro.value === ''
    ? secciones.value
    : secciones.value.filter((seccion) => seccion.gradoNumero === gradoFiltro.value),
)

// Panel resumen de capacidad, matriculados y vacantes (US-1.7, criterio 6).
const resumen = computed(() => {
  const lista = seccionesFiltradas.value

  return {
    capacidad: lista.reduce((total, seccion) => total + seccion.vacantesTotales, 0),
    matriculados: lista.reduce((total, seccion) => total + calcularConfirmados(seccion), 0),
    porConfirmar: lista.reduce((total, seccion) => total + (seccion.porConfirmar ?? 0), 0),
    vacantes: lista.reduce((total, seccion) => total + calcularVacantesDisponibles(seccion), 0),
    seccionesLlenas: lista.filter((seccion) => calcularVacantesDisponibles(seccion) === 0).length,
  }
})

const matriculasSinConfirmar = computed(() =>
  secciones.value.reduce((total, seccion) => total + (seccion.porConfirmar ?? 0), 0),
)

const tituloResumen = computed(() =>
  gradoFiltro.value === '' ? 'Resumen general' : `Resumen de ${obtenerNombreGrado(gradoFiltro.value)}`,
)

function describirSeccion(seccion: Pick<Seccion, 'gradoNumero' | 'nombre'>): string {
  return formatearSeccionCompleta(seccion.gradoNumero, seccion.nombre)
}

// Edicion de la capacidad maxima (US-1.7, criterio 2)
const seccionEnEdicion = ref<Seccion | null>(null)
const nuevaCapacidad = ref<number | ''>('')
const errorCapacidad = ref('')
const errorGuardadoCapacidad = ref('')
const guardandoCapacidad = ref(false)

const vacantesPrevistas = computed(() => {
  if (!seccionEnEdicion.value || nuevaCapacidad.value === '') {
    return null
  }

  return calcularVacantesDisponibles({
    vacantesTotales: nuevaCapacidad.value,
    cantidadMatriculados: seccionEnEdicion.value.cantidadMatriculados,
  })
})

function abrirEdicionCapacidad(seccion: Seccion): void {
  seccionEnEdicion.value = seccion
  nuevaCapacidad.value = seccion.vacantesTotales
  errorCapacidad.value = ''
  errorGuardadoCapacidad.value = ''
}

function cerrarEdicionCapacidad(): void {
  seccionEnEdicion.value = null
}

async function guardarCapacidad(): Promise<void> {
  const seccion = seccionEnEdicion.value

  if (!seccion) {
    return
  }

  errorGuardadoCapacidad.value = ''
  errorCapacidad.value = validarNuevaCapacidad(Number(nuevaCapacidad.value), seccion.cantidadMatriculados)

  if (nuevaCapacidad.value === '') {
    errorCapacidad.value = 'La capacidad máxima es obligatoria.'
  }

  if (errorCapacidad.value) {
    return
  }

  guardandoCapacidad.value = true

  try {
    await actualizarVacantes(seccion.id, { vacantesTotales: Number(nuevaCapacidad.value) })
    seccionEnEdicion.value = null
    mensajeExito.value = `Capacidad de ${describirSeccion(seccion)} actualizada a ${nuevaCapacidad.value} alumnos.`
    await cargarSecciones()
  } catch (error: unknown) {
    errorGuardadoCapacidad.value = obtenerMensajeError(error, 'No se pudo actualizar la capacidad.')
  } finally {
    guardandoCapacidad.value = false
  }
}

// Registro de una nueva seccion (US-1.7, criterio 1)
const modalSeccionAbierto = ref(false)
const guardandoSeccion = ref(false)
const errorGuardadoSeccion = ref('')

const formularioSeccion = reactive<SolicitudSeccion>({
  gradoNumero: 1,
  nombre: '',
  vacantesTotales: 30,
})

const erroresSeccion = reactive<ErroresSeccion>({})

function limpiarErroresSeccion(): void {
  erroresSeccion.gradoNumero = undefined
  erroresSeccion.nombre = undefined
  erroresSeccion.vacantesTotales = undefined
  errorGuardadoSeccion.value = ''
}

function abrirRegistroSeccion(): void {
  formularioSeccion.gradoNumero = gradoFiltro.value === '' ? 1 : gradoFiltro.value
  formularioSeccion.nombre = ''
  formularioSeccion.vacantesTotales = 30
  limpiarErroresSeccion()
  modalSeccionAbierto.value = true
}

function cambiarNombreSeccion(evento: Event): void {
  const entrada = evento.target as HTMLInputElement
  const valor = entrada.value
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)

  formularioSeccion.nombre = valor
  entrada.value = valor
  erroresSeccion.nombre = undefined
}

async function guardarSeccion(): Promise<void> {
  limpiarErroresSeccion()
  Object.assign(erroresSeccion, validarSeccion(formularioSeccion, seccionesRegistradas.value))

  if (tieneErrores(erroresSeccion)) {
    return
  }

  guardandoSeccion.value = true

  try {
    const nueva = await registrarSeccion({ ...formularioSeccion })
    modalSeccionAbierto.value = false
    mensajeExito.value = `${describirSeccion(nueva)} registrada con ${nueva.vacantesTotales} vacantes.`
    await cargarSecciones()
  } catch (error: unknown) {
    errorGuardadoSeccion.value = obtenerMensajeError(error, 'No se pudo registrar la sección.')
  } finally {
    guardandoSeccion.value = false
  }
}

// Apertura del año escolar: crea el periodo de clases de cada sección que aún no lo tiene en ese año.
const aperturaAbierta = ref(false)
const editandoAnhio = ref(false)
const abriendo = ref(false)
const errorApertura = ref('')
const formularioApertura = reactive<SolicitudAperturaAnhio>({ anhio: 0, fechaInicio: '', fechaFin: '' })
const erroresApertura = reactive<ErroresAperturaAnhio>({})
const fechasBimestres = ref<FechasBimestre[]>([])
const bimestresEditados = ref(false)
const errorFechasBimestres = ref('')

function fechasValidasDelAnhio(): boolean {
  return Boolean(
    formularioApertura.fechaInicio &&
    formularioApertura.fechaFin &&
    formularioApertura.fechaFin > formularioApertura.fechaInicio,
  )
}

/** Bloqueos de cada bimestre al editar: el cerrado no cambia y el que ya empezó conserva su inicio. */
function bloqueoBimestre(numero: number): { cerrado: boolean; inicioFijo: boolean } {
  const guardado = editandoAnhio.value ? bimestresAnhio.value.find((bimestre) => bimestre.numero === numero) : undefined
  return {
    cerrado: guardado?.estado === 'CERRADO',
    inicioFijo: Boolean(guardado && guardado.fechaInicio <= fechaHoy),
  }
}

watch(
  () => [formularioApertura.fechaInicio, formularioApertura.fechaFin],
  () => {
    errorFechasBimestres.value = ''
    if (!fechasValidasDelAnhio()) return
    const algunoEmpezo = [1, 2, 3, 4].some((numero) => bloqueoBimestre(numero).inicioFijo)
    if (!fechasBimestres.value.length || (!bimestresEditados.value && !algunoEmpezo)) {
      fechasBimestres.value = proponerBimestres(formularioApertura.fechaInicio, formularioApertura.fechaFin)
      return
    }
    fechasBimestres.value[0]!.fechaInicio = formularioApertura.fechaInicio
    fechasBimestres.value[3]!.fechaFin = formularioApertura.fechaFin
  },
)

function marcarBimestresEditados(): void {
  bimestresEditados.value = true
  errorFechasBimestres.value = ''
}

function obtenerPendientes(anhio: number): Seccion[] {
  return obtenerSeccionesPendientes(seccionesRegistradas.value, obtenerPeriodosDelAnhio(anhio))
}

const anhiosParaAbrir = computed(() => {
  const anhioCalendario = obtenerAnhio(fechaHoy)
  const candidatos = new Set([anhioCalendario, anhioCalendario + 1, anhioCalendario + 2, anhioActual.value])
  return [...candidatos]
    .filter((anhio) => obtenerPendientes(anhio).length > 0)
    .sort((primero, segundo) => primero - segundo)
})

const seccionesPorCrear = computed(() => obtenerPendientes(formularioApertura.anhio))
const anhioFinalizado = computed(() => resumenAnhio.value?.estado === 'FINALIZADO')
const inicioBloqueado = computed(() => editandoAnhio.value && resumenAnhio.value?.estado === 'EN_CURSO')
const limitesFechas = computed(() =>
  calcularLimitesFechasAnhio(formularioApertura.anhio, formularioApertura.fechaInicio, fechaHoy),
)

function abrirApertura(): void {
  editandoAnhio.value = false
  const anhio = anhiosParaAbrir.value.includes(anhioActual.value) ? anhioActual.value : anhiosParaAbrir.value[0]
  formularioApertura.anhio = anhio ?? anhioActual.value
  formularioApertura.fechaInicio = ''
  formularioApertura.fechaFin = ''
  fechasBimestres.value = []
  bimestresEditados.value = false
  errorFechasBimestres.value = ''
  erroresApertura.fechaInicio = undefined
  erroresApertura.fechaFin = undefined
  errorApertura.value = ''
  aperturaAbierta.value = true
}

function editarPeriodoAnhio(): void {
  if (!resumenAnhio.value || anhioFinalizado.value) return
  formularioApertura.anhio = anhioActual.value
  editandoAnhio.value = true
  fechasBimestres.value = bimestresAnhio.value.map(({ numero, fechaInicio, fechaFin }) => ({
    numero,
    fechaInicio,
    fechaFin,
  }))
  bimestresEditados.value = bimestresAnhio.value.some((bimestre) => bimestre.configurado)
  errorFechasBimestres.value = ''
  formularioApertura.fechaInicio = resumenAnhio.value.fechaInicio
  formularioApertura.fechaFin = resumenAnhio.value.fechaFin
  erroresApertura.fechaInicio = undefined
  erroresApertura.fechaFin = undefined
  errorApertura.value = ''
  aperturaAbierta.value = true
}

async function confirmarApertura(): Promise<void> {
  errorApertura.value = ''
  erroresApertura.fechaInicio = undefined
  erroresApertura.fechaFin = undefined
  Object.assign(erroresApertura, validarAperturaAnhio(formularioApertura, fechaHoy, inicioBloqueado.value))

  if (tieneErrores(erroresApertura)) {
    return
  }
  errorFechasBimestres.value = validarBimestres(
    fechasBimestres.value,
    formularioApertura.fechaInicio,
    formularioApertura.fechaFin,
  )
  if (errorFechasBimestres.value) {
    return
  }

  abriendo.value = true

  try {
    const solicitud = { ...formularioApertura, bimestres: fechasBimestres.value.map((bimestre) => ({ ...bimestre })) }
    const creados = editandoAnhio.value ? await actualizarAnhio(solicitud) : await abrirAnhio(solicitud)
    aperturaAbierta.value = false
    anhioSeleccionado.value = formularioApertura.anhio
    mensajeExito.value = editandoAnhio.value
      ? `Periodo del año escolar ${formularioApertura.anhio} actualizado en ${creados.length} secciones.`
      : `Año escolar ${formularioApertura.anhio} abierto: se ${creados.length === 1 ? 'creó 1 periodo' : `crearon ${creados.length} periodos`}.`
    await cargarSecciones()
    await cargarBimestres()
  } catch (error: unknown) {
    errorApertura.value = obtenerMensajeError(error, 'No se pudo abrir el año escolar.')
  } finally {
    abriendo.value = false
  }
}
</script>

<template>
  <main class="pagina-secciones">
    <EncabezadoPagina
      titulo="Vacantes por Grado y Sección"
      :descripcion="`Configura la capacidad máxima de cada sección y revisa las vacantes del año escolar ${anhioActual}.`"
    >
      <template #acciones>
        <BotonAccion variante="secundario" destino="/matriculas/periodo">Periodo de matrícula</BotonAccion>
        <BotonAccion
          variante="secundario"
          :deshabilitado="cargando || anhiosParaAbrir.length === 0"
          :title="
            anhiosParaAbrir.length === 0
              ? 'Todas las secciones ya tienen su periodo en los años disponibles.'
              : undefined
          "
          @click="abrirApertura"
        >
          Abrir año escolar
        </BotonAccion>
        <BotonAccion
          v-if="anhioAbierto"
          variante="secundario"
          :deshabilitado="anhioFinalizado"
          :title="
            anhioFinalizado ? `Las clases de ${anhioActual} ya terminaron; sus fechas no se pueden cambiar.` : undefined
          "
          @click="editarPeriodoAnhio"
        >
          Editar periodo del año
        </BotonAccion>
        <BotonAccion @click="abrirRegistroSeccion">+ Agregar sección</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="mensajeExito" :mensaje="mensajeExito" tipo="exito" cerrable @cerrar="mensajeExito = ''" />
    <div v-if="!cargando && matriculasSinConfirmar" class="aviso-por-confirmar" role="status">
      <span>
        <strong
          >{{ matriculasSinConfirmar }}
          {{ matriculasSinConfirmar === 1 ? 'matrícula sin confirmar' : 'matrículas sin confirmar' }} en
          {{ anhioActual }}.</strong
        >
        Reservan su vacante, pero esos alumnos aún no aparecen en tareas, asistencia ni notas hasta confirmar su
        compromiso de pago.
      </span>
      <NuxtLink to="/matriculas/nueva">Confirmar ahora →</NuxtLink>
    </div>

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargarSecciones">
      <section class="panel-filtros" aria-label="Filtros de secciones">
        <div class="campo-filtro">
          <label for="filtro-anhio">Año escolar</label>

          <select id="filtro-anhio" v-model.number="anhioSeleccionado">
            <option v-for="anhio in anhiosDisponibles" :key="anhio" :value="anhio">{{ anhio }}</option>
          </select>
        </div>

        <div class="campo-filtro">
          <label for="filtro-grado">Grado</label>

          <select id="filtro-grado" v-model="gradoFiltro">
            <option value="">Todos los Grados</option>
            <option v-for="grado in GRADOS_SECUNDARIA" :key="grado" :value="grado">
              {{ obtenerNombreGrado(grado) }}
            </option>
          </select>
        </div>

        <p v-if="resumenAnhio" class="info-anhio">
          Clases del <strong>{{ formatearFecha(resumenAnhio.fechaInicio) }}</strong> al
          <strong>{{ formatearFecha(resumenAnhio.fechaFin) }}</strong>
          <InsigniaEstado
            :texto="obtenerEtiquetaEstadoAnhio(resumenAnhio.estado)"
            :variante="obtenerVarianteEstadoAnhio(resumenAnhio.estado)"
          />
          <span v-if="bimestreVigente" class="bimestre-vigente">
            · Bimestre {{ bimestreVigente.numero }}
            {{ obtenerEtiquetaEstadoBimestre(bimestreVigente.estado).toLowerCase() }}
          </span>
          <small v-if="anhioFinalizado" class="nota-finalizado"
            >Solo consulta: sus fechas ya no se pueden cambiar.</small
          >
        </p>

        <BotonAccion v-if="anhioAbierto" variante="secundario" @click="abrirBimestres">Bimestres</BotonAccion>
        <BotonAccion v-if="anhioAbierto" variante="secundario" @click="diasNoLectivosAbierto = true">
          Días no lectivos
        </BotonAccion>
      </section>

      <section v-if="!anhioAbierto" class="anhio-sin-abrir" aria-labelledby="titulo-anhio-sin-abrir">
        <h2 id="titulo-anhio-sin-abrir">El año escolar {{ anhioActual }} todavía no está abierto</h2>

        <template v-if="seccionesRegistradas.length > 0">
          <p>
            Ábrelo para crear el periodo de clases de cada sección. Después podrás registrar matrículas para
            {{ anhioActual }} mientras el periodo de matrícula esté vigente.
          </p>
          <BotonAccion @click="abrirApertura">Abrir año escolar {{ anhioActual }}</BotonAccion>
        </template>

        <template v-else>
          <p>
            Al abrir el año se crearán automáticamente los grados 1.º a 5.º de secundaria y la sección A de cada grado.
          </p>
          <BotonAccion @click="abrirApertura">Abrir año escolar {{ anhioActual }}</BotonAccion>
        </template>
      </section>

      <template v-else>
        <section class="resumen" :aria-label="tituloResumen">
          <h2 class="solo-lectores">{{ tituloResumen }}</h2>

          <div class="indicador">
            <span>Capacidad máxima</span>
            <strong>{{ resumen.capacidad }}</strong>
          </div>

          <div class="indicador">
            <span>Matriculados</span>
            <strong>{{ resumen.matriculados }}</strong>
            <small v-if="resumen.porConfirmar" class="por-confirmar">+{{ resumen.porConfirmar }} por confirmar</small>
          </div>

          <div class="indicador destacado">
            <span>Vacantes disponibles</span>
            <strong>{{ resumen.vacantes }}</strong>
          </div>

          <div class="indicador" :class="{ alerta: resumen.seccionesLlenas > 0 }">
            <span>Secciones sin vacantes</span>
            <strong>{{ resumen.seccionesLlenas }}</strong>
          </div>
        </section>

        <section class="panel-tabla" aria-label="Vacantes por sección">
          <div class="tabla-desplazable">
            <table>
              <thead>
                <tr>
                  <th scope="col">Grado</th>
                  <th scope="col">Sección</th>
                  <th scope="col">Capacidad máxima</th>
                  <th scope="col">Matriculados en {{ anhioActual }}</th>
                  <th scope="col">Vacantes</th>
                  <th scope="col">Ocupación</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="seccion in seccionesFiltradas" :key="seccion.id">
                  <td class="sin-salto">{{ obtenerNombreGrado(seccion.gradoNumero) }}</td>
                  <td class="dato-destacado">{{ seccion.nombre }}</td>
                  <td>{{ seccion.vacantesTotales }}</td>
                  <td>
                    {{ calcularConfirmados(seccion) }}
                    <small v-if="seccion.porConfirmar" class="por-confirmar"
                      >+{{ seccion.porConfirmar }} por confirmar</small
                    >
                  </td>
                  <td class="dato-destacado">{{ calcularVacantesDisponibles(seccion) }}</td>
                  <td>
                    <div class="celda-ocupacion">
                      <BarraOcupacion
                        :porcentaje="calcularPorcentajeOcupacion(seccion)"
                        :estado="obtenerEstadoCupos(calcularVacantesDisponibles(seccion))"
                        :etiqueta="`Ocupación de ${describirSeccion(seccion)}`"
                      />
                      <span>{{ calcularPorcentajeOcupacion(seccion) }}%</span>
                    </div>
                  </td>
                  <td>
                    <InsigniaEstado
                      :texto="obtenerEtiquetaEstadoCupos(obtenerEstadoCupos(calcularVacantesDisponibles(seccion)))"
                      :variante="obtenerVarianteEstadoCupos(obtenerEstadoCupos(calcularVacantesDisponibles(seccion)))"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="boton-tabla"
                      :aria-label="`Editar capacidad de ${describirSeccion(seccion)}`"
                      @click="abrirEdicionCapacidad(seccion)"
                    >
                      Editar capacidad
                    </button>
                  </td>
                </tr>

                <tr v-if="seccionesFiltradas.length === 0">
                  <td colspan="8" class="sin-resultados">
                    No hay secciones registradas para este grado. Agrégalas con «Agregar sección».
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <footer class="pie-tabla">
            Mostrando {{ seccionesFiltradas.length }} de {{ secciones.length }} secciones
          </footer>
        </section>
      </template>
    </PanelEstadoCarga>

    <VentanaModal
      :abierta="seccionEnEdicion !== null"
      titulo="Editar capacidad máxima"
      :descripcion="seccionEnEdicion ? describirSeccion(seccionEnEdicion) : ''"
      :bloqueada="guardandoCapacidad"
      @cerrar="cerrarEdicionCapacidad"
    >
      <form
        v-if="seccionEnEdicion"
        id="formulario-capacidad"
        class="formulario"
        novalidate
        @submit.prevent="guardarCapacidad"
      >
        <p class="dato-informativo">
          Vacantes ocupadas actualmente: <strong>{{ seccionEnEdicion.cantidadMatriculados }}</strong>
          <template v-if="seccionEnEdicion.porConfirmar">
            ({{ calcularConfirmados(seccionEnEdicion) }} matriculados y {{ seccionEnEdicion.porConfirmar }} por
            confirmar)</template
          >. La nueva capacidad no puede ser menor que esta cantidad.
        </p>

        <div class="campo">
          <label for="nueva-capacidad">Capacidad máxima <span class="obligatorio">*</span></label>

          <input
            id="nueva-capacidad"
            v-model.number="nuevaCapacidad"
            type="number"
            inputmode="numeric"
            :min="Math.max(1, seccionEnEdicion.cantidadMatriculados)"
            step="1"
            :aria-invalid="Boolean(errorCapacidad)"
            :aria-describedby="errorCapacidad ? 'error-capacidad' : undefined"
            @input="errorCapacidad = ''"
          />

          <small v-if="errorCapacidad" id="error-capacidad" class="error">{{ errorCapacidad }}</small>
        </div>

        <p v-if="vacantesPrevistas !== null && !errorCapacidad" class="vista-previa" role="status">
          Vacantes disponibles con esta capacidad: <strong>{{ vacantesPrevistas }}</strong>
        </p>

        <AvisoMensaje v-if="errorGuardadoCapacidad" :mensaje="errorGuardadoCapacidad" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="guardandoCapacidad" @click="cerrarEdicionCapacidad">
          Cancelar
        </BotonAccion>
        <BotonAccion tipo="submit" form="formulario-capacidad" :deshabilitado="guardandoCapacidad">
          {{ guardandoCapacidad ? 'Guardando...' : 'Guardar capacidad' }}
        </BotonAccion>
      </template>
    </VentanaModal>

    <VentanaModal
      :abierta="modalSeccionAbierto"
      titulo="Agregar sección"
      descripcion="Registra una sección y su capacidad máxima antes del inicio de la matrícula."
      :bloqueada="guardandoSeccion"
      @cerrar="modalSeccionAbierto = false"
    >
      <form id="formulario-seccion" class="formulario" novalidate @submit.prevent="guardarSeccion">
        <div class="cuadricula-campos">
          <div class="campo">
            <label for="grado-seccion">Grado <span class="obligatorio">*</span></label>

            <select
              id="grado-seccion"
              v-model.number="formularioSeccion.gradoNumero"
              :aria-invalid="Boolean(erroresSeccion.gradoNumero)"
              :aria-describedby="erroresSeccion.gradoNumero ? 'error-grado' : undefined"
              @change="erroresSeccion.nombre = undefined"
            >
              <option v-for="grado in GRADOS_SECUNDARIA" :key="grado" :value="grado">
                {{ obtenerNombreGrado(grado) }}
              </option>
            </select>

            <small v-if="erroresSeccion.gradoNumero" id="error-grado" class="error">
              {{ erroresSeccion.gradoNumero }}
            </small>
          </div>

          <div class="campo">
            <label for="nombre-seccion">Sección <span class="obligatorio">*</span></label>

            <input
              id="nombre-seccion"
              :value="formularioSeccion.nombre"
              type="text"
              maxlength="2"
              placeholder="Ej. C"
              autocomplete="off"
              :aria-invalid="Boolean(erroresSeccion.nombre)"
              :aria-describedby="erroresSeccion.nombre ? 'error-nombre-seccion' : undefined"
              @input="cambiarNombreSeccion"
            />

            <small v-if="erroresSeccion.nombre" id="error-nombre-seccion" class="error">
              {{ erroresSeccion.nombre }}
            </small>
          </div>
        </div>

        <div class="campo">
          <label for="capacidad-seccion">Capacidad máxima <span class="obligatorio">*</span></label>

          <input
            id="capacidad-seccion"
            v-model.number="formularioSeccion.vacantesTotales"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            :aria-invalid="Boolean(erroresSeccion.vacantesTotales)"
            :aria-describedby="erroresSeccion.vacantesTotales ? 'error-capacidad-seccion' : undefined"
            @input="erroresSeccion.vacantesTotales = undefined"
          />

          <small v-if="erroresSeccion.vacantesTotales" id="error-capacidad-seccion" class="error">
            {{ erroresSeccion.vacantesTotales }}
          </small>
        </div>

        <AvisoMensaje v-if="errorGuardadoSeccion" :mensaje="errorGuardadoSeccion" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="guardandoSeccion" @click="modalSeccionAbierto = false">
          Cancelar
        </BotonAccion>
        <BotonAccion tipo="submit" form="formulario-seccion" :deshabilitado="guardandoSeccion">
          {{ guardandoSeccion ? 'Guardando...' : 'Agregar sección' }}
        </BotonAccion>
      </template>
    </VentanaModal>

    <VentanaModal
      :abierta="aperturaAbierta"
      :titulo="editandoAnhio ? 'Editar periodo del año escolar' : 'Abrir año escolar'"
      :descripcion="
        editandoAnhio
          ? 'Actualiza las fechas de clases de todas las secciones del año.'
          : 'Crea automáticamente los grados 1.º-5.º, la sección A y el periodo de clases de cada sección.'
      "
      :bloqueada="abriendo"
      @cerrar="aperturaAbierta = false"
    >
      <form id="formulario-apertura" class="formulario" novalidate @submit.prevent="confirmarApertura">
        <div class="campo">
          <label for="anhio-apertura">Año escolar <span class="obligatorio">*</span></label>
          <select
            id="anhio-apertura"
            v-model.number="formularioApertura.anhio"
            :disabled="editandoAnhio"
            :aria-describedby="editandoAnhio ? undefined : 'ayuda-anhio-apertura'"
          >
            <option
              v-for="anhio in editandoAnhio ? [formularioApertura.anhio] : anhiosParaAbrir"
              :key="anhio"
              :value="anhio"
            >
              {{ anhio }}
            </option>
          </select>
          <small v-if="!editandoAnhio" id="ayuda-anhio-apertura" class="ayuda">
            Solo se listan los años con secciones sin periodo.
          </small>
        </div>

        <div class="reglas-fechas" role="note">
          <strong>{{ inicioBloqueado ? 'Reglas para un año en curso' : 'Reglas de las fechas' }}</strong>
          <ul v-if="inicioBloqueado">
            <li>
              El inicio no se cambia: las clases empezaron el {{ formatearFecha(formularioApertura.fechaInicio) }}.
            </li>
            <li>
              El fin de clases debe ser desde hoy ({{ formatearFecha(fechaHoy) }}) y dentro de
              {{ formularioApertura.anhio }}.
            </li>
          </ul>
          <ul v-else>
            <li>
              Inicio de clases: desde el {{ formatearFecha(limitesFechas.minimoInicio) }} y dentro de
              {{ formularioApertura.anhio }}.
            </li>
            <li>Fin de clases: posterior al inicio y dentro de {{ formularioApertura.anhio }}.</li>
          </ul>
        </div>

        <div class="cuadricula-campos">
          <div class="campo">
            <label for="inicio-clases">Inicio de clases <span class="obligatorio">*</span></label>
            <input
              id="inicio-clases"
              v-model="formularioApertura.fechaInicio"
              type="date"
              :min="limitesFechas.minimoInicio"
              :max="limitesFechas.maximo"
              :disabled="inicioBloqueado"
              :aria-invalid="Boolean(erroresApertura.fechaInicio)"
              :aria-describedby="
                erroresApertura.fechaInicio
                  ? 'error-inicio-clases'
                  : inicioBloqueado
                    ? 'ayuda-inicio-clases'
                    : undefined
              "
              @input="erroresApertura.fechaInicio = undefined"
            />
            <small v-if="erroresApertura.fechaInicio" id="error-inicio-clases" class="error">
              {{ erroresApertura.fechaInicio }}
            </small>
            <small v-else-if="inicioBloqueado" id="ayuda-inicio-clases" class="ayuda">Las clases ya empezaron.</small>
          </div>

          <div class="campo">
            <label for="fin-clases">Fin de clases <span class="obligatorio">*</span></label>
            <input
              id="fin-clases"
              v-model="formularioApertura.fechaFin"
              type="date"
              :min="limitesFechas.minimoFin"
              :max="limitesFechas.maximo"
              :aria-invalid="Boolean(erroresApertura.fechaFin)"
              :aria-describedby="erroresApertura.fechaFin ? 'error-fin-clases' : undefined"
              @input="erroresApertura.fechaFin = undefined"
            />
            <small v-if="erroresApertura.fechaFin" id="error-fin-clases" class="error">
              {{ erroresApertura.fechaFin }}
            </small>
          </div>
        </div>

        <fieldset v-if="fechasBimestres.length" class="bimestres-anhio">
          <legend>Bimestres</legend>
          <p class="ayuda">
            Se proponen solos al elegir las fechas de clases, con dos semanas de vacaciones a mitad de año. Ajústalos
            solo si tu calendario es distinto.
          </p>
          <div v-for="(bimestre, indice) in fechasBimestres" :key="bimestre.numero" class="fila-bimestre">
            <strong>Bimestre {{ bimestre.numero }}</strong>
            <input
              v-model="bimestre.fechaInicio"
              type="date"
              :aria-label="`Inicio del bimestre ${bimestre.numero}`"
              :disabled="
                indice === 0 || bloqueoBimestre(bimestre.numero).cerrado || bloqueoBimestre(bimestre.numero).inicioFijo
              "
              @input="marcarBimestresEditados"
            />
            <span>al</span>
            <input
              v-model="bimestre.fechaFin"
              type="date"
              :aria-label="`Fin del bimestre ${bimestre.numero}`"
              :disabled="indice === fechasBimestres.length - 1 || bloqueoBimestre(bimestre.numero).cerrado"
              @input="marcarBimestresEditados"
            />
            <span
              v-if="bloqueoBimestre(bimestre.numero).cerrado"
              class="candado"
              title="Bimestre cerrado: sus fechas ya no se pueden cambiar"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z"
                />
              </svg>
              Cerrado
            </span>
            <span v-else />
          </div>
          <small class="ayuda">El bimestre 1 empieza y el 4 termina con las clases.</small>
          <small v-if="errorFechasBimestres" class="error" role="alert">{{ errorFechasBimestres }}</small>
        </fieldset>

        <div v-if="!editandoAnhio" class="lista-por-crear">
          <strong>
            Se
            {{ seccionesPorCrear.length === 1 ? 'creará 1 periodo' : `crearán ${seccionesPorCrear.length} periodos` }}
            para {{ formularioApertura.anhio }}
          </strong>
          <ul>
            <li v-for="seccion in seccionesPorCrear" :key="seccion.id">
              <span>{{ describirSeccion(seccion) }}</span>
              <small>capacidad {{ seccion.vacantesTotales }}</small>
            </li>
          </ul>
        </div>

        <AvisoMensaje v-if="errorApertura" :mensaje="errorApertura" tipo="error" />
      </form>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="abriendo" @click="aperturaAbierta = false"
          >Cancelar</BotonAccion
        >
        <BotonAccion tipo="submit" form="formulario-apertura" :deshabilitado="abriendo">
          {{
            abriendo
              ? 'Guardando...'
              : editandoAnhio
                ? `Guardar cambios de ${formularioApertura.anhio}`
                : `Abrir año ${formularioApertura.anhio}`
          }}
        </BotonAccion>
      </template>
    </VentanaModal>

    <VentanaModal
      :abierta="bimestresAbierto"
      :titulo="`Bimestres de ${anhioActual}`"
      descripcion="Fechas de cada bimestre y su cierre. Un bimestre cerrado no admite notas ni evaluaciones nuevas."
      :bloqueada="cerrandoBimestre"
      @cerrar="bimestresAbierto = false"
    >
      <div class="tabla-desplazable">
        <table class="tabla-bimestres">
          <thead>
            <tr>
              <th scope="col">Bimestre</th>
              <th scope="col">Inicio</th>
              <th scope="col">Fin</th>
              <th scope="col">Estado</th>
              <th scope="col"><span class="solo-lectores">Acción</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bimestre in bimestresAnhio" :key="bimestre.numero">
              <td>
                <strong>Bimestre {{ bimestre.numero }}</strong>
              </td>
              <td>
                <svg
                  v-if="bimestre.estado === 'CERRADO'"
                  class="candado-mini"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label="Fechas bloqueadas"
                >
                  <path
                    d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z"
                  />
                </svg>
                {{ formatearFecha(bimestre.fechaInicio) }}
              </td>
              <td>{{ formatearFecha(bimestre.fechaFin) }}</td>
              <td>
                <InsigniaEstado
                  :texto="obtenerEtiquetaEstadoBimestre(bimestre.estado)"
                  :variante="obtenerVarianteEstadoBimestre(bimestre.estado)"
                />
              </td>
              <td>
                <button
                  v-if="bimestreParaCerrar?.numero === bimestre.numero && bimestreAConfirmar === null"
                  type="button"
                  class="boton-cerrar-bimestre"
                  @click="bimestreAConfirmar = bimestre.numero"
                >
                  Cerrar bimestre
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="bimestreAConfirmar !== null" class="confirmar-cierre" role="alert">
        <p>
          <strong>¿Cerrar el bimestre {{ bimestreAConfirmar }}?</strong> Las notas de evaluaciones parciales que falten
          se registrarán como C. Los docentes ya no podrán registrar ni rectificar notas de este bimestre; el
          administrador sí podrá rectificarlas. No se puede deshacer.
        </p>
        <div class="acciones-confirmar">
          <BotonAccion variante="secundario" :deshabilitado="cerrandoBimestre" @click="bimestreAConfirmar = null">
            Cancelar
          </BotonAccion>
          <BotonAccion :deshabilitado="cerrandoBimestre" @click="confirmarCierreBimestre(bimestreAConfirmar)">
            {{ cerrandoBimestre ? 'Cerrando...' : `Sí, cerrar bimestre ${bimestreAConfirmar}` }}
          </BotonAccion>
        </div>
      </div>
      <AvisoMensaje v-if="errorBimestres" :mensaje="errorBimestres" tipo="error" />
      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="cerrandoBimestre" @click="bimestresAbierto = false">
          Listo
        </BotonAccion>
        <BotonAccion
          variante="secundario"
          :deshabilitado="cerrandoBimestre || anhioFinalizado"
          @click="editarFechasBimestres"
        >
          Editar fechas
        </BotonAccion>
      </template>
    </VentanaModal>

    <ModalDiasNoLectivos
      :abierta="diasNoLectivosAbierto"
      :anhio="anhioActual"
      @cerrar="diasNoLectivosAbierto = false"
    />
  </main>
</template>

<style scoped>
.por-confirmar {
  display: block;
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
}

.aviso-por-confirmar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border: 1px solid #fcd34d;
  border-radius: 10px;
  background: #fffbeb;
  color: #78350f;
  font-size: 14px;
  line-height: 1.5;
}

.aviso-por-confirmar a {
  flex-shrink: 0;
  color: #004ac6;
  font-weight: 600;
  text-decoration: none;
}
.bimestre-vigente {
  color: #434655;
  font-size: 13px;
  font-weight: 600;
}

.bimestres-anhio {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
}

.bimestres-anhio legend {
  padding: 0 4px;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.bimestres-anhio .ayuda {
  margin: 0;
}

.fila-bimestre {
  display: grid;
  grid-template-columns: 5.6rem minmax(0, 1fr) auto minmax(0, 1fr) 4.6rem;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.fila-bimestre input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 7px 9px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  font: inherit;
}

.fila-bimestre input:disabled {
  background: #f2f4f6;
  color: #737686;
}

.candado {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #737686;
  font-size: 12px;
  font-weight: 600;
}

.candado svg,
.candado-mini {
  width: 14px;
  height: 14px;
  fill: #737686;
  vertical-align: -2px;
}

.tabla-bimestres {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.tabla-bimestres th {
  padding: 8px 6px;
  background: #f2f4f6;
  color: #434655;
  font-size: 12px;
}

.tabla-bimestres td {
  padding: 10px 6px;
  border-top: 1px solid #e5e7eb;
  white-space: nowrap;
}

.boton-cerrar-bimestre {
  padding: 6px 10px;
  border: 0;
  border-radius: 7px;
  background: #004ac6;
  color: white;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.confirmar-cierre {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  background: #fffbeb;
  color: #78350f;
  font-size: 13px;
  line-height: 1.5;
}

.confirmar-cierre p {
  margin: 0;
}

.acciones-confirmar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.pagina-secciones {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.panel-filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 16px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.campo-filtro {
  display: flex;
  width: 100%;
  max-width: 240px;
  flex-direction: column;
  gap: 6px;
}

.campo-filtro label {
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

.campo-filtro select {
  width: 100%;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: #f7f9fb;
  color: #191c1e;
  font-size: 14px;
}

.campo-filtro select:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.resumen {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.indicador {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: white;
}

.indicador span {
  color: #434655;
  font-size: 12px;
}

.indicador strong {
  color: #191c1e;
  font-size: 30px;
}

.indicador.destacado {
  background: #ecfdf5;
}

.indicador.alerta {
  background: #fef2f2;
}

.panel-tabla {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tabla-desplazable {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

thead {
  background: #f2f4f6;
}

th {
  padding: 12px 14px;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

td {
  padding: 12px 14px;
  border-top: 1px solid #e5e7eb;
  color: #191c1e;
  font-size: 13px;
}

.dato-destacado {
  font-weight: 600;
}

.sin-salto {
  white-space: nowrap;
}

.celda-ocupacion {
  display: grid;
  min-width: 140px;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
}

.celda-ocupacion span {
  min-width: 36px;
  color: #434655;
  font-size: 12px;
  text-align: right;
}

.boton-tabla {
  padding: 6px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: white;
  color: #004ac6;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.boton-tabla:hover {
  background: #eef2ff;
}

.sin-resultados {
  padding: 48px 16px;
  color: #737686;
  text-align: center;
}

.pie-tabla {
  padding: 14px;
  border-top: 1px solid #c3c6d7;
  color: #434655;
  font-size: 13px;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cuadricula-campos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
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

.campo select:focus-visible,
.campo input:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.campo [aria-invalid='true'] {
  border-color: #dc2626;
}

.obligatorio,
.error {
  color: #dc2626;
}

.error {
  font-size: 12px;
}

.dato-informativo,
.vista-previa {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .resumen {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .pagina-secciones {
    padding: 20px 14px;
  }

  .campo-filtro {
    max-width: none;
  }

  .resumen {
    gap: 12px;
  }

  .indicador strong {
    font-size: 24px;
  }

  .cuadricula-campos {
    grid-template-columns: 1fr;
  }

  table {
    min-width: 860px;
  }
}
.info-anhio {
  display: flex;
  min-height: 38px;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 6px 12px;
  border-radius: 8px;
  background: #f2f4f6;
  color: #434655;
  font-size: 13px;
}

.anhio-sin-abrir {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 24px;
  border: 1px dashed #c3c6d7;
  border-radius: 12px;
  background: white;
  text-align: center;
}

.anhio-sin-abrir h2 {
  margin: 0;
  color: #191c1e;
  font-size: 17px;
}

.anhio-sin-abrir p {
  max-width: 560px;
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

.ayuda {
  color: #737686;
  font-size: 12px;
}

.formulario input:disabled,
.formulario select:disabled {
  background: #f2f4f6;
  color: #434655;
  cursor: not-allowed;
}

.reglas-fechas {
  padding: 12px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 13px;
  line-height: 1.5;
}

.reglas-fechas ul {
  margin: 4px 0 0;
  padding-left: 18px;
}

.nota-finalizado {
  color: #434655;
  font-size: 12px;
}

.lista-por-crear {
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f7f9fb;
  font-size: 13px;
}

.lista-por-crear ul {
  max-height: 180px;
  margin: 8px 0 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.lista-por-crear li {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px solid #e5e7eb;
}

.lista-por-crear small {
  color: #737686;
}
</style>
