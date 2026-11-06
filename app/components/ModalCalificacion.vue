<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AlumnoClase, Calificacion, NotaCualitativa } from '~/types/calificacion'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useCalificaciones } from '~/composables/useCalificaciones'
import { NOTAS } from '~/composables/useMisClases'

const TAMANIO_MAXIMO = 10 * 1024 * 1024

const propiedades = defineProps<{
  abierta: boolean
  alumno: AlumnoClase | null
  contexto: string
  periodoId: number
  competenciaCodigo: string
  actual: Calificacion | null
  haySiguiente: boolean
}>()

const emitir = defineEmits<{
  cerrar: []
  guardada: [calificacion: Calificacion, siguiente: boolean]
}>()

const { registrar } = useCalificaciones()

const nota = ref<NotaCualitativa | ''>('')
const tipoEvidencia = ref<'URL' | 'ARCHIVO'>('URL')
const evidenciaUrl = ref('')
const archivo = ref<File | null>(null)
const observacion = ref('')
const guardando = ref(false)
const error = ref('')
const entradaArchivo = ref<HTMLInputElement | null>(null)

const archivoAnterior = computed(() =>
  propiedades.actual?.evidenciaTipo === 'ARCHIVO' ? propiedades.actual.evidenciaNombre || 'archivo adjunto' : '',
)
const titulo = computed(() => (propiedades.actual ? 'Editar calificación' : 'Registrar calificación'))

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (!abierta) return
    const actual = propiedades.actual
    nota.value = actual?.nota ?? ''
    tipoEvidencia.value = actual?.evidenciaTipo ?? 'URL'
    evidenciaUrl.value = actual?.evidenciaTipo === 'URL' ? (actual.evidenciaUrl ?? '') : ''
    archivo.value = null
    observacion.value = actual?.observacion ?? ''
    error.value = ''
    if (entradaArchivo.value) entradaArchivo.value.value = ''
  },
)

watch([nota, tipoEvidencia, evidenciaUrl], () => {
  error.value = ''
})

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

function validar(): string {
  if (!nota.value) return 'Elige la nota del alumno.'
  if (tipoEvidencia.value === 'URL') {
    const url = evidenciaUrl.value.trim()
    if (!url) return 'Ingresa el enlace de la evidencia.'
    if (!/^https?:\/\/\S+$/i.test(url)) return 'El enlace debe empezar con http:// o https://.'
  } else if (!archivo.value) {
    return archivoAnterior.value
      ? 'Vuelve a adjuntar el archivo de evidencia para guardar el cambio.'
      : 'Adjunta el archivo de evidencia.'
  }
  return ''
}

async function guardar(siguiente: boolean): Promise<void> {
  error.value = validar()
  if (error.value || !propiedades.alumno || !nota.value) return
  guardando.value = true
  try {
    const usaUrl = tipoEvidencia.value === 'URL'
    const calificacion = await registrar(
      {
        periodoId: propiedades.periodoId,
        matriculaId: propiedades.alumno.matriculaId,
        competenciaCodigo: propiedades.competenciaCodigo,
        nota: nota.value,
        observacion: observacion.value.trim(),
        evidenciaUrl: usaUrl ? evidenciaUrl.value.trim() : null,
      },
      usaUrl ? null : archivo.value,
    )
    emitir('guardada', calificacion, siguiente)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo guardar la calificación.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    :titulo="titulo"
    :descripcion="alumno ? `${alumno.nombreCompleto} · ${contexto}` : contexto"
    :bloqueada="guardando"
    @cerrar="emitir('cerrar')"
  >
    <form id="formulario-calificacion" class="formulario" novalidate @submit.prevent="guardar(false)">
      <fieldset class="notas">
        <legend>Nota <span class="obligatorio">*</span></legend>
        <label v-for="opcion in NOTAS" :key="opcion.valor" :class="['nota', `nota--${opcion.valor}`]">
          <input v-model="nota" type="radio" name="nota" :value="opcion.valor" :disabled="guardando" />
          <strong>{{ opcion.valor }}</strong>
          <small>{{ opcion.descripcion }}</small>
        </label>
      </fieldset>

      <fieldset class="evidencia">
        <legend>Evidencia <span class="obligatorio">*</span></legend>
        <div class="alternar" role="radiogroup" aria-label="Tipo de evidencia">
          <label :class="{ activo: tipoEvidencia === 'URL' }">
            <input v-model="tipoEvidencia" type="radio" value="URL" :disabled="guardando" />Enlace
          </label>
          <label :class="{ activo: tipoEvidencia === 'ARCHIVO' }">
            <input v-model="tipoEvidencia" type="radio" value="ARCHIVO" :disabled="guardando" />Archivo
          </label>
        </div>
        <div v-if="tipoEvidencia === 'URL'" class="campo">
          <label for="calificacion-url" class="solo-lectores">Enlace de la evidencia</label>
          <input
            id="calificacion-url"
            v-model="evidenciaUrl"
            type="url"
            inputmode="url"
            placeholder="https://drive.google.com/..."
            :disabled="guardando"
          />
        </div>
        <div v-else class="campo">
          <label for="calificacion-archivo" class="solo-lectores">Archivo de evidencia</label>
          <input
            id="calificacion-archivo"
            ref="entradaArchivo"
            type="file"
            :disabled="guardando"
            @change="elegirArchivo"
          />
          <small class="ayuda">
            <template v-if="archivo">{{ archivo.name }}</template>
            <template v-else-if="archivoAnterior"
              >Actual: {{ archivoAnterior }}. Adjúntalo de nuevo al editar.</template
            >
            <template v-else>PDF, imagen o documento de hasta 10 MB.</template>
          </small>
        </div>
      </fieldset>

      <div class="campo">
        <label for="calificacion-observacion">Observación</label>
        <textarea
          id="calificacion-observacion"
          v-model="observacion"
          rows="3"
          maxlength="1000"
          placeholder="Retroalimentación para el alumno (opcional)"
          :disabled="guardando"
        />
      </div>

      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    </form>

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="guardando" @click="emitir('cerrar')">Cancelar</BotonAccion>
      <BotonAccion v-if="haySiguiente" variante="secundario" :deshabilitado="guardando" @click="guardar(true)">
        Guardar y siguiente
      </BotonAccion>
      <BotonAccion tipo="submit" form="formulario-calificacion" :deshabilitado="guardando">
        {{ guardando ? 'Guardando...' : 'Guardar' }}
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

legend,
.campo > label:not(.solo-lectores) {
  margin-bottom: 8px;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.obligatorio {
  color: #dc2626;
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
.campo textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 14px;
}

.campo textarea {
  resize: vertical;
}

.ayuda {
  margin-top: 6px;
  color: #434655;
  font-size: 12px;
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
  .notas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
