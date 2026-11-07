<script setup lang="ts">
import { computed } from 'vue'
import type { TipoAviso } from '~/types/interfaz'

const propiedades = withDefaults(
  defineProps<{
    mensaje: string
    tipo?: TipoAviso
    cerrable?: boolean
  }>(),
  {
    tipo: 'informacion',
    cerrable: false,
  },
)

const emitir = defineEmits<{
  cerrar: []
}>()

// Los errores se anuncian de inmediato a los lectores de pantalla; el resto, de forma no intrusiva.
const rolAccesible = computed(() => (propiedades.tipo === 'error' ? 'alert' : 'status'))
</script>

<template>
  <div class="aviso-mensaje" :class="tipo" :role="rolAccesible">
    <p>{{ mensaje }}</p>

    <button v-if="cerrable" type="button" class="boton-cerrar" aria-label="Cerrar aviso" @click="emitir('cerrar')">
      ×
    </button>
  </div>
</template>

<style scoped>
.aviso-mensaje {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: #f7f9fb;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

p {
  margin: 0;
}

.exito {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #991b1b;
}

.advertencia {
  border-color: #fde68a;
  background: #fffbeb;
  color: #92400e;
}

.boton-cerrar {
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
</style>
