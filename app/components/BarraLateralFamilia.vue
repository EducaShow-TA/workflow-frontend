<script setup lang="ts">
const ruta = useRoute()

const enlaces = [
  { nombre: 'Panel', destino: '/familia', icono: '/icons/menu-panel.svg' },
  { nombre: 'Progreso académico', destino: '/libretas', icono: '/icons/menu-calificaciones.svg' },
  { nombre: 'Asistencia', destino: '/familia/asistencia', icono: '/icons/menu-estudiantes.svg' },
  { nombre: 'Pagos', destino: '/familia/pagos', icono: '/icons/menu-finanzas.svg' },
]
const proximos = [{ nombre: 'Horario', icono: '/icons/menu-horarios.svg' }]

function activo(destino: string): boolean {
  return destino === '/familia' ? ruta.path === destino : ruta.path.startsWith(destino)
}
</script>

<template>
  <aside class="docente-lateral" aria-label="Menú del portal del apoderado">
    <NuxtLink to="/familia" class="docente-marca">
      <span class="docente-marca__icono"><img src="/icons/logo.svg" alt="" /></span>
      <span>
        <strong>EducaShow</strong>
        <small>Portal del apoderado</small>
      </span>
    </NuxtLink>

    <nav class="docente-navegacion" aria-label="Navegación del apoderado">
      <NuxtLink
        v-for="enlace in enlaces"
        :key="enlace.destino"
        :to="enlace.destino"
        class="docente-navegacion__enlace"
        :class="{ 'docente-navegacion__enlace--activo': activo(enlace.destino) }"
        :aria-current="activo(enlace.destino) ? 'page' : undefined"
      >
        <img :src="enlace.icono" alt="" />
        <span>{{ enlace.nombre }}</span>
      </NuxtLink>
      <span
        v-for="proximo in proximos"
        :key="proximo.nombre"
        class="docente-navegacion__enlace proximamente"
        aria-disabled="true"
        title="Disponible próximamente"
      >
        <img :src="proximo.icono" alt="" />
        <span>{{ proximo.nombre }}</span>
        <small>Pronto</small>
      </span>
    </nav>

    <div class="pie">
      <span class="docente-navegacion__enlace proximamente" aria-disabled="true" title="Disponible próximamente">
        <img src="/icons/menu-config.svg" alt="" />
        <span>Configuración</span>
        <small>Pronto</small>
      </span>
    </div>
  </aside>
</template>

<style scoped>
.proximamente {
  color: #8fa6d6;
  cursor: not-allowed;
}

.proximamente:hover {
  background: transparent;
  color: #8fa6d6;
}

.proximamente img {
  opacity: 0.55;
}

.proximamente small {
  margin-left: auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgb(255 255 255 / 12%);
  color: #c7d6f5;
  font-size: 11px;
  font-weight: 700;
}

.pie {
  padding-top: 12px;
  border-top: 1px solid rgb(255 255 255 / 22%);
}

@media (max-width: 860px) {
  .pie {
    display: none;
  }
}
</style>
