<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AlumnoClase, Calificacion, MovimientoCalificacion, NotaCualitativa } from '~/types/calificacion'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  ATAJOS_MOTIVO_RECTIFICACION,
  LONGITUD_MAXIMA_MOTIVO_RECTIFICACION,
  aplicarAtajoMotivo,
  useCalificaciones,
  validarMotivoRectificacion,
} from '~/composables/useCalificaciones'
import { NOTAS } from '~/composables/useMisClases'

const TAMANIO_MAXIMO = 10 * 1024 * 1024

const propiedades = defineProps<{
  abierta: boolean
  alumno: AlumnoClase | null
  contexto: string
  periodoId: number
  bimestre: number
  competenciaCodigo: string
  actual: Calificacion | null
}>()

const emitir = defineEmits<{
  cerrar: []
  guardada: [calificacion: Calificacion, notaAnterior: NotaCualitativa]
}>()

const { registrar, historial: consultarHistorial } = useCalificaciones()

const nota = ref<NotaCualitativa | ''>('')
const observacion = ref('')
const motivo = ref('')
const reemplazarEvidencia = ref(false)
const tipoEvidencia = ref<'URL' | 'ARCHIVO'>('URL')
const evidenciaUrl = ref('')
const archivo = ref<File | null>(null)
const entradaArchivo = ref<HTMLInputElement | null>(null)
const errorMotivo = ref('')
const error = ref('')
const guardando = ref(false)
const movimientos = ref<MovimientoCalificacion[] | null>(null)
const errorHistorial = ref('')

const descripcionNota = computed(() => new Map(NOTAS.map((opcion) => [opcion.valor, opcion.descripcion])))
const nombreEvidencia = computed(() => {
  const actual = propiedades.actual
  if (!actual) return ''
  return actual.evidenciaTipo === 'ARCHIVO' ? actual.evidenciaNombre || 'archivo adjunto' : 'enlace de evidencia'
})
const evidenciaNueva = computed(
  () =>
    reemplazarEvidencia.value &&
    (tipoEvidencia.value === 'URL' ? Boolean(evidenciaUrl.value.trim()) : Boolean(archivo.value)),
)
const hayCambios = computed(() => {
  const actual = propiedades.actual
  if (!actual || !nota.value) return false
  return (
    nota.value !== actual.nota || observacion.value.trim() !== (actual.observacion ?? '').trim() || evidenciaNueva.value
  )
})

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (!abierta) return
    const actual = propiedades.actual
    nota.value = actual?.nota ?? ''
    observacion.value = actual?.observacion ?? ''
    motivo.value = ''
    reemplazarEvidencia.value = false
    tipoEvidencia.value = 'URL'
    evidenciaUrl.value = ''
    archivo.value = null
    errorMotivo.value = ''
    error.value = ''
    movimientos.value = null
    errorHistorial.value = ''
    if (actual) void cargarHistorial(actual.id)
  },
)

watch(motivo, () => {
  if (errorMotivo.value) errorMotivo.value = validarMotivoRectificacion(motivo.value)
})
watch([nota, observacion, evidenciaUrl, tipoEvidencia], () => {
  error.value = ''
})

async function cargarHistorial(calificacionId: number): Promise<void> {
  try {
    movimientos.value = await consultarHistorial(calificacionId)
  } catch (fallo: unknown) {
    errorHistorial.value = obtenerMensajeError(fallo, 'No se pudo cargar el historial de la nota.')
  }
}

function elegirAtajo(atajo: string): void {
  motivo.value = aplicarAtajoMotivo(motivo.value, atajo).slice(0, LONGITUD_MAXIMA_MOTIVO_RECTIFICACION)
}

function atajoActivo(atajo: string): boolean {
  return motivo.value.startsWith(`${atajo}:`)
}

function alternarEvidencia(): void {
  reemplazarEvidencia.value = !reemplazarEvidencia.value
  evidenciaUrl.value = ''
  archivo.value = null
  error.value = ''
}

function elegirArchivo(evento: Event): void {
  const elegido = (evento.target as HTMLInputElement).files?.[0] ?? null
  error.value = ''
  if (elegido && elegido.size > TAMANIO_MAXIMO) {
    archivo.value = null
    ;(evento.target as HTMLInputElement).value = ''
    error.value = 'El archivo supera los 10 MB permitidos.'
    return
  }
  archivo.value = elegido
}

function validarEvidencia(): string {
  if (!reemplazarEvidencia.value) return ''
  if (tipoEvidencia.value === 'URL') {
    const url = evidenciaUrl.value.trim()
    if (!url) return 'Ingresa el nuevo enlace o mantén la evidencia actual.'
    if (!/^https?:\/\/\S+$/i.test(url)) return 'El enlace debe empezar con http:// o https://.'
  } else if (!archivo.value) {
    return 'Adjunta el nuevo archivo o mantén la evidencia actual.'
  }
  return ''
}

function fechaHora(valor: string): string {
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime())
    ? valor
    : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(fecha)
}

async function guardar(): Promise<void> {
  const actual = propiedades.actual
  if (!actual || !propiedades.alumno || !nota.value || !hayCambios.value) return
  error.value = validarEvidencia()
  errorMotivo.value = validarMotivoRectificacion(motivo.value)
  if (error.value || errorMotivo.value) return
  guardando.value = true
  try {
    const conUrl = reemplazarEvidencia.value && tipoEvidencia.value === 'URL'
    const calificacion = await registrar(
      {
        periodoId: propiedades.periodoId,
        bimestre: propiedades.bimestre,
        matriculaId: propiedades.alumno.matriculaId,
        competenciaCodigo: propiedades.competenciaCodigo,
        nota: nota.value,
        observacion: observacion.value.trim(),
        evidenciaUrl: conUrl ? evidenciaUrl.value.trim() : null,
        motivo: motivo.value.trim(),
      },
      reemplazarEvidencia.value && tipoEvidencia.value === 'ARCHIVO' ? archivo.value : null,
    )
    emitir('guardada', calificacion, actual.nota)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo guardar la rectificación.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    titulo="Rectificar calificación"
    :descripcion="alumno ? `${alumno.nombreCompleto} · ${contexto} · Bimestre ${bimestre}` : contexto"
    :bloqueada="guardando"
    @cerrar="emitir('cerrar')"
  >
    <form v-if="actual" id="formulario-rectificacion" class="formulario" novalidate @submit.prevent="guardar">
      <div class="actual">
        <span :class="['chip', `chip--${actual.nota}`]">{{ actual.nota }}</span>
        <strong>Nota actual · {{ descripcionNota.get(actual.nota) }}</strong>
        <span>Última modificación: {{ fechaHora(actual.fechaRegistro) }}</span>
      </div>

      <fieldset class="notas">
        <legend>Nueva nota <span class="obligatorio">*</span></legend>
        <label v-for="opcion in NOTAS" :key="opcion.valor" :class="['nota', `nota--${opcion.valor}`]">
          <input v-model="nota" type="radio" name="nota-rectificada" :value="opcion.valor" :disabled="guardando" />
          <span v-if="opcion.valor === actual.nota" class="actual-marca">Actual</span>
          <strong>{{ opcion.valor }}</strong>
          <small>{{ opcion.descripcion }}</small>
        </label>
      </fieldset>

      <div class="evidencia">
        <div class="evidencia__resumen">
          <span v-if="!reemplazarEvidencia">
            Evidencia: se mantiene <strong>{{ nombreEvidencia }}</strong>
          </span>
          <span v-else>Nueva evidencia</span>
          <button type="button" class="enlace" :disabled="guardando" @click="alternarEvidencia">
            {{ reemplazarEvidencia ? 'Mantener la actual' : 'Reemplazar evidencia' }}
          </button>
        </div>
        <template v-if="reemplazarEvidencia">
          <div class="alternar" role="radiogroup" aria-label="Tipo de evidencia">
            <label :class="{ activo: tipoEvidencia === 'URL' }">
              <input v-model="tipoEvidencia" type="radio" value="URL" :disabled="guardando" />Enlace
            </label>
            <label :class="{ activo: tipoEvidencia === 'ARCHIVO' }">
              <input v-model="tipoEvidencia" type="radio" value="ARCHIVO" :disabled="guardando" />Archivo
            </label>
          </div>
          <div v-if="tipoEvidencia === 'URL'" class="campo">
            <label for="rectificacion-url" class="solo-lectores">Enlace de la nueva evidencia</label>
            <input
              id="rectificacion-url"
              v-model="evidenciaUrl"
              type="url"
              inputmode="url"
              placeholder="https://drive.google.com/..."
              :disabled="guardando"
            />
          </div>
          <div v-else class="campo">
            <label for="rectificacion-archivo" class="solo-lectores">Archivo de la nueva evidencia</label>
            <input
              id="rectificacion-archivo"
              ref="entradaArchivo"
              type="file"
              :disabled="guardando"
              @change="elegirArchivo"
            />
            <small class="ayuda">{{ archivo ? archivo.name : 'PDF, imagen o documento de hasta 10 MB.' }}</small>
          </div>
        </template>
      </div>

      <div class="campo">
        <label for="rectificacion-observacion">Observación para el alumno</label>
        <textarea
          id="rectificacion-observacion"
          v-model="observacion"
          rows="2"
          maxlength="1000"
          :disabled="guardando"
        />
        <small class="ayuda">Retroalimentación que verán el alumno y su apoderado (opcional).</small>
      </div>

      <div class="motivo">
        <label for="rectificacion-motivo" class="motivo__titulo">
          Motivo de la rectificación <span class="obligatorio">*</span>
        </label>
        <div class="atajos" role="group" aria-label="Motivos frecuentes">
          <button
            v-for="atajo in ATAJOS_MOTIVO_RECTIFICACION"
            :key="atajo"
            type="button"
            :class="['atajo', { 'atajo--activo': atajoActivo(atajo) }]"
            :aria-pressed="atajoActivo(atajo)"
            :disabled="guardando"
            @click="elegirAtajo(atajo)"
          >
            {{ atajo }}
          </button>
        </div>
        <textarea
          id="rectificacion-motivo"
          v-model="motivo"
          rows="3"
          :maxlength="LONGITUD_MAXIMA_MOTIVO_RECTIFICACION"
          placeholder="Explica por qué cambias la nota (mínimo 10 caracteres)"
          :class="{ invalido: errorMotivo }"
          :aria-invalid="Boolean(errorMotivo)"
          aria-describedby="rectificacion-motivo-ayuda"
          :disabled="guardando"
        />
        <div id="rectificacion-motivo-ayuda" class="motivo__pie">
          <span>Queda en el registro de auditoría. No lo ven el alumno ni el apoderado.</span>
          <span>{{ motivo.length }}/{{ LONGITUD_MAXIMA_MOTIVO_RECTIFICACION }}</span>
        </div>
        <p v-if="errorMotivo" class="error-campo" role="alert">{{ errorMotivo }}</p>
      </div>

      <p class="cambio" aria-live="polite">
        <template v-if="nota && nota !== actual.nota">
          <span :class="['chip', `chip--${actual.nota}`]">{{ actual.nota }}</span>
          <span class="flecha" aria-hidden="true">→</span>
          <span :class="['chip', `chip--${nota}`]">{{ nota }}</span>
          <span> La nota cambiará de {{ descripcionNota.get(actual.nota) }} a {{ descripcionNota.get(nota) }} </span>
        </template>
        <template v-else-if="hayCambios"
          >Se mantiene la nota {{ actual.nota }}; se actualizarán los demás datos.</template
        >
        <template v-else>Sin cambios: elige otra nota o cambia la observación o la evidencia.</template>
      </p>

      <details class="historial">
        <summary>
          Historial de esta nota<template v-if="movimientos"> ({{ movimientos.length }})</template>
        </summary>
        <p v-if="errorHistorial" class="historial__vacio">{{ errorHistorial }}</p>
        <p v-else-if="!movimientos" class="historial__vacio">Cargando historial…</p>
        <HistorialCalificacionLista v-else :movimientos="movimientos" />
      </details>

      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    </form>

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="guardando" @click="emitir('cerrar')">Cancelar</BotonAccion>
      <BotonAccion tipo="submit" form="formulario-rectificacion" :deshabilitado="guardando || !hayCambios">
        {{ guardando ? 'Guardando...' : 'Guardar rectificación' }}
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

legend,
.campo > label:not(.solo-lectores),
.motivo__titulo {
  display: block;
  margin-bottom: 8px;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.obligatorio {
  color: #dc2626;
}

.actual {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 14px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 14px;
}

.actual .chip {
  grid-row: span 2;
  min-width: 52px;
  padding: 8px 12px;
  font-size: 18px;
}

.actual > span:last-child {
  color: #434655;
  font-size: 13px;
}

.chip {
  display: inline-flex;
  min-width: 36px;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.chip--AD {
  background: #dcfce7;
  color: #166534;
}

.chip--A {
  background: #dbeafe;
  color: #1e40af;
}

.chip--B {
  background: #fef3c7;
  color: #92400e;
}

.chip--C {
  background: #fee2e2;
  color: #991b1b;
}

.notas {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.notas legend {
  grid-column: 1 / -1;
}

.nota {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 6px;
  border: 1px solid #c3c6d7;
  border-radius: 10px;
  background: white;
  cursor: pointer;
  text-align: center;
}

.nota input,
.alternar input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.nota strong {
  font-size: 20px;
}

.nota small {
  color: #434655;
  font-size: 11px;
}

.actual-marca {
  position: absolute;
  top: -9px;
  left: 50%;
  padding: 1px 7px;
  border-radius: 999px;
  background: #334155;
  color: white;
  font-size: 10.5px;
  font-weight: 700;
  transform: translateX(-50%);
  white-space: nowrap;
}

.nota:has(input:focus-visible),
.alternar label:has(input:focus-visible) {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.nota:has(input:checked) {
  border-width: 2px;
  padding: 11px 5px;
}

.nota--AD:has(input:checked) {
  border-color: #047857;
  background: #ecfdf5;
  color: #065f46;
}

.nota--A:has(input:checked) {
  border-color: #1d4ed8;
  background: #eff6ff;
  color: #1e3a8a;
}

.nota--B:has(input:checked) {
  border-color: #b45309;
  background: #fffbeb;
  color: #92400e;
}

.nota--C:has(input:checked) {
  border-color: #b91c1c;
  background: #fef2f2;
  color: #991b1b;
}

.evidencia {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.evidencia__resumen {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 10px 14px;
  border: 1px dashed #c3c6d7;
  border-radius: 10px;
  color: #434655;
  font-size: 13.5px;
}

.evidencia__resumen strong {
  color: #191c1e;
  overflow-wrap: anywhere;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: #004ac6;
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
  text-decoration: underline;
}

.alternar {
  display: inline-flex;
  align-self: flex-start;
  padding: 3px;
  border-radius: 8px;
  background: #eceef0;
}

.alternar label {
  position: relative;
  padding: 6px 14px;
  border-radius: 6px;
  color: #434655;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.alternar label.activo {
  background: white;
  color: #004ac6;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.campo input,
.campo textarea,
.motivo textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 14px;
}

textarea {
  resize: vertical;
}

.ayuda {
  margin-top: 6px;
  color: #434655;
  font-size: 12px;
}

.motivo {
  padding: 14px;
  border: 2px solid #c4b5fd;
  border-radius: 12px;
  background: #faf7ff;
}

.atajos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.atajo {
  padding: 6px 12px;
  border: 1px solid #c4b5fd;
  border-radius: 999px;
  background: white;
  color: #5b21b6;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.atajo--activo {
  border-color: #7c3aed;
  background: #7c3aed;
  color: white;
}

.atajo:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.motivo textarea.invalido {
  border-color: #dc2626;
  background: #fff7f7;
}

.motivo__pie {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
  color: #434655;
  font-size: 12px;
}

.error-campo {
  margin: 6px 0 0;
  color: #b91c1c;
  font-size: 12.5px;
  font-weight: 600;
}

.cambio {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px 10px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.flecha {
  color: #6b7280;
  font-size: 18px;
}

.historial {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 13.5px;
}

.historial summary {
  padding: 10px 14px;
  font-weight: 600;
  cursor: pointer;
}

.historial :deep(.linea),
.historial__vacio {
  margin: 0;
  padding: 4px 14px 12px;
}

.historial__vacio {
  color: #434655;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 480px) {
  .motivo__pie {
    flex-direction: column;
    gap: 2px;
  }
}
</style>
