<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  MINIMO_CARACTERES_BUSQUEDA,
  buscarPantallasAdministrador,
  resaltarCoincidencia,
  useBusquedaAdministrador,
  type EstudianteEncontrado,
  type PantallaAdministrador,
} from '~/composables/useBusquedaAdministrador'
import { listarPendientesPanel, usePanelAdministrador, type PendientePanel } from '~/composables/usePanelAdministrador'
import { useAutenticacionStore } from '~/stores/autenticacion'

type OpcionBusqueda =
  | { tipo: 'estudiante'; clave: string; estudiante: EstudianteEncontrado }
  | { tipo: 'pantalla'; clave: string; pantalla: PantallaAdministrador }

const MINUTOS_ACTUALIZACION = 5

const autenticacion = useAutenticacionStore()
const ruta = useRoute()
const busqueda = useBusquedaAdministrador()
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

const campo = ref<HTMLInputElement | null>(null)
const zonaBusqueda = ref<HTMLElement | null>(null)
const zonaAcciones = ref<HTMLElement | null>(null)
const consulta = ref('')
const desplegableAbierto = ref(false)
const buscando = ref(false)
const errorBusqueda = ref('')
const estudiantes = ref<EstudianteEncontrado[]>([])
const indiceActivo = ref(0)
let temporizador: ReturnType<typeof setTimeout> | undefined
let turnoBusqueda = 0

const pantallas = computed(() => buscarPantallasAdministrador(consulta.value))
const consultaValida = computed(() => consulta.value.trim().length >= MINIMO_CARACTERES_BUSQUEDA)
const opciones = computed<OpcionBusqueda[]>(() => [
  ...estudiantes.value.map((estudiante) => ({
    tipo: 'estudiante' as const,
    clave: `e-${estudiante.estudianteId}`,
    estudiante,
  })),
  ...pantallas.value.map((pantalla) => ({ tipo: 'pantalla' as const, clave: `p-${pantalla.destino}`, pantalla })),
])
const mostrarDesplegable = computed(() => desplegableAbierto.value && consultaValida.value)
const opcionActiva = computed(() =>
  mostrarDesplegable.value && opciones.value[indiceActivo.value]
    ? `opcion-${opciones.value[indiceActivo.value]!.clave}`
    : undefined,
)

watch(consulta, (texto) => {
  clearTimeout(temporizador)
  indiceActivo.value = 0
  errorBusqueda.value = ''
  desplegableAbierto.value = true
  const turno = ++turnoBusqueda
  if (texto.trim().length < MINIMO_CARACTERES_BUSQUEDA) {
    estudiantes.value = []
    buscando.value = false
    return
  }
  buscando.value = true
  temporizador = setTimeout(async () => {
    try {
      const encontrados = await busqueda.buscarEstudiantes(texto)
      if (turno === turnoBusqueda) estudiantes.value = encontrados
    } catch {
      if (turno === turnoBusqueda) {
        estudiantes.value = []
        errorBusqueda.value = 'No se pudo buscar estudiantes. Intenta de nuevo.'
      }
    } finally {
      if (turno === turnoBusqueda) buscando.value = false
    }
  }, 300)
})

watch(
  () => ruta.fullPath,
  () => {
    desplegableAbierto.value = false
    cerrarMenus()
  },
)

function moverSeleccion(paso: number): void {
  if (!opciones.value.length) return
  desplegableAbierto.value = true
  indiceActivo.value = (indiceActivo.value + paso + opciones.value.length) % opciones.value.length
}

async function elegir(opcion: OpcionBusqueda): Promise<void> {
  desplegableAbierto.value = false
  if (opcion.tipo === 'estudiante') {
    consulta.value = ''
    await navigateTo({ path: '/estudiantes', query: { buscar: opcion.estudiante.dni } })
  } else {
    consulta.value = ''
    await navigateTo(opcion.pantalla.destino)
  }
}

async function verTodos(): Promise<void> {
  const texto = consulta.value.trim()
  desplegableAbierto.value = false
  consulta.value = ''
  await navigateTo({ path: '/estudiantes', query: { buscar: texto } })
}

async function confirmar(): Promise<void> {
  const opcion = opciones.value[indiceActivo.value]
  if (opcion) await elegir(opcion)
  else if (consultaValida.value && !buscando.value) await verTodos()
}

function cerrarBusqueda(): void {
  desplegableAbierto.value = false
}

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

function alPresionarTecla(evento: KeyboardEvent): void {
  if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
    evento.preventDefault()
    campo.value?.focus()
    desplegableAbierto.value = true
  }
}

function alHacerClic(evento: MouseEvent): void {
  const destino = evento.target as Node
  if (!zonaBusqueda.value?.contains(destino)) desplegableAbierto.value = false
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
  document.addEventListener('keydown', alPresionarTecla)
  document.addEventListener('click', alHacerClic)
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  clearTimeout(temporizador)
  document.removeEventListener('keydown', alPresionarTecla)
  document.removeEventListener('click', alHacerClic)
})
</script>

<template>
  <header class="encabezado-administrador" @keydown.esc="cerrarMenus">
    <div class="barra-superior">
      <div ref="zonaBusqueda" class="zona-busqueda">
        <form class="formulario-busqueda" role="search" @submit.prevent="confirmar">
          <label for="busqueda-global" class="solo-lectores">Buscar estudiante por nombre o DNI, o una pantalla</label>

          <img src="/icons/buscar.svg" alt="" class="icono-busqueda" />

          <input
            id="busqueda-global"
            ref="campo"
            v-model="consulta"
            type="search"
            placeholder="Buscar estudiante (nombre o DNI) o pantalla…"
            autocomplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="resultados-busqueda"
            :aria-expanded="mostrarDesplegable"
            :aria-activedescendant="opcionActiva"
            @focus="desplegableAbierto = true"
            @keydown.down.prevent="moverSeleccion(1)"
            @keydown.up.prevent="moverSeleccion(-1)"
            @keydown.esc.stop="cerrarBusqueda"
          />
          <kbd class="atajo" aria-hidden="true">Ctrl K</kbd>
        </form>

        <div v-if="mostrarDesplegable" class="desplegable">
          <ul id="resultados-busqueda" role="listbox" aria-label="Resultados de búsqueda">
            <li v-if="estudiantes.length" class="grupo" role="presentation">Estudiantes</li>
            <template v-for="(opcion, indice) in opciones" :key="opcion.clave">
              <li v-if="opcion.tipo === 'pantalla' && indice === estudiantes.length" class="grupo" role="presentation">
                Ir a
              </li>
              <li
                :id="`opcion-${opcion.clave}`"
                role="option"
                :aria-selected="indice === indiceActivo"
                :class="['opcion', { 'opcion--activa': indice === indiceActivo }]"
                @mousemove="indiceActivo = indice"
                @mousedown.prevent="elegir(opcion)"
              >
                <template v-if="opcion.tipo === 'estudiante'">
                  <span class="iniciales" aria-hidden="true">{{ opcion.estudiante.iniciales }}</span>
                  <span class="opcion__texto">
                    <span>
                      <template
                        v-for="(parte, p) in resaltarCoincidencia(opcion.estudiante.nombreCompleto, consulta)"
                        :key="p"
                      >
                        <mark v-if="parte.marcado">{{ parte.texto }}</mark>
                        <template v-else>{{ parte.texto }}</template>
                      </template>
                    </span>
                    <small>
                      DNI
                      <template v-for="(parte, p) in resaltarCoincidencia(opcion.estudiante.dni, consulta)" :key="p">
                        <mark v-if="parte.marcado">{{ parte.texto }}</mark>
                        <template v-else>{{ parte.texto }}</template>
                      </template>
                    </small>
                  </span>
                  <span class="aula">{{ opcion.estudiante.aula }}</span>
                </template>
                <template v-else>
                  <span class="icono-pantalla" aria-hidden="true">{{ opcion.pantalla.icono }}</span>
                  <span class="opcion__texto">
                    <span>
                      <template v-for="(parte, p) in resaltarCoincidencia(opcion.pantalla.titulo, consulta)" :key="p">
                        <mark v-if="parte.marcado">{{ parte.texto }}</mark>
                        <template v-else>{{ parte.texto }}</template>
                      </template>
                    </span>
                    <small>{{ opcion.pantalla.detalle }}</small>
                  </span>
                </template>
              </li>
            </template>
          </ul>
          <p v-if="buscando && !estudiantes.length" class="estado-busqueda" role="status">Buscando estudiantes…</p>
          <p v-else-if="errorBusqueda" class="estado-busqueda" role="alert">{{ errorBusqueda }}</p>
          <p v-else-if="!estudiantes.length" class="estado-busqueda" role="status">
            Ningún estudiante coincide con “{{ consulta.trim() }}”.
          </p>
          <div class="pie-busqueda">
            <span>↑↓ para moverte · Enter para abrir</span>
            <button v-if="estudiantes.length" type="button" class="enlace" @mousedown.prevent="verTodos">
              Ver todos los estudiantes con “{{ consulta.trim() }}” →
            </button>
          </div>
        </div>
      </div>

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

.formulario-busqueda input {
  padding-right: 62px;
}

.formulario-busqueda input::-webkit-search-cancel-button {
  display: none;
}

.atajo {
  position: absolute;
  top: 9px;
  right: 10px;
  padding: 1px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  background: white;
  color: #64748b;
  font-family: inherit;
  font-size: 11.5px;
  pointer-events: none;
}

.desplegable {
  position: absolute;
  z-index: 20;
  top: 44px;
  left: 0;
  width: 100%;
  padding: 6px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: 0 12px 32px rgb(15 23 42 / 14%);
}

.desplegable ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.grupo {
  padding: 6px 10px 4px;
  color: #64748b;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.opcion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  cursor: pointer;
}

.opcion--activa {
  background: #eff4ff;
}

.opcion mark {
  padding: 0 1px;
  border-radius: 2px;
  background: #fef08a;
  color: inherit;
}

.iniciales,
.icono-pantalla {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  font-size: 13px;
}

.iniciales {
  border-radius: 50%;
  background: #e0e7ff;
  color: #1e40af;
  font-weight: 700;
}

.icono-pantalla {
  border-radius: 8px;
  background: #f1f5f9;
}

.opcion__texto {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.opcion__texto small {
  color: #64748b;
  font-size: 12.5px;
}

.aula {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-size: 12px;
  white-space: nowrap;
}

.estado-busqueda {
  margin: 0;
  padding: 10px;
  color: var(--color-text-secondary);
  font-size: 13.5px;
}

.pie-busqueda {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
  padding: 8px 10px 4px;
  border-top: 1px solid #f1f5f9;
  color: #64748b;
  font-size: 12px;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
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
