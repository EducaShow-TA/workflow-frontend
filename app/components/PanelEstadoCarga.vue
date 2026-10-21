<script setup lang="ts">
withDefaults(
  defineProps<{
    cargando: boolean
    error?: string
    textoCarga?: string
  }>(),
  {
    error: '',
    textoCarga: 'Cargando información...',
  },
)

const emitir = defineEmits<{
  reintentar: []
}>()
</script>

<template>
  <div v-if="cargando" class="estado-carga" role="status" aria-live="polite">
    <span class="indicador-giro" aria-hidden="true" />
    {{ textoCarga }}
  </div>

  <div v-else-if="error" class="estado-error" role="alert">
    <p>{{ error }}</p>

    <button type="button" class="boton-reintentar" @click="emitir('reintentar')">Reintentar</button>
  </div>

  <slot v-else />
</template>

<style scoped>
.estado-carga,
.estado-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
  color: #434655;
  font-size: 14px;
}

.estado-error {
  flex-direction: column;
  color: #991b1b;
}

.estado-error p {
  margin: 0;
}

.indicador-giro {
  width: 18px;
  height: 18px;
  border: 2px solid #c3c6d7;
  border-top-color: #004ac6;
  border-radius: 50%;
  animation: girar 0.8s linear infinite;
}

.boton-reintentar {
  min-height: 38px;
  padding: 8px 16px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #434655;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

@keyframes girar {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .indicador-giro {
    animation: none;
  }
}
</style>
