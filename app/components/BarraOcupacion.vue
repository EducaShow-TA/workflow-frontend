<script setup lang="ts">
import type { EstadoCupos } from '~/types/seccion'

defineProps<{
  porcentaje: number
  estado: EstadoCupos
  etiqueta: string
}>()
</script>

<template>
  <div
    class="barra-ocupacion"
    role="progressbar"
    :aria-valuenow="porcentaje"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="etiqueta"
  >
    <div class="avance" :class="estado" :style="{ width: `${porcentaje}%` }" />
  </div>
</template>

<style scoped>
.barra-ocupacion {
  height: 10px;
  overflow: hidden;
  border-radius: 20px;
  background: #d1d5db;
}

.avance {
  height: 100%;
  border-radius: 20px;
  background: #22c55e;
  transition: width 0.2s ease;
}

.avance.limitado {
  background: #f59e0b;
}

.avance.agotado {
  background: #dc2626;
}
</style>
