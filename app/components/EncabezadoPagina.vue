<script setup lang="ts">
defineProps<{
  titulo: string
  descripcion?: string
}>()
</script>

<template>
  <header class="encabezado-pagina">
    <div class="textos">
      <h1>{{ titulo }}</h1>

      <p v-if="descripcion">{{ descripcion }}</p>
    </div>

    <div v-if="$slots.acciones" class="acciones">
      <slot name="acciones" />
    </div>
  </header>
</template>

<style scoped>
.encabezado-pagina {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.textos {
  min-width: 0;
}

h1 {
  margin: 0 0 4px;
  color: #191c1e;
  font-size: 28px;
  font-weight: 700;
}

p {
  margin: 0;
  color: #434655;
  font-size: 14px;
}

.acciones {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 600px) {
  .encabezado-pagina {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
