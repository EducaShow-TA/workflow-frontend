<script setup lang="ts">
definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const ruta = useRoute()
</script>

<template>
  <ListaAsistenciaSesion :sesion-id="Number(ruta.params.id)" ruta-volver="/docente/asistencia" />
</template>
