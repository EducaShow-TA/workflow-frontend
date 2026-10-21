<template>
  <div class="estructura-administrador">
    <BarraLateralAdministrador />

    <div class="contenido-administrador">
      <BarraSuperiorAdministrador />

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

@media (max-width: 800px) {
  .estructura-administrador {
    flex-direction: column;
  }
}
</style>
