<script setup lang="ts">
import { ref } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useTareas } from '~/composables/useTareas'
import { formatearFechaTarea, formatearTamanioArchivo } from '~/composables/useTareasEstudiante'
import type { EntregaTarea } from '~/types/tarea'

const propiedades = defineProps<{
  tareaId: number
  entrega: EntregaTarea
}>()

const { descargarArchivoEntrega } = useTareas()
const descargando = ref(false)
const error = ref('')

async function descargar(): Promise<void> {
  if (!propiedades.entrega.archivoNombre) return
  descargando.value = true
  error.value = ''
  try {
    await descargarArchivoEntrega(
      propiedades.tareaId,
      propiedades.entrega.matriculaId,
      propiedades.entrega.archivoNombre,
    )
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo descargar el archivo.')
  } finally {
    descargando.value = false
  }
}
</script>

<template>
  <div class="archivo-entrega">
    <p v-if="entrega.cumplida && entrega.origen === 'DOCENTE'" class="origen">Registrada por el docente, sin archivo</p>
    <template v-if="entrega.archivoNombre">
      <p class="origen">
        <span v-if="!entrega.cumplida">Entrega revertida · </span>Archivo del alumno<template
          v-if="entrega.archivoFecha"
        >
          · {{ formatearFechaTarea(entrega.archivoFecha) }}</template
        >
      </p>
      <button type="button" class="enlace" :disabled="descargando" @click="descargar">
        {{
          descargando ? 'Descargando…' : `${entrega.archivoNombre} (${formatearTamanioArchivo(entrega.archivoTamanio)})`
        }}
      </button>
    </template>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.archivo-entrega {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.origen {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}

.enlace {
  overflow: hidden;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  color: #1e40af;
  font: inherit;
  font-size: 13px;
  text-align: left;
  text-decoration: underline;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.enlace:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.error {
  margin: 0;
  color: #b91c1c;
  font-size: 12px;
}
</style>
