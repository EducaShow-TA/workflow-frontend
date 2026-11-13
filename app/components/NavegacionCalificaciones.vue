<script setup lang="ts">
import { computed } from 'vue'

const propiedades = withDefaults(
  defineProps<{
    docente?: boolean
  }>(),
  {
    docente: false,
  },
)

const ruta = useRoute()

const secciones = computed(() =>
  propiedades.docente
    ? [
        { titulo: 'Registro de calificaciones', destino: '/docente/calificaciones' },
        { titulo: 'Libretas e informes', destino: '/calificaciones/libretas' },
      ]
    : [
        { titulo: 'Registro de calificaciones', destino: '/calificaciones' },
        { titulo: 'Evaluaciones parciales', destino: '/calificaciones/evaluaciones' },
        { titulo: 'Libretas e informes', destino: '/calificaciones/libretas' },
        { titulo: 'Auditoría de cambios', destino: '/calificaciones/auditoria' },
      ],
)
</script>

<template>
  <nav class="navegacion-calificaciones" aria-label="Secciones de calificaciones">
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
.navegacion-calificaciones {
  display: flex;
  width: 100%;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid #c3c6d7;
  scrollbar-width: thin;
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
