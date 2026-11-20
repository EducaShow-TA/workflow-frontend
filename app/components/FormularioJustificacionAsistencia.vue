<script setup lang="ts">
import { ref } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePortalFamilia } from '~/composables/usePortalFamilia'

const props = defineProps<{ asistenciaId: number }>()
const emit = defineEmits<{ cancelar: []; justificada: [] }>()
const { justificarAsistencia } = usePortalFamilia()
const motivo = ref('')
const documento = ref<File | null>(null)
const error = ref('')
const guardando = ref(false)
const MAX_BYTES = 10 * 1024 * 1024

function seleccionarDocumento(evento: Event): void {
  const input = evento.target as HTMLInputElement
  const archivo = input.files?.[0] ?? null
  error.value = ''
  if (archivo && archivo.size > MAX_BYTES) {
    documento.value = null
    input.value = ''
    error.value = 'El documento no puede superar los 10 MB.'
    return
  }
  documento.value = archivo
}

async function enviar(): Promise<void> {
  const texto = motivo.value.trim()
  if (!texto) {
    error.value = 'Escribe el motivo de la inasistencia.'
    return
  }
  if (!documento.value) {
    error.value = 'Adjunta un documento de sustento.'
    return
  }

  guardando.value = true
  error.value = ''
  try {
    await justificarAsistencia(props.asistenciaId, texto, documento.value)
    emit('justificada')
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo enviar la justificación. Inténtalo nuevamente.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <form class="formulario-justificacion" @submit.prevent="enviar">
    <h3>Justificar esta inasistencia</h3>
    <label :for="`motivo-justificacion-${asistenciaId}`">Motivo</label>
    <textarea
      :id="`motivo-justificacion-${asistenciaId}`"
      v-model="motivo"
      rows="3"
      maxlength="500"
      required
      :disabled="guardando"
      placeholder="Cuéntanos por qué faltó el estudiante"
    />
    <small class="formulario-justificacion__contador">{{ motivo.length }}/500 caracteres</small>

    <label :for="`documento-justificacion-${asistenciaId}`">Documento de sustento</label>
    <input
      :id="`documento-justificacion-${asistenciaId}`"
      type="file"
      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
      required
      :disabled="guardando"
      @change="seleccionarDocumento"
    />
    <small>Adjunta un PDF, una imagen o un documento. Tamaño máximo: 10 MB.</small>
    <p v-if="error" class="formulario-justificacion__error" role="alert">{{ error }}</p>

    <div class="formulario-justificacion__acciones">
      <button type="button" class="boton-secundario" :disabled="guardando" @click="emit('cancelar')">Cancelar</button>
      <button type="submit" :disabled="guardando || !documento">
        {{ guardando ? 'Enviando…' : 'Enviar justificación' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.formulario-justificacion {
  display: grid;
  gap: 8px;
  width: 100%;
  margin-top: 12px;
  padding: 16px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
  text-align: left;
}
.formulario-justificacion h3 {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 15px;
}
.formulario-justificacion label {
  color: #334155;
  font-size: 13px;
  font-weight: 600;
}
.formulario-justificacion textarea,
.formulario-justificacion input[type='file'] {
  width: 100%;
  font: inherit;
}
.formulario-justificacion textarea {
  resize: vertical;
  padding: 9px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: white;
}
.formulario-justificacion__contador,
.formulario-justificacion > small {
  color: #64748b;
  font-size: 12px;
}
.formulario-justificacion__error {
  margin: 0;
  color: #b91c1c;
  font-size: 13px;
}
.formulario-justificacion__acciones {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.formulario-justificacion__acciones button {
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid #1d4ed8;
  border-radius: 7px;
  color: white;
  background: #1d4ed8;
  cursor: pointer;
}
.formulario-justificacion__acciones .boton-secundario {
  border-color: #cbd5e1;
  color: #334155;
  background: white;
}
.formulario-justificacion__acciones button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
