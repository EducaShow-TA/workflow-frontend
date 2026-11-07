<script setup lang="ts">
export type IconoAcceso = 'llave' | 'correo' | 'candado' | 'exito' | 'alerta'

defineProps<{
  titulo: string
  icono: IconoAcceso
}>()
</script>

<template>
  <div class="encabezado-acceso">
    <div class="marca">
      <div class="marca-icono" aria-hidden="true">E</div>
      <span>EducaShow</span>
    </div>

    <div class="icono" :class="icono" aria-hidden="true">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <template v-if="icono === 'llave'">
          <circle cx="7.5" cy="15.5" r="4.5" />
          <path d="M10.7 12.3 21 2M16 7l3 3M18 5l2 2" />
        </template>
        <template v-else-if="icono === 'correo'">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 6-10 7L2 6" />
        </template>
        <template v-else-if="icono === 'candado'">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </template>
        <path v-else-if="icono === 'exito'" d="M20 6 9 17l-5-5" />
        <template v-else>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17h.01" />
        </template>
      </svg>
    </div>

    <header class="titulo">
      <h1>{{ titulo }}</h1>
      <p><slot /></p>
    </header>
  </div>
</template>

<style scoped>
.marca {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 40px;
  color: var(--color-text);
  font-size: 24px;
  font-weight: 700;
}

.marca-icono {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: white;
  font-weight: 700;
}

.icono {
  display: flex;
  width: 52px;
  height: 52px;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border-radius: 50%;
  background: #e0e7ff;
  color: var(--color-primary);
}

.icono.correo,
.icono.exito {
  background: #dcfce7;
  color: var(--color-success);
}

.icono.alerta {
  background: #fef3c7;
  color: #b45309;
}

.titulo {
  margin-bottom: 24px;
}

.titulo h1 {
  margin: 0 0 6px;
  font-size: 30px;
  font-weight: 600;
}

.titulo p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.5;
}

@media (max-width: 480px) {
  .titulo h1 {
    font-size: 26px;
  }
}
</style>
