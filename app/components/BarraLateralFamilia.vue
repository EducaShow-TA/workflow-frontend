<script setup lang="ts">
const ruta = useRoute()

const grupos = [
  {
    titulo: 'Inicio',
    enlaces: [{ nombre: 'Panel', destino: '/familia', icono: '/icons/menu-panel.svg' }],
  },
  {
    titulo: 'Seguimiento académico',
    enlaces: [
      { nombre: 'Progreso académico', destino: '/libretas', icono: '/icons/menu-calificaciones.svg' },
      { nombre: 'Reporte anual', destino: '/familia/reporte-anual', icono: '/icons/menu-reportes.svg' },
      { nombre: 'Horario', destino: '/familia/horario', icono: '/icons/menu-horarios.svg' },
      { nombre: 'Asistencia', destino: '/familia/asistencia', icono: '/icons/menu-estudiantes.svg' },
    ],
  },
  {
    titulo: 'Trámites y pagos',
    enlaces: [
      { nombre: 'Matrícula anual', destino: '/familia/matricula', icono: '/icons/menu-estudiantes.svg' },
      { nombre: 'Pagos', destino: '/familia/pagos', icono: '/icons/menu-finanzas.svg' },
    ],
  },
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
