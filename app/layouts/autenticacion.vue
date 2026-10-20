<template>
  <div class="autenticacion">
    <aside class="panel-imagen">
      <img src="/images/campus-login-nuevo.png" alt="Edificio del campus educativo" class="imagen-campus" />

      <div class="capa-institucional" />

      <div class="mensaje-institucional">
        <h2>Gestión Educativa Inteligente</h2>

        <p>
          Centraliza la administración de tu institución con herramientas diseñadas para la eficiencia y el control
          total.
        </p>
      </div>
    </aside>

    <main class="panel-formulario">
      <div class="contenedor-formulario">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.autenticacion {
  display: grid;
  grid-template-columns: 60% 40%;
  min-height: 100vh;
}

.panel-imagen {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background-color: var(--color-background);
}

.imagen-campus {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.capa-institucional {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgb(224 227 229 / 65%), rgb(30 64 175 / 6%) 60%, transparent);
}

.mensaje-institucional {
  position: absolute;
  right: 48px;
  bottom: 48px;
  left: 48px;
  max-width: 448px;
  padding: 24px;
  border: 1px solid rgb(195 198 215 / 30%);
  border-radius: var(--radius-lg);
  background: rgb(255 255 255 / 85%);
  box-shadow: 0 10px 20px rgb(0 0 0 / 10%);
  backdrop-filter: blur(6px);
}

.mensaje-institucional h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.mensaje-institucional p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 16px;
  line-height: 1.5;
}

.panel-formulario {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background-color: var(--color-surface);
  box-shadow: -10px 0 15px -3px rgb(0 0 0 / 5%);
}

.contenedor-formulario {
  width: 100%;
  max-width: 400px;
}

@media (max-width: 800px) {
  .autenticacion {
    grid-template-columns: 1fr;
  }

  .panel-imagen {
    display: none;
  }

  .panel-formulario {
    padding: 24px;
  }
}
</style>
