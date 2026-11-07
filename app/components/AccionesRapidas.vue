<script setup lang="ts">
import type { AccionRapidaPanel } from '~/types/panel'

defineProps<{
  acciones: AccionRapidaPanel[]
}>()

const emitir = defineEmits<{
  seleccionar: [accion: AccionRapidaPanel]
}>()
</script>

<template>
  <section class="acciones-rapidas" aria-label="Acciones rápidas">
    <button
      v-for="accion in acciones"
      :key="accion.id"
      type="button"
      class="tarjeta-accion"
      @click="emitir('seleccionar', accion)"
    >
      <span class="circulo-icono" :style="{ backgroundColor: accion.colorFondo }">
        <img :src="accion.icono" alt="" />
      </span>

      <span class="titulo-accion">
        {{ accion.titulo }}
      </span>
    </button>
  </section>
</template>

<style scoped>
.acciones-rapidas {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.tarjeta-accion {
  display: flex;
  min-width: 0;
  min-height: 102px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  padding: 17px 10px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background-color: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.tarjeta-accion:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgb(0 0 0 / 6%);
}

.tarjeta-accion:focus-visible {
  outline: 3px solid var(--color-primary-light);
  outline-offset: 2px;
}

.circulo-icono {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.titulo-accion {
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  text-align: center;
}

@media (max-width: 1180px) {
  .acciones-rapidas {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .acciones-rapidas {
    grid-template-columns: 1fr;
  }
}
</style>
