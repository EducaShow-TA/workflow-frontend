<script setup lang="ts">
const ruta = useRoute()

const pestanias = [
  { nombre: 'Cobranza', destino: '/reportes/boletas' },
  { nombre: 'Asistencia', destino: '/reportes/asistencia' },
]
</script>

<template>
  <nav class="pestanias" aria-label="Tipos de reporte">
    <NuxtLink
      v-for="pestania in pestanias"
      :key="pestania.destino"
      :to="pestania.destino"
      class="pestania"
      :class="{ 'pestania--activa': ruta.path.startsWith(pestania.destino) }"
      :aria-current="ruta.path.startsWith(pestania.destino) ? 'page' : undefined"
    >
      {{ pestania.nombre }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.pestanias {
  display: flex;
  gap: 8px;
  margin: 0 0 24px;
  border-bottom: 1px solid var(--color-border);
}
.pestania {
  padding: 10px 16px;
  color: var(--color-text-secondary);
  text-decoration: none;
  font-weight: 600;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
}
.pestania--activa {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}
.pestania:focus-visible {
  outline: 3px solid #93b4fa;
  outline-offset: 3px;
}
</style>
