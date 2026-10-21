<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAutenticacionStore } from '~/stores/autenticacion'

const autenticacion = useAutenticacionStore()
const ruta = useRoute()

const nombrePagina = computed(() => {
  if (ruta.path.startsWith('/estudiantes')) return 'Estudiantes'
  if (ruta.path.startsWith('/matriculas')) return 'Matrícula'
  if (ruta.path.startsWith('/secciones')) return 'Grados y secciones'
  if (ruta.path.startsWith('/competencias')) return 'Competencias'
  if (ruta.path.startsWith('/usuarios')) return 'Usuarios'
  if (ruta.path.startsWith('/roles-permisos')) return 'Roles y permisos'
  return 'Panel'
})

const consulta = ref('')
const avisoBusqueda = ref('')
const notificacionesAbiertas = ref(false)
const perfilAbierto = ref(false)

function buscar(): void {
  avisoBusqueda.value = ''

  if (!consulta.value.trim()) {
    return
  }

  avisoBusqueda.value = 'La búsqueda estará disponible cuando se integre el servicio de estudiantes y cursos.'
}

function alternarNotificaciones(): void {
  notificacionesAbiertas.value = !notificacionesAbiertas.value
  perfilAbierto.value = false
}

function alternarPerfil(): void {
  perfilAbierto.value = !perfilAbierto.value
  notificacionesAbiertas.value = false
}

function cerrarMenus(): void {
  notificacionesAbiertas.value = false
  perfilAbierto.value = false
}

async function cerrarSesion(): Promise<void> {
  autenticacion.cerrarSesion()
  cerrarMenus()
  await navigateTo('/login')
}
</script>

<template>
  <header class="encabezado-administrador" @keydown.esc="cerrarMenus">
    <div class="barra-superior">
      <div class="zona-busqueda">
        <form class="formulario-busqueda" role="search" @submit.prevent="buscar">
          <label for="busqueda-global" class="solo-lectores"> Buscar estudiante o curso </label>

          <img src="/icons/buscar.svg" alt="" class="icono-busqueda" />

          <input
            id="busqueda-global"
            v-model="consulta"
            type="search"
            placeholder="Buscar estudiante, curso..."
            autocomplete="off"
            @input="avisoBusqueda = ''"
          />
        </form>

        <p v-if="avisoBusqueda" class="aviso-busqueda" role="status">
          {{ avisoBusqueda }}
        </p>
      </div>

      <div class="zona-acciones">
        <button
          type="button"
          class="boton-accion"
          aria-label="Notificaciones"
          aria-controls="panel-notificaciones"
          :aria-expanded="notificacionesAbiertas"
          @click="alternarNotificaciones"
        >
          <img src="/icons/campana.svg" alt="" />
        </button>

        <button
          type="button"
          class="boton-perfil"
          aria-label="Abrir menú de usuario"
          aria-controls="menu-perfil"
          aria-haspopup="menu"
          :aria-expanded="perfilAbierto"
          @click="alternarPerfil"
        >
          <img src="/images/avatar-admin.png" alt="" class="avatar" />
        </button>

        <div v-if="notificacionesAbiertas" id="panel-notificaciones" class="menu-emergente" role="status">
          <strong>Notificaciones</strong>

          <p>Las notificaciones estarán disponibles cuando se integre el backend.</p>
        </div>

        <div v-if="perfilAbierto" id="menu-perfil" class="menu-emergente" role="menu" aria-label="Opciones de usuario">
          <div class="datos-usuario">
            <strong>
              {{ autenticacion.usuario?.nombreCompleto ?? 'Administrador' }}
            </strong>

            <span>
              {{ autenticacion.usuario?.username }}
            </span>
          </div>

          <button type="button" class="opcion-salir" role="menuitem" @click="cerrarSesion">Cerrar sesión</button>
        </div>
      </div>
    </div>

    <nav class="migas-pan" aria-label="Ruta de navegación">
      <NuxtLink to="/panel"> Inicio </NuxtLink>

      <span aria-hidden="true">&rsaquo;</span>

      <span aria-current="page">{{ nombrePagina }}</span>
    </nav>
  </header>
</template>

<style scoped>
.encabezado-administrador {
  position: relative;
  z-index: 10;
  background: var(--color-surface);
}

.barra-superior {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 0 24px;
  border-bottom: 1px solid #c3c6d7;
}

.zona-busqueda {
  position: relative;
  width: 100%;
  max-width: 448px;
}

.formulario-busqueda {
  position: relative;
  width: 100%;
}

.formulario-busqueda input {
  width: 100%;
  height: 38px;
  padding: 10px 12px 10px 37px;
  border: 1px solid transparent;
  border-radius: 8px;
  outline: none;
  background: #f2f4f6;
  color: var(--color-text);
  font-size: 14px;
}

.formulario-busqueda input:focus {
  border-color: var(--color-primary);
}

.formulario-busqueda input::placeholder {
  color: #6b7280;
}

.icono-busqueda {
  position: absolute;
  z-index: 1;
  top: 10px;
  left: 8px;
  width: 18px;
  height: 18px;
  pointer-events: none;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.aviso-busqueda {
  position: absolute;
  z-index: 20;
  top: 42px;
  left: 0;
  width: 100%;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: 0 8px 20px rgb(0 0 0 / 10%);
  color: var(--color-text-secondary);
  font-size: 13px;
}

.zona-acciones {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.boton-accion,
.boton-perfil {
  display: flex;
  width: 40px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.boton-accion {
  border-radius: 50%;
}

.boton-accion img {
  width: 16px;
  height: 20px;
}

.boton-accion:hover,
.boton-perfil:hover {
  background: #f2f4f6;
}

.avatar {
  width: 32px;
  height: 32px;
  border: 1px solid #c3c6d7;
  border-radius: 50%;
  object-fit: cover;
}

.boton-accion:focus-visible,
.boton-perfil:focus-visible,
.opcion-salir:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.menu-emergente {
  position: absolute;
  z-index: 20;
  top: calc(100% + 8px);
  right: 0;
  width: 280px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: 0 8px 20px rgb(0 0 0 / 12%);
}

.menu-emergente strong {
  font-size: 14px;
}

.menu-emergente p {
  margin: 12px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.datos-usuario {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.datos-usuario span {
  overflow-wrap: anywhere;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.opcion-salir {
  width: 100%;
  margin-top: 12px;
  padding: 10px;
  border: 0;
  border-radius: 6px;
  background: #f2f4f6;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.opcion-salir:hover {
  background: #e5e7eb;
}

.migas-pan {
  display: flex;
  height: 26px;
  align-items: center;
  gap: 5px;
  padding: 0 24px;
  border-bottom: 1px solid #c3c6d7;
  font-size: 14px;
}

.migas-pan a {
  color: var(--color-text-secondary);
  text-decoration: none;
}

.migas-pan span:last-child {
  color: var(--color-primary);
  font-weight: 600;
}

@media (max-width: 600px) {
  .barra-superior {
    gap: 8px;
    padding: 0 12px;
  }

  .migas-pan {
    padding: 0 12px;
  }

  .menu-emergente {
    width: min(280px, 85vw);
  }
}
</style>
