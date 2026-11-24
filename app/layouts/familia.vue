<script setup lang="ts">
import '~/assets/css/docente.css'
</script>

<template>
  <div class="portal-docente">
    <BarraLateralFamilia />
    <div class="portal-docente__contenido">
      <BarraSuperiorFamilia />
      <BannerFechaSistema />
      <div class="portal-docente__pagina">
        <slot />
      </div>
    </div>
  </div>
</template>
