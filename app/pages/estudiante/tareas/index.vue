<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  agruparTareasPorEntregar,
  colorAreaTarea,
  cuentaRegresivaTarea,
  formatearFechaTarea,
  ordenarTareasPorFecha,
  useTareasEstudiante,
} from '~/composables/useTareasEstudiante'
import type { EstadoTareaEstudiante, TareaEstudiante } from '~/types/tareaEstudiante'

definePageMeta({ middleware: 'autenticacion', layout: 'estudiante' })

type Vista = 'pendientes' | 'entregadas' | 'vencidas'

const PESTANIAS: { vista: Vista; estado: EstadoTareaEstudiante; nombre: string }[] = [
  { vista: 'pendientes', estado: 'PENDIENTE', nombre: 'Por entregar' },
  { vista: 'entregadas', estado: 'ENTREGADA', nombre: 'Entregadas' },
  { vista: 'vencidas', estado: 'VENCIDA', nombre: 'Vencidas' },
]

const ruta = useRoute()
const router = useRouter()
const { listar } = useTareasEstudiante()

const tareas = ref<TareaEstudiante[]>([])
const cargando = ref(true)
const error = ref('')
const area = ref('')
const masAdelanteAbierto = ref(false)
const ahora = ref(ahoraSistema())
let reloj: ReturnType<typeof setInterval> | undefined

const vista = computed<Vista>(() => {
  const valor = ruta.query.vista
  return valor === 'entregadas' || valor === 'vencidas' ? valor : 'pendientes'
})
const areas = computed(() =>
  [
    ...new Map(tareas.value.filter((t) => t.areaCodigo).map((t) => [t.areaCodigo!, t.area ?? t.areaCodigo!])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1])),
)
const filtradas = computed(() => tareas.value.filter((tarea) => !area.value || tarea.areaCodigo === area.value))
const cantidades = computed(() => {
  const conteo: Record<EstadoTareaEstudiante, number> = { PENDIENTE: 0, ENTREGADA: 0, VENCIDA: 0 }
  for (const tarea of filtradas.value) conteo[tarea.estado]++
  return conteo
})
const grupos = computed(() =>
  agruparTareasPorEntregar(
    filtradas.value.filter((tarea) => tarea.estado === 'PENDIENTE'),
    ahora.value,
  ),
)
const entregadas = computed(() =>
  [...filtradas.value.filter((tarea) => tarea.estado === 'ENTREGADA')].sort(
    (a, b) => (b.fechaEntrega ?? '').localeCompare(a.fechaEntrega ?? '') || b.id - a.id,
  ),
)
const vencidas = computed(() =>
  ordenarTareasPorFecha(
    filtradas.value.filter((tarea) => tarea.estado === 'VENCIDA'),
    true,
  ),
)

function elegirVista(destino: Vista): void {
  void router.replace({ query: destino === 'pendientes' ? {} : { vista: destino } })
}

function etiquetaArea(tarea: TareaEstudiante): string {
  return [tarea.area ?? tarea.competencia, tarea.docente ? `Prof. ${tarea.docente}` : ''].filter(Boolean).join(' · ')
}

function grupoPlegado(cercania: string): boolean {
  return cercania === 'adelante' && grupos.value.length > 1 && !masAdelanteAbierto.value
}

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    tareas.value = await listar()
    ahora.value = ahoraSistema()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar tus tareas.')
  } finally {
    cargando.value = false
  }
}

onMounted(() => {
  void cargar()
  reloj = setInterval(() => {
    ahora.value = ahoraSistema()
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(reloj))
</script>

<template>
  <main class="docente-vista tareas-alumno">
    <div class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">Portal del estudiante</span>
        <h1>Mis tareas</h1>
        <p>Revisa qué tienes por entregar y sube tus trabajos antes de la fecha límite.</p>
      </div>
    </div>

    <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargar" />

    <template v-else>
      <div class="pestanias" role="tablist" aria-label="Estado de las tareas">
        <button
          v-for="pestania in PESTANIAS"
          :key="pestania.vista"
          type="button"
          role="tab"
          :aria-selected="vista === pestania.vista"
          :class="['pestania', `pestania--${pestania.vista}`, { 'pestania--activa': vista === pestania.vista }]"
          @click="elegirVista(pestania.vista)"
        >
          <strong>{{ cantidades[pestania.estado] }}</strong>
          <span>{{ pestania.nombre }}</span>
        </button>
      </div>

      <div v-if="areas.length > 1" class="filtro">
        <label for="filtro-area" class="solo-lectores">Filtrar por curso</label>
        <select id="filtro-area" v-model="area">
          <option value="">Todos los cursos</option>
          <option v-for="[codigo, nombre] in areas" :key="codigo" :value="codigo">{{ nombre }}</option>
        </select>
        <small>{{ vista === 'pendientes' ? 'Ordenadas por fecha límite' : 'Las más recientes primero' }}</small>
      </div>

      <section v-if="vista === 'pendientes'" class="lista" aria-label="Tareas por entregar">
        <div v-if="!grupos.length" class="vacio">
          <span aria-hidden="true">🎉</span>
          <strong>¡Todo al día!</strong>
          <p>No tienes tareas por entregar{{ area ? ' en este curso' : '' }}.</p>
        </div>
        <section
          v-for="grupo in grupos"
          :key="grupo.cercania"
          :class="['bloque', { 'bloque--hoy': grupo.cercania === 'hoy' }]"
          :aria-label="grupo.titulo"
        >
          <button
            v-if="grupo.cercania === 'adelante' && grupos.length > 1"
            type="button"
            class="bloque__titulo bloque__titulo--boton"
            :aria-expanded="!grupoPlegado(grupo.cercania)"
            @click="masAdelanteAbierto = !masAdelanteAbierto"
          >
            <span>{{ grupoPlegado(grupo.cercania) ? '▸' : '▾' }} {{ grupo.titulo }}</span>
            <span class="cuenta">{{ grupo.tareas.length }}</span>
            <small v-if="grupoPlegado(grupo.cercania)">
              La más próxima: {{ formatearFechaTarea(grupo.tareas[0]!.fechaLimite, ahora) }}
            </small>
          </button>
          <h2 v-else class="bloque__titulo">
            <span>{{ grupo.cercania === 'hoy' ? '⏰ ' : '' }}{{ grupo.titulo }}</span>
            <span class="cuenta">{{ grupo.tareas.length }}</span>
          </h2>
          <ul v-if="!grupoPlegado(grupo.cercania)">
            <li
              v-for="tarea in grupo.tareas"
              :key="tarea.id"
              :class="['fila', { 'fila--hoy': grupo.cercania === 'hoy' }]"
            >
              <span class="punto" :style="{ background: colorAreaTarea(tarea.areaCodigo) }" aria-hidden="true" />
              <span class="fila__texto">
                <NuxtLink :to="`/estudiante/tareas/${tarea.id}`" class="fila__enlace">{{ tarea.titulo }}</NuxtLink>
                <small>{{ etiquetaArea(tarea) }}</small>
              </span>
              <span class="fila__fecha">Vence {{ formatearFechaTarea(tarea.fechaLimite, ahora) }}</span>
              <span :class="['pastilla', `pastilla--${cuentaRegresivaTarea(tarea.fechaLimite, ahora).nivel}`]">
                {{ cuentaRegresivaTarea(tarea.fechaLimite, ahora).texto }}
              </span>
              <NuxtLink :to="`/estudiante/tareas/${tarea.id}`" class="docente-boton fila__accion" tabindex="-1">
                Entregar
              </NuxtLink>
            </li>
          </ul>
        </section>
      </section>

      <section v-else-if="vista === 'entregadas'" class="lista" aria-label="Tareas entregadas">
        <div v-if="!entregadas.length" class="vacio">
          <strong>Aún no has entregado tareas{{ area ? ' de este curso' : '' }}.</strong>
        </div>
        <ul v-else class="bloque">
          <li v-for="tarea in entregadas" :key="tarea.id" class="fila fila--entregada">
            <span class="punto" :style="{ background: colorAreaTarea(tarea.areaCodigo) }" aria-hidden="true" />
            <span class="fila__texto">
              <NuxtLink :to="`/estudiante/tareas/${tarea.id}`" class="fila__enlace">{{ tarea.titulo }}</NuxtLink>
              <small>{{ etiquetaArea(tarea) }}</small>
            </span>
            <span class="fila__fecha">
              <template v-if="tarea.origen === 'DOCENTE'">Registrada por tu docente</template>
              <template v-else
                >Entregada {{ tarea.fechaEntrega ? formatearFechaTarea(tarea.fechaEntrega, ahora) : '' }}</template
              >
            </span>
            <span v-if="tarea.nota || tarea.notaJustificada" class="pastilla pastilla--nota">
              {{ tarea.notaJustificada ? 'Justificada' : `Nota: ${tarea.nota}` }}
              <span v-if="tarea.comentario" title="Con comentario de tu docente">💬</span>
            </span>
            <span v-else-if="tarea.cuentaParaNota" class="pastilla pastilla--por-calificar">Por calificar</span>
            <span v-else class="pastilla pastilla--ok">✓ Entregada</span>
          </li>
        </ul>
      </section>

      <section v-else class="lista" aria-label="Tareas vencidas">
        <div v-if="!vencidas.length" class="vacio">
          <span aria-hidden="true">🎉</span>
          <strong>¡Todo al día!</strong>
          <p>No tienes tareas vencidas{{ area ? ' en este curso' : '' }}.</p>
        </div>
        <ul v-else class="bloque">
          <li v-for="tarea in vencidas" :key="tarea.id" class="fila fila--vencida">
            <span class="punto" :style="{ background: colorAreaTarea(tarea.areaCodigo) }" aria-hidden="true" />
            <span class="fila__texto">
              <NuxtLink :to="`/estudiante/tareas/${tarea.id}`" class="fila__enlace">{{ tarea.titulo }}</NuxtLink>
              <small>{{ etiquetaArea(tarea) }}</small>
            </span>
            <span class="fila__fecha">Venció {{ formatearFechaTarea(tarea.fechaLimite, ahora) }}</span>
            <span v-if="tarea.nota || tarea.notaJustificada" class="pastilla pastilla--nota">
              {{ tarea.notaJustificada ? 'Justificada' : `Nota: ${tarea.nota}` }}
              <span v-if="tarea.comentario" title="Con comentario de tu docente">💬</span>
            </span>
            <span v-else class="pastilla pastilla--vencida">Vencida</span>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<style scoped>
.tareas-alumno {
  max-width: 1100px;
}

.pestanias {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.pestania {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
  color: #191c1e;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pestania strong {
  font-size: 24px;
  line-height: 1.1;
}

.pestania span {
  color: #434655;
  font-size: 13px;
  font-weight: 600;
}

.pestania--pendientes strong {
  color: #1d4ed8;
}

.pestania--entregadas strong {
  color: #15803d;
}

.pestania--vencidas strong {
  color: #b91c1c;
}

.pestania--activa {
  padding: 11px 13px;
  border: 2px solid #004ac6;
  background: #eff4ff;
}

.pestania:focus-visible,
.fila__enlace:focus-visible,
.bloque__titulo--boton:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.filtro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.filtro select {
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 14px;
}

.filtro small {
  color: #64748b;
}

.lista {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bloque {
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
  list-style: none;
}

.bloque ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.bloque__titulo {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 16px;
  border: 0;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  color: #434655;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
}

.bloque__titulo--boton {
  border-bottom: 0;
  background: white;
  cursor: pointer;
}

.bloque__titulo--boton[aria-expanded='true'] {
  border-bottom: 1px solid #e5e7eb;
}

.bloque__titulo small {
  margin-left: auto;
  color: #64748b;
  font-size: 12.5px;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

.cuenta {
  padding: 0 8px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #334155;
  font-size: 12px;
  letter-spacing: 0;
}

.bloque--hoy {
  border-color: #fca5a5;
}

.bloque--hoy .bloque__titulo {
  background: #fef2f2;
  color: #991b1b;
}

.fila {
  position: relative;
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) 11rem 7rem auto;
  gap: 12px;
  align-items: center;
  min-height: 56px;
  padding: 8px 16px;
  border-top: 1px solid #f1f5f9;
}

.fila:first-child {
  border-top: 0;
}

.fila:hover {
  background: #f8fafc;
}

.fila--hoy {
  box-shadow: inset 4px 0 0 #dc2626;
}

.fila--entregada,
.fila--vencida {
  grid-template-columns: 10px minmax(0, 1fr) 13rem 7rem;
}

.fila--vencida .fila__enlace {
  color: #475569;
}

.punto {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.fila__texto {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.fila__enlace {
  overflow: hidden;
  color: #191c1e;
  font-size: 14.5px;
  font-weight: 700;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fila__enlace::after {
  position: absolute;
  inset: 0;
  content: '';
}

.fila__texto small {
  overflow: hidden;
  color: #64748b;
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fila__fecha {
  color: #434655;
  font-size: 13px;
}

.fila__accion {
  position: relative;
  z-index: 1;
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  padding: 0 14px;
  font-size: 13px;
  text-decoration: none;
}

.pastilla {
  justify-self: start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.pastilla--hoy {
  background: #fee2e2;
  color: #991b1b;
}

.pastilla--dias {
  background: #fef3c7;
  color: #92400e;
}

.pastilla--lejos {
  background: #e0e7ff;
  color: #3730a3;
}

.pastilla--ok {
  background: #dcfce7;
  color: #166534;
}

.pastilla--nota {
  background: #ede9fe;
  color: #5b21b6;
}

.pastilla--por-calificar {
  background: #f1f5f9;
  color: #475569;
  font-weight: 600;
}

.pastilla--vencida {
  background: #f1f5f9;
  color: #475569;
}

.vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 32px 16px;
  border: 1px dashed #c3c6d7;
  border-radius: 12px;
  background: white;
  color: #434655;
  text-align: center;
}

.vacio span {
  font-size: 28px;
}

.vacio p {
  margin: 0;
  font-size: 14px;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .pestania {
    align-items: center;
    padding: 8px 6px;
    text-align: center;
  }

  .pestania--activa {
    padding: 7px 5px;
  }

  .pestania strong {
    font-size: 20px;
  }

  .pestania span {
    font-size: 12px;
  }

  .filtro select {
    width: 100%;
  }

  .fila,
  .fila--entregada,
  .fila--vencida {
    grid-template-columns: 10px minmax(0, 1fr) auto;
    row-gap: 2px;
  }

  .fila__fecha {
    grid-column: 2;
    grid-row: 2;
    font-size: 12.5px;
  }

  .pastilla {
    grid-column: 3;
    grid-row: 1 / span 2;
    justify-self: end;
  }

  .fila__accion {
    display: none;
  }
}
</style>
