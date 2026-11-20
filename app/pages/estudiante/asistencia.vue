<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  ESTADOS_ASISTENCIA,
  VARIANTES_ESTADO,
  horaDeClaseFamilia,
  usePortalFamilia,
} from '~/composables/usePortalFamilia'
import {
  NOMBRES_CLASE,
  SIMBOLOS_CLASE,
  agruparIncidenciasEstudiante,
  armarCalendarioEstudiante,
  describirDiaEstudiante,
  limitesMesEstudiante,
  mesInicialEstudiante,
  mesesDeLaFicha,
  nombrarFechaEstudiante,
  nombrarMesEstudiante,
  resumirClasesEstudiante,
  resumirDiaEstudiante,
  tieneIncidenciasClases,
  tituloIncidenciaEstudiante,
  usePortalEstudiante,
} from '~/composables/usePortalEstudiante'
import type {
  ClaseEstudiante,
  DiaCalendarioEstudiante,
  EstadoClaseEstudiante,
  FichaEstudiante,
  IncidenciaEstudiante,
} from '~/types/portalEstudiante'

definePageMeta({ middleware: 'autenticacion', layout: 'estudiante' })

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
const LEYENDA: EstadoClaseEstudiante[] = [...ESTADOS_ASISTENCIA, 'PENDIENTE_MARCAJE']

const { obtenerFicha, consultarClases } = usePortalEstudiante()
const { descargarDocumento } = usePortalFamilia()

const fechaHoy = obtenerFechaHoyIso()
const ficha = ref<FichaEstudiante | null>(null)
const mes = ref<string | null>(null)
const clases = ref<ClaseEstudiante[]>([])
const diaSeleccionado = ref<string | null>(null)
const cargandoFicha = ref(true)
const cargando = ref(false)
const errorFicha = ref('')
const error = ref('')
const errorDocumento = ref('')
const mensajeJustificacion = ref('')
const descargandoId = ref<number | null>(null)
const asistenciaActivaId = ref<number | null>(null)
let consultaActual = 0

const meses = computed(() => (ficha.value ? mesesDeLaFicha(ficha.value) : []))
const indiceMes = computed(() => (mes.value ? meses.value.indexOf(mes.value) : -1))
const resumen = computed(() => resumirClasesEstudiante(clases.value))
const celdas = computed(() => (mes.value ? armarCalendarioEstudiante(mes.value, clases.value, fechaHoy) : []))
const incidencias = computed(() => agruparIncidenciasEstudiante(clases.value))
const detalle = computed(() => celdas.value.find((celda) => celda?.fecha === diaSeleccionado.value) ?? null)
const puedeIrAHoy = computed(() => meses.value.includes(fechaHoy.slice(0, 7)) && mes.value !== fechaHoy.slice(0, 7))

function porcentajeDe(cantidad: number): string {
  return resumen.value.total ? `${Math.round((cantidad / resumen.value.total) * 100)}%` : '0%'
}

function unidad(cantidad: number): string {
  return cantidad === 1 ? 'clase' : 'clases'
}

function irAMes(desplazamiento: number): void {
  const destino = meses.value[indiceMes.value + desplazamiento]
  if (destino) mes.value = destino
}

function irAHoy(): void {
  mes.value = fechaHoy.slice(0, 7)
}

function elegirDia(dia: DiaCalendarioEstudiante): void {
  diaSeleccionado.value = diaSeleccionado.value === dia.fecha ? null : dia.fecha
}

function claseDelDia(dia: DiaCalendarioEstudiante): Record<string, boolean> {
  const conClases = dia.clases.length > 0
  return {
    'dia--sin-clases': !conClases && !dia.esFuturo,
    'dia--futuro': !conClases && dia.esFuturo,
    'dia--completo':
      conClases &&
      !tieneIncidenciasClases(dia.clases) &&
      dia.clases.some((clase) => clase.estado !== 'PENDIENTE_MARCAJE'),
    'dia--incidencia': conClases && tieneIncidenciasClases(dia.clases),
    'dia--falta': dia.clases.some((clase) => clase.estado === 'AUSENTE'),
    'dia--hoy': dia.esHoy,
    'dia--elegido': diaSeleccionado.value === dia.fecha,
  }
}

function fechaIncidencia(fecha: string): string {
  return nombrarFechaEstudiante(fecha)
    .replace(/^(\S{3})\S*/, '$1')
    .replace(/ de \S+$/, `/${fecha.slice(5, 7)}`)
}

function documentoDe(incidencia: IncidenciaEstudiante): ClaseEstudiante | undefined {
  return incidencia.clases.find((clase) => clase.documentoUrl)
}

function abrirDocumentoDe(incidencia: IncidenciaEstudiante): void {
  const clase = documentoDe(incidencia)
  if (clase) void abrirDocumento(clase)
}

async function cargarFicha(): Promise<void> {
  cargandoFicha.value = true
  errorFicha.value = ''

  try {
    ficha.value = await obtenerFicha()
    mes.value = mesInicialEstudiante(meses.value, fechaHoy)
  } catch (fallo: unknown) {
    errorFicha.value = obtenerMensajeError(fallo, 'No se pudo cargar tu información.')
  } finally {
    cargandoFicha.value = false
  }
}

async function consultar(): Promise<void> {
  if (!ficha.value || !mes.value) {
    clases.value = []
    return
  }

  const turno = ++consultaActual
  const { desde, hasta } = limitesMesEstudiante(mes.value)
  cargando.value = true
  error.value = ''

  try {
    const datos = await consultarClases(ficha.value.estudianteId, desde, hasta)
    if (turno === consultaActual) clases.value = datos
  } catch (fallo: unknown) {
    if (turno === consultaActual) {
      clases.value = []
      error.value = obtenerMensajeError(fallo, 'No se pudo cargar tu asistencia.')
    }
  } finally {
    if (turno === consultaActual) cargando.value = false
  }
}

async function abrirDocumento(clase: ClaseEstudiante): Promise<void> {
  errorDocumento.value = ''
  descargandoId.value = clase.asistenciaId

  try {
    const archivo = await descargarDocumento(clase)
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(archivo)
    enlace.download = clase.documentoNombre ?? 'justificacion'
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

watch(mes, () => {
  diaSeleccionado.value = null
  void consultar()
})

onMounted(cargarFicha)
</script>

<template>
  <main class="docente-vista asistencia-estudiante">
    <div class="docente-titulo">
      <div>
        <h1>Mi asistencia</h1>
        <p v-if="mes && !cargando && !error">
          {{ nombrarMesEstudiante(mes) }} · {{ resumen.total }} {{ unidad(resumen.total) }} registradas
        </p>
        <p v-else>Revisa tu asistencia clase por clase.</p>
      </div>
    </div>

    <PanelEstadoCarga
      v-if="cargandoFicha || errorFicha"
      :cargando="cargandoFicha"
      :error="errorFicha"
      @reintentar="cargarFicha"
    />

    <AvisoMensaje
      v-else-if="!mes"
      mensaje="Todavía no tienes una matrícula confirmada. Cuando el colegio la confirme, aquí verás tu asistencia."
    />

    <template v-else>
      <section v-if="resumen.total && !cargando && !error" class="indicadores" aria-label="Resumen del mes">
        <div class="indicador principal">
          <span class="titulo">Asistencia del mes</span>
          <strong>{{ resumen.porcentaje }} %</strong>
          <small>{{ resumen.total - resumen.AUSENTE }} de {{ resumen.total }} clases sin falta</small>
        </div>
        <div v-for="estado in ESTADOS_ASISTENCIA" :key="estado" class="indicador" :class="estado.toLowerCase()">
          <span class="titulo"
            ><i aria-hidden="true">{{ SIMBOLOS_CLASE[estado] }}</i> {{ NOMBRES_CLASE[estado] }}</span
          >
          <strong>{{ resumen[estado] }}</strong>
          <small>{{ unidad(resumen[estado]) }}</small>
          <div class="pista" aria-hidden="true"><div :style="{ width: porcentajeDe(resumen[estado]) }" /></div>
        </div>
      </section>

      <AvisoMensaje v-if="errorDocumento" :mensaje="errorDocumento" tipo="error" />
      <AvisoMensaje v-if="mensajeJustificacion" :mensaje="mensajeJustificacion" tipo="exito" />

      <div class="rejilla">
        <section class="docente-tarjeta calendario" aria-label="Calendario del mes">
          <header class="cabecera">
            <h2>{{ nombrarMesEstudiante(mes) }}</h2>
            <div class="navegacion">
              <button
                type="button"
                aria-label="Mes anterior"
                :disabled="indiceMes <= 0 || cargando"
                @click="irAMes(-1)"
              >
                ‹
              </button>
              <button type="button" class="hoy" :disabled="!puedeIrAHoy || cargando" @click="irAHoy">Hoy</button>
              <button
                type="button"
                aria-label="Mes siguiente"
                :disabled="indiceMes >= meses.length - 1 || cargando"
                @click="irAMes(1)"
              >
                ›
              </button>
            </div>
          </header>

          <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="consultar" />

          <template v-else>
            <div class="mes">
              <span v-for="dia in DIAS_SEMANA" :key="dia" class="dia-semana" aria-hidden="true">{{ dia }}</span>
              <template v-for="(celda, indice) in celdas" :key="celda?.fecha ?? `vacia-${indice}`">
                <span v-if="!celda" class="dia dia--vacio" aria-hidden="true" />
                <button
                  v-else-if="celda.clases.length"
                  type="button"
                  class="dia"
                  :class="claseDelDia(celda)"
                  :title="describirDiaEstudiante(celda.fecha, celda.clases)"
                  :aria-label="describirDiaEstudiante(celda.fecha, celda.clases)"
                  :aria-pressed="diaSeleccionado === celda.fecha"
                  @click="elegirDia(celda)"
                >
                  <span class="numero"
                    >{{ celda.numero }}<span v-if="celda.esHoy" class="etiqueta-hoy"> · hoy</span></span
                  >
                  <span class="circulos" aria-hidden="true">
                    <i
                      v-for="clase in celda.clases"
                      :key="clase.asistenciaId"
                      class="circulo"
                      :class="clase.estado.toLowerCase()"
                      >{{ SIMBOLOS_CLASE[clase.estado] }}</i
                    >
                  </span>
                  <span v-if="resumirDiaEstudiante(celda.clases)" class="resumen-dia">
                    {{ resumirDiaEstudiante(celda.clases) }}
                  </span>
                </button>
                <span v-else class="dia" :class="claseDelDia(celda)">
                  <span class="numero"
                    >{{ celda.numero }}<span v-if="celda.esHoy" class="etiqueta-hoy"> · hoy</span></span
                  >
                </span>
              </template>
            </div>

            <ul class="leyenda" aria-label="Leyenda">
              <li v-for="estado in LEYENDA" :key="estado">
                <i class="circulo" :class="estado.toLowerCase()" aria-hidden="true">{{ SIMBOLOS_CLASE[estado] }}</i>
                {{ NOMBRES_CLASE[estado] }}
              </li>
              <li class="explicacion">Cada círculo es una clase, en orden de hora</li>
            </ul>

            <p v-if="!clases.length" class="vacio">
              No tienes clases registradas en {{ nombrarMesEstudiante(mes, false) }}.
            </p>
            <p v-else-if="!detalle" class="ayuda">Haz clic en un día para ver sus clases.</p>

            <div v-if="detalle" class="detalle" aria-live="polite">
              <h3>
                <span
                  >{{ nombrarFechaEstudiante(detalle.fecha) }} · {{ detalle.clases.length }}
                  {{ unidad(detalle.clases.length) }}</span
                >
                <button type="button" class="enlace" @click="diaSeleccionado = null">Cerrar</button>
              </h3>
              <ul>
                <li v-for="clase in detalle.clases" :key="clase.asistenciaId">
                  <span class="hora">
                    {{ horaDeClaseFamilia(clase.horaInicio) }} – {{ horaDeClaseFamilia(clase.horaFin) }}
                  </span>
                  <span class="materia">
                    <strong>{{ clase.areaNombre }}</strong>
                    <small>{{ clase.docenteNombre }}</small>
                    <small v-if="clase.motivoJustificacion" class="justificacion">
                      Motivo: {{ clase.motivoJustificacion }}
                      <template v-if="clase.documentoUrl">
                        ·
                        <button
                          type="button"
                          class="enlace"
                          :disabled="descargandoId !== null"
                          @click="abrirDocumento(clase)"
                        >
                          {{ descargandoId === clase.asistenciaId ? 'Descargando…' : 'Ver documento' }}
                        </button>
                      </template>
                    </small>
                  </span>
                  <InsigniaEstado
                    :texto="NOMBRES_CLASE[clase.estado]"
                    :variante="clase.estado === 'PENDIENTE_MARCAJE' ? 'neutro' : VARIANTES_ESTADO[clase.estado]"
                  />
                </li>
              </ul>
            </div>
          </template>
        </section>

        <section class="docente-tarjeta incidencias" aria-label="Incidencias del mes">
          <h2>Incidencias de {{ nombrarMesEstudiante(mes, false) }}</h2>
          <p v-if="cargando" class="ayuda">Cargando…</p>
          <p v-else-if="!incidencias.length" class="sin-incidencias">✔ Sin faltas ni tardanzas este mes.</p>
          <ul v-else>
            <li v-for="incidencia in incidencias" :key="incidencia.clave">
              <div class="arriba">
                <strong>{{ fechaIncidencia(incidencia.fecha) }} · {{ tituloIncidenciaEstudiante(incidencia) }}</strong>
                <InsigniaEstado
                  :texto="NOMBRES_CLASE[incidencia.estado]"
                  :variante="VARIANTES_ESTADO[incidencia.estado]"
                />
              </div>
              <p v-if="incidencia.estado === 'JUSTIFICADA'">
                Motivo: «{{ incidencia.motivo ?? 'sin motivo' }}».
                <button
                  v-if="documentoDe(incidencia)"
                  type="button"
                  class="enlace"
                  :disabled="descargandoId !== null"
                  @click="abrirDocumentoDe(incidencia)"
                >
                  {{ descargandoId === documentoDe(incidencia)?.asistenciaId ? 'Descargando…' : 'Ver documento' }}
                </button>
              </p>
              <p v-else-if="incidencia.clases[0]">
                {{ horaDeClaseFamilia(incidencia.clases[0].horaInicio) }} –
                {{ horaDeClaseFamilia(incidencia.clases[0].horaFin) }} · {{ incidencia.clases[0].docenteNombre }}
                <template v-if="incidencia.estado === 'AUSENTE'"> · Sin justificar</template>
              </p>
              <FormularioJustificacionAsistencia
                v-if="
                  incidencia.estado === 'AUSENTE' &&
                  incidencia.clases[0] &&
                  asistenciaActivaId === incidencia.clases[0].asistenciaId
                "
                :asistencia-id="incidencia.clases[0].asistenciaId"
                @cancelar="asistenciaActivaId = null"
                @justificada="alJustificar"
              />
              <button
                v-else-if="incidencia.estado === 'AUSENTE' && incidencia.clases[0]"
                type="button"
                class="enlace"
                @click="abrirFormularioJustificacion(incidencia.clases[0].asistenciaId)"
              >
                Justificar inasistencia
              </button>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.docente-titulo p {
  margin: 0;
  color: #64748b;
}

.indicadores {
  display: grid;
  grid-template-columns: 1.25fr repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.indicador {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
}

.indicador .titulo {
  font-size: 13px;
  font-weight: 700;
}

.indicador .titulo i {
  font-style: normal;
}

.indicador strong {
  font-size: 26px;
  line-height: 1.2;
}

.indicador small {
  color: #64748b;
  font-size: 13px;
}

.indicador.principal strong {
  color: #15803d;
  font-size: 32px;
}

.presente .titulo,
.presente strong {
  color: #15803d;
}

.tardanza .titulo,
.tardanza strong {
  color: #d97706;
}

.ausente .titulo,
.ausente strong {
  color: #dc2626;
}

.justificada .titulo,
.justificada strong {
  color: #2563eb;
}

.pista {
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef0f4;
}

.pista div {
  height: 100%;
  border-radius: 999px;
  background: currentcolor;
}

.presente .pista {
  color: #16a34a;
}

.tardanza .pista {
  color: #f59e0b;
}

.ausente .pista {
  color: #dc2626;
}

.justificada .pista {
  color: #2563eb;
}

.rejilla {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.cabecera h2,
.incidencias h2 {
  margin: 0;
  font-size: 17px;
}

.navegacion {
  display: flex;
  gap: 6px;
}

.navegacion button {
  min-width: 36px;
  height: 36px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
}

.navegacion .hoy {
  padding: 0 12px;
  color: #1e40af;
  font-size: 13px;
}

.navegacion button:disabled {
  border-color: #e5e7eb;
  color: #c3c6d7;
  cursor: not-allowed;
}

.mes {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.dia-semana {
  padding-bottom: 2px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.dia {
  display: flex;
  min-width: 0;
  min-height: 68px;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: white;
  color: #191c1e;
  font: inherit;
  text-align: left;
}

button.dia {
  cursor: pointer;
}

button.dia:hover {
  border-color: #1e40af;
}

.dia--vacio {
  border: 0;
  background: transparent;
}

.dia--sin-clases {
  background: #f3f4f6;
  color: #9ca3af;
}

.dia--futuro {
  border-style: dashed;
  border-color: #d1d5db;
  color: #9ca3af;
}

.dia--completo {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.dia--incidencia {
  border-color: #fcd34d;
}

.dia--falta {
  border-color: #fca5a5;
}

.dia--hoy {
  box-shadow: inset 0 0 0 2px #1e40af;
}

.dia--elegido {
  outline: 3px solid #191c1e;
  outline-offset: 1px;
}

.numero {
  font-size: 14px;
  font-weight: 700;
}

.etiqueta-hoy {
  font-weight: 600;
}

.circulos {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.circulo {
  display: inline-grid;
  width: 14px;
  height: 14px;
  flex: none;
  place-items: center;
  border-radius: 999px;
  color: white;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
  line-height: 1;
}

.circulo.presente {
  background: #16a34a;
}

.circulo.tardanza {
  background: #d97706;
}

.circulo.ausente {
  background: #dc2626;
}

.circulo.justificada {
  background: #2563eb;
}

.circulo.pendiente_marcaje {
  border: 2px dashed #9ca3af;
  background: white;
}

.resumen-dia {
  overflow: hidden;
  max-width: 100%;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leyenda {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 12px 0 0;
  padding: 0;
  color: #64748b;
  font-size: 13px;
  list-style: none;
}

.leyenda li {
  display: flex;
  align-items: center;
  gap: 5px;
}

.leyenda .explicacion {
  flex-basis: 100%;
}

.ayuda,
.vacio {
  margin: 10px 0 0;
  color: #64748b;
  font-size: 14px;
}

.detalle {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}

.detalle h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0 0 6px;
  font-size: 15px;
}

.detalle ul,
.incidencias ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.detalle li {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
}

.materia {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.materia small {
  color: #64748b;
}

.materia .justificacion {
  color: #1e3a8a;
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

.enlace:disabled {
  color: #94a3b8;
  cursor: wait;
}

.incidencias {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.incidencias li {
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
}

.incidencias li + li {
  margin-top: 8px;
}

.incidencias .arriba {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.incidencias p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

.sin-incidencias {
  margin: 0;
  color: #15803d;
  font-size: 14px;
}

@media (max-width: 1100px) {
  .indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .indicador.principal {
    grid-column: 1 / -1;
  }

  .rejilla {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .mes {
    gap: 5px;
  }

  .dia {
    min-height: 58px;
    padding: 4px 5px;
  }

  .circulo {
    width: 13px;
    height: 13px;
    font-size: 8px;
  }

  .resumen-dia,
  .etiqueta-hoy {
    display: none;
  }

  .detalle li {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .detalle .hora {
    grid-column: 1 / -1;
    color: #64748b;
  }
}
</style>
