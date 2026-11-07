<script setup lang="ts">
definePageMeta({
  middleware: 'autenticacion',
})

const ruta = useRoute()
</script>

<template>
  <div class="pagina-sesion">
    <ListaAsistenciaSesion :sesion-id="Number(ruta.params.id)" ruta-volver="/sesiones-clase" />
  </div>
</template>

<style scoped>
.pagina-sesion {
  padding: 32px;
}

@media (max-width: 720px) {
  .pagina-sesion {
    padding: 16px;
  }
}
</style>
