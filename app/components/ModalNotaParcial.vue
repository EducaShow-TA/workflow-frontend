<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useEvaluacionesParciales } from '~/composables/useEvaluacionesParciales'
import { useTareas } from '~/composables/useTareas'
import type { NotaEvaluacionParcial } from '~/types/evaluacionParcial'
import type { Tarea } from '~/types/tarea'

type Opcion = 'AD' | 'A' | 'B' | 'C' | 'JUST'

interface NotaActual {
  nota: 'AD' | 'A' | 'B' | 'C' | null
  justificada: boolean
  comentario?: string | null
}

const propiedades = withDefaults(
  defineProps<{
    abierta: boolean
    titulo: string
    descripcion?: string
    evaluacionId: number
    matriculaId: number
    tareaId?: number | null
    actual?: NotaActual | null
    notaInicial?: Opcion | null
    soloComentario?: boolean
  }>(),
  { descripcion: '', tareaId: null, actual: null, notaInicial: null, soloComentario: false },
)

const emitir = defineEmits<{
  cerrar: []
  guardada: [resultado: { tarea: Tarea | null; nota: NotaEvaluacionParcial | null }]
}>()

const OPCIONES: { valor: Opcion; texto: string }[] = [
  { valor: 'AD', texto: 'AD' },
  { valor: 'A', texto: 'A' },
  { valor: 'B', texto: 'B' },
  { valor: 'C', texto: 'C' },
  { valor: 'JUST', texto: 'Justificada' },
]

const { calificarEntrega } = useTareas()
const { registrarNota } = useEvaluacionesParciales()

const eleccion = ref<Opcion | null>(null)
const motivo = ref('')
const comentario = ref('')
const tipoEvidencia = ref<'' | 'ARCHIVO' | 'URL'>('')
const archivo = ref<File | null>(null)
const enlace = ref('')
const guardando = ref(false)
const error = ref('')

const esTarea = computed(() => propiedades.tareaId !== null && propiedades.tareaId !== undefined)
const opcionActual = computed<Opcion | null>(() => {
  if (!propiedades.actual) return null
  if (propiedades.actual.justificada) return 'JUST'
  return propiedades.actual.nota
})
const cambiaNota = computed(() => eleccion.value !== opcionActual.value)
const requiereMotivo = computed(() => opcionActual.value !== null && cambiaNota.value)
const idFormulario = computed(() => `nota-parcial-${propiedades.evaluacionId}-${propiedades.matriculaId}`)

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (!abierta) return
    eleccion.value = propiedades.notaInicial ?? opcionActual.value
    motivo.value = ''
    comentario.value = propiedades.actual?.comentario ?? ''
    tipoEvidencia.value = ''
    archivo.value = null
    enlace.value = ''
    error.value = ''
  },
  { immediate: true },
)

function elegirArchivo(evento: Event): void {
  archivo.value = (evento.target as HTMLInputElement).files?.[0] ?? null
}

async function guardar(): Promise<void> {
  error.value = ''
  if (!eleccion.value) {
    error.value = 'Elige una nota o marca la evaluación como justificada.'
    return
  }
  if (requiereMotivo.value && motivo.value.trim().length < 10) {
    error.value = 'Indica el motivo del cambio (mínimo 10 caracteres).'
    return
  }
  if (!esTarea.value && tipoEvidencia.value === 'ARCHIVO' && !archivo.value) {
    error.value = 'Elige el archivo de evidencia o quita la opción.'
    return
  }
  if (!esTarea.value && tipoEvidencia.value === 'URL' && !/^https?:\/\/\S+$/i.test(enlace.value.trim())) {
    error.value = 'El enlace de evidencia debe empezar con http:// o https://.'
    return
  }
  const elegida = eleccion.value
  const justificada = elegida === 'JUST'
  const nota = elegida === 'JUST' ? null : elegida
  const motivoEnviado = requiereMotivo.value ? motivo.value.trim() : null
  guardando.value = true
  try {
    if (esTarea.value) {
      const tarea = await calificarEntrega(propiedades.tareaId as number, propiedades.matriculaId, {
        nota,
        justificada,
        motivo: motivoEnviado,
        comentario: comentario.value.trim() || null,
      })
      emitir('guardada', { tarea, nota: null })
    } else {
      const registrada = await registrarNota(
        propiedades.evaluacionId,
        propiedades.matriculaId,
        {
          nota,
          justificada,
          motivo: motivoEnviado,
          evidenciaUrl: tipoEvidencia.value === 'URL' ? enlace.value.trim() : null,
        },
        tipoEvidencia.value === 'ARCHIVO' ? archivo.value : null,
      )
      emitir('guardada', { tarea: null, nota: registrada })
    }
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo guardar la nota.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    :titulo="titulo"
    :descripcion="descripcion"
    :bloqueada="guardando"
    @cerrar="emitir('cerrar')"
  >
    <form :id="idFormulario" class="docente-formulario" novalidate @submit.prevent="guardar">
      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

      <div v-if="!soloComentario" class="docente-campo">
        <span class="etiqueta">Nota</span>
        <div class="selector-nota" role="radiogroup" aria-label="Nota">
          <button
            v-for="opcion in OPCIONES"
            :key="opcion.valor"
            type="button"
            role="radio"
            :aria-checked="eleccion === opcion.valor"
            :class="{ activa: eleccion === opcion.valor }"
            @click="eleccion = opcion.valor"
          >
            {{ opcion.texto }}
          </button>
        </div>
        <small v-if="eleccion === 'JUST'" class="ayuda">No rindió por un motivo válido; no cuenta en el cálculo.</small>
      </div>

      <div v-if="requiereMotivo" class="docente-campo">
        <label :for="`${idFormulario}-motivo`">Motivo del cambio *</label>
        <textarea
          :id="`${idFormulario}-motivo`"
          v-model="motivo"
          rows="3"
          maxlength="500"
          placeholder="Ej. Error de digitación: la rúbrica suma 13 puntos"
        />
        <small class="ayuda">Queda en la auditoría de calificaciones.</small>
      </div>

      <div v-if="esTarea" class="docente-campo">
        <label :for="`${idFormulario}-comentario`">Comentario para el alumno</label>
        <textarea
          :id="`${idFormulario}-comentario`"
          v-model="comentario"
          rows="3"
          maxlength="1000"
          placeholder="Opcional. El alumno lo verá junto a su nota."
        />
      </div>

      <fieldset v-else class="docente-campo evidencia">
        <legend>Evidencia (opcional)</legend>
        <div class="opciones-evidencia">
          <label><input v-model="tipoEvidencia" type="radio" value="" /> Sin evidencia</label>
          <label><input v-model="tipoEvidencia" type="radio" value="ARCHIVO" /> Archivo</label>
          <label><input v-model="tipoEvidencia" type="radio" value="URL" /> Enlace</label>
        </div>
        <input
          v-if="tipoEvidencia === 'ARCHIVO'"
          type="file"
          aria-label="Archivo de evidencia"
          @change="elegirArchivo"
        />
        <input
          v-else-if="tipoEvidencia === 'URL'"
          v-model="enlace"
          type="url"
          aria-label="Enlace de evidencia"
          placeholder="https://"
        />
      </fieldset>
    </form>

    <template #pie>
      <button
        type="button"
        class="docente-boton docente-boton--secundario"
        :disabled="guardando"
        @click="emitir('cerrar')"
      >
        Cancelar
      </button>
      <button type="submit" :form="idFormulario" class="docente-boton" :disabled="guardando">
        {{ guardando ? 'Guardando…' : soloComentario ? 'Guardar comentario' : 'Guardar nota' }}
      </button>
    </template>
  </VentanaModal>
</template>

<style scoped>
.etiqueta {
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.selector-nota {
  display: inline-flex;
  flex-wrap: wrap;
  align-self: flex-start;
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
}

.selector-nota button {
  min-width: 44px;
  padding: 7px 12px;
  border: 0;
  border-right: 1px solid #c3c6d7;
  background: white;
  color: #334155;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.selector-nota button:last-child {
  border-right: 0;
}

.selector-nota button.activa {
  background: #004ac6;
  color: white;
}

.selector-nota button:focus-visible {
  outline: 3px solid #93c5fd;
  outline-offset: -3px;
}

.ayuda {
  color: #64748b;
  font-size: 12px;
}

.evidencia {
  margin: 0;
  padding: 0;
  border: 0;
}

.evidencia legend {
  margin-bottom: 6px;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}

.opciones-evidencia {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 8px;
  font-size: 14px;
}

.opciones-evidencia label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.opciones-evidencia input[type='radio'] {
  width: 16px;
  min-width: 16px;
  height: 16px;
  min-height: 0;
  margin: 0;
  padding: 0;
  border: 0;
  box-shadow: none;
  accent-color: #004ac6;
}
</style>
