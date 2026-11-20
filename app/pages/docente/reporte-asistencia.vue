<script setup lang="ts">
definePageMeta({ layout: 'docente', middleware: 'autenticacion' })
</script>

<template>
  <main class="docente-vista">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">Seguimiento académico</span>
        <h1>Asistencia de alumnos</h1>
        <p>Consulta la asistencia de los alumnos de las secciones donde enseñas.</p>
      </div>
    </header>
    <ReporteAsistenciaAlumnos />
  </main>
</template>
