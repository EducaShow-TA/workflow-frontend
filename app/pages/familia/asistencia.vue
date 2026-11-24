<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  ESTADOS_ASISTENCIA,
  NOMBRES_ESTADO,
  VARIANTES_ESTADO,
  agruparPorDia,
  calcularRango,
  horaDeClaseFamilia,
  nombrarDia,
  periodoVigente,
  resumirAsistencia,
  tieneIncidencias,
  usePortalFamilia,
} from '~/composables/usePortalFamilia'
import type { AtajoRango, EstadoAsistenciaHijo, HijoVinculado, RegistroAsistencia } from '~/types/familia'

definePageMeta({ middleware: 'autenticacion', layout: 'familia' })

const ATAJOS: { valor: AtajoRango; texto: string }[] = [
  { valor: 'SEMANA', texto: 'Esta semana' },
  { valor: 'MES', texto: 'Este mes' },
  { valor: 'MES_ANTERIOR', texto: 'Mes anterior' },
  { valor: 'ANIO', texto: 'Todo el año' },
]

const ruta = useRoute()
const { listarHijos, consultarAsistencia, descargarDocumento } = usePortalFamilia()

const fechaHoy = obtenerFechaHoyIso()
const rangoInicial = calcularRango('MES', fechaHoy)
const hijos = ref<HijoVinculado[]>([])
const estudianteId = ref<number | ''>('')
const desde = ref(rangoInicial.desde)
const hasta = ref(rangoInicial.hasta)
const atajo = ref<AtajoRango | null>('MES')
const registros = ref<RegistroAsistencia[]>([])
const filtroEstado = ref<EstadoAsistenciaHijo | null>(null)
const cargandoHijos = ref(true)
const cargando = ref(false)
const errorHijos = ref('')
const error = ref('')
const errorDocumento = ref('')
const mensajeJustificacion = ref('')
const descargandoId = ref<number | null>(null)
const asistenciaActivaId = ref<number | null>(null)
let consultaActual = 0

const rangoInvalido = computed(() => Boolean(desde.value && hasta.value && desde.value > hasta.value))
const resumen = computed(() => resumirAsistencia(registros.value))
const dias = computed(() => agruparPorDia(registros.value))
const filtrados = computed(() =>
  filtroEstado.value
    ? [...registros.value]
        .filter((registro) => registro.estado === filtroEstado.value)
        .sort(
          (primero, segundo) =>
            segundo.fecha.localeCompare(primero.fecha) || primero.horaInicio.localeCompare(segundo.horaInicio),
        )
    : [],
)

function nombreHijo(hijo: HijoVinculado): string {
  const periodo = periodoVigente(hijo, fechaHoy)
  return periodo
    ? `${hijo.nombreCompleto} · ${formatearSeccion(periodo.gradoNumero, periodo.seccion)}`
    : hijo.nombreCompleto
}

function elegirAtajo(valor: AtajoRango): void {
  const rango = calcularRango(valor, fechaHoy)
  atajo.value = valor
  desde.value = rango.desde
  hasta.value = rango.hasta
}

function cambiarFecha(): void {
  atajo.value = null
}

function alternarFiltro(estado: EstadoAsistenciaHijo): void {
  filtroEstado.value = filtroEstado.value === estado ? null : estado
}

function fechaCorta(fecha: string): string {
  return nombrarDia(fecha)
    .replace(/^(\S{3})\S*/, '$1')
    .replace(/\/\d{4}$/, '')
}

async function cargarHijos(): Promise<void> {
  cargandoHijos.value = true
  errorHijos.value = ''

  try {
    hijos.value = await listarHijos()
    const pedido = Number(ruta.query.estudianteId)
    estudianteId.value = hijos.value.some((hijo) => hijo.estudianteId === pedido)
      ? pedido
      : (hijos.value[0]?.estudianteId ?? '')
  } catch (fallo: unknown) {
    errorHijos.value = obtenerMensajeError(fallo, 'No se pudo cargar la lista de tus hijos.')
  } finally {
    cargandoHijos.value = false
  }
}

async function consultar(): Promise<void> {
  if (!estudianteId.value || !desde.value || !hasta.value || rangoInvalido.value) {
    registros.value = []
    return
  }

  const turno = ++consultaActual
  cargando.value = true
  error.value = ''

  try {
    const datos = await consultarAsistencia(estudianteId.value, desde.value, hasta.value)
    if (turno === consultaActual) registros.value = datos
  } catch (fallo: unknown) {
    if (turno === consultaActual) {
      registros.value = []
      error.value = obtenerMensajeError(fallo, 'No se pudo cargar la asistencia.')
    }
  } finally {
    if (turno === consultaActual) cargando.value = false
  }
}

async function abrirDocumento(registro: RegistroAsistencia): Promise<void> {
  errorDocumento.value = ''
  descargandoId.value = registro.asistenciaId

  try {
    const archivo = await descargarDocumento(registro)
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(archivo)
    enlace.download = registro.documentoNombre ?? 'justificacion'
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  } catch (fallo: unknown) {
    errorDocumento.value = obtenerMensajeError(fallo, 'No se pudo descargar el documento.')
  } finally {
    descargandoId.value = null
  }
}

function abrirFormularioJustificacion(asistenciaId: number): void {
  asistenciaActivaId.value = asistenciaId
  errorDocumento.value = ''
  mensajeJustificacion.value = ''
}

async function alJustificar(): Promise<void> {
  asistenciaActivaId.value = null
  mensajeJustificacion.value = 'La inasistencia quedó justificada y el documento fue adjuntado.'
  await consultar()
}

watch([estudianteId, desde, hasta], () => {
  filtroEstado.value = null
  void consultar()
})

onMounted(cargarHijos)
</script>

<template>
  <main class="docente-vista asistencia-familia">
    <div class="docente-titulo">
      <div>
        <h1>Asistencia</h1>
        <p>
          Revisa la asistencia de tu hijo clase por clase. Si ves algo que no corresponde, comunícate con el docente o
          con la secretaría del colegio.
        </p>
      </div>
    </div>

    <PanelEstadoCarga
      v-if="cargandoHijos || errorHijos"
      :cargando="cargandoHijos"
      :error="errorHijos"
      @reintentar="cargarHijos"
    />

    <AvisoMensaje
      v-else-if="!hijos.length"
      tipo="advertencia"
      mensaje="Tu cuenta aún no tiene estudiantes vinculados. Comunícate con la secretaría del colegio."
    />

    <template v-else>
      <AvisoMensaje v-if="mensajeJustificacion" :mensaje="mensajeJustificacion" tipo="exito" />
      <section class="docente-tarjeta filtros" aria-label="Filtros">
        <div class="campos">
          <div class="campo">
            <label for="asistencia-hijo">Estudiante</label>
            <select id="asistencia-hijo" v-model.number="estudianteId">
              <option v-for="hijo in hijos" :key="hijo.estudianteId" :value="hijo.estudianteId">
                {{ nombreHijo(hijo) }}
              </option>
            </select>
          </div>
          <div class="campo">
            <label for="asistencia-desde">Desde</label>
            <input id="asistencia-desde" v-model="desde" type="date" :max="hasta || undefined" @change="cambiarFecha" />
          </div>
          <div class="campo">
            <label for="asistencia-hasta">Hasta</label>
            <input id="asistencia-hasta" v-model="hasta" type="date" :min="desde || undefined" @change="cambiarFecha" />
          </div>
        </div>
        <div class="atajos" role="group" aria-label="Rangos rápidos">
          <button
            v-for="opcion in ATAJOS"
            :key="opcion.valor"
            type="button"
            :class="{ activo: atajo === opcion.valor }"
            :aria-pressed="atajo === opcion.valor"
            @click="elegirAtajo(opcion.valor)"
          >
            {{ opcion.texto }}
          </button>
        </div>
        <AvisoMensaje
          v-if="rangoInvalido"
          tipo="advertencia"
          mensaje="La fecha inicial no puede ser posterior a la fecha final."
        />
      </section>

      <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="consultar" />

      <template v-else-if="!rangoInvalido">
        <div v-if="!registros.length" class="docente-tarjeta vacio">
          <p>No hay asistencia registrada en ese rango de fechas.</p>
          <small>Prueba con otro rango.</small>
        </div>

        <template v-else>
          <section class="indicadores" aria-label="Resumen del rango">
            <div class="indicador principal">
              <strong class="verde">{{ resumen.porcentaje }} %</strong>
              <span>asistencia del rango</span>
              <div class="barra" aria-hidden="true">
                <div
                  v-for="estado in ESTADOS_ASISTENCIA"
                  :key="estado"
                  :class="estado.toLowerCase()"
                  :style="{ flexGrow: resumen[estado] }"
                />
              </div>
            </div>
            <button
              v-for="estado in ESTADOS_ASISTENCIA"
              :key="estado"
              type="button"
              class="indicador"
              :class="[estado.toLowerCase(), { seleccionado: filtroEstado === estado }]"
              :aria-pressed="filtroEstado === estado"
              :disabled="!resumen[estado]"
              @click="alternarFiltro(estado)"
            >
              <strong>{{ resumen[estado] }}</strong>
              <span>{{ NOMBRES_ESTADO[estado] }}{{ filtroEstado === estado ? ' · filtrando' : '' }}</span>
            </button>
          </section>
          <p class="nota">
            Se cuenta por clase: un día con 6 clases suma 6. Asistencia = (presente + tardanza + justificada) / total.
            Toca un indicador para ver solo esas clases.
          </p>

          <AvisoMensaje v-if="errorDocumento" :mensaje="errorDocumento" tipo="error" />

          <template v-if="filtroEstado">
            <div class="filtro-activo" role="status">
              <span>
                Mostrando solo <strong>{{ NOMBRES_ESTADO[filtroEstado] }}</strong> ({{ filtrados.length }}
                {{ filtrados.length === 1 ? 'clase' : 'clases' }}).
              </span>
              <button type="button" @click="filtroEstado = null">Ver todo</button>
            </div>
            <ul class="clases plana">
              <li v-for="registro in filtrados" :key="registro.asistenciaId">
                <span class="hora"
                  >{{ fechaCorta(registro.fecha) }} · {{ horaDeClaseFamilia(registro.horaInicio) }}</span
                >
                <span class="detalle">
                  <strong>{{ registro.areaNombre }}</strong>
                  <small>{{ registro.docenteNombre }}</small>
                  <small v-if="registro.motivoJustificacion" class="justificacion">
                    Motivo: {{ registro.motivoJustificacion }}
                  </small>
                </span>
                <InsigniaEstado
                  :texto="NOMBRES_ESTADO[registro.estado]"
                  :variante="VARIANTES_ESTADO[registro.estado]"
                />
                <div v-if="registro.estado === 'AUSENTE'" class="acciones-justificacion">
                  <FormularioJustificacionAsistencia
                    v-if="asistenciaActivaId === registro.asistenciaId"
                    :asistencia-id="registro.asistenciaId"
                    @cancelar="asistenciaActivaId = null"
                    @justificada="alJustificar"
                  />
                  <button
                    v-else
                    type="button"
                    class="enlace"
                    @click="abrirFormularioJustificacion(registro.asistenciaId)"
                  >
                    Justificar inasistencia
                  </button>
                </div>
              </li>
            </ul>
          </template>

          <div v-else class="dias">
            <details v-for="dia in dias" :key="dia.fecha" class="dia" :open="tieneIncidencias(dia)">
              <summary>
                <span>
                  <strong>{{ nombrarDia(dia.fecha) }}</strong>
                  <small> · {{ dia.resumen.total }} {{ dia.resumen.total === 1 ? 'clase' : 'clases' }}</small>
                </span>
                <span class="chips">
                  <template v-for="estado in ESTADOS_ASISTENCIA" :key="estado">
                    <InsigniaEstado
                      v-if="dia.resumen[estado]"
                      :texto="`${dia.resumen[estado]} ${NOMBRES_ESTADO[estado]}`"
                      :variante="VARIANTES_ESTADO[estado]"
                    />
                  </template>
                </span>
              </summary>
              <ul class="clases">
                <li v-for="registro in dia.registros" :key="registro.asistenciaId">
                  <span class="hora"
                    >{{ horaDeClaseFamilia(registro.horaInicio) }} – {{ horaDeClaseFamilia(registro.horaFin) }}</span
                  >
                  <span class="detalle">
                    <strong>{{ registro.areaNombre }}</strong>
                    <small>{{ registro.docenteNombre }}</small>
                    <small v-if="registro.motivoJustificacion" class="justificacion">
                      Motivo: {{ registro.motivoJustificacion }}
                      <template v-if="registro.documentoUrl">
                        ·
                        <button
                          type="button"
                          class="enlace"
                          :disabled="descargandoId !== null"
                          @click="abrirDocumento(registro)"
                        >
                          {{
                            descargandoId === registro.asistenciaId
                              ? 'Descargando…'
                              : (registro.documentoNombre ?? 'Ver documento')
                          }}
                        </button>
                      </template>
                    </small>
                  </span>
                  <InsigniaEstado
                    :texto="NOMBRES_ESTADO[registro.estado]"
                    :variante="VARIANTES_ESTADO[registro.estado]"
                  />
                  <div v-if="registro.estado === 'AUSENTE'" class="acciones-justificacion">
                    <FormularioJustificacionAsistencia
                      v-if="asistenciaActivaId === registro.asistenciaId"
                      :asistencia-id="registro.asistenciaId"
                      @cancelar="asistenciaActivaId = null"
                      @justificada="alJustificar"
                    />
                    <button
                      v-else
                      type="button"
                      class="enlace"
                      @click="abrirFormularioJustificacion(registro.asistenciaId)"
                    >
                      Justificar inasistencia
                    </button>
                  </div>
                </li>
              </ul>
            </details>
            <p class="nota">
              Los días con algo distinto de "Presente" se muestran abiertos; los demás se abren con un clic.
            </p>
          </div>
        </template>
      </template>
    </template>
  </main>
</template>

<style scoped>
.docente-titulo p {
  max-width: 760px;
  margin: 0;
  color: #64748b;
}

.filtros {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.campos {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.campo {
  display: flex;
  min-width: 170px;
  flex-direction: column;
  gap: 6px;
}

.campo:first-child {
  flex: 1 1 260px;
}

.campo label {
  font-size: 14px;
  font-weight: 600;
}

.campo select,
.campo input {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
}

.atajos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.atajos button {
  min-height: 36px;
  padding: 6px 14px;
  border: 1px solid #c3c6d7;
  border-radius: 999px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
}

.atajos button.activo {
  border-color: #1e40af;
  background: #1e40af;
  color: white;
}

.indicadores {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.indicador {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  color: #191c1e;
  font: inherit;
  text-align: left;
}

button.indicador {
  cursor: pointer;
}

button.indicador:disabled {
  cursor: default;
  opacity: 0.6;
}

button.indicador:hover:not(:disabled) {
  border-color: #93b4fa;
}

.indicador.seleccionado {
  border-color: #1e40af;
  box-shadow: 0 0 0 2px #93b4fa;
}

.indicador strong {
  font-size: 26px;
  line-height: 1.2;
}

.indicador span {
  color: #64748b;
  font-size: 13px;
}

.verde,
.indicador.presente strong {
  color: #15803d;
}

.indicador.tardanza strong {
  color: #d97706;
}

.indicador.ausente strong {
  color: #dc2626;
}

.indicador.justificada strong {
  color: #2563eb;
}

.barra {
  display: flex;
  width: 100%;
  height: 8px;
  overflow: hidden;
  margin-top: 6px;
  border-radius: 999px;
  background: #e2e8f0;
}

.barra .presente {
  background: #16a34a;
}

.barra .tardanza {
  background: #f59e0b;
}

.barra .ausente {
  background: #ef4444;
}

.barra .justificada {
  background: #3b82f6;
}

.nota {
  margin: -10px 0 0;
  color: #64748b;
  font-size: 13px;
}

.filtro-activo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid #bfdbfe;
  border-radius: 9px;
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 14px;
}

.filtro-activo button,
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

.dias {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dia {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
}

.dia summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  list-style: none;
}

.dia summary::-webkit-details-marker {
  display: none;
}

.dia summary small {
  color: #64748b;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.clases {
  margin: 0;
  padding: 0;
  border-top: 1px solid #e2e8f0;
  list-style: none;
}

.clases.plana {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
}

.clases li {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 14px;
  padding: 10px 16px;
  font-size: 14px;
}

.acciones-justificacion {
  flex: 1 0 100%;
}

.clases li + li {
  border-top: 1px solid #e2e8f0;
}

.hora {
  flex: none;
  width: 120px;
  color: #334155;
}

.detalle {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.detalle small {
  color: #64748b;
}

.detalle .justificacion {
  color: #1e3a8a;
}

.vacio {
  text-align: center;
}

.vacio p {
  margin: 0 0 4px;
}

.vacio small {
  color: #64748b;
}

@media (max-width: 900px) {
  .indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .indicador.principal {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .campo {
    min-width: 0;
    flex: 1 1 100%;
  }

  .clases li {
    flex-wrap: wrap;
    gap: 4px 10px;
  }

  .hora {
    width: auto;
  }

  .detalle {
    flex-basis: 100%;
    order: 3;
  }
}
</style>
