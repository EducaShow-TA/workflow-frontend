<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerRecordatoriosPago } from '~/composables/useRecordatoriosPago'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  NOMBRES_ESTADO,
  VARIANTES_ESTADO,
  calcularRango,
  describirSeccionHijo,
  periodoVigente,
  resumirAsistencia,
  usePortalFamilia,
} from '~/composables/usePortalFamilia'
import {
  deudaFamiliar,
  fechaPago,
  formatearSolesFamilia,
  nombrarMesBoleta,
  primerNombre,
  sumarDeuda,
  NOMBRES_ESTADO_BOLETA,
  usePagosFamilia,
} from '~/composables/usePagosFamilia'
import { bimestreEnFecha, useBimestres } from '~/composables/useBimestres'
import { useLibretas } from '~/composables/useLibretas'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { LibretaNotas } from '~/types/libreta'
import type { HorarioEstudiante } from '~/types/portalEstudiante'
import type {
  AlertaRiesgoFamilia,
  HijoVinculado,
  PagosHijo,
  PeriodoVinculado,
  RegistroAsistencia,
  ResumenAsistencia,
} from '~/types/familia'

definePageMeta({ middleware: 'autenticacion', layout: 'familia' })

type NotaLogro = 'AD' | 'A' | 'B' | 'C'

interface ClaseHoy {
  clave: string
  hora: string
  area: string
  registro: RegistroAsistencia | null
}

interface NotasBimestre {
  bimestre: number
  conteo: Record<NotaLogro, number>
  total: number
}

interface TarjetaHijo {
  hijo: HijoVinculado
  resumen: ResumenAsistencia | null
  incidencias: RegistroAsistencia[]
  error: string
  registrosHoy: RegistroAsistencia[]
  clasesHoy: ClaseHoy[] | null
  notas: NotasBimestre | null
  errorNotas: string
}

interface AvisoAusencia {
  clave: string
  estudianteId: number
  nombre: string
  areas: string
  seccion: string
  hora: string
}

const NOTAS_LOGRO: NotaLogro[] = ['AD', 'A', 'B', 'C']
const DIAS_SEMANA = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const DIAS_NOMBRE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const CLAVE_AUSENCIAS_VISTAS = 'familia-ausencias-vistas'

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const autenticacion = useAutenticacionStore()
const { listarHijos, consultarAsistencia, consultarRiesgos, consultarHorario } = usePortalFamilia()
const { consultar: consultarLibreta } = useLibretas()
const { listar: listarBimestres } = useBimestres()
const { listarPagos } = usePagosFamilia()
const DEUDAS_VISIBLES = 3
const configuracion = useRuntimeConfig()
const fechaRecordatorio = ref(obtenerFechaHoyIso())
let actualizacionPagos = 0
let temporizador: ReturnType<typeof setInterval> | undefined

const fechaHoy = obtenerFechaHoyIso()
const tarjetas = ref<TarjetaHijo[]>([])
const cargando = ref(true)
const error = ref('')
const pagos = ref<PagosHijo[]>([])
const errorPagos = ref('')
const riesgos = ref<AlertaRiesgoFamilia[]>([])
const errorRiesgos = ref('')
let actualizacionRiesgos = 0

const deudas = computed(() => deudaFamiliar(pagos.value))
const totalDeuda = computed(() => sumarDeuda(deudas.value))
const recordatorios = computed(() =>
  obtenerRecordatoriosPago(deudas.value, fechaRecordatorio.value, Number(configuracion.public.recordatorioPagoDias)),
)
const deudasEnMora = computed(() => deudas.value.filter((deuda) => deuda.boleta.estadoPago === 'EN_MORA').length)
const hayCompromisos = computed(() => pagos.value.some((hijo) => hijo.compromisos.length > 0))
const proximaEmision = computed(
  () =>
    pagos.value
      .flatMap((hijo) => hijo.compromisos.map((compromiso) => compromiso.proximaEmision))
      .filter((fecha): fecha is string => Boolean(fecha))
      .sort()[0] ?? null,
)

const ausenciasVistas = ref<string[]>(leerAusenciasVistas())
const avisosAusencia = computed<AvisoAusencia[]>(() =>
  tarjetas.value.flatMap((tarjeta) => {
    const ausentes = tarjeta.registrosHoy.filter((registro) => registro.estado === 'AUSENTE')
    const clave = ausentes.map((registro) => registro.asistenciaId).join('-')
    const primera = ausentes[0]
    if (!primera || ausenciasVistas.value.includes(clave)) return []
    return [
      {
        clave,
        estudianteId: tarjeta.hijo.estudianteId,
        nombre: primerNombre(tarjeta.hijo.nombreCompleto),
        areas: [...new Set(ausentes.map((registro) => registro.areaNombre))].join(', '),
        seccion: describirSeccionHijo(periodoVigente(tarjeta.hijo, fechaHoy)),
        hora: primera.horaInicio.slice(0, 5),
      },
    ]
  }),
)

const nombre = computed(() => autenticacion.usuario?.nombreCompleto?.trim().split(/\s+/)[0] ?? '')
const mes = MESES[Number(fechaHoy.slice(5, 7)) - 1]

function formatearDia(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
}

const diaHoy = new Date(Number(fechaHoy.slice(0, 4)), Number(fechaHoy.slice(5, 7)) - 1, Number(fechaHoy.slice(8, 10)))
const textoHoy = `${DIAS_NOMBRE[diaHoy.getDay()]} ${formatearDia(fechaHoy)}`

function leerAusenciasVistas(): string[] {
  try {
    const guardado: unknown = JSON.parse(localStorage.getItem(CLAVE_AUSENCIAS_VISTAS) ?? '[]')
    return Array.isArray(guardado) ? guardado.filter((clave): clave is string => typeof clave === 'string') : []
  } catch {
    return []
  }
}

function marcarAusenciaVista(clave: string): void {
  ausenciasVistas.value = [...ausenciasVistas.value, clave].slice(-50)
  try {
    localStorage.setItem(CLAVE_AUSENCIAS_VISTAS, JSON.stringify(ausenciasVistas.value))
  } catch {
    return
  }
}

/** Respaldo si no se pudo leer el calendario: cuatro tramos de duración similar, como el back. */
function bimestrePorTramos(periodo: PeriodoVinculado, fecha: string): number {
  const dia = 86_400_000
  const inicio = Date.parse(periodo.fechaInicio)
  const diasTotales = Math.round((Date.parse(periodo.fechaFin) - inicio) / dia) + 1
  const transcurridos = Math.max(0, Math.min(diasTotales - 1, Math.round((Date.parse(fecha) - inicio) / dia)))
  return Math.min(4, Math.floor((transcurridos * 4) / diasTotales) + 1)
}

async function bimestreActual(periodo: PeriodoVinculado): Promise<number> {
  try {
    const calendario = await listarBimestres(Number(periodo.fechaInicio.slice(0, 4)))
    if (calendario.length) return bimestreEnFecha(calendario, fechaHoy)
  } catch {
    return bimestrePorTramos(periodo, fechaHoy)
  }
  return bimestrePorTramos(periodo, fechaHoy)
}

function armarClasesHoy(sesiones: HorarioEstudiante[], registrosHoy: RegistroAsistencia[]): ClaseHoy[] {
  return sesiones
    .filter((sesion) => sesion.dia === DIAS_SEMANA[diaHoy.getDay()])
    .sort((primera, segunda) => primera.horaInicio.localeCompare(segunda.horaInicio))
    .map((sesion) => ({
      clave: `${sesion.id}`,
      hora: sesion.horaInicio.slice(0, 5),
      area: sesion.areaNombre,
      registro:
        registrosHoy.find(
          (registro) =>
            registro.areaCodigo === sesion.areaCodigo &&
            registro.horaInicio.slice(0, 5) === sesion.horaInicio.slice(0, 5),
        ) ?? null,
    }))
}

function contarNotas(libreta: LibretaNotas): NotasBimestre {
  const conteo: Record<NotaLogro, number> = { AD: 0, A: 0, B: 0, C: 0 }
  const periodo = libreta.periodos.find((item) => item.periodoId === libreta.periodoSolicitadoId)
  for (const area of periodo?.areas ?? []) {
    for (const competencia of area.competencias) {
      const nota = competencia.nota as NotaLogro | null
      if (nota && NOTAS_LOGRO.includes(nota)) conteo[nota]++
    }
  }
  return { bimestre: libreta.bimestre, conteo, total: NOTAS_LOGRO.reduce((suma, nota) => suma + conteo[nota], 0) }
}

async function cargarClasesHoy(hijo: HijoVinculado, registrosHoy: RegistroAsistencia[]): Promise<ClaseHoy[] | null> {
  if (!periodoVigente(hijo, fechaHoy)) return []
  try {
    return armarClasesHoy(await consultarHorario(hijo.estudianteId, Number(fechaHoy.slice(0, 4))), registrosHoy)
  } catch {
    return null
  }
}

async function cargarNotas(hijo: HijoVinculado): Promise<Pick<TarjetaHijo, 'notas' | 'errorNotas'>> {
  const periodo = periodoVigente(hijo, fechaHoy)
  if (!periodo) return { notas: null, errorNotas: '' }
  try {
    const libreta = await consultarLibreta(hijo.estudianteId, periodo.periodoId, await bimestreActual(periodo))
    return { notas: contarNotas(libreta), errorNotas: '' }
  } catch (fallo: unknown) {
    return { notas: null, errorNotas: obtenerMensajeError(fallo, 'No se pudieron consultar las notas del bimestre.') }
  }
}

async function armarTarjeta(hijo: HijoVinculado): Promise<TarjetaHijo> {
  const { desde, hasta } = calcularRango('MES', fechaHoy)
  const notas = cargarNotas(hijo)
  let registros: RegistroAsistencia[] = []
  let base: Pick<TarjetaHijo, 'resumen' | 'incidencias' | 'error'>

  try {
    registros = await consultarAsistencia(hijo.estudianteId, desde, hasta)
    const incidencias = registros
      .filter((registro) => registro.estado !== 'PRESENTE')
      .sort(
        (primero, segundo) =>
          segundo.fecha.localeCompare(primero.fecha) || segundo.horaInicio.localeCompare(primero.horaInicio),
      )
      .slice(0, 3)
    base = { resumen: resumirAsistencia(registros), incidencias, error: '' }
  } catch (fallo: unknown) {
    base = {
      resumen: null,
      incidencias: [],
      error: obtenerMensajeError(fallo, 'No se pudo cargar la asistencia del mes.'),
    }
  }

  const registrosHoy = registros.filter((registro) => registro.fecha === fechaHoy)
  const [clasesHoy, resultadoNotas] = await Promise.all([cargarClasesHoy(hijo, registrosHoy), notas])
  return { hijo, ...base, registrosHoy, clasesHoy, ...resultadoNotas }
}

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''

  try {
    const [hijos] = await Promise.all([listarHijos(), cargarPagos(), cargarRiesgos()])
    tarjetas.value = await Promise.all(hijos.map(armarTarjeta))
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar el resumen de tus hijos.')
  } finally {
    cargando.value = false
  }
}

async function cargarPagos(): Promise<void> {
  const actual = ++actualizacionPagos
  errorPagos.value = ''
  try {
    const resultado = await listarPagos()
    if (actual === actualizacionPagos) pagos.value = resultado
  } catch (fallo: unknown) {
    if (actual === actualizacionPagos) {
      errorPagos.value = obtenerMensajeError(fallo, 'No se pudo cargar el resumen de pagos.')
    }
  }
}

async function cargarRiesgos(): Promise<void> {
  const actual = ++actualizacionRiesgos
  try {
    const resultado = await consultarRiesgos()
    if (actual === actualizacionRiesgos) {
      riesgos.value = resultado
      errorRiesgos.value = ''
    }
  } catch (fallo: unknown) {
    if (actual === actualizacionRiesgos) {
      riesgos.value = []
      errorRiesgos.value = obtenerMensajeError(fallo, 'No se pudo consultar el riesgo académico de tus hijos.')
    }
  }
}

function actualizarRecordatorios(): void {
  fechaRecordatorio.value = obtenerFechaHoyIso()
  if (document.visibilityState === 'visible' && !cargando.value) {
    void cargarPagos()
    void cargarRiesgos()
  }
}

onMounted(() => {
  void cargar()
  window.addEventListener('focus', actualizarRecordatorios)
  temporizador = setInterval(actualizarRecordatorios, 60_000)
})

onUnmounted(() => {
  actualizacionPagos++
  actualizacionRiesgos++
  window.removeEventListener('focus', actualizarRecordatorios)
  clearInterval(temporizador)
})
</script>

<template>
  <main class="docente-vista panel-familia">
    <div class="docente-titulo">
      <div>
        <h1>Hola{{ nombre ? `, ${nombre}` : '' }}</h1>
        <p>Resumen de tus hijos en el año escolar {{ fechaHoy.slice(0, 4) }}.</p>
      </div>
    </div>

    <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargar" />

    <AvisoMensaje
      v-else-if="!tarjetas.length"
      tipo="advertencia"
      mensaje="Tu cuenta aún no tiene estudiantes vinculados. Comunícate con la secretaría del colegio."
    />

    <template v-else>
      <section v-if="avisosAusencia.length" class="avisos-ausencia" aria-label="Avisos de hoy">
        <div v-for="aviso in avisosAusencia" :key="aviso.clave" class="aviso-ausencia" role="status">
          <span class="icono-aviso" aria-hidden="true">!</span>
          <div class="texto-aviso">
            <strong>{{ aviso.nombre }} fue marcado ausente hoy</strong>
            <small>
              {{ aviso.areas }} · {{ aviso.seccion }} · {{ textoHoy }}, {{ aviso.hora }}. Si faltó por un motivo
              justificado, puedes enviar la justificación.
            </small>
          </div>
          <div class="botones-aviso">
            <NuxtLink :to="`/familia/asistencia?estudianteId=${aviso.estudianteId}`" class="justificar">
              Justificar
            </NuxtLink>
            <button type="button" class="entendido" @click="marcarAusenciaVista(aviso.clave)">Entendido</button>
          </div>
        </div>
      </section>

      <section
        v-if="!errorPagos && recordatorios.length"
        class="recordatorio-pagos"
        aria-labelledby="titulo-recordatorios"
        role="status"
      >
        <h2 id="titulo-recordatorios">Pagos próximos a vencer</h2>
        <ul>
          <li v-for="recordatorio in recordatorios" :key="recordatorio.boleta.boletaId">
            <strong>{{ recordatorio.nombreHijo }}</strong> · {{ nombrarMesBoleta(recordatorio.boleta.mesCobro) }} ·
            <strong>{{ formatearSolesFamilia(recordatorio.boleta.montoTotal) }}</strong>
            <span>
              {{
                recordatorio.diasRestantes === 0
                  ? 'Vence hoy'
                  : recordatorio.diasRestantes === 1
                    ? 'Vence mañana'
                    : `Vence en ${recordatorio.diasRestantes} días`
              }}. Fecha límite: {{ fechaPago(recordatorio.boleta.fechaVencimiento) }}.
            </span>
          </li>
        </ul>
        <NuxtLink to="/familia/pagos" class="ver-pagos">Ver pagos</NuxtLink>
      </section>

      <AvisoMensaje v-if="errorPagos" :mensaje="errorPagos" tipo="advertencia" />

      <section v-else-if="hayCompromisos && deudas.length" class="docente-tarjeta franja-pagos" aria-label="Pagos">
        <div class="saldo">
          <span>Total por pagar</span>
          <strong>{{ formatearSolesFamilia(totalDeuda) }}</strong>
          <small>
            {{ deudas.length }} {{ deudas.length === 1 ? 'boleta' : 'boletas' }}
            <template v-if="deudasEnMora"> · {{ deudasEnMora }} en mora</template>
          </small>
        </div>
        <div class="lista-deudas">
          <div v-for="deuda in deudas.slice(0, DEUDAS_VISIBLES)" :key="deuda.boleta.boletaId" class="fila-deuda">
            <span class="texto">
              <strong>{{ primerNombre(deuda.nombreHijo) }}</strong> ·
              {{ nombrarMesBoleta(deuda.boleta.mesCobro, true) }}
              <small
                >{{ deuda.boleta.estadoPago === 'EN_MORA' ? 'Venció' : 'Vence' }}
                {{ fechaPago(deuda.boleta.fechaVencimiento, false) }}</small
              >
            </span>
            <span class="estado-boleta" :class="deuda.boleta.estadoPago.toLowerCase()">{{
              NOMBRES_ESTADO_BOLETA[deuda.boleta.estadoPago]
            }}</span>
            <strong class="importe">{{ formatearSolesFamilia(deuda.boleta.montoTotal) }}</strong>
          </div>
          <span v-if="deudas.length > DEUDAS_VISIBLES" class="mas">
            y {{ deudas.length - DEUDAS_VISIBLES }}
            {{ deudas.length - DEUDAS_VISIBLES === 1 ? 'boleta más' : 'boletas más' }}
          </span>
          <div class="botones-pagos">
            <NuxtLink to="/familia/pagos" class="ir-pagar" :class="{ mora: deudasEnMora }">Ir a pagar</NuxtLink>
            <NuxtLink to="/familia/pagos#titulo-historial" class="ver-pagos">Ver todos los pagos</NuxtLink>
          </div>
        </div>
      </section>

      <section v-else-if="hayCompromisos" class="docente-tarjeta pagos-al-dia" aria-label="Pagos">
        <span
          >✔ <strong>Estás al día con las pensiones.</strong>
          <template v-if="proximaEmision"> La próxima boleta se emite el {{ fechaPago(proximaEmision) }}.</template>
        </span>
        <NuxtLink to="/familia/pagos" class="ver-pagos">Ver pagos</NuxtLink>
      </section>

      <div v-if="errorRiesgos" role="alert">
        <p>{{ errorRiesgos }}</p>
        <button type="button" class="reintentar-riesgo" @click="cargarRiesgos">Reintentar consulta académica</button>
      </div>

      <section class="hijos" aria-label="Resumen por hijo">
        <article v-for="tarjeta in tarjetas" :key="tarjeta.hijo.estudianteId" class="docente-tarjeta hijo">
          <header>
            <h2>{{ tarjeta.hijo.nombreCompleto }}</h2>
            <p>{{ describirSeccionHijo(periodoVigente(tarjeta.hijo, fechaHoy)) }}</p>
          </header>

          <section
            v-for="alerta in riesgos.filter((item) => item.estudianteId === tarjeta.hijo.estudianteId)"
            :key="`${alerta.periodoId}-${alerta.areaCodigo}`"
            class="alerta-riesgo"
            role="status"
            :aria-label="`Riesgo académico en ${alerta.areaNombre}`"
          >
            <h3>Riesgo académico en {{ alerta.areaNombre }}</h3>
            <p>
              Bimestre {{ alerta.bimestre }}: {{ alerta.notasC }} calificaciones C superan el umbral configurado de
              {{ alerta.umbral }}. Coordina con el docente acciones de apoyo.
            </p>
            <ul>
              <li v-for="competencia in alerta.competencias" :key="competencia.codigo">
                {{ competencia.nombre }} · {{ competencia.notasC }}
                {{ competencia.notasC === 1 ? 'calificación C' : 'calificaciones C' }}
              </li>
            </ul>
            <NuxtLink to="/libretas">Ver progreso académico</NuxtLink>
          </section>

          <section class="bloque-hoy" :aria-label="`Clases de hoy de ${primerNombre(tarjeta.hijo.nombreCompleto)}`">
            <h3>Hoy en el colegio</h3>
            <p v-if="tarjeta.clasesHoy === null" class="secundario">No se pudo consultar el horario de hoy.</p>
            <p v-else-if="!tarjeta.clasesHoy.length" class="secundario">Hoy no tiene clases programadas.</p>
            <ul v-else class="clases-hoy">
              <li class="rango-hoy">
                {{ tarjeta.clasesHoy.length }} {{ tarjeta.clasesHoy.length === 1 ? 'clase' : 'clases' }} · desde las
                {{ tarjeta.clasesHoy[0]?.hora }}
              </li>
              <li v-for="clase in tarjeta.clasesHoy" :key="clase.clave">
                <span>{{ clase.hora }} {{ clase.area }}</span>
                <InsigniaEstado
                  v-if="clase.registro"
                  :texto="NOMBRES_ESTADO[clase.registro.estado]"
                  :variante="VARIANTES_ESTADO[clase.registro.estado]"
                />
                <span v-else class="sin-registro">Aún no registrada</span>
              </li>
            </ul>
          </section>

          <h3>Asistencia de {{ mes }}</h3>

          <AvisoMensaje v-if="tarjeta.error" :mensaje="tarjeta.error" tipo="error" />
          <p v-else-if="!tarjeta.resumen?.total" class="secundario">Aún no hay clases registradas este mes.</p>
          <template v-else-if="tarjeta.resumen">
            <dl class="indicadores">
              <div>
                <dt>asistencia</dt>
                <dd class="verde">{{ tarjeta.resumen.porcentaje }} %</dd>
              </div>
              <div>
                <dt>tardanzas</dt>
                <dd :class="{ ambar: tarjeta.resumen.TARDANZA }">{{ tarjeta.resumen.TARDANZA }}</dd>
              </div>
              <div>
                <dt>ausencias</dt>
                <dd :class="{ rojo: tarjeta.resumen.AUSENTE }">{{ tarjeta.resumen.AUSENTE }}</dd>
              </div>
              <div>
                <dt>justificadas</dt>
                <dd :class="{ azul: tarjeta.resumen.JUSTIFICADA }">{{ tarjeta.resumen.JUSTIFICADA }}</dd>
              </div>
            </dl>

            <ul v-if="tarjeta.incidencias.length" class="incidencias" aria-label="Últimas faltas y tardanzas">
              <li v-for="registro in tarjeta.incidencias" :key="registro.asistenciaId">
                <span>{{ formatearDia(registro.fecha) }} · {{ registro.areaNombre }}</span>
                <InsigniaEstado
                  :texto="NOMBRES_ESTADO[registro.estado]"
                  :variante="VARIANTES_ESTADO[registro.estado]"
                />
              </li>
            </ul>
            <p v-else class="sin-incidencias">✔ Sin faltas ni tardanzas este mes.</p>
          </template>

          <section
            v-if="tarjeta.notas || tarjeta.errorNotas"
            class="bloque-notas"
            :aria-label="`Notas del bimestre de ${primerNombre(tarjeta.hijo.nombreCompleto)}`"
          >
            <h3>Notas del bimestre {{ tarjeta.notas?.bimestre ?? '' }}</h3>
            <p v-if="tarjeta.errorNotas" class="secundario">{{ tarjeta.errorNotas }}</p>
            <p v-else-if="!tarjeta.notas?.total" class="secundario">Aún no hay notas registradas en este bimestre.</p>
            <dl v-else class="notas">
              <div
                v-for="nota in NOTAS_LOGRO"
                :key="nota"
                :class="{ 'nota-c': nota === 'C' && tarjeta.notas?.conteo.C }"
              >
                <dt>{{ nota }}</dt>
                <dd>{{ tarjeta.notas?.conteo[nota] }}</dd>
              </div>
            </dl>
          </section>

          <div class="acciones">
            <NuxtLink :to="`/familia/horario?estudianteId=${tarjeta.hijo.estudianteId}`">Ver horario</NuxtLink>
            <NuxtLink :to="`/familia/asistencia?estudianteId=${tarjeta.hijo.estudianteId}`">Ver asistencia</NuxtLink>
            <NuxtLink to="/libretas">Ver progreso académico</NuxtLink>
          </div>
        </article>
      </section>
    </template>
  </main>
</template>

<style scoped>
.avisos-ausencia {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.aviso-ausencia {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #fecdd3;
  border-radius: 12px;
  background: #fff1f2;
  color: #9f1239;
  font-size: 14px;
}

.icono-aviso {
  display: grid;
  flex: none;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: #ffe4e6;
  font-weight: 800;
}

.texto-aviso {
  min-width: 0;
}

.texto-aviso strong {
  display: block;
  margin-bottom: 2px;
  font-size: 15px;
}

.botones-aviso {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.justificar,
.entendido {
  padding: 6px 11px;
  border-radius: 8px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.justificar {
  background: #9f1239;
  color: white;
}

.entendido {
  border: 1px solid #fecdd3;
  background: white;
  color: #9f1239;
}

.bloque-hoy,
.bloque-notas {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.clases-hoy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 12px;
  border: 1px solid #eef2f7;
  border-radius: 10px;
  background: #f8fafc;
  list-style: none;
  font-size: 14px;
}

.clases-hoy li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.clases-hoy .rango-hoy {
  color: #64748b;
  font-size: 13px;
}

.sin-registro {
  padding: 2px 9px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.notas {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.notas div {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  padding: 8px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
}

.notas dt {
  color: #64748b;
  font-size: 12px;
}

.notas dd {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.notas .nota-c dd {
  color: #dc2626;
}

.alerta-riesgo {
  padding: 16px;
  border: 1px solid #f0b4aa;
  border-radius: 10px;
  background: #fff1ee;
  color: #8c291d;
}

.alerta-riesgo p {
  margin: 8px 0;
  font-size: 14px;
  line-height: 1.5;
}

.alerta-riesgo ul {
  margin: 8px 0 12px;
  padding-left: 20px;
  font-size: 14px;
}

.alerta-riesgo a,
.reintentar-riesgo {
  color: #2444b0;
  font: inherit;
  font-weight: 600;
}

.reintentar-riesgo {
  padding: 8px 12px;
  border: 1px solid #c9d4e5;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.recordatorio-pagos {
  padding: 20px;
  border: 1px solid #e8be52;
  border-radius: 12px;
  background: #fff8e6;
  color: #713f12;
}

.recordatorio-pagos h2 {
  margin: 0 0 12px;
  font-size: 18px;
}

.recordatorio-pagos ul {
  display: grid;
  gap: 12px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

.recordatorio-pagos li span {
  display: block;
  margin-top: 4px;
}

.docente-titulo p {
  margin: 0;
  color: #64748b;
}

.hijos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}

.hijo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hijo header h2 {
  margin: 0;
  font-size: 18px;
}

.hijo header p,
.secundario {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 14px;
}

.hijo h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.indicadores {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
}

.indicadores div {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  padding: 8px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
}

.indicadores dt {
  color: #64748b;
  font-size: 12px;
}

.indicadores dd {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.verde {
  color: #15803d;
}

.ambar {
  color: #d97706;
}

.rojo {
  color: #dc2626;
}

.azul {
  color: #2563eb;
}

.incidencias {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}

.incidencias li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid #e2e8f0;
}

.sin-incidencias {
  margin: 0;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  color: #15803d;
  font-size: 14px;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}

.acciones a {
  padding: 8px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  color: #1e40af;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.acciones a:hover {
  border-color: #1e40af;
  background: #eff6ff;
}

.franja-pagos {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 20px;
  margin-bottom: 18px;
}

.saldo {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 16px;
  border-radius: 12px;
  background: #0f4c9c;
  color: white;
}

.saldo span,
.saldo small {
  color: #dbeafe;
  font-size: 13px;
}

.saldo strong {
  font-size: 30px;
  white-space: nowrap;
}

.lista-deudas {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.fila-deuda {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 6.5rem 6.5rem;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
}

.fila-deuda .texto {
  min-width: 0;
}

.fila-deuda small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.estado-boleta {
  justify-self: start;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.estado-boleta.en_mora {
  background: #fee2e2;
  color: #991b1b;
}

.estado-boleta.pendiente {
  background: #fef3c7;
  color: #92400e;
}

.importe {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.mas {
  padding-top: 8px;
  color: #64748b;
  font-size: 13px;
}

.botones-pagos {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.ir-pagar,
.ver-pagos {
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  text-decoration: none;
}

.ir-pagar {
  background: #1e40af;
  color: white;
}

.ir-pagar.mora {
  background: #dc2626;
}

.ver-pagos {
  border: 1px solid #c3c6d7;
  color: #1e40af;
}

.pagos-al-dia {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 18px;
  color: #166534;
  font-size: 14px;
}

.hijos {
  align-items: start;
}

@media (max-width: 860px) {
  .franja-pagos {
    grid-template-columns: minmax(0, 1fr);
  }

  .botones-pagos > * {
    flex: 1;
  }

  .aviso-ausencia {
    flex-wrap: wrap;
  }

  .botones-aviso {
    margin-left: 44px;
  }
}

@media (max-width: 480px) {
  .fila-deuda {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .fila-deuda .estado-boleta {
    grid-row: 2;
  }

  .fila-deuda .importe {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .hijos {
    grid-template-columns: minmax(0, 1fr);
  }

  .indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
