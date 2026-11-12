<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AlumnoClase, MiClase } from '~/types/calificacion'
import type { EntregaTarea, SolicitudTarea, Tarea } from '~/types/tarea'
import { useTareas } from '~/composables/useTareas'
import { claveClase, nombreClase, useMisClases } from '~/composables/useMisClases'
import { obtenerMensajeError } from '~/composables/useMensajesError'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const api = useTareas()
const { listar: listarClases, listarAlumnos } = useMisClases()
const clases = ref<MiClase[]>([])
const claseElegida = ref('')
const competenciaCodigo = ref('')
const alumnos = ref<AlumnoClase[]>([])
const tareas = ref<Tarea[]>([])
const cargando = ref(true)
const cargandoTareas = ref(false)
const guardando = ref(false)
const entregaEnProceso = ref('')
const error = ref('')
const aviso = ref('')
const formulario = reactive({ titulo: '', descripcion: '', fechaLimite: '', ponderacion: '' })
const claseActual = computed(() => clases.value.find((item) => claveClase(item) === claseElegida.value) ?? null)
const competencias = computed(() => claseActual.value?.competencias ?? [])
const tareasOrdenadas = computed(() => [...tareas.value].sort((a, b) => b.id - a.id))

function limpiarAvisos(): void {
  error.value = ''
  aviso.value = ''
}

async function cargarTareas(): Promise<void> {
  tareas.value = []
  alumnos.value = []
  const clase = claseActual.value
  if (!clase) return
  cargandoTareas.value = true
  limpiarAvisos()
  try {
    const [listaTareas, listaAlumnos] = await Promise.all([
      api.listarPorPeriodo(clase.periodoId),
      listarAlumnos(clase.periodoId),
    ])
    if (claseElegida.value !== claveClase(clase)) return
    tareas.value = listaTareas
    alumnos.value = listaAlumnos
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar las tareas y matrículas de tu clase.')
  } finally {
    cargandoTareas.value = false
  }
}

async function cargarClases(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    clases.value = await listarClases()
    const primera = clases.value[0]
    if (primera) {
      claseElegida.value = claveClase(primera)
      competenciaCodigo.value = primera.competencias[0]?.codigo ?? ''
      await cargarTareas()
    }
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar tus clases asignadas.')
  } finally {
    cargando.value = false
  }
}

function alCambiarClase(): void {
  competenciaCodigo.value = competencias.value[0]?.codigo ?? ''
  void cargarTareas()
}

async function crearTarea(): Promise<void> {
  limpiarAvisos()
  const clase = claseActual.value
  if (!clase || !competenciaCodigo.value) {
    error.value = 'Selecciona una clase y una competencia.'
    return
  }
  if (!formulario.titulo.trim() || !formulario.descripcion.trim() || !formulario.fechaLimite) {
    error.value = 'Completa el título, la descripción y la fecha límite.'
    return
  }
  const ponderacion = formulario.ponderacion.trim() ? Number(formulario.ponderacion) : null
  if (ponderacion !== null && (!Number.isFinite(ponderacion) || ponderacion < 0 || ponderacion > 100)) {
    error.value = 'La ponderación debe estar entre 0 y 100.'
    return
  }
  const solicitud: SolicitudTarea = {
    periodoId: clase.periodoId,
    competenciaCodigo: competenciaCodigo.value,
    titulo: formulario.titulo.trim(),
    descripcion: formulario.descripcion.trim(),
    fechaLimite: formulario.fechaLimite.length === 16 ? `${formulario.fechaLimite}:00` : formulario.fechaLimite,
    ponderacion,
  }
  guardando.value = true
  try {
    await api.registrar(solicitud)
    Object.assign(formulario, { titulo: '', descripcion: '', fechaLimite: '', ponderacion: '' })
    await cargarTareas()
    aviso.value = 'Tarea publicada y asociada a las matrículas confirmadas de tu clase.'
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo publicar la tarea.')
  } finally {
    guardando.value = false
  }
}

async function cambiarEntrega(tarea: Tarea, entrega: EntregaTarea): Promise<void> {
  const llave = `${tarea.id}-${entrega.matriculaId}`
  entregaEnProceso.value = llave
  limpiarAvisos()
  try {
    const actualizada = await api.marcarEntrega(tarea.id, entrega.matriculaId, !entrega.cumplida)
    tareas.value = tareas.value.map((item) => (item.id === tarea.id ? actualizada : item))
    aviso.value = 'Se actualizó el seguimiento de la entrega.'
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo actualizar la entrega.')
  } finally {
    entregaEnProceso.value = ''
  }
}

function fechaVisible(fecha: string): string {
  const valor = new Date(fecha)
  return Number.isNaN(valor.getTime())
    ? fecha
    : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(valor)
}

function entregasCumplidas(tarea: Tarea): number {
  return tarea.entregas.filter((item) => item.cumplida).length
}

onMounted(cargarClases)
</script>

<template>
  <main class="docente-vista">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-3.7 · Seguimiento académico</span>
        <h1>Mis tareas</h1>
        <p>Publica actividades para tus clases y registra el cumplimiento de las entregas.</p>
      </div>
      <button
        type="button"
        class="docente-boton docente-boton--secundario"
        :disabled="cargando || cargandoTareas"
        @click="cargarTareas"
      >
        Actualizar
      </button>
    </header>

    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />
    <p v-if="cargando" role="status">Cargando tus clases…</p>
    <template v-else>
      <p v-if="!clases.length" class="docente-aviso" role="status">No tienes clases asignadas para gestionar tareas.</p>
      <template v-else>
        <section class="docente-tarjeta" aria-labelledby="seleccion-clase">
          <h2 id="seleccion-clase">Clase</h2>
          <label class="docente-campo" for="clase-tareas">Sección y área</label>
          <select id="clase-tareas" v-model="claseElegida" @change="alCambiarClase">
            <option v-for="clase in clases" :key="claveClase(clase)" :value="claveClase(clase)">
              {{ clase.areaNombre }} · {{ nombreClase(clase) }} · {{ clase.anhio }}
            </option>
          </select>
          <p v-if="claseActual">Alumnos con matrícula confirmada: {{ claseActual.totalAlumnos }}</p>
        </section>

        <div class="docente-grid docente-grid--dos-tercios">
          <section class="docente-tarjeta" aria-labelledby="crear-tarea-docente">
            <h2 id="crear-tarea-docente">Nueva tarea</h2>
            <form class="docente-formulario" @submit.prevent="crearTarea">
              <div class="docente-campo">
                <label for="tarea-competencia">Competencia *</label>
                <select id="tarea-competencia" v-model="competenciaCodigo" required :disabled="!competencias.length">
                  <option value="" disabled>Selecciona una competencia</option>
                  <option v-for="item in competencias" :key="item.codigo" :value="item.codigo">
                    {{ item.nombre }}
                  </option>
                </select>
              </div>
              <div class="docente-campo">
                <label for="tarea-titulo">Título *</label
                ><input id="tarea-titulo" v-model="formulario.titulo" maxlength="180" required />
              </div>
              <div class="docente-campo">
                <label for="tarea-descripcion">Descripción *</label
                ><textarea id="tarea-descripcion" v-model="formulario.descripcion" rows="4" maxlength="5000" required />
              </div>
              <div class="docente-grid docente-grid--dos">
                <div class="docente-campo">
                  <label for="tarea-fecha">Fecha límite *</label
                  ><input id="tarea-fecha" v-model="formulario.fechaLimite" type="datetime-local" required />
                </div>
                <div class="docente-campo">
                  <label for="tarea-ponderacion">Ponderación (%)</label
                  ><input
                    id="tarea-ponderacion"
                    v-model="formulario.ponderacion"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>
              </div>
              <div class="docente-formulario__acciones">
                <button type="submit" class="docente-boton" :disabled="guardando || !competenciaCodigo">
                  {{ guardando ? 'Publicando…' : 'Publicar tarea' }}
                </button>
              </div>
            </form>
          </section>
          <aside class="docente-tarjeta">
            <h2>Seguimiento</h2>
            <p class="docente-texto-secundario">
              Cada tarea crea un estado pendiente para las matrículas confirmadas del período. Puedes registrar o
              revertir su cumplimiento.
            </p>
          </aside>
        </div>

        <section class="docente-tarjeta" aria-labelledby="listado-tarea-docente">
          <div class="docente-tarjeta__titulo">
            <h2 id="listado-tarea-docente">
              Tareas de {{ claseActual?.areaNombre }} · {{ claseActual ? nombreClase(claseActual) : '' }}
            </h2>
          </div>
          <p v-if="cargandoTareas" role="status">Consultando tareas…</p>
          <p v-else-if="!tareasOrdenadas.length" class="docente-texto-secundario">
            Todavía no hay tareas para esta clase.
          </p>
          <article v-for="tarea in tareasOrdenadas" :key="tarea.id" class="docente-ficha">
            <div>
              <strong>{{ tarea.titulo }}</strong><span
                >{{ tarea.competencia }} · vence {{ fechaVisible(tarea.fechaLimite) }}</span
              >
              <p>{{ tarea.descripcion }}</p>
            </div>
            <p>
              <strong>{{ entregasCumplidas(tarea) }} / {{ tarea.entregas.length }}</strong> entregas cumplidas
            </p>
            <details>
              <summary>Ver entregas de estudiantes</summary>
              <p v-if="!tarea.entregas.length" class="docente-texto-secundario">No hay matrículas confirmadas.</p>
              <div v-for="entrega in tarea.entregas" :key="entrega.matriculaId" class="docente-ficha">
                <span>{{ entrega.estudiante }}</span><strong>{{ entrega.cumplida ? 'Entregada' : 'Pendiente' }}</strong>
                <small>{{
                  entrega.fechaCumplimiento ? fechaVisible(entrega.fechaCumplimiento) : 'Sin fecha de entrega'
                }}</small>
                <button
                  type="button"
                  class="docente-boton docente-boton--secundario"
                  :disabled="entregaEnProceso === `${tarea.id}-${entrega.matriculaId}`"
                  @click="cambiarEntrega(tarea, entrega)"
                >
                  {{ entrega.cumplida ? 'Revertir' : 'Marcar cumplida' }}
                </button>
              </div>
            </details>
          </article>
        </section>
      </template>
    </template>
  </main>
</template>
