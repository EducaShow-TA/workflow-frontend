<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listarPendientesPanel, usePanelAdministrador, type PendientePanel } from '~/composables/usePanelAdministrador'
import { useAutenticacionStore } from '~/stores/autenticacion'

const MINUTOS_ACTUALIZACION = 5

const autenticacion = useAutenticacionStore()
const ruta = useRoute()
const panel = usePanelAdministrador()

const NOMBRES_PAGINA: [string, string][] = [
  ['/estudiantes', 'Estudiantes'],
  ['/matriculas', 'Matrícula'],
  ['/secciones', 'Grados y secciones'],
  ['/competencias', 'Competencias'],
  ['/tareas', 'Tareas'],
  ['/calificaciones', 'Calificaciones'],
  ['/horarios', 'Horarios'],
  ['/horario-secciones', 'Horario por sección'],
  ['/usuarios', 'Usuarios'],
  ['/roles-permisos', 'Roles y permisos'],
  ['/logs-sistema', 'Logs del sistema'],
  ['/parametros-sistema', 'Parámetros del sistema'],
  ['/sesiones-clase', 'Sesiones de clase'],
  ['/asistencia-docentes', 'Asistencia docente'],
  ['/finanzas', 'Finanzas'],
  ['/reportes/cuadro-merito', 'Cuadro de mérito'],
  ['/reportes/asistencia', 'Reporte de asistencia'],
  ['/reportes', 'Reportes'],
  ['/libretas', 'Libretas'],
  ['/asistencia', 'Asistencia'],
]

const nombrePagina = computed(
  () =>
    NOMBRES_PAGINA.find(([prefijo]) => ruta.path === prefijo || ruta.path.startsWith(`${prefijo}/`))?.[1] ?? 'Panel',
)

const zonaAcciones = ref<HTMLElement | null>(null)

watch(
  () => ruta.fullPath,
  () => {
    cerrarMenus()
  },
)

const pendientes = ref<PendientePanel[]>([])
const actualizadoA = ref('')
const errorPendientes = ref(false)
const notificacionesAbiertas = ref(false)
const perfilAbierto = ref(false)
let reloj: ReturnType<typeof setInterval> | undefined

async function cargarPendientes(): Promise<void> {
  try {
    pendientes.value = listarPendientesPanel(await panel.consultar())
    errorPendientes.value = false
    actualizadoA.value = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(new Date())
  } catch {
    errorPendientes.value = true
  }
}

function alternarNotificaciones(): void {
  notificacionesAbiertas.value = !notificacionesAbiertas.value
  perfilAbierto.value = false
  if (notificacionesAbiertas.value) void cargarPendientes()
}

function alternarPerfil(): void {
  perfilAbierto.value = !perfilAbierto.value
  notificacionesAbiertas.value = false
}

function cerrarMenus(): void {
  notificacionesAbiertas.value = false
  perfilAbierto.value = false
}

function alHacerClic(evento: MouseEvent): void {
  const destino = evento.target as Node
  if (!zonaAcciones.value?.contains(destino)) cerrarMenus()
}

async function cerrarSesion(): Promise<void> {
  autenticacion.cerrarSesion()
  cerrarMenus()
  await navigateTo('/login')
}

onMounted(() => {
  void cargarPendientes()
  reloj = setInterval(cargarPendientes, MINUTOS_ACTUALIZACION * 60_000)
  document.addEventListener('click', alHacerClic)
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  document.removeEventListener('click', alHacerClic)
})
</script>

<template>
  <header class="encabezado-administrador" @keydown.esc="cerrarMenus">
    <div class="barra-superior">
      <div ref="zonaAcciones" class="zona-acciones">
        <button
          type="button"
          class="boton-accion"
          :aria-label="pendientes.length ? `Pendientes: ${pendientes.length}` : 'Pendientes'"
          aria-controls="panel-notificaciones"
          :aria-expanded="notificacionesAbiertas"
          @click="alternarNotificaciones"
        >
          <img src="/icons/campana.svg" alt="" />
          <span v-if="pendientes.length" class="contador" aria-hidden="true">{{ pendientes.length }}</span>
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

        <div
          v-if="notificacionesAbiertas"
          id="panel-notificaciones"
          class="menu-emergente notificaciones"
          role="dialog"
          aria-label="Pendientes"
        >
          <div class="notificaciones__cabecera">
            <strong>Pendientes</strong>
            <small v-if="actualizadoA">Actualizado {{ actualizadoA }}</small>
          </div>
          <p v-if="errorPendientes && !pendientes.length" class="notificaciones__vacio">
            No se pudieron cargar los pendientes.
          </p>
          <ul v-else-if="pendientes.length" class="notificaciones__lista">
            <li v-for="pendiente in pendientes" :key="pendiente.destino">
              <NuxtLink :to="pendiente.destino" @click="cerrarMenus">
                <span :class="['numero', `numero--${pendiente.tono}`]">{{ pendiente.cantidad }}</span>
                <span class="notificaciones__texto">
                  {{ pendiente.titulo }}
                  <small>{{ pendiente.detalle }}</small>
                </span>
                <span class="notificaciones__ir">{{ pendiente.enlace }} →</span>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="notificaciones__vacio notificaciones__vacio--ok">✓ Todo al día: no hay pendientes.</p>
          <div class="notificaciones__pie">
            <span>Se actualizan cada {{ MINUTOS_ACTUALIZACION }} min</span>
            <NuxtLink to="/panel" @click="cerrarMenus">Ir al panel</NuxtLink>
          </div>
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
  justify-content: flex-end;
  gap: 24px;
  padding: 0 24px;
  border-bottom: 1px solid #c3c6d7;
}

.boton-accion {
  position: relative;
}

.contador {
  position: absolute;
  top: 2px;
  right: 0;
  display: grid;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  place-items: center;
  border: 2px solid var(--color-surface);
  border-radius: 999px;
  background: #dc2626;
  color: white;
  font-size: 10.5px;
  font-weight: 700;
}

.menu-emergente.notificaciones {
  width: 360px;
  padding: 0;
}

.notificaciones__cabecera {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 14px 8px;
  border-bottom: 1px solid #f1f5f9;
}

.notificaciones__cabecera small {
  color: #64748b;
  font-size: 12px;
}

.notificaciones__lista {
  margin: 0;
  padding: 6px;
  list-style: none;
}

.notificaciones__lista a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 8px;
  border-radius: 8px;
  color: var(--color-text);
  font-size: 13.5px;
  text-decoration: none;
}

.notificaciones__lista a:hover,
.notificaciones__lista a:focus-visible {
  background: #f8fafc;
}

.numero {
  display: grid;
  min-width: 34px;
  height: 34px;
  padding: 0 5px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 800;
}

.numero--ambar {
  background: #fef3c7;
  color: #92400e;
}

.numero--rojo {
  background: #fee2e2;
  color: #991b1b;
}

.numero--azul {
  background: #dbeafe;
  color: #1e40af;
}

.numero--gris {
  background: #e2e8f0;
  color: #334155;
}

.notificaciones__texto {
  min-width: 0;
  flex: 1;
}

.notificaciones__texto small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.notificaciones__ir {
  color: var(--color-primary);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.menu-emergente .notificaciones__vacio {
  margin: 0;
  padding: 20px 16px;
  text-align: center;
}

.menu-emergente .notificaciones__vacio--ok {
  color: #166534;
  font-weight: 600;
}

.notificaciones__pie {
  display: flex;
  justify-content: space-between;
  padding: 9px 14px;
  border-top: 1px solid #f1f5f9;
  color: #64748b;
  font-size: 12.5px;
}

.notificaciones__pie a {
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: none;
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

  .menu-emergente.notificaciones {
    width: min(360px, 92vw);
  }

  .atajo,
  .pie-busqueda span {
    display: none;
  }
}
</style>
