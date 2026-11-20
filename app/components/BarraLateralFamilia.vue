<script setup lang="ts">
const ruta = useRoute()

const enlaces = [
  { nombre: 'Panel', destino: '/familia', icono: '/icons/menu-panel.svg' },
  { nombre: 'Progreso académico', destino: '/libretas', icono: '/icons/menu-calificaciones.svg' },
  { nombre: 'Horario', destino: '/familia/horario', icono: '/icons/menu-horarios.svg' },
  { nombre: 'Asistencia', destino: '/familia/asistencia', icono: '/icons/menu-estudiantes.svg' },
  { nombre: 'Pagos', destino: '/familia/pagos', icono: '/icons/menu-finanzas.svg' },
]
function activo(destino: string): boolean {
  return destino === '/familia' ? ruta.path === destino : ruta.path.startsWith(destino)
}
</script>

<template>
  <aside class="docente-lateral" aria-label="Menú del portal del apoderado">
    <NuxtLink to="/familia" class="docente-marca">
      <span class="docente-marca__icono"><img src="/icons/logo.svg" alt="" /></span>
      <span>
        <strong>EducaShow</strong>
        <small>Portal del apoderado</small>
      </span>
    </NuxtLink>

    <nav class="docente-navegacion" aria-label="Navegación del apoderado">
      <NuxtLink
        v-for="enlace in enlaces"
        :key="enlace.destino"
        :to="enlace.destino"
        class="docente-navegacion__enlace"
        :class="{ 'docente-navegacion__enlace--activo': activo(enlace.destino) }"
        :aria-current="activo(enlace.destino) ? 'page' : undefined"
      >
        <img :src="enlace.icono" alt="" />
        <span>{{ enlace.nombre }}</span>
      </NuxtLink>
    </nav>
  </aside>
</template>
