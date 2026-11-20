<script setup lang="ts">
const ruta = useRoute()

const enlaces = [
  { nombre: 'Panel', destino: '/estudiante', icono: '/icons/menu-panel.svg' },
  { nombre: 'Horario', destino: '/estudiante/horario', icono: '/icons/menu-horarios.svg' },
  { nombre: 'Asistencia', destino: '/estudiante/asistencia', icono: '/icons/menu-estudiantes.svg' },
]
function activo(destino: string): boolean {
  return destino === '/estudiante' ? ruta.path === destino : ruta.path.startsWith(destino)
}
</script>

<template>
  <aside class="docente-lateral" aria-label="Menú del portal del estudiante">
    <NuxtLink to="/estudiante" class="docente-marca">
      <span class="docente-marca__icono"><img src="/icons/logo.svg" alt="" /></span>
      <span>
        <strong>EducaShow</strong>
        <small>Portal del estudiante</small>
      </span>
    </NuxtLink>

    <nav class="docente-navegacion" aria-label="Navegación del estudiante">
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
