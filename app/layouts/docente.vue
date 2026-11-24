<script setup lang="ts">
import '~/assets/css/docente.css'
</script>

<template>
  <div class="portal-docente">
    <BarraLateralDocente />
    <div class="portal-docente__contenido">
      <BarraSuperiorDocente />
      <BannerFechaSistema />
      <div class="portal-docente__pagina">
        <slot />
      </div>
    </div>
  </div>
</template>
