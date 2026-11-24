<template>
  <div class="estructura-administrador">
    <BarraLateralAdministrador />

    <div class="contenido-administrador">
      <BarraSuperiorAdministrador />
      <BannerFechaSistema />

      <div class="zona-contenido">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.estructura-administrador {
  display: flex;
  min-height: 100vh;
}

.contenido-administrador {
  min-width: 0;
  flex: 1;
  background-color: var(--color-background);
}

.zona-contenido {
  min-height: calc(100vh - 90px);
}

:deep(.zona-contenido > *) {
  width: 100% !important;
  max-width: 1320px !important;
  padding: 28px 32px 48px !important;
  margin-right: auto !important;
  margin-left: auto !important;
}

@media (max-width: 800px) {
  .estructura-administrador {
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  :deep(.zona-contenido > *) {
    padding: 20px 16px 32px !important;
  }
}
</style>
