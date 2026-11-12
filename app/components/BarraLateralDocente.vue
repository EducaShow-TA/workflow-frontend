<script setup lang="ts">
const ruta = useRoute()

const enlaces = [
  { nombre: 'Mi panel', destino: '/docente', icono: '/icons/menu-panel.svg' },
  { nombre: 'Tareas', destino: '/docente/tareas', icono: '/icons/menu-tareas.svg' },
  { nombre: 'Calificaciones', destino: '/docente/calificaciones', icono: '/icons/menu-competencias.svg' },
  { nombre: 'Asistencia de alumnos', destino: '/docente/asistencia', icono: '/icons/menu-estudiantes.svg' },
  { nombre: 'Libretas e informes', destino: '/docente/libretas', icono: '/icons/menu-calificaciones.svg' },
  { nombre: 'Mi marcaje', destino: '/docente/marcaje', icono: '/icons/menu-docentes.svg' },
  { nombre: 'Mi horario', destino: '/docente/horario', icono: '/icons/menu-horarios.svg' },
]

function activo(destino: string): boolean {
  return destino === '/docente' ? ruta.path === destino : ruta.path.startsWith(destino)
}
</script>

<template>
  <aside class="docente-lateral" aria-label="Menú del portal docente">
    <NuxtLink to="/docente" class="docente-marca">
      <span class="docente-marca__icono"><img src="/icons/logo.svg" alt="" /></span>
      <span>
        <strong>EducaShow</strong>
        <small>Portal Docente</small>
      </span>
    </NuxtLink>

    <nav class="docente-navegacion" aria-label="Navegación docente">
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

    <div class="docente-lateral__pie">
      <span>Gestión académica</span>
      <small>Versión de interfaz · Sprint 2</small>
    </div>
  </aside>
</template>
