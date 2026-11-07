<script setup lang="ts">
withDefaults(
  defineProps<{
    variante?: 'primario' | 'secundario'
    tipo?: 'button' | 'submit'
    deshabilitado?: boolean
    /** Si se indica, el boton se muestra como enlace a esa ruta. */
    destino?: string
  }>(),
  {
    variante: 'primario',
    tipo: 'button',
    deshabilitado: false,
    destino: undefined,
  },
)
</script>

<template>
  <NuxtLink v-if="destino" :to="destino" class="boton-accion" :class="variante">
    <slot />
  </NuxtLink>

  <button v-else class="boton-accion" :class="variante" :type="tipo" :disabled="deshabilitado">
    <slot />
  </button>
</template>

<style scoped>
.boton-accion {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.primario {
  border: 0;
  background: #004ac6;
  color: white;
}

.primario:hover:not(:disabled) {
  background: #003e9f;
}

.secundario {
  border: 1px solid #c3c6d7;
  background: white;
  color: #434655;
}

.secundario:hover:not(:disabled) {
  background: #f2f4f6;
}

.boton-accion:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.boton-accion:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
