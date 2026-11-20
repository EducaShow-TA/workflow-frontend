<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePanelDocente } from '~/composables/usePanelDocente'
import { formatearHora, horaDeMomento, nombreSeccion, obtenerSituacion } from '~/composables/useSesionesClase'
import { useAutenticacionStore } from '~/stores/autenticacion'
import type { SesionClaseResumen } from '~/types/sesionClase'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const autenticacion = useAutenticacionStore()
const { datos, cargar } = usePanelDocente()
const cargando = ref(false)
const error = ref('')
const ahora = ref(Date.now())
let reloj: ReturnType<typeof setInterval> | undefined

const nombre = computed(() => autenticacion.usuario?.nombreCompleto?.trim().split(/\s+/)[0] || 'docente')
const saludo = computed(() => {
  const hora = new Date(ahora.value).getHours()
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
})
const fechaHoy = computed(() => {
  const texto = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date(ahora.value))
    .replace(',', '')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
})
const sesiones = computed(() => datos.value?.sesionesHoy ?? [])
const sinAsistencia = computed(
  () =>
    sesiones.value.filter((sesion) => ['ABIERTA', 'CERRADA'].includes(obtenerSituacion(sesion, ahora.value))).length,
)
const tareasVigentes = computed(() => (datos.value?.tareas ?? []).filter((tarea) => tarea.vigente))
const subtitulo = computed(() => {
  if (!datos.value) return 'Accede a las herramientas de enseñanza y seguimiento de tus estudiantes.'
  const total = sesiones.value.length
  if (!total) return `${fechaHoy.value} · hoy no tienes clases programadas.`
  const abierta = sesiones.value.find((sesion) => obtenerSituacion(sesion, ahora.value) === 'ABIERTA')
  const clases = `${fechaHoy.value} · tienes ${total} ${total === 1 ? 'clase' : 'clases'} hoy.`
  return abierta
    ? `${clases} La asistencia de ${nombreSeccion(abierta)} se puede tomar hasta las ${horaDeMomento(abierta.ventanaCierre)}.`
    : clases
})

const indicadores = computed(() => {
  const panel = datos.value
  const entregadas = tareasVigentes.value.reduce((total, tarea) => total + tarea.entregadas, 0)
  const esperadas = tareasVigentes.value.reduce((total, tarea) => total + tarea.tarea.entregas.length, 0)
  const vencenHoy = tareasVigentes.value.filter((tarea) => tarea.venceHoy).length
  const riesgo = panel?.enRiesgo.length ?? 0
  return [
    {
      nombre: 'Clases de hoy',
      valor: panel ? String(sesiones.value.length) : '—',
      descripcion: !panel
        ? 'Consultando tus sesiones de clase…'
        : !sesiones.value.length
          ? 'Hoy no tienes clases programadas'
          : sinAsistencia.value
            ? `${sinAsistencia.value} sin asistencia registrada`
            : 'Asistencia registrada en todas',
      alerta: sinAsistencia.value > 0,
      icono: '/icons/menu-horarios.svg',
    },
    {
      nombre: 'Tareas activas',
      valor: panel ? String(tareasVigentes.value.length) : '—',
      descripcion: !panel
        ? 'Consultando tus tareas…'
        : tareasVigentes.value.length
          ? `${entregadas} de ${esperadas} entregas recibidas${vencenHoy ? ` · ${vencenHoy} vence${vencenHoy === 1 ? '' : 'n'} hoy` : ''}`
          : 'No tienes tareas vigentes',
      alerta: vencenHoy > 0,
      icono: '/icons/menu-tareas.svg',
    },
    {
      nombre: 'Alumnos en riesgo',
      valor: panel ? String(riesgo) : '—',
      descripcion: !panel
        ? 'Consultando el riesgo académico…'
        : riesgo
          ? 'Con notas C sobre el umbral de riesgo'
          : 'Ningún alumno supera el umbral de notas C',
      alerta: false,
      icono: '/icons/menu-competencias.svg',
    },
  ]
})

const accesos = [
  {
    titulo: 'Mis tareas',
    descripcion: 'Crear tareas y consultar las entregas por sección.',
    destino: '/docente/tareas',
    icono: '/icons/menu-tareas.svg',
  },
  {
    titulo: 'Calificaciones',
    descripcion: 'Registrar notas AD, A, B o C y sus evidencias.',
    destino: '/docente/calificaciones',
    icono: '/icons/menu-competencias.svg',
  },
  {
    titulo: 'Asistencia',
    descripcion: 'Controlar la asistencia de alumnos en cada sesión.',
    destino: '/docente/asistencia',
    icono: '/icons/menu-estudiantes.svg',
  },
  {
    titulo: 'Mi horario',
    descripcion: 'Consultar la agenda semanal o del día.',
    destino: '/docente/horario',
    icono: '/icons/menu-horarios.svg',
  },
]

function estadoSesion(sesion: SesionClaseResumen): { texto: string; tono: string } {
  const situacion = obtenerSituacion(sesion, ahora.value)
  if (situacion === 'REGISTRADA')
    return { texto: `Asistencia registrada · ${sesion.registrados}/${sesion.totalAlumnos}`, tono: 'verde' }
  if (situacion === 'ABIERTA')
    return { texto: `Asistencia pendiente · hasta las ${horaDeMomento(sesion.ventanaCierre)}`, tono: 'ambar' }
  if (situacion === 'POR_ABRIR')
    return { texto: `Se abre a las ${horaDeMomento(sesion.ventanaApertura)}`, tono: 'gris' }
  return { texto: 'Ventana cerrada sin registro', tono: 'rojo' }
}

async function actualizar(forzar = false): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    await cargar(forzar)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar tu resumen del día.')
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  if (autenticacion.usuario?.rol !== 'DOCENTE') return
  void actualizar(true)
  reloj = setInterval(() => {
    ahora.value = Date.now()
  }, 30_000)
})

onBeforeUnmount(() => clearInterval(reloj))
</script>

<template>
  <main class="docente-vista">
    <div class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">Panel académico</span>
        <h1>{{ saludo }}, {{ nombre }}</h1>
        <p>{{ subtitulo }}</p>
      </div>
      <span class="docente-insignia">Portal Docente</span>
    </div>

    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />

    <section aria-labelledby="resumen-docente">
      <h2 id="resumen-docente" class="docente-seccion-titulo">Resumen académico</h2>
      <div class="docente-grid docente-grid--tres">
        <article v-for="indicador in indicadores" :key="indicador.nombre" class="docente-tarjeta docente-indicador">
          <div class="docente-indicador__icono"><img :src="indicador.icono" alt="" /></div>
          <span class="docente-indicador__nombre">{{ indicador.nombre }}</span>
          <strong class="docente-indicador__valor">{{ indicador.valor }}</strong>
          <small :class="{ 'indicador-alerta': indicador.alerta }">{{ indicador.descripcion }}</small>
        </article>
      </div>
    </section>

    <section v-if="sesiones.length" aria-labelledby="clases-hoy">
      <div class="encabezado-seccion">
        <h2 id="clases-hoy" class="docente-seccion-titulo">Mis clases de hoy</h2>
        <NuxtLink to="/docente/horario">Ver mi horario</NuxtLink>
      </div>
      <ul class="clases-hoy">
        <li
          v-for="sesion in sesiones"
          :key="sesion.id"
          :class="{ 'clases-hoy--ahora': obtenerSituacion(sesion, ahora) === 'ABIERTA' }"
        >
          <span class="clases-hoy__hora">
            {{ formatearHora(sesion.horaInicio) }}
            <small>a {{ formatearHora(sesion.horaFin) }}</small>
          </span>
          <span class="clases-hoy__texto">
            <strong>{{ sesion.areaNombre }} · {{ nombreSeccion(sesion) }}</strong>
            <small>
              {{ sesion.totalAlumnos }} alumnos ·
              <span :class="['pastilla', `pastilla--${estadoSesion(sesion).tono}`]">{{
                estadoSesion(sesion).texto
              }}</span>
            </small>
          </span>
          <NuxtLink
            :to="`/docente/asistencia/${sesion.id}`"
            :class="['docente-boton', { 'docente-boton--secundario': obtenerSituacion(sesion, ahora) !== 'ABIERTA' }]"
          >
            {{ obtenerSituacion(sesion, ahora) === 'ABIERTA' ? 'Tomar asistencia' : 'Ver lista' }}
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section aria-labelledby="acciones-docente">
      <h2 id="acciones-docente" class="docente-seccion-titulo">Accesos rápidos</h2>
      <div class="docente-grid docente-grid--dos">
        <NuxtLink v-for="acceso in accesos" :key="acceso.destino" :to="acceso.destino" class="docente-acceso">
          <span class="docente-acceso__icono"><img :src="acceso.icono" alt="" /></span>
          <span class="docente-acceso__texto"
            ><strong>{{ acceso.titulo }}</strong
            ><small>{{ acceso.descripcion }}</small></span
          >
          <span class="docente-acceso__flecha" aria-hidden="true">›</span>
        </NuxtLink>
      </div>
    </section>

    <section class="docente-tarjeta" aria-labelledby="mis-secciones">
      <div class="docente-tarjeta__titulo">
        <h2 id="mis-secciones">Mis secciones asignadas</h2>
        <span class="docente-insignia docente-insignia--neutral">
          {{ datos ? `${datos.clases.length} ${datos.clases.length === 1 ? 'clase' : 'clases'}` : 'Mis clases' }}
        </span>
      </div>
      <p v-if="cargando && !datos" class="docente-texto-secundario" role="status">Consultando tus clases…</p>
      <div v-else-if="datos?.clases.length" class="secciones">
        <article v-for="item in datos.clases" :key="item.clave" class="secciones__tarjeta">
          <strong>{{ item.nombre }}</strong>
          <small>
            {{ item.clase.totalAlumnos }} alumnos · {{ item.clase.competencias.length }}
            {{ item.clase.competencias.length === 1 ? 'competencia' : 'competencias' }}
          </small>
          <small :class="{ 'indicador-alerta': item.alumnosEnRiesgo }">
            {{
              item.alumnosEnRiesgo
                ? `${item.alumnosEnRiesgo} ${item.alumnosEnRiesgo === 1 ? 'alumno' : 'alumnos'} en riesgo`
                : 'Sin alumnos en riesgo'
            }}
          </small>
          <div class="secciones__enlaces">
            <NuxtLink :to="`/docente/tareas?clase=${encodeURIComponent(item.clave)}`">Tareas</NuxtLink>
            <NuxtLink :to="`/docente/calificaciones?clase=${encodeURIComponent(item.clave)}`">Notas</NuxtLink>
            <NuxtLink to="/docente/asistencia">Asistencia</NuxtLink>
          </div>
        </article>
      </div>
      <DocenteEstadoVacio
        v-else
        titulo="Aún no tienes secciones asignadas"
        descripcion="Cuando se te asigne una sección, la información de tus clases aparecerá aquí."
        icono="/icons/menu-clases.svg"
      />
    </section>
  </main>
</template>

<style scoped>
.indicador-alerta {
  color: #92400e;
  font-weight: 600;
}

.encabezado-seccion {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.encabezado-seccion a,
.secciones__enlaces a {
  color: #1d4ed8;
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.clases-hoy {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.clases-hoy li {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: white;
}

.clases-hoy li.clases-hoy--ahora {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.clases-hoy__hora {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
}

.clases-hoy__hora small,
.clases-hoy__texto small {
  display: block;
  color: #64748b;
  font-size: 12.5px;
  font-weight: 500;
}

.clases-hoy__texto {
  min-width: 0;
}

.clases-hoy__texto strong {
  font-size: 15px;
}

.clases-hoy .docente-boton {
  text-decoration: none;
  white-space: nowrap;
}

.pastilla {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.pastilla--verde {
  background: #dcfce7;
  color: #166534;
}

.pastilla--ambar {
  background: #fef3c7;
  color: #92400e;
}

.pastilla--gris {
  background: #e2e8f0;
  color: #334155;
}

.pastilla--rojo {
  background: #fee2e2;
  color: #991b1b;
}

.secciones {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
}

.secciones__tarjeta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.secciones__tarjeta strong {
  color: #111827;
  font-size: 15px;
}

.secciones__tarjeta small {
  color: #64748b;
  font-size: 13px;
}

.secciones__enlaces {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.secciones__enlaces a {
  padding: 5px 10px;
  border-radius: 7px;
  background: #eff4ff;
  font-size: 12.5px;
}

@media (max-width: 700px) {
  .clases-hoy li {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .clases-hoy .docente-boton {
    grid-column: 1 / -1;
    justify-content: center;
  }
}
</style>
