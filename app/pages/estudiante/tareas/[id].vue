<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  TIPOS_ARCHIVO_TAREA,
  colorAreaTarea,
  cuentaRegresivaTarea,
  extensionArchivoTarea,
  formatearFechaLargaTarea,
  formatearFechaTarea,
  formatearTamanioArchivo,
  useTareasEstudiante,
  validarArchivoTarea,
} from '~/composables/useTareasEstudiante'
import type { TareaEstudiante } from '~/types/tareaEstudiante'

definePageMeta({ middleware: 'autenticacion', layout: 'estudiante' })

const ruta = useRoute()
const { obtener, entregar, descargarArchivo } = useTareasEstudiante()

const tarea = ref<TareaEstudiante | null>(null)
const cargando = ref(true)
const error = ref('')
const archivo = ref<File | null>(null)
const errorArchivo = ref('')
const progreso = ref<number | null>(null)
const recienEntregada = ref(false)
const reemplazando = ref(false)
const arrastrando = ref(false)
const descargando = ref(false)
const entrada = ref<HTMLInputElement | null>(null)
const ahora = ref(new Date())
let reloj: ReturnType<typeof setInterval> | undefined

const tareaId = computed(() => Number(ruta.params.id))
const cuenta = computed(() => (tarea.value ? cuentaRegresivaTarea(tarea.value.fechaLimite, ahora.value) : null))
const subiendo = computed(() => progreso.value !== null)
const muestraSubida = computed(
  () => !!tarea.value && tarea.value.puedeEntregar && (tarea.value.estado !== 'ENTREGADA' || reemplazando.value),
)
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const calificada = computed(() => Boolean(tarea.value?.nota || tarea.value?.notaJustificada))
const fechaCalificada = computed(() => {
  const fecha = tarea.value?.fechaCalificacion
  if (!fecha) return ''
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number) as [number, number, number]
  return `${DIAS_SEMANA[new Date(anio, mes - 1, dia).getDay()]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
})
const inicialesDocente = computed(() =>
  (tarea.value?.docente ?? '')
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join(''),
)

const textoEstado = computed(() => {
  if (!tarea.value || !cuenta.value) return ''
  if (tarea.value.estado === 'ENTREGADA') return '✓ Entregada'
  if (tarea.value.estado === 'VENCIDA')
    return `Vencida · venció ${formatearFechaTarea(tarea.value.fechaLimite, ahora.value)}`
  return `Por entregar · ${cuenta.value.texto.toLowerCase()}`
})
const claseEstado = computed(() => {
  if (!tarea.value) return ''
  if (tarea.value.estado === 'ENTREGADA') return 'pastilla--ok'
  if (tarea.value.estado === 'VENCIDA') return 'pastilla--vencida'
  return `pastilla--${cuenta.value?.nivel ?? 'dias'}`
})

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    tarea.value = await obtener(tareaId.value)
    ahora.value = new Date()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar la tarea.')
  } finally {
    cargando.value = false
  }
}

function elegir(seleccionado: File | null | undefined): void {
  errorArchivo.value = ''
  recienEntregada.value = false
  if (!seleccionado) return
  const mensaje = validarArchivoTarea(seleccionado)
  archivo.value = seleccionado
  errorArchivo.value = mensaje
}

function alElegir(evento: Event): void {
  const campo = evento.target as HTMLInputElement
  elegir(campo.files?.[0])
  campo.value = ''
}

function alSoltar(evento: DragEvent): void {
  arrastrando.value = false
  elegir(evento.dataTransfer?.files?.[0])
}

function quitar(): void {
  archivo.value = null
  errorArchivo.value = ''
}

function cancelarReemplazo(): void {
  reemplazando.value = false
  quitar()
}

async function enviar(): Promise<void> {
  if (!tarea.value || !archivo.value || errorArchivo.value || subiendo.value) return
  progreso.value = 0
  try {
    tarea.value = await entregar(tarea.value.id, archivo.value, (porcentaje) => {
      progreso.value = porcentaje
    })
    archivo.value = null
    reemplazando.value = false
    recienEntregada.value = true
  } catch (fallo: unknown) {
    errorArchivo.value = obtenerMensajeError(fallo, 'No se pudo entregar la tarea.')
    if (errorArchivo.value.includes('fecha límite')) void cargar()
  } finally {
    progreso.value = null
    ahora.value = new Date()
  }
}

async function descargar(): Promise<void> {
  if (!tarea.value?.archivoNombre) return
  descargando.value = true
  try {
    await descargarArchivo(tarea.value.id, tarea.value.archivoNombre)
  } catch (fallo: unknown) {
    errorArchivo.value = obtenerMensajeError(fallo, 'No se pudo descargar el archivo.')
  } finally {
    descargando.value = false
  }
}

onMounted(() => {
  void cargar()
  reloj = setInterval(() => {
    ahora.value = new Date()
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(reloj))
</script>

<template>
  <main class="docente-vista detalle-tarea">
    <NuxtLink to="/estudiante/tareas" class="volver">← Mis tareas</NuxtLink>

    <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargar" />

    <div v-else-if="tarea" class="columnas">
      <article class="docente-tarjeta consigna">
        <span class="area">
          <span class="punto" :style="{ background: colorAreaTarea(tarea.areaCodigo) }" aria-hidden="true" />
          {{ tarea.area ?? tarea.competencia }}<template v-if="tarea.docente"> · Prof. {{ tarea.docente }}</template>
        </span>
        <h1>{{ tarea.titulo }}</h1>
        <span :class="['pastilla', claseEstado]">{{ textoEstado }}</span>

        <dl class="datos">
          <div>
            <dt>Fecha límite</dt>
            <dd>{{ formatearFechaTarea(tarea.fechaLimite, ahora) }}</dd>
          </div>
          <div>
            <dt>Peso en la nota</dt>
            <dd v-if="tarea.cuentaParaNota">
              {{ Number(tarea.ponderacion) }} %<span class="secundario"> · bimestre {{ tarea.bimestre }}</span>
            </dd>
            <dd v-else>No cuenta para la nota</dd>
          </div>
          <div class="ancho">
            <dt>Competencia</dt>
            <dd>{{ tarea.competencia }}</dd>
          </div>
        </dl>

        <h2>Consigna</h2>
        <p class="descripcion">{{ tarea.descripcion }}</p>
      </article>

      <div class="lateral">
        <aside class="docente-tarjeta entrega" aria-labelledby="titulo-entrega">
          <h2 id="titulo-entrega">Tu entrega</h2>

          <template v-if="tarea.estado === 'ENTREGADA' && !reemplazando">
            <div class="recibo" role="status">
              <strong>✓ {{ recienEntregada ? '¡Tarea entregada!' : 'Tarea entregada' }}</strong>
              <span v-if="tarea.origen === 'DOCENTE'">Tu docente registró tu entrega.</span>
              <span v-else-if="tarea.fechaEntrega">El {{ formatearFechaLargaTarea(tarea.fechaEntrega) }}.</span>
            </div>
            <div v-if="tarea.archivoNombre && tarea.origen === 'ALUMNO'" class="archivo">
              <span class="archivo__tipo">{{ extensionArchivoTarea(tarea.archivoNombre) }}</span>
              <span class="archivo__datos">
                <strong>{{ tarea.archivoNombre }}</strong>
                <small>{{ formatearTamanioArchivo(tarea.archivoTamanio) }}</small>
              </span>
              <button type="button" class="enlace" :disabled="descargando" @click="descargar">
                {{ descargando ? 'Descargando…' : 'Descargar' }}
              </button>
            </div>
            <template v-if="tarea.puedeEntregar && tarea.origen === 'ALUMNO'">
              <button
                type="button"
                class="docente-boton docente-boton--secundario ancho-total"
                @click="reemplazando = true"
              >
                Reemplazar archivo
              </button>
              <small class="nota"
                >Puedes reemplazarlo hasta el {{ formatearFechaTarea(tarea.fechaLimite, ahora) }}.</small
              >
            </template>
            <small v-else-if="calificada && tarea.origen === 'ALUMNO'" class="nota">
              Tu docente ya calificó esta entrega, así que el archivo ya no se puede reemplazar.
            </small>
          </template>

          <AvisoMensaje
            v-else-if="calificada"
            mensaje="Tu docente ya calificó esta tarea, así que ya no se puede entregar por el sistema."
          />

          <template v-else-if="tarea.estado === 'VENCIDA' || !tarea.puedeEntregar">
            <AvisoMensaje
              mensaje="No se registró tu entrega y la fecha límite ya pasó. Si tuviste un motivo, conversa con tu docente: puede registrarla por ti."
            />
          </template>

          <template v-if="muestraSubida">
            <p v-if="tarea.archivoNombre && tarea.estado === 'PENDIENTE'" class="nota">
              Tu docente revirtió la entrega de "{{ tarea.archivoNombre }}". Vuelve a entregarla.
            </p>
            <div
              v-if="!archivo"
              :class="['zona', { 'zona--activa': arrastrando }]"
              @dragover.prevent="arrastrando = true"
              @dragleave="arrastrando = false"
              @drop.prevent="alSoltar"
            >
              <span aria-hidden="true">📎</span>
              <strong>Arrastra tu archivo aquí</strong>
              <span>
                o
                <button type="button" class="enlace" @click="entrada?.click()">elígelo de tu equipo</button>
              </span>
              <small>{{ TIPOS_ARCHIVO_TAREA }} · máximo 10 MB</small>
              <input
                ref="entrada"
                type="file"
                class="solo-lectores"
                aria-label="Elegir archivo de la tarea"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                @change="alElegir"
              />
            </div>
            <div v-else :class="['archivo', { 'archivo--error': errorArchivo }]">
              <span class="archivo__tipo">{{ extensionArchivoTarea(archivo.name) }}</span>
              <span class="archivo__datos">
                <strong>{{ archivo.name }}</strong>
                <small>{{
                  subiendo
                    ? progreso! >= 100
                      ? 'Guardando tu entrega…'
                      : `Subiendo… ${progreso} %`
                    : formatearTamanioArchivo(archivo.size)
                }}</small>
              </span>
              <button v-if="!subiendo" type="button" class="enlace" @click="quitar">Quitar</button>
            </div>
            <div
              v-if="subiendo"
              class="progreso"
              role="progressbar"
              :aria-valuenow="progreso ?? 0"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Progreso de la entrega"
            >
              <span :style="{ width: `${progreso}%` }" />
            </div>
            <p v-if="errorArchivo" class="error" role="alert">{{ errorArchivo }}</p>
            <button
              type="button"
              class="docente-boton ancho-total enviar"
              :disabled="!archivo || !!errorArchivo || subiendo"
              @click="enviar"
            >
              {{ subiendo ? 'Entregando…' : reemplazando ? 'Reemplazar entrega' : 'Entregar tarea' }}
            </button>
            <button v-if="reemplazando && !subiendo" type="button" class="enlace centrado" @click="cancelarReemplazo">
              Mantener mi entrega actual
            </button>
            <small v-else-if="!subiendo" class="nota">Puedes reemplazar tu archivo hasta la fecha límite.</small>
          </template>
        </aside>

        <section v-if="tarea.cuentaParaNota" class="docente-tarjeta calificacion" aria-labelledby="titulo-calificacion">
          <h2 id="titulo-calificacion">Calificación</h2>
          <template v-if="calificada">
            <div class="calificacion__nota">
              <span class="insignia">{{ tarea.notaJustificada ? 'J' : tarea.nota }}</span>
              <span>
                <strong>{{
                  tarea.notaJustificada ? 'Evaluación justificada' : `Calificada el ${fechaCalificada}`
                }}</strong>
                <small>
                  {{
                    tarea.notaJustificada
                      ? 'No cuenta en tu nota del bimestre.'
                      : `Suma a tu nota del bimestre ${tarea.bimestre}`
                  }}
                </small>
              </span>
            </div>
            <blockquote v-if="tarea.comentario" class="comentario">
              <span class="comentario__autor">
                <span class="iniciales" aria-hidden="true">{{ inicialesDocente }}</span>
                {{ tarea.docente ? `Prof. ${tarea.docente}` : 'Tu docente' }}
              </span>
              <p>{{ tarea.comentario }}</p>
            </blockquote>
          </template>
          <p v-else class="sin-calificar">Aún sin calificar.</p>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.detalle-tarea {
  max-width: 1100px;
}

.volver {
  align-self: flex-start;
  color: #1e40af;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.volver:hover {
  text-decoration: underline;
}

.columnas {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 16px;
  align-items: start;
}

.consigna,
.entrega {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.lateral {
  position: sticky;
  top: 16px;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 16px;
}

.secundario {
  color: #64748b;
  font-weight: 500;
}

.calificacion {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calificacion h2 {
  margin: 0;
  font-size: 16px;
}

.calificacion__nota {
  display: flex;
  align-items: center;
  gap: 12px;
}

.calificacion__nota strong {
  display: block;
  color: #0f172a;
  font-size: 15px;
}

.calificacion__nota small {
  color: #475569;
  font-size: 12.5px;
}

.insignia {
  display: grid;
  flex: none;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 14px;
  background: #eff4ff;
  color: #1e40af;
  font-size: 26px;
  font-weight: 800;
}

.comentario {
  margin: 0;
  padding: 10px 12px;
  border-left: 3px solid #93b4fa;
  border-radius: 0 10px 10px 0;
  background: #f8fafc;
}

.comentario__autor {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.iniciales {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 50%;
  background: #dbeafe;
  color: #1e40af;
  font-size: 10.5px;
  font-weight: 800;
}

.comentario p {
  margin: 0;
  color: #0f172a;
  font-size: 13.5px;
  white-space: pre-line;
}

.sin-calificar {
  margin: 0;
  color: #64748b;
  font-size: 13.5px;
}

.area {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-size: 12.5px;
  font-weight: 700;
}

.punto {
  width: 10px;
  height: 10px;
  flex: none;
  border-radius: 50%;
}

h1 {
  margin: 0;
  font-size: 24px;
  overflow-wrap: anywhere;
}

h2 {
  margin: 4px 0 0;
  font-size: 16px;
}

.pastilla {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 700;
}

.pastilla--hoy {
  background: #fee2e2;
  color: #991b1b;
}

.pastilla--dias {
  background: #fef3c7;
  color: #92400e;
}

.pastilla--lejos {
  background: #e0e7ff;
  color: #3730a3;
}

.pastilla--ok {
  background: #dcfce7;
  color: #166534;
}

.pastilla--vencida {
  background: #f1f5f9;
  color: #475569;
}

.datos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 4px 0 0;
}

.datos div {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
}

.datos .ancho {
  grid-column: 1 / -1;
}

.datos dt {
  color: #6b7280;
  font-size: 11.5px;
  font-weight: 600;
}

.datos dd {
  margin: 2px 0 0;
  font-size: 14px;
  font-weight: 600;
}

.descripcion {
  margin: 0;
  color: #434655;
  font-size: 14.5px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.zona {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 14px;
  border: 2px dashed #93b4fa;
  border-radius: 12px;
  background: #f8fbff;
  color: #434655;
  font-size: 14px;
  text-align: center;
}

.zona--activa {
  border-color: #004ac6;
  background: #eff4ff;
}

.zona strong {
  color: #191c1e;
}

.zona small {
  color: #6b7280;
}

.archivo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 10px;
  font-size: 13.5px;
}

.archivo--error {
  border-color: #fca5a5;
}

.archivo__tipo {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 8px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 11px;
  font-weight: 800;
}

.archivo__datos {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.archivo__datos strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archivo__datos small {
  color: #6b7280;
}

.progreso {
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
}

.progreso span {
  display: block;
  height: 100%;
  background: #004ac6;
  transition: width 0.2s ease;
}

.recibo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid #bbf7d0;
  border-radius: 12px;
  background: #f0fdf4;
  color: #14532d;
  font-size: 14px;
}

.recibo strong {
  font-size: 15px;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: #1e40af;
  font: inherit;
  font-size: 13.5px;
  text-decoration: underline;
  cursor: pointer;
}

.enlace:focus-visible,
.volver:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.centrado {
  align-self: center;
}

.ancho-total {
  width: 100%;
  justify-content: center;
}

.enviar {
  padding-block: 12px;
}

.error {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-left: 4px solid #dc2626;
  border-radius: 10px;
  background: #fef2f2;
  color: #7f1d1d;
  font-size: 13.5px;
}

.nota {
  margin: 0;
  color: #6b7280;
  font-size: 12.5px;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 860px) {
  .columnas {
    grid-template-columns: 1fr;
  }

  .lateral {
    position: static;
  }
}

@media (max-width: 480px) {
  .datos {
    grid-template-columns: 1fr;
  }

  .enviar {
    position: sticky;
    bottom: 8px;
    box-shadow: 0 6px 16px rgb(0 0 0 / 0.15);
  }
}
</style>
