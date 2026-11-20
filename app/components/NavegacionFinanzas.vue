<script setup lang="ts">
const ruta = useRoute()

const secciones = [
  { titulo: 'Boletas', destino: '/finanzas' },
  { titulo: 'Auditoría', destino: '/finanzas/auditoria' },
]
</script>

<template>
  <nav class="navegacion-finanzas" aria-label="Secciones de finanzas">
    <NuxtLink
      v-for="seccion in secciones"
      :key="seccion.destino"
      :to="seccion.destino"
      class="pestana"
      :class="{ activa: ruta.path === seccion.destino }"
      :aria-current="ruta.path === seccion.destino ? 'page' : undefined"
    >
      {{ seccion.titulo }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.navegacion-finanzas {
  display: flex;
  width: 100%;
  gap: 4px;
  margin-bottom: 20px;
  overflow-x: auto;
  border-bottom: 1px solid #c3c6d7;
}

.pestana {
  display: inline-flex;
  min-height: 44px;
  flex: 0 0 auto;
  align-items: center;
  padding: 0 16px;
  border-bottom: 3px solid transparent;
  color: #434655;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.pestana:hover:not(.activa) {
  background: #f7f9fb;
  color: #004ac6;
}

.pestana.activa {
  border-bottom-color: #004ac6;
  color: #004ac6;
}

.pestana:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: -2px;
}
</style>
