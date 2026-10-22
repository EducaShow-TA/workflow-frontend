<script setup lang="ts">
interface EnlaceMenu {
  nombre: string
  icono: string
  destino?: string
  prefijoActivo?: string
}

const ruta = useRoute()

const enlaces: EnlaceMenu[] = [
  { nombre: 'Panel', icono: '/icons/menu-panel.svg', destino: '/panel' },
  { nombre: 'Estudiantes', icono: '/icons/menu-estudiantes.svg', destino: '/estudiantes' },
  {
    nombre: 'Matrícula',
    icono: '/icons/menu-matricula.svg',
    destino: '/matriculas',
    prefijoActivo: '/matriculas',
  },
  { nombre: 'Grados/Secciones', icono: '/icons/menu-secciones.svg', destino: '/secciones' },
  { nombre: 'Competencias', icono: '/icons/menu-competencias.svg', destino: '/competencias' },
  { nombre: 'Docentes', icono: '/icons/menu-docentes.svg' },
  { nombre: 'Clases', icono: '/icons/menu-clases.svg' },
  { nombre: 'Finanzas', icono: '/icons/menu-finanzas.svg' },
  { nombre: 'Reportes', icono: '/icons/menu-reportes.svg' },
  { nombre: 'Usuarios', icono: '/icons/menu-usuarios.svg', destino: '/usuarios' },
  { nombre: 'Roles/Permisos', icono: '/icons/menu-roles.svg', destino: '/roles-permisos' },
  { nombre: 'Logs del sistema', icono: '/icons/menu-logs.svg', destino: '/logs-sistema' },
]

function estaActivo(enlace: EnlaceMenu): boolean {
  const prefijo = enlace.prefijoActivo ?? enlace.destino
  return prefijo !== undefined && ruta.path.startsWith(prefijo)
}
</script>

<template>
  <aside class="barra-lateral">
    <NuxtLink to="/panel" class="marca">
      <span class="marca-icono">
        <img src="/icons/logo.svg" alt="" />
      </span>

      <span class="marca-texto">
        <strong>EducaShow</strong>
        <small>Portal Administrador</small>
      </span>
    </NuxtLink>

    <nav class="navegacion" aria-label="Navegación principal">
      <template v-for="enlace in enlaces" :key="enlace.nombre">
        <NuxtLink
          v-if="enlace.destino"
          :to="enlace.destino"
          class="enlace-menu"
          :class="{ activo: estaActivo(enlace) }"
          :aria-current="estaActivo(enlace) ? 'page' : undefined"
        >
          <span class="contenedor-icono">
            <img :src="enlace.icono" alt="" />
          </span>
          <span>{{ enlace.nombre }}</span>
        </NuxtLink>

        <span v-else class="enlace-menu deshabilitado" aria-disabled="true" title="Módulo pendiente de implementación">
          <span class="contenedor-icono">
            <img :src="enlace.icono" alt="" />
          </span>
          <span>{{ enlace.nombre }}</span>
        </span>
      </template>
    </nav>

    <div class="parte-inferior">
      <span class="enlace-menu deshabilitado" aria-disabled="true" title="Configuración pendiente">
        <span class="contenedor-icono">
          <img src="/icons/menu-config.svg" alt="" />
        </span>
        <span>Configuración</span>
      </span>
    </div>
  </aside>
</template>

<style scoped>
.barra-lateral {
  position: sticky;
  top: 0;
  display: flex;
  width: 280px;
  height: 100vh;
  flex: 0 0 280px;
  flex-direction: column;
  padding: 16px;
  background-color: #00569c;
  color: #ffffff;
}

.marca {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 24px;
  color: inherit;
  text-decoration: none;
}

.marca-icono {
  display: flex;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgb(255 255 255 / 20%);
}

.marca-texto {
  display: flex;
  flex-direction: column;
}

.marca-texto strong {
  font-size: 24px;
  line-height: 32px;
}

.marca-texto small {
  color: rgb(255 255 255 / 70%);
  font-size: 12px;
}

.navegacion {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
}

.enlace-menu {
  display: flex;
  min-height: 36px;
  align-items: center;
  gap: 16px;
  padding: 8px;
  border-radius: 8px;
  color: rgb(255 255 255 / 75%);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.contenedor-icono {
  display: flex;
  width: 24px;
  flex: 0 0 24px;
  align-items: center;
  justify-content: center;
}

.contenedor-icono img,
.marca-icono img {
  max-width: 24px;
  max-height: 24px;
}

.enlace-menu.activo {
  background: #8fa7fe;
  color: #1d3989;
}

.enlace-menu.deshabilitado {
  cursor: not-allowed;
}

.parte-inferior {
  padding-top: 8px;
  border-top: 1px solid rgb(255 255 255 / 10%);
}

@media (max-width: 800px) {
  .barra-lateral {
    position: relative;
    width: 100%;
    height: auto;
    flex-basis: auto;
  }

  .marca {
    padding-bottom: 16px;
  }

  .navegacion {
    flex-direction: row;
    overflow-x: auto;
  }

  .enlace-menu {
    flex-shrink: 0;
    white-space: nowrap;
  }

  .parte-inferior {
    display: none;
  }
}

/* EDU: color unico para iconos del menu */
.navegacion .contenedor-icono img,
.parte-inferior .contenedor-icono img {
  filter: none !important;
  opacity: 1 !important;
}
</style>
