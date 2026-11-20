<script setup lang="ts">
definePageMeta({ middleware: 'autenticacion' })
</script>

<template>
  <main class="pagina-reporte">
    <header class="encabezado">
      <p class="ubicacion">Reportes / Asistencia</p>
      <h1>Inasistencias y tardanzas de alumnos</h1>
      <p>Identifica a los alumnos que más faltan o llegan tarde para intervenir a tiempo.</p>
    </header>
    <PestaniasReportes />
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
  margin: 8px 0 12px;
  font-size: 28px;
}
.encabezado > p {
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.ubicacion {
  font-size: 13px;
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
