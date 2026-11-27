<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  limpiarPanelDocente,
  listarPendientesDocente,
  usePanelDocente,
} from '~/composables/usePanelDocente'
import { useAutenticacionStore } from '~/stores/autenticacion'

const MINUTOS_ACTUALIZACION = 5

const ruta = useRoute()
const autenticacion = useAutenticacionStore()
const panel = usePanelDocente()
const perfilAbierto = ref(false)
const notificacionesAbiertas = ref(false)
const esDocente = computed(() => autenticacion.usuario?.rol === 'DOCENTE')
const titulos: Record<string, string> = {
  '/docente': 'Mi panel',
  '/docente/tareas': 'Gestión de tareas',
  '/docente/calificaciones': 'Calificaciones y evidencias',
  '/docente/asistencia': 'Asistencia de alumnos',
  '/docente/reporte-asistencia': 'Reporte de asistencia',
  '/docente/libretas': 'Libretas e informes',
  '/docente/marcaje': 'Mi marcaje',
  '/docente/horario': 'Mi horario',
}
const titulo = computed(
  () =>
    titulos[ruta.path] ??
    (ruta.path.startsWith('/docente/asistencia/') ? titulos['/docente/asistencia'] : undefined) ??
    'Portal docente',
)
const iniciales = computed(() => {
  const palabras = (autenticacion.usuario?.nombreCompleto ?? 'Docente').trim().split(/\s+/)
  return palabras
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join('')
})

const zonaAcciones = ref<HTMLElement | null>(null)
const errorCarga = ref(false)
const ahora = ref(ahoraSistema().getTime())
let reloj: ReturnType<typeof setInterval> | undefined

const pendientes = computed(() => (panel.datos.value ? listarPendientesDocente(panel.datos.value, ahora.value) : []))
const actualizadoA = computed(() =>
  panel.datos.value
    ? new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(panel.datos.value.actualizado)
    : '',
)

watch(
  () => ruta.fullPath,
  () => {
    cerrarMenus()
  },
)

async function cargarDatos(forzar = false): Promise<void> {
  if (!esDocente.value) return
  try {
    await panel.cargar(forzar)
    errorCarga.value = false
  } catch {
    errorCarga.value = true
  }
  ahora.value = ahoraSistema().getTime()
}

function cerrarMenus(): void {
  perfilAbierto.value = false
  notificacionesAbiertas.value = false
}

function alternarNotificaciones(): void {
  notificacionesAbiertas.value = !notificacionesAbiertas.value
  perfilAbierto.value = false
  if (notificacionesAbiertas.value) void cargarDatos(true)
}

function alternarPerfil(): void {
  perfilAbierto.value = !perfilAbierto.value
  notificacionesAbiertas.value = false
}

function alHacerClic(evento: MouseEvent): void {
  const destino = evento.target as Node
  if (!zonaAcciones.value?.contains(destino)) cerrarMenus()
}

async function salir(): Promise<void> {
  cerrarMenus()
  limpiarPanelDocente()
  autenticacion.cerrarSesion()
  await navigateTo('/login')
}

onMounted(() => {
  void cargarDatos()
  reloj = setInterval(() => cargarDatos(true), MINUTOS_ACTUALIZACION * 60_000)
  document.addEventListener('click', alHacerClic)
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  document.removeEventListener('click', alHacerClic)
})
</script>

<template>
  <header class="docente-superior" @keydown.esc="cerrarMenus">
    <div class="docente-superior__barra">
      <div class="docente-superior__identidad">
        <span class="docente-superior__identificador">Portal Docente</span>
        <span class="docente-superior__separador" aria-hidden="true">/</span>
        <strong>{{ titulo }}</strong>
      </div>
      <div ref="zonaAcciones" class="docente-superior__acciones acciones">
        <button
          v-if="esDocente"
          type="button"
          class="campana"
          :aria-label="pendientes.length ? `Pendientes de hoy: ${pendientes.length}` : 'Pendientes de hoy'"
          aria-controls="pendientes-docente"
          :aria-expanded="notificacionesAbiertas"
          @click="alternarNotificaciones"
        >
          <img src="/icons/campana.svg" alt="" />
          <span v-if="pendientes.length" class="campana__contador" aria-hidden="true">{{ pendientes.length }}</span>
        </button>
        <span class="docente-superior__rol">{{
          autenticacion.usuario?.rol === 'ADMINISTRADOR' ? 'Vista de administrador' : 'Docente'
        }}</span>
        <button
          type="button"
          class="docente-superior__perfil"
          aria-label="Abrir opciones de usuario"
          aria-haspopup="menu"
          :aria-expanded="perfilAbierto"
          @click="alternarPerfil"
        >
          {{ iniciales }}
        </button>
        <div
          v-if="notificacionesAbiertas"
          id="pendientes-docente"
          class="pendientes"
          role="dialog"
          aria-label="Pendientes de hoy"
        >
          <div class="pendientes__cabecera">
            <strong>Pendientes de hoy</strong>
            <small v-if="actualizadoA">Actualizado {{ actualizadoA }}</small>
          </div>
          <p v-if="errorCarga && !panel.datos.value" class="pendientes__vacio">No se pudieron cargar tus pendientes.</p>
          <ul v-else-if="pendientes.length" class="pendientes__lista">
            <li v-for="pendiente in pendientes" :key="pendiente.clave">
              <NuxtLink :to="pendiente.destino" @click="cerrarMenus">
                <span :class="['pendientes__numero', `pendientes__numero--${pendiente.tono}`]">{{
                  pendiente.cantidad
                }}</span>
                <span class="pendientes__texto">
                  {{ pendiente.titulo }}
                  <small>{{ pendiente.detalle }}</small>
                </span>
                <span class="pendientes__ir">{{ pendiente.enlace }} →</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="pendientes__vacio pendientes__vacio--ok">✓ Todo al día: no tienes pendientes hoy.</p>
          <div class="pendientes__pie">
            <span>Se actualizan cada {{ MINUTOS_ACTUALIZACION }} min</span>
            <NuxtLink to="/docente" @click="cerrarMenus">Ir a mi panel</NuxtLink>
          </div>
        </div>
        <div v-if="perfilAbierto" class="docente-superior__menu" role="menu" aria-label="Opciones del usuario">
          <strong>{{ autenticacion.usuario?.nombreCompleto ?? 'Usuario' }}</strong>
          <small>{{ autenticacion.usuario?.username }}</small>
          <button type="button" role="menuitem" @click="salir">Cerrar sesión</button>
        </div>
      </div>
    </div>
    <nav class="docente-superior__migas" aria-label="Ruta de navegación">
      <NuxtLink to="/docente">Inicio</NuxtLink>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ titulo }}</span>
    </nav>
  </header>
</template>

<style scoped>
.acciones {
  position: relative;
}

.acciones .docente-superior__menu {
  top: calc(100% + 12px);
  right: 0;
}

.campana {
  position: relative;
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.campana:hover,
.campana[aria-expanded='true'] {
  background: #eff4ff;
}

.campana img {
  width: 16px;
  height: 20px;
}

.campana__contador {
  position: absolute;
  top: 0;
  right: -2px;
  display: grid;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  place-items: center;
  border: 2px solid white;
  border-radius: 999px;
  background: #dc2626;
  color: white;
  font-size: 10.5px;
  font-weight: 700;
}

.campana:focus-visible {
  outline: 2px solid #1d4ed8;
  outline-offset: 2px;
}

.pendientes {
  position: absolute;
  z-index: 20;
  top: calc(100% + 12px);
  right: 0;
  width: 370px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  box-shadow: 0 12px 32px rgb(15 23 42 / 14%);
}

.pendientes__cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 14px 8px;
  border-bottom: 1px solid #f1f5f9;
}

.pendientes__cabecera strong {
  font-size: 15px;
}

.pendientes__cabecera small {
  color: #64748b;
  font-size: 12px;
}

.pendientes__lista {
  margin: 0;
  padding: 6px;
  list-style: none;
}

.pendientes__lista a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 8px;
  border-radius: 8px;
  color: #111827;
  font-size: 13.5px;
  text-decoration: none;
}

.pendientes__lista a:hover,
.pendientes__lista a:focus-visible {
  background: #f8fafc;
}

.pendientes__numero {
  display: grid;
  min-width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 800;
}

.pendientes__numero--rojo {
  background: #fee2e2;
  color: #991b1b;
}

.pendientes__numero--ambar {
  background: #fef3c7;
  color: #92400e;
}

.pendientes__numero--azul {
  background: #dbeafe;
  color: #1e40af;
}

.pendientes__texto {
  min-width: 0;
  flex: 1;
}

.pendientes__texto small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.pendientes__ir {
  color: #1d4ed8;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.pendientes__vacio {
  margin: 0;
  padding: 20px 16px;
  color: #475569;
  font-size: 13.5px;
  text-align: center;
}

.pendientes__vacio--ok {
  color: #166534;
  font-weight: 600;
}

.pendientes__pie {
  display: flex;
  justify-content: space-between;
  padding: 9px 14px;
  border-top: 1px solid #f1f5f9;
  color: #64748b;
  font-size: 12.5px;
}

.pendientes__pie a {
  color: #1d4ed8;
  font-weight: 600;
  text-decoration: none;
}

@media (max-width: 900px) {
  .docente-superior__identidad {
    display: none;
  }
}

@media (max-width: 640px) {
  .pendientes {
    position: fixed;
    top: 70px;
    right: 8px;
    left: 8px;
    width: auto;
  }
}
</style>
