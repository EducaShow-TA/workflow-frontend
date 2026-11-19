<script setup lang="ts">
definePageMeta({ layout: 'docente', middleware: 'autenticacion' })
</script>

<template>
  <main class="pagina-reporte">
    <header class="encabezado">
      <h1>Reporte de inasistencias y tardanzas</h1>
      <p>Consulta la asistencia de los alumnos de las secciones donde enseñas.</p>
    </header>
    <ReporteAsistenciaAlumnos />
  </main>
</template>

<style scoped>
.pagina-reporte {
  max-width: 1600px;
  padding: 32px;
  margin: 0 auto;
}
.encabezado {
  margin-bottom: 24px;
}
h1 {
  margin: 0 0 12px;
  font-size: 28px;
}
.encabezado > p {
  color: var(--color-text-secondary);
  line-height: 1.5;
}
@media (max-width: 600px) {
  .pagina-reporte {
    padding: 16px;
  }
  h1 {
    font-size: 24px;
  }
}
</style>
