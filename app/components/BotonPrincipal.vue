<script setup lang="ts">
withDefaults(
  defineProps<{
    tipo?: 'button' | 'submit'
    deshabilitado?: boolean
  }>(),
  {
    tipo: 'button',
    deshabilitado: false,
  },
)
</script>

<template>
  <button class="boton-principal" :type="tipo" :disabled="deshabilitado">
    <slot />
  </button>
</template>

<style scoped>
.boton-principal {
  display: flex;
  width: 100%;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 25px;
  border: none;
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.boton-principal:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
}

.boton-principal:focus-visible {
  outline: 3px solid var(--color-primary-light);
  outline-offset: 2px;
}

.boton-principal:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
