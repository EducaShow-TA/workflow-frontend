<script setup lang="ts">
import { computed } from 'vue'
import { useAutenticacionStore } from '~/stores/autenticacion'
import { obtenerNombreRol, puedeAcceder } from '~/composables/usePermisosRol'

definePageMeta({
  layout: 'autenticacion',
  middleware: 'autenticacion',
})

const autenticacion = useAutenticacionStore()
const ruta = useRoute()

const rutaSolicitada = computed(() => (typeof ruta.query.ruta === 'string' ? ruta.query.ruta : ''))
const nombreRol = computed(() => (autenticacion.usuario ? obtenerNombreRol(autenticacion.usuario.rol) : ''))
const puedeVolverAlPanel = computed(() =>
  autenticacion.usuario ? puedeAcceder(autenticacion.usuario.rol, '/panel') : false,
)

async function irAlPanel(): Promise<void> {
  await navigateTo('/panel')
}

async function cerrarSesion(): Promise<void> {
  autenticacion.cerrarSesion()
  await navigateTo('/login')
}
</script>

<template>
  <section class="acceso-denegado">
    <div class="icono" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 -960 960 960" fill="currentColor">
        <path
          d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm296.5-143.5Q560-327 560-360t-23.5-56.5Q513-440 480-440t-56.5 23.5Q400-393 400-360t23.5 56.5Q447-280 480-280t56.5-23.5ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z"
        />
      </svg>
    </div>

    <header class="encabezado">
      <h1>Acceso denegado</h1>

      <p>
        Tu rol <strong>{{ nombreRol }}</strong> no tiene permiso para ingresar a esta pantalla.
        <span v-if="rutaSolicitada"
          >Ruta solicitada: <code>{{ rutaSolicitada }}</code></span
        >
      </p>

      <p v-if="!puedeVolverAlPanel">
        Las pantallas de este rol todavía no están disponibles. Si crees que es un error, comunícate con el
        administrador del colegio.
      </p>
    </header>

    <div class="acciones">
      <BotonPrincipal v-if="puedeVolverAlPanel" @click="irAlPanel">Volver al panel</BotonPrincipal>

      <button type="button" class="boton-secundario" @click="cerrarSesion">Cerrar sesión</button>
    </div>
  </section>
</template>

<style scoped>
.acceso-denegado {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.icono {
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fef2f2;
  color: #ba1a1a;
}

.encabezado h1 {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 600;
}

.encabezado p {
  margin: 0 0 8px;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.5;
}

.encabezado strong {
  color: var(--color-text);
}

.encabezado code {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: #f2f4f6;
  color: var(--color-text);
  font-size: 13px;
}

.acciones {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.boton-secundario {
  min-height: 42px;
  padding: 11px 25px;
  border: 1px solid #c3c6d7;
  border-radius: var(--radius-md);
  background: white;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.boton-secundario:hover {
  background: #eef2ff;
}

.boton-secundario:focus-visible {
  outline: 3px solid var(--color-primary-light);
  outline-offset: 2px;
}
</style>
