<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FilaListaAsistencia } from '~/types/sesionClase'
import { useJustificacionDocente } from '~/composables/useJustificacionDocente'
import { obtenerMensajeError } from '~/composables/useMensajesError'

const MAX_ARCHIVO_BYTES = 10 * 1024 * 1024
const props = defineProps<{
  alumno: FilaListaAsistencia | null
}>()
const emitir = defineEmits<{
  cerrar: []
  guardada: []
}>()
const motivo = ref('')
const documento = ref<File | null>(null)
const entradaDocumento = ref<HTMLInputElement | null>(null)
const error = ref('')
const guardando = ref(false)
const { justificar } = useJustificacionDocente()

watch(
  () => props.alumno,
  () => {
    motivo.value = ''
    documento.value = null
    error.value = ''
    if (entradaDocumento.value) entradaDocumento.value.value = ''
  },
)

function cambiarDocumento(evento: Event): void {
  const entrada = evento.target as HTMLInputElement
  const archivo = entrada.files?.[0] ?? null
  error.value = ''
  if (archivo && archivo.size > MAX_ARCHIVO_BYTES) {
    documento.value = null
    entrada.value = ''
    error.value = 'El archivo debe tener un tamaño máximo de 10 MB.'
    return
  }
  documento.value = archivo
}

function cerrar(): void {
  if (!guardando.value) emitir('cerrar')
}

async function guardar(): Promise<void> {
  if (!props.alumno?.asistenciaId || guardando.value) return
  const detalle = motivo.value.trim()
  if (!detalle) {
    error.value = 'Escribe el motivo de la justificación.'
    return
  }
  if (detalle.length > 500) {
    error.value = 'El motivo debe tener como máximo 500 caracteres.'
    return
  }
  guardando.value = true
  error.value = ''
  try {
    await justificar(props.alumno.asistenciaId, detalle, documento.value)
    emitir('guardada')
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No fue posible justificar esta inasistencia.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <VentanaModal
    :abierta="alumno !== null"
    titulo="Justificar inasistencia"
    :descripcion="alumno ? `${alumno.nombreCompleto} · US-2.8` : ''"
    :bloqueada="guardando"
    @cerrar="cerrar"
  >
    <form id="formulario-justificacion-docente" class="formulario-justificacion" @submit.prevent="guardar">
      <p>
        Se cambiará el estado de <strong>Ausente</strong> a <strong>Justificada</strong>. Esta operación registra el
        docente y la fecha de la corrección.
      </p>
      <label for="motivo-justificacion">Motivo <span aria-hidden="true">*</span></label>
      <textarea
        id="motivo-justificacion"
        v-model="motivo"
        rows="4"
        maxlength="500"
        required
        :disabled="guardando"
        placeholder="Indica el motivo de la justificación"
      />
      <small>{{ motivo.trim().length }} / 500 caracteres</small>
      <label for="documento-justificacion">Documento de respaldo (opcional)</label>
      <input
        id="documento-justificacion"
        ref="entradaDocumento"
        type="file"
        :disabled="guardando"
        @change="cambiarDocumento"
      />
      <small>Archivo opcional de hasta 10 MB.</small>
      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    </form>
    <template #pie>
      <button class="boton-secundario" type="button" :disabled="guardando" @click="cerrar">Cancelar</button>
      <button
        class="boton-confirmar"
        type="submit"
        form="formulario-justificacion-docente"
        :disabled="guardando || !motivo.trim()"
      >
        {{ guardando ? 'Guardando…' : 'Confirmar justificación' }}
      </button>
    </template>
  </VentanaModal>
</template>

<style scoped>
.formulario-justificacion {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.formulario-justificacion p {
  margin: 0 0 8px;
  line-height: 1.5;
}
.formulario-justificacion label {
  font-weight: 600;
}
.formulario-justificacion textarea,
.formulario-justificacion input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid #b8c6d8;
  border-radius: 7px;
  background: white;
}
.formulario-justificacion small {
  color: #64748b;
}
.boton-secundario,
.boton-confirmar {
  border-radius: 7px;
  padding: 10px 14px;
  cursor: pointer;
  border: 1px solid #b8c6d8;
  background: white;
}
.boton-confirmar {
  color: white;
  background: #1e40af;
  border-color: #1e40af;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
