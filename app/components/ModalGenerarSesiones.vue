<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { obtenerAnhio, obtenerAnhiosAbiertos } from '~/composables/useAnhioEscolar'
import { useDiasNoLectivos } from '~/composables/useDiasNoLectivos'
import { calcularDiasEntre, formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { useSesionesClase } from '~/composables/useSesionesClase'
import { ErrorSolicitudApi } from '~/types/api'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import type { GeneracionSesiones } from '~/types/sesionClase'

type Paso = 'eleccion' | 'generando' | 'resultado'

interface ResultadoSeccion {
  periodo: PeriodoAcademico
  generacion: GeneracionSesiones | null
  error: string
  sinHorario: boolean
}

const TODAS = 0

const propiedades = defineProps<{
  abierta: boolean
}>()

const emitir = defineEmits<{
  cerrar: []
  generado: []
}>()

const { listar: listarPeriodos } = usePeriodosAcademicos()
const { listar: listarDias } = useDiasNoLectivos()
const { generar } = useSesionesClase()

const fechaHoy = obtenerFechaHoyIso()
const periodos = ref<PeriodoAcademico[]>([])
const seleccion = ref(TODAS)
const diasEnRango = ref<number | null>(null)
const paso = ref<Paso>('eleccion')
const resultados = ref<ResultadoSeccion[]>([])
const enProceso = ref<PeriodoAcademico | null>(null)
const cargando = ref(false)
const error = ref('')

const anhio = computed(() => {
  const anhios = obtenerAnhiosAbiertos(periodos.value)
  const actual = obtenerAnhio(fechaHoy)
  return anhios.includes(actual) ? actual : (anhios[0] ?? actual)
})
const periodosDelAnhio = computed(() =>
  periodos.value
    .filter((periodo) => obtenerAnhio(periodo.fechaInicio) === anhio.value)
    .sort((a, b) => a.numeroGrado - b.numeroGrado || a.seccion.localeCompare(b.seccion, 'es')),
)
const elegidos = computed(() =>
  seleccion.value === TODAS
    ? periodosDelAnhio.value
    : periodosDelAnhio.value.filter((periodo) => periodo.periodoId === seleccion.value),
)
const rango = computed(() => {
  if (!elegidos.value.length) return null
  const inicio = elegidos.value.map((periodo) => periodo.fechaInicio).sort()[0]!
  const fin = elegidos.value
    .map((periodo) => periodo.fechaFin)
    .sort()
    .at(-1)!
  const desde = fechaHoy > inicio ? fechaHoy : inicio
  return { inicio, fin, desde, terminado: desde > fin }
})
const porcentajePasado = computed(() => {
  if (!rango.value) return 0
  const total = calcularDiasEntre(rango.value.inicio, rango.value.fin)
  if (total <= 0) return 0
  const pasado = calcularDiasEntre(rango.value.inicio, rango.value.desde)
  return Math.min(100, Math.max(0, Math.round((pasado / total) * 100)))
})
const textoBoton = computed(() =>
  seleccion.value === TODAS
    ? `Generar para ${elegidos.value.length} ${elegidos.value.length === 1 ? 'sección' : 'secciones'}`
    : 'Generar sesiones',
)
const listas = computed(() => resultados.value.filter((resultado) => resultado.generacion))
const fallidas = computed(() => resultados.value.filter((resultado) => !resultado.generacion))
const totales = computed(() =>
  listas.value.reduce(
    (suma, resultado) => ({
      creadas: suma.creadas + (resultado.generacion?.creadas ?? 0),
      omitidas: suma.omitidas + (resultado.generacion?.omitidasNoLectivas ?? 0),
      canceladas: suma.canceladas + (resultado.generacion?.canceladasPorCalendario ?? 0),
    }),
    { creadas: 0, omitidas: 0, canceladas: 0 },
  ),
)
const progreso = computed(() =>
  elegidos.value.length ? Math.round((resultados.value.length / elegidos.value.length) * 100) : 0,
)

function nombre(periodo: PeriodoAcademico): string {
  return `${periodo.numeroGrado}.° ${periodo.seccion}`
}

function enlaceHorario(periodo: PeriodoAcademico): string {
  return `/horario-secciones?seccionId=${periodo.seccionId}&anhio=${obtenerAnhio(periodo.fechaInicio)}`
}

function estadoDe(resultado: ResultadoSeccion): { texto: string; variante: 'exito' | 'neutro' | 'error' } {
  if (!resultado.generacion) {
    return { texto: resultado.sinHorario ? 'No tiene horario' : 'No se generó', variante: 'error' }
  }
  const { creadas, canceladasPorCalendario, omitidasNoLectivas } = resultado.generacion
  return creadas + canceladasPorCalendario + omitidasNoLectivas === 0
    ? { texto: 'Ya estaban generadas', variante: 'neutro' }
    : { texto: 'Listo', variante: 'exito' }
}

async function cargarPeriodos(): Promise<void> {
  cargando.value = true
  error.value = ''

  try {
    periodos.value = await listarPeriodos()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar las secciones del año escolar.')
  } finally {
    cargando.value = false
  }
}

async function contarDiasNoLectivos(): Promise<void> {
  diasEnRango.value = null
  const actual = rango.value
  if (!actual || actual.terminado) return

  try {
    const dias = await listarDias(actual.desde, actual.fin)
    if (rango.value === actual) diasEnRango.value = dias.length
  } catch {
    diasEnRango.value = null
  }
}

async function generarSesiones(): Promise<void> {
  paso.value = 'generando'
  resultados.value = []

  for (const periodo of elegidos.value) {
    enProceso.value = periodo
    try {
      resultados.value.push({ periodo, generacion: await generar(periodo.periodoId), error: '', sinHorario: false })
    } catch (fallo: unknown) {
      resultados.value.push({
        periodo,
        generacion: null,
        error: obtenerMensajeError(fallo, 'No se pudieron generar las sesiones.'),
        sinHorario: fallo instanceof ErrorSolicitudApi && fallo.estado === 409 && fallo.message.includes('horario'),
      })
    }
  }

  enProceso.value = null
  paso.value = 'resultado'
  if (listas.value.length) emitir('generado')
}

function cerrar(): void {
  if (paso.value === 'generando') return
  emitir('cerrar')
}

watch(rango, () => {
  void contarDiasNoLectivos()
})

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (!abierta) return
    paso.value = 'eleccion'
    resultados.value = []
    seleccion.value = TODAS
    void cargarPeriodos()
  },
  { immediate: true },
)
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    :titulo="
      paso === 'resultado' ? 'Sesiones generadas' : paso === 'generando' ? 'Generando sesiones…' : 'Generar sesiones'
    "
    :descripcion="
      paso === 'resultado'
        ? `${listas.length} de ${resultados.length} ${resultados.length === 1 ? 'sección lista' : 'secciones listas'}.`
        : paso === 'generando'
          ? 'Se procesa una sección a la vez. No cierres esta ventana.'
          : 'Crea las clases de cada día según el horario semanal de la sección.'
    "
    :bloqueada="paso === 'generando'"
    ancho="amplia"
    @cerrar="cerrar"
  >
    <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargarPeriodos" />

    <div v-else-if="paso === 'eleccion'" class="contenido">
      <p v-if="!periodosDelAnhio.length" class="vacio">No hay secciones con el año escolar {{ anhio }} abierto.</p>

      <template v-else>
        <div class="campo">
          <label for="generar-seccion">Sección (año {{ anhio }})</label>
          <select id="generar-seccion" v-model.number="seleccion">
            <option :value="TODAS">Todas las secciones del año ({{ periodosDelAnhio.length }})</option>
            <option v-for="periodo in periodosDelAnhio" :key="periodo.periodoId" :value="periodo.periodoId">
              {{ nombre(periodo) }}
            </option>
          </select>
        </div>

        <template v-if="rango">
          <div class="linea-tiempo" aria-hidden="true">
            <div class="pasado" :style="{ flexBasis: `${porcentajePasado}%` }">
              <span v-if="porcentajePasado >= 20">ya pasó</span>
            </div>
            <div class="por-generar">
              <span v-if="porcentajePasado <= 80">se genera</span>
            </div>
          </div>
          <div class="leyenda">
            <span>Inicio {{ formatearFecha(rango.inicio) }}</span>
            <span v-if="!rango.terminado && rango.desde !== rango.inicio">Hoy {{ formatearFecha(rango.desde) }}</span>
            <span>Fin {{ formatearFecha(rango.fin) }}</span>
          </div>

          <AvisoMensaje
            v-if="rango.terminado"
            tipo="advertencia"
            mensaje="Las clases de esta selección ya terminaron: no hay sesiones que generar."
          />
          <AvisoMensaje
            v-else
            tipo="informacion"
            :mensaje="`Se crearán las clases del ${formatearFecha(rango.desde)} al ${formatearFecha(rango.fin)}${
              seleccion === TODAS ? ` de las ${elegidos.length} secciones` : ''
            }. Las que ya existen no se duplican y en los días no lectivos no se crea ninguna.`"
          />

          <p v-if="!rango.terminado && diasEnRango !== null" class="ayuda">
            {{
              diasEnRango === 0
                ? 'No hay días no lectivos registrados en ese rango.'
                : diasEnRango === 1
                  ? 'Se saltará 1 día no lectivo registrado en ese rango.'
                  : `Se saltarán ${diasEnRango} días no lectivos registrados en ese rango.`
            }}
            Se administran en <NuxtLink to="/secciones" class="enlace">Grados/Secciones → Días no lectivos</NuxtLink>.
          </p>
        </template>
      </template>
    </div>

    <div v-else-if="paso === 'generando'" class="contenido">
      <div
        class="barra"
        role="progressbar"
        :aria-valuenow="progreso"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Avance de la generación"
      >
        <div :style="{ width: `${progreso}%` }" />
      </div>
      <p class="ayuda" role="status">
        {{ resultados.length }} de {{ elegidos.length }} secciones
        <template v-if="enProceso"> · {{ nombre(enProceso) }}</template>
      </p>
    </div>

    <div v-else class="contenido">
      <div class="kpis">
        <div class="kpi">
          <strong class="verde">{{ totales.creadas }}</strong>
          <span>clases creadas</span>
        </div>
        <div class="kpi">
          <strong class="ambar">{{ totales.omitidas + totales.canceladas }}</strong>
          <span>no creadas o canceladas por día no lectivo</span>
        </div>
        <div class="kpi">
          <strong :class="fallidas.length ? 'rojo' : ''">{{ fallidas.length }}</strong>
          <span>{{ fallidas.length === 1 ? 'sección sin generar' : 'secciones sin generar' }}</span>
        </div>
      </div>

      <div class="tabla-desplazable">
        <table>
          <thead>
            <tr>
              <th scope="col">Sección</th>
              <th scope="col">Creadas</th>
              <th scope="col" class="columna-dnl">Día no lectivo</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="resultado in resultados" :key="resultado.periodo.periodoId">
              <td class="seccion">{{ nombre(resultado.periodo) }}</td>
              <td>{{ resultado.generacion ? resultado.generacion.creadas : '—' }}</td>
              <td class="columna-dnl">
                {{
                  resultado.generacion
                    ? resultado.generacion.omitidasNoLectivas + resultado.generacion.canceladasPorCalendario
                    : '—'
                }}
              </td>
              <td>
                <InsigniaEstado :texto="estadoDe(resultado).texto" :variante="estadoDe(resultado).variante" />
                <NuxtLink v-if="resultado.sinHorario" :to="enlaceHorario(resultado.periodo)" class="enlace detalle">
                  Armar horario
                </NuxtLink>
                <small v-else-if="!resultado.generacion" class="detalle error">{{ resultado.error }}</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="fallidas.some((resultado) => resultado.sinHorario)" class="ayuda">
        Después de armar el horario, vuelve aquí y genera solo esa sección: las demás ya están listas y no se duplican.
      </p>
    </div>

    <template v-if="!cargando && !error && paso !== 'generando'" #pie>
      <template v-if="paso === 'eleccion'">
        <BotonAccion variante="secundario" @click="cerrar">Cancelar</BotonAccion>
        <BotonAccion :deshabilitado="!elegidos.length || !rango || rango.terminado" @click="generarSesiones">
          {{ textoBoton }}
        </BotonAccion>
      </template>
      <BotonAccion v-else @click="cerrar">Listo</BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.contenido {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 14px;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
}

.linea-tiempo {
  display: flex;
  height: 26px;
  overflow: hidden;
  border-radius: 6px;
  color: white;
  font-size: 12px;
  font-weight: 700;
}

.linea-tiempo > div {
  display: flex;
  align-items: center;
  justify-content: center;
}

.pasado {
  flex: none;
  background: #cbd5e1;
  color: #475569;
}

.por-generar {
  flex: 1;
  background: #1e40af;
}

.leyenda {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: -6px;
  color: #434655;
  font-size: 12px;
}

.ayuda,
.vacio {
  margin: 0;
  color: #434655;
  font-size: 13px;
}

.enlace {
  color: #004ac6;
  font-weight: 600;
}

.barra {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7eb;
}

.barra > div {
  height: 100%;
  background: #1e40af;
  transition: width 0.2s ease;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.kpi {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  text-align: center;
}

.kpi strong {
  font-size: 24px;
}

.kpi span {
  color: #434655;
  font-size: 12px;
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

.tabla-desplazable {
  max-height: 320px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: middle;
}

th {
  position: sticky;
  top: 0;
  background: #f7f9fb;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

tbody tr:last-child td {
  border-bottom: 0;
}

.seccion {
  font-weight: 600;
}

.detalle {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}

.error {
  color: #dc2626;
}

@media (max-width: 640px) {
  .kpis {
    grid-template-columns: minmax(0, 1fr);
  }

  .columna-dnl {
    display: none;
  }

  .kpi {
    flex-direction: row;
    gap: 10px;
    text-align: left;
  }
}
</style>
