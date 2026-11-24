<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { resaltarCoincidencia } from '~/composables/useBusquedaAdministrador'
import {
  GRUPOS_BUSQUEDA_DOCENTE,
  buscarEnPanelDocente,
  limpiarPanelDocente,
  listarPendientesDocente,
  usePanelDocente,
  type ResultadoBusquedaDocente,
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

const campo = ref<HTMLInputElement | null>(null)
const zonaBusqueda = ref<HTMLElement | null>(null)
const zonaAcciones = ref<HTMLElement | null>(null)
const consulta = ref('')
const desplegableAbierto = ref(false)
const indiceActivo = ref(0)
const errorCarga = ref(false)
const ahora = ref(ahoraSistema().getTime())
let reloj: ReturnType<typeof setInterval> | undefined

const resultados = computed(() => buscarEnPanelDocente(panel.datos.value, consulta.value))
const consultaValida = computed(() => consulta.value.trim().length >= 2)
const mostrarDesplegable = computed(() => desplegableAbierto.value && consultaValida.value)
const opcionActiva = computed(() =>
  mostrarDesplegable.value && resultados.value[indiceActivo.value]
    ? `docente-opcion-${resultados.value[indiceActivo.value]!.clave}`
    : undefined,
)
const pendientes = computed(() => (panel.datos.value ? listarPendientesDocente(panel.datos.value, ahora.value) : []))
const actualizadoA = computed(() =>
  panel.datos.value
    ? new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(panel.datos.value.actualizado)
    : '',
)

function iniciaGrupo(indice: number): boolean {
  return indice === 0 || resultados.value[indice - 1]!.tipo !== resultados.value[indice]!.tipo
}

function inicialesDe(texto: string): string {
  const [apellidos = '', nombres = ''] = texto.split(',')
  return `${nombres.trim().charAt(0)}${apellidos.trim().charAt(0)}`.toUpperCase() || texto.charAt(0)
}

watch(consulta, () => {
  indiceActivo.value = 0
  desplegableAbierto.value = true
})

watch(
  () => ruta.fullPath,
  () => {
    desplegableAbierto.value = false
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

function moverSeleccion(paso: number): void {
  if (!resultados.value.length) return
  desplegableAbierto.value = true
  indiceActivo.value = (indiceActivo.value + paso + resultados.value.length) % resultados.value.length
}

async function elegir(resultado: ResultadoBusquedaDocente): Promise<void> {
  desplegableAbierto.value = false
  consulta.value = ''
  await navigateTo(resultado.destino)
}

async function confirmar(): Promise<void> {
  const resultado = resultados.value[indiceActivo.value]
  if (resultado) await elegir(resultado)
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

function alPresionarTecla(evento: KeyboardEvent): void {
  if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k' && campo.value) {
    evento.preventDefault()
    campo.value.focus()
    desplegableAbierto.value = true
  }
}

function alHacerClic(evento: MouseEvent): void {
  const destino = evento.target as Node
  if (!zonaBusqueda.value?.contains(destino)) desplegableAbierto.value = false
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
  document.addEventListener('keydown', alPresionarTecla)
  document.addEventListener('click', alHacerClic)
})

onBeforeUnmount(() => {
  clearInterval(reloj)
  document.removeEventListener('keydown', alPresionarTecla)
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
      <div v-if="esDocente" ref="zonaBusqueda" class="buscador">
        <form role="search" @submit.prevent="confirmar">
          <label for="busqueda-docente" class="solo-lectores">Buscar alumnos, clases, tareas o pantallas</label>
          <img src="/icons/buscar.svg" alt="" class="buscador__icono" />
          <input
            id="busqueda-docente"
            ref="campo"
            v-model="consulta"
            type="search"
            placeholder="Buscar alumno, clase, tarea o pantalla…"
            autocomplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="resultados-docente"
            :aria-expanded="mostrarDesplegable"
            :aria-activedescendant="opcionActiva"
            @focus="desplegableAbierto = true"
            @keydown.down.prevent="moverSeleccion(1)"
            @keydown.up.prevent="moverSeleccion(-1)"
            @keydown.esc.stop="desplegableAbierto = false"
          />
          <kbd class="buscador__atajo" aria-hidden="true">Ctrl K</kbd>
        </form>
        <div v-if="mostrarDesplegable" class="buscador__desplegable">
          <ul id="resultados-docente" role="listbox" aria-label="Resultados de búsqueda">
            <template v-for="(resultado, indice) in resultados" :key="resultado.clave">
              <li v-if="iniciaGrupo(indice)" class="buscador__grupo" role="presentation">
                {{ GRUPOS_BUSQUEDA_DOCENTE[resultado.tipo] }}
              </li>
              <li
                :id="`docente-opcion-${resultado.clave}`"
                role="option"
                :aria-selected="indice === indiceActivo"
                :class="['buscador__opcion', { 'buscador__opcion--activa': indice === indiceActivo }]"
                @mousemove="indiceActivo = indice"
                @mousedown.prevent="elegir(resultado)"
              >
                <span
                  :class="['buscador__marca', { 'buscador__marca--alumno': resultado.tipo === 'alumno' }]"
                  aria-hidden="true"
                >
                  {{
                    resultado.tipo === 'alumno'
                      ? inicialesDe(resultado.titulo)
                      : resultado.tipo === 'clase'
                        ? '🏫'
                        : resultado.tipo === 'tarea'
                          ? '📋'
                          : resultado.etiqueta
                  }}
                </span>
                <span class="buscador__texto">
                  <span>
                    <template v-for="(parte, p) in resaltarCoincidencia(resultado.titulo, consulta)" :key="p">
                      <mark v-if="parte.marcado">{{ parte.texto }}</mark>
                      <template v-else>{{ parte.texto }}</template>
                    </template>
                  </span>
                  <small>
                    <template v-for="(parte, p) in resaltarCoincidencia(resultado.detalle, consulta)" :key="p">
                      <mark v-if="parte.marcado">{{ parte.texto }}</mark>
                      <template v-else>{{ parte.texto }}</template>
                    </template>
                  </small>
                </span>
                <span v-if="resultado.tipo !== 'pantalla'" class="buscador__etiqueta">{{ resultado.etiqueta }}</span>
              </li>
            </template>
          </ul>
          <p v-if="!panel.datos.value" class="buscador__estado" role="status">Cargando tus clases…</p>
          <p v-else-if="!resultados.length" class="buscador__estado" role="status">
            Nada coincide con “{{ consulta.trim() }}” entre tus alumnos, clases, tareas o pantallas.
          </p>
          <p class="buscador__pie">↑↓ para moverte · Enter para abrir · Esc para cerrar</p>
        </div>
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
.buscador {
  position: relative;
  flex: 1;
  max-width: 440px;
  margin-left: auto;
}

.buscador form {
  position: relative;
}

.buscador input {
  width: 100%;
  height: 38px;
  padding: 10px 62px 10px 37px;
  border: 1px solid transparent;
  border-radius: 8px;
  outline: none;
  background: #f2f4f6;
  color: #111827;
  font: inherit;
  font-size: 14px;
}

.buscador input:focus {
  border-color: #1d4ed8;
  background: white;
}

.buscador input::-webkit-search-cancel-button {
  display: none;
}

.buscador__icono {
  position: absolute;
  top: 10px;
  left: 9px;
  width: 18px;
  height: 18px;
  pointer-events: none;
}

.buscador__atajo {
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

.buscador__desplegable {
  position: absolute;
  z-index: 20;
  top: 44px;
  left: 0;
  width: 100%;
  padding: 6px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
  box-shadow: 0 12px 32px rgb(15 23 42 / 14%);
}

.buscador__desplegable ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.buscador__grupo {
  padding: 6px 10px 4px;
  color: #64748b;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.buscador__opcion {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  color: #111827;
  font-size: 14px;
  cursor: pointer;
}

.buscador__opcion--activa {
  background: #eff4ff;
}

.buscador__opcion mark {
  padding: 0 1px;
  border-radius: 2px;
  background: #fef08a;
  color: inherit;
}

.buscador__marca {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 8px;
  background: #f1f5f9;
  font-size: 13px;
}

.buscador__marca--alumno {
  border-radius: 50%;
  background: #e0e7ff;
  color: #1e40af;
  font-size: 12px;
  font-weight: 700;
}

.buscador__texto {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.buscador__texto small {
  color: #64748b;
  font-size: 12.5px;
}

.buscador__etiqueta {
  padding: 2px 8px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
  font-size: 12px;
  white-space: nowrap;
}

.buscador__estado,
.buscador__pie {
  margin: 0;
  padding: 10px;
  color: #64748b;
  font-size: 13px;
}

.buscador__pie {
  margin-top: 4px;
  padding: 8px 10px 4px;
  border-top: 1px solid #f1f5f9;
  font-size: 12px;
}

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

.solo-lectores {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 900px) {
  .docente-superior__identidad {
    display: none;
  }
}

@media (max-width: 640px) {
  .buscador__atajo,
  .buscador__pie {
    display: none;
  }

  .pendientes {
    position: fixed;
    top: 70px;
    right: 8px;
    left: 8px;
    width: auto;
  }
}
</style>
