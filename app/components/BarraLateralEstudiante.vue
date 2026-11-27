<script setup lang="ts">
const ruta = useRoute()

const grupos = [
  {
    titulo: 'Inicio',
    enlaces: [{ nombre: 'Panel', destino: '/estudiante', icono: '/icons/menu-panel.svg' }],
  },
  {
    titulo: 'Mis estudios',
    enlaces: [
      { nombre: 'Horario', destino: '/estudiante/horario', icono: '/icons/menu-horarios.svg' },
      { nombre: 'Reporte anual', destino: '/estudiante/reporte-anual', icono: '/icons/menu-reportes.svg' },
      { nombre: 'Asistencia', destino: '/estudiante/asistencia', icono: '/icons/menu-estudiantes.svg' },
      { nombre: 'Tareas', destino: '/estudiante/tareas', icono: '/icons/menu-tareas.svg' },
    ],
  },
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
      <section v-for="grupo in grupos" :key="grupo.titulo" class="docente-navegacion__grupo">
        <h2 class="docente-navegacion__titulo">{{ grupo.titulo }}</h2>
        <NuxtLink
          v-for="enlace in grupo.enlaces"
          :key="enlace.destino"
          :to="enlace.destino"
          class="docente-navegacion__enlace"
          :class="{ 'docente-navegacion__enlace--activo': activo(enlace.destino) }"
          :aria-current="activo(enlace.destino) ? 'page' : undefined"
        >
          <img :src="enlace.icono" alt="" />
          <span>{{ enlace.nombre }}</span>
        </NuxtLink>
      </section>
    </nav>
  </aside>
</template>
