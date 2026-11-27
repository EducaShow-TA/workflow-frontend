<script setup lang="ts">
interface EnlaceMenu {
  nombre: string
  icono: string
  destino: string
  prefijoActivo?: string
}

interface GrupoMenu {
  titulo: string
  enlaces: EnlaceMenu[]
}

const ruta = useRoute()
const grupos: GrupoMenu[] = [
  {
    titulo: 'Inicio',
    enlaces: [{ nombre: 'Panel', icono: '/icons/menu-panel.svg', destino: '/panel' }],
  },
  {
    titulo: 'Estudiantes y matrícula',
    enlaces: [
      { nombre: 'Estudiantes', icono: '/icons/menu-estudiantes.svg', destino: '/estudiantes' },
      {
        nombre: 'Matrícula',
        icono: '/icons/menu-matricula.svg',
        destino: '/matriculas',
        prefijoActivo: '/matriculas',
      },
      { nombre: 'Grados y secciones', icono: '/icons/menu-secciones.svg', destino: '/secciones' },
    ],
  },
  {
    titulo: 'Gestión académica',
    enlaces: [
      { nombre: 'Calificaciones', icono: '/icons/menu-calificaciones.svg', destino: '/calificaciones' },
      { nombre: 'Áreas y competencias', icono: '/icons/menu-competencias.svg', destino: '/competencias' },
      { nombre: 'Tareas', icono: '/icons/menu-tareas.svg', destino: '/tareas' },
      { nombre: 'Horarios', icono: '/icons/menu-horarios.svg', destino: '/horarios' },
      { nombre: 'Horario por sección', icono: '/icons/menu-clases.svg', destino: '/horario-secciones' },
      { nombre: 'Docentes', icono: '/icons/menu-docentes.svg', destino: '/docentes' },
      { nombre: 'Sesiones de clase', icono: '/icons/menu-matricula.svg', destino: '/sesiones-clase' },
      { nombre: 'Asistencia docente', icono: '/icons/menu-docentes.svg', destino: '/asistencia-docentes' },
    ],
  },
  {
    titulo: 'Finanzas y reportes',
    enlaces: [
      { nombre: 'Finanzas', icono: '/icons/menu-finanzas.svg', destino: '/finanzas' },
      {
        nombre: 'Boletas',
        icono: '/icons/menu-reportes.svg',
        destino: '/reportes/boletas',
        prefijoActivo: '/reportes/boletas',
      },
      {
        nombre: 'Reporte de asistencia',
        icono: '/icons/menu-reportes.svg',
        destino: '/reportes/asistencia',
        prefijoActivo: '/reportes/asistencia',
      },
      {
        nombre: 'Cuadro de mérito',
        icono: '/icons/menu-reportes.svg',
        destino: '/reportes/cuadro-merito',
        prefijoActivo: '/reportes/cuadro-merito',
      },
    ],
  },
  {
    titulo: 'Administración',
    enlaces: [
      { nombre: 'Usuarios', icono: '/icons/menu-usuarios.svg', destino: '/usuarios' },
      { nombre: 'Roles y permisos', icono: '/icons/menu-roles.svg', destino: '/roles-permisos' },
      { nombre: 'Logs del sistema', icono: '/icons/menu-logs.svg', destino: '/logs-sistema' },
      { nombre: 'Parámetros', icono: '/icons/menu-config.svg', destino: '/parametros-sistema' },
    ],
  },
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
      <section v-for="grupo in grupos" :key="grupo.titulo" class="grupo-menu">
        <h2 class="titulo-grupo">{{ grupo.titulo }}</h2>
        <NuxtLink
          v-for="enlace in grupo.enlaces"
          :key="enlace.destino"
          :to="enlace.destino"
          class="enlace-menu"
          :class="{ activo: estaActivo(enlace) }"
          :aria-current="estaActivo(enlace) ? 'page' : undefined"
        >
          <span class="contenedor-icono"><img :src="enlace.icono" alt="" /></span>
          <span>{{ enlace.nombre }}</span>
        </NuxtLink>
      </section>
    </nav>
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
  gap: 12px;
  overflow-y: auto;
}

.grupo-menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.titulo-grupo {
  padding: 4px 8px;
  margin: 0;
  color: rgb(255 255 255 / 70%);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
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

  .grupo-menu {
    flex: 0 0 auto;
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
