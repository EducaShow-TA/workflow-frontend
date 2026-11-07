<template>
  <main class="pagina-inicio">
    <section class="tarjeta-bienvenida">
      <h1>EducaShow</h1>

      <p>Sistema de Información Web para la Gestión Integral de un Colegio de Educación Secundaria.</p>

      <p class="mensaje-estado">Frontend Nuxt 4 configurado correctamente.</p>
    </section>
  </main>
</template>

<style scoped>
.pagina-inicio {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background-color: #f5f6f8;
  font-family: Inter, Roboto, sans-serif;
}

.tarjeta-bienvenida {
  width: 100%;
  max-width: 520px;
  padding: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background-color: #ffffff;
  text-align: center;
}

h1 {
  margin: 0 0 16px;
  color: #1e40af;
  font-size: 32px;
}

p {
  color: #475569;
  line-height: 1.6;
}

.mensaje-estado {
  margin-top: 24px;
  color: #15803d;
  font-weight: 600;
}
</style>
