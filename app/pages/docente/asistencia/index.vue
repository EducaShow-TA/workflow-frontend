<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SesionClaseResumen, SituacionSesion } from '~/types/sesionClase'
import type { VarianteInsignia } from '~/types/interfaz'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import {
  formatearHora,
  horaDeMomento,
  minutosRestantes,
  nombreSeccion,
  obtenerSituacion,
  ordenarPorHora,
  useSesionesClase,
} from '~/composables/useSesionesClase'
import { useAutenticacionStore } from '~/stores/autenticacion'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const autenticacion = useAutenticacionStore()
const { listarMias } = useSesionesClase()
const esDocente = computed(() => autenticacion.usuario?.rol === 'DOCENTE')

const fecha = ref(obtenerFechaHoyIso())
const filtroArea = ref('')
const filtroSeccion = ref('')
const sesiones = ref<SesionClaseResumen[]>([])
const cargando = ref(true)
const error = ref('')
const ahora = ref(Date.now())
let reloj: ReturnType<typeof setInterval> | undefined

const descripcionFecha = computed(() => {
  const [anhio, mes, dia] = fecha.value.split('-').map(Number) as [number, number, number]
  return `${DIAS[new Date(anhio, mes - 1, dia).getDay()]} ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anhio}`
})
const esHoy = computed(() => fecha.value === obtenerFechaHoyIso())
const areas = computed(() => [...new Set(sesiones.value.map((sesion) => sesion.areaNombre))].sort())
const secciones = computed(() =>
  [...new Set(sesiones.value.map((sesion) => nombreSeccion(sesion)))].sort((a, b) => a.localeCompare(b, 'es')),
)
const sesionesFiltradas = computed(() =>
  ordenarPorHora(sesiones.value).filter(
    (sesion) =>
      (!filtroArea.value || sesion.areaNombre === filtroArea.value) &&
      (!filtroSeccion.value || nombreSeccion(sesion) === filtroSeccion.value),
  ),
)

const INSIGNIAS: Record<SituacionSesion, VarianteInsignia> = {
  REGISTRADA: 'exito',
  ABIERTA: 'advertencia',
  POR_ABRIR: 'neutro',
  CERRADA: 'error',
}

function situacion(sesion: SesionClaseResumen): SituacionSesion {
  return obtenerSituacion(sesion, ahora.value)
}

function textoInsignia(sesion: SesionClaseResumen): string {
  switch (situacion(sesion)) {
    case 'REGISTRADA':
      return 'Registrada'
    case 'ABIERTA':
      return `Abierta · ${minutosRestantes(sesion, ahora.value)} min`
    case 'POR_ABRIR':
      return 'Por abrir'
    default:
      return 'Cerrada sin registro'
  }
}

function contar(cantidad: number, palabra: string): string {
  return `${cantidad} ${palabra}${cantidad === 1 ? '' : 's'}`
}

function detalle(sesion: SesionClaseResumen): string {
  const alumnos = contar(sesion.totalAlumnos, 'alumno')
  switch (situacion(sesion)) {
    case 'REGISTRADA':
      return `${alumnos} · ${contar(sesion.presentes, 'presente')}, ${contar(sesion.tardanzas, 'tardanza')}, ${contar(sesion.ausentes, 'ausente')}`
    case 'ABIERTA':
      return `${alumnos} · Puedes registrar hasta las ${horaDeMomento(sesion.ventanaCierre)}`
    case 'POR_ABRIR':
      return `${alumnos} · Se habilita a las ${horaDeMomento(sesion.ventanaApertura)}`
    default:
      return `${alumnos} · La ventana cerró a las ${horaDeMomento(sesion.ventanaCierre)} sin registro`
  }
}

function textoAccion(sesion: SesionClaseResumen): string {
  const actual = situacion(sesion)
  if (actual === 'REGISTRADA') return 'Ver asistencia'
  if (actual === 'CERRADA') return 'Ver detalle'
  return 'Tomar asistencia'
}

async function cargar(): Promise<void> {
  if (!esDocente.value) {
    cargando.value = false
    return
  }
  cargando.value = true
  error.value = ''

  try {
    sesiones.value = await listarMias(fecha.value)
    ahora.value = Date.now()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar tus clases.')
  } finally {
    cargando.value = false
  }
}

watch(fecha, (nueva) => {
  if (nueva) {
    filtroArea.value = ''
    filtroSeccion.value = ''
    void cargar()
  }
})

onMounted(() => {
  void cargar()
  reloj = setInterval(() => (ahora.value = Date.now()), 30000)
})

onBeforeUnmount(() => clearInterval(reloj))
</script>

<template>
  <main class="docente-vista pagina-asistencia">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-2.1 · Control de asistencia</span>
        <h1>{{ esHoy ? 'Mis clases de hoy' : 'Mis clases' }}</h1>
        <p>{{ descripcionFecha }} · {{ autenticacion.usuario?.nombreCompleto ?? '' }}</p>
      </div>
      <BotonAccion variante="secundario" :deshabilitado="cargando || !esDocente" @click="cargar"
        >Actualizar</BotonAccion
      >
    </header>

    <div class="docente-aviso" role="note">
      <strong>Cuándo se toma la asistencia</strong>
      <span>
        Desde 15 minutos antes del inicio hasta 30 minutos después. Una vez registrada, puedes corregirla cuando lo
        necesites; queda constancia de cada corrección.
      </span>
    </div>

    <AvisoMensaje
      v-if="!esDocente"
      mensaje="Esta vista muestra las clases del docente que inicia sesión. Como administrador, revisa y registra la asistencia desde Sesiones de clase."
      tipo="advertencia"
    />

    <section class="tarjeta filtros" aria-label="Filtros">
      <div class="campo">
        <label for="fecha-clases">Fecha</label>
        <input id="fecha-clases" v-model="fecha" type="date" />
      </div>
      <div class="campo">
        <label for="filtro-area">Área</label>
        <select id="filtro-area" v-model="filtroArea" :disabled="!areas.length">
          <option value="">Todas mis áreas</option>
          <option v-for="area in areas" :key="area" :value="area">{{ area }}</option>
        </select>
      </div>
      <div class="campo">
        <label for="filtro-seccion">Grado y sección</label>
        <select id="filtro-seccion" v-model="filtroSeccion" :disabled="!secciones.length">
          <option value="">Todas mis secciones</option>
          <option v-for="seccion in secciones" :key="seccion" :value="seccion">{{ seccion }}</option>
        </select>
      </div>
      <p v-if="!cargando && sesiones.length" class="conteo" role="status">
        {{ sesionesFiltradas.length }} de {{ sesiones.length }} {{ sesiones.length === 1 ? 'clase' : 'clases' }}
      </p>
    </section>

    <NuxtLink v-if="!esDocente" to="/sesiones-clase" class="enlace-admin">Ir a Sesiones de clase →</NuxtLink>

    <PanelEstadoCarga v-else-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargar" />

    <p v-else-if="!sesiones.length" class="vacio">No tienes clases programadas para esta fecha.</p>

    <p v-else-if="!sesionesFiltradas.length" class="vacio">Ninguna clase coincide con los filtros.</p>

    <ul v-else class="clases">
      <li
        v-for="sesion in sesionesFiltradas"
        :key="sesion.id"
        class="clase"
        :class="{ activa: situacion(sesion) === 'ABIERTA' }"
      >
        <p class="hora">
          {{ formatearHora(sesion.horaInicio) }}<small>a {{ formatearHora(sesion.horaFin) }}</small>
        </p>
        <div class="datos">
          <h2>{{ sesion.areaNombre }} · {{ nombreSeccion(sesion) }}</h2>
          <p>{{ detalle(sesion) }}</p>
        </div>
        <div class="acciones">
          <InsigniaEstado :texto="textoInsignia(sesion)" :variante="INSIGNIAS[situacion(sesion)]" />
          <BotonAccion
            :variante="situacion(sesion) === 'ABIERTA' ? 'primario' : 'secundario'"
            :deshabilitado="situacion(sesion) === 'POR_ABRIR'"
            @click="navigateTo(`/docente/asistencia/${sesion.id}`)"
          >
            {{ textoAccion(sesion) }}
          </BotonAccion>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.pagina-asistencia {
  max-width: 1000px;
  gap: 20px;
}

.enlace-admin {
  align-self: flex-start;
  color: #004ac6;
  font-weight: 600;
  text-decoration: none;
}

.tarjeta {
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 16px 20px;
}

.campo {
  display: flex;
  min-width: 180px;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo input,
.campo select {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
}

.conteo {
  margin: 0 0 12px auto;
  color: #6b7280;
  font-size: 13px;
}

.vacio {
  margin: 0;
  padding: 32px;
  border: 1px dashed #c3c6d7;
  border-radius: 12px;
  background: white;
  color: #434655;
  text-align: center;
}

.clases {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.clase {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.clase.activa {
  border-color: #93c5fd;
  box-shadow: 0 0 0 3px #dbeafe;
}

.hora {
  margin: 0;
  color: #191c1e;
  font-size: 16px;
  font-weight: 700;
}

.hora small {
  display: block;
  color: #6b7280;
  font-size: 12px;
  font-weight: 400;
}

.datos {
  min-width: 0;
}

.datos h2 {
  margin: 0 0 4px;
  color: #191c1e;
  font-size: 16px;
}

.datos p {
  margin: 0;
  color: #434655;
  font-size: 13px;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 720px) {
  .clase {
    grid-template-columns: minmax(0, 1fr);
  }

  .acciones {
    justify-content: flex-start;
  }

  .campo {
    min-width: 0;
    flex: 1 1 100%;
  }

  .conteo {
    margin-left: 0;
  }
}
</style>
