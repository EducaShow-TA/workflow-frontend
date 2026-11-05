<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { useTareas } from '~/composables/useTareas'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import type { EntregaTarea, SolicitudTarea, Tarea } from '~/types/tarea'

definePageMeta({ middleware: 'autenticacion' })

interface CompetenciaCatalogo {
  codigo: string
  nombre: string
  activo: boolean
}

interface AreaCatalogo {
  id: number
  nombre: string
  activo: boolean
  competencias: CompetenciaCatalogo[]
}

const { solicitar } = useApi()
const { listar: listarPeriodos } = usePeriodosAcademicos()
const { listarPorPeriodo, registrar, marcarEntrega } = useTareas()

const periodos = ref<PeriodoAcademico[]>([])
const areas = ref<AreaCatalogo[]>([])
const tareas = ref<Tarea[]>([])
const periodoId = ref<number | null>(null)
const cargando = ref(true)
const cargandoTareas = ref(false)
const guardando = ref(false)
const entregaEnProceso = ref('')
const error = ref('')
const mensajeExito = ref('')

const formulario = reactive({
  competenciaCodigo: '',
  titulo: '',
  descripcion: '',
  fechaLimite: '',
  ponderacion: '',
})

const competencias = computed(() => {
  const unicas = new Map<string, CompetenciaCatalogo>()
  areas.value
    .filter((area) => area.activo)
    .forEach((area) => {
      area.competencias
        .filter((competencia) => competencia.activo)
        .forEach((competencia) => {
          if (competencia.codigo) unicas.set(competencia.codigo, competencia)
        })
    })
  return [...unicas.values()].sort((primera, segunda) => primera.nombre.localeCompare(segunda.nombre, 'es'))
})

const periodoSeleccionado = computed(() => periodos.value.find((periodo) => periodo.periodoId === periodoId.value))
const tareasOrdenadas = computed(() => [...tareas.value].sort((a, b) => b.id - a.id))

function descripcionPeriodo(periodo: PeriodoAcademico): string {
  return `${periodo.numeroGrado}.° ${periodo.nivelEducativo} - Sección ${periodo.seccion} (${periodo.fechaInicio.slice(0, 4)})`
}

function formatearFecha(fecha: string): string {
  const valor = new Date(fecha)
  return Number.isNaN(valor.getTime())
    ? fecha
    : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(valor)
}

function cantidadCumplidas(tarea: Tarea): number {
  return tarea.entregas.filter((entrega) => entrega.cumplida).length
}

function limpiarAvisos(): void {
  error.value = ''
  mensajeExito.value = ''
}

async function cargarTareas(): Promise<void> {
  tareas.value = []
  limpiarAvisos()
  if (periodoId.value === null) return
  cargandoTareas.value = true
  try {
    tareas.value = await listarPorPeriodo(periodoId.value)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo consultar las tareas del período.')
  } finally {
    cargandoTareas.value = false
  }
}

async function cargarCatalogos(): Promise<void> {
  cargando.value = true
  limpiarAvisos()
  try {
    const [periodosApi, areasApi] = await Promise.all([listarPeriodos(), solicitar<AreaCatalogo[]>('/api/v1/areas')])
    periodos.value = periodosApi
    areas.value = areasApi
    periodoId.value = periodosApi[0]?.periodoId ?? null
    formulario.competenciaCodigo = competencias.value[0]?.codigo ?? ''
    await cargarTareas()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar los períodos y competencias.')
  } finally {
    cargando.value = false
  }
}

async function crearTarea(): Promise<void> {
  limpiarAvisos()
  if (guardando.value) return
  if (periodoId.value === null || !formulario.competenciaCodigo) {
    error.value = 'Selecciona un período académico y una competencia activa.'
    return
  }
  if (!formulario.titulo.trim() || !formulario.descripcion.trim() || !formulario.fechaLimite) {
    error.value = 'Completa el título, la descripción y la fecha límite.'
    return
  }
  if (formulario.titulo.trim().length > 180 || formulario.descripcion.trim().length > 5000) {
    error.value = 'El título admite hasta 180 caracteres y la descripción hasta 5000.'
    return
  }
  const fecha = new Date(formulario.fechaLimite)
  if (Number.isNaN(fecha.getTime())) {
    error.value = 'Ingresa una fecha límite válida.'
    return
  }
  const ponderacion = String(formulario.ponderacion ?? '').trim() === '' ? null : Number(formulario.ponderacion)
  if (ponderacion !== null && (!Number.isFinite(ponderacion) || ponderacion < 0 || ponderacion > 100)) {
    error.value = 'La ponderación debe estar entre 0 y 100.'
    return
  }

  const solicitud: SolicitudTarea = {
    periodoId: periodoId.value,
    competenciaCodigo: formulario.competenciaCodigo,
    titulo: formulario.titulo.trim(),
    descripcion: formulario.descripcion.trim(),
    fechaLimite: formulario.fechaLimite.length === 16 ? `${formulario.fechaLimite}:00` : formulario.fechaLimite,
    ponderacion,
  }

  guardando.value = true
  try {
    await registrar(solicitud)
    formulario.titulo = ''
    formulario.descripcion = ''
    formulario.fechaLimite = ''
    formulario.ponderacion = ''
    await cargarTareas()
    mensajeExito.value = 'Tarea registrada correctamente. Se generó el seguimiento para las matrículas confirmadas.'
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo registrar la tarea.')
  } finally {
    guardando.value = false
  }
}

async function cambiarEntrega(tarea: Tarea, entrega: EntregaTarea): Promise<void> {
  limpiarAvisos()
  const llave = `${tarea.id}-${entrega.matriculaId}`
  entregaEnProceso.value = llave
  try {
    const actualizada = await marcarEntrega(tarea.id, entrega.matriculaId, !entrega.cumplida)
    tareas.value = tareas.value.map((actual) => (actual.id === tarea.id ? actualizada : actual))
    mensajeExito.value = 'Estado de entrega actualizado.'
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo actualizar la entrega.')
  } finally {
    entregaEnProceso.value = ''
  }
}

onMounted(cargarCatalogos)
</script>

<template>
  <main class="pagina-tareas">
    <header class="cabecera-pagina">
      <div>
        <h1>Gestión de tareas</h1>
        <p>Registra actividades y controla las entregas de cada sección.</p>
      </div>
      <span class="etiqueta">US-3.7 · Seguimiento académico</span>
    </header>

    <p v-if="error" class="mensaje error" role="alert">{{ error }}</p>
    <p v-if="mensajeExito" class="mensaje exito" role="status">{{ mensajeExito }}</p>

    <div v-if="cargando" class="tarjeta" role="status">Cargando períodos y competencias...</div>

    <template v-else>
      <section class="tarjeta" aria-labelledby="titulo-periodo">
        <h2 id="titulo-periodo">1. Sección y período académico</h2>
        <div class="campo">
          <label for="periodo-tareas">Selecciona el período</label>
          <select
            id="periodo-tareas"
            v-model.number="periodoId"
            :disabled="periodos.length === 0"
            @change="cargarTareas"
          >
            <option v-for="periodo in periodos" :key="periodo.periodoId" :value="periodo.periodoId">
              {{ descripcionPeriodo(periodo) }}
            </option>
          </select>
          <small v-if="periodos.length === 0"
            >No hay períodos académicos. Primero debes abrir el año escolar y configurar sus secciones.</small
          >
          <small v-else-if="periodoSeleccionado"
            >Las tareas generarán entregas para las matrículas confirmadas de esta sección.</small
          >
        </div>
      </section>

      <section class="tarjeta" aria-labelledby="titulo-crear">
        <h2 id="titulo-crear">2. Nueva tarea</h2>
        <p class="ayuda">Los campos marcados con * son obligatorios.</p>
        <form class="formulario" @submit.prevent="crearTarea">
          <div class="campo">
            <label for="competencia-tarea">Competencia *</label>
            <select
              id="competencia-tarea"
              v-model="formulario.competenciaCodigo"
              required
              :disabled="competencias.length === 0"
            >
              <option value="" disabled>Selecciona una competencia</option>
              <option v-for="competencia in competencias" :key="competencia.codigo" :value="competencia.codigo">
                {{ competencia.nombre }} ({{ competencia.codigo }})
              </option>
            </select>
            <small v-if="competencias.length === 0"
              >No hay competencias activas. Configúralas primero en el módulo Competencias.</small
            >
          </div>

          <div class="campo">
            <label for="titulo-tarea">Título *</label>
            <input
              id="titulo-tarea"
              v-model="formulario.titulo"
              maxlength="180"
              required
              placeholder="Ej. Práctica de fracciones"
            />
          </div>

          <div class="campo ancho">
            <label for="descripcion-tarea">Descripción *</label>
            <textarea
              id="descripcion-tarea"
              v-model="formulario.descripcion"
              maxlength="5000"
              rows="4"
              required
              placeholder="Indica qué debe realizar el estudiante."
            />
          </div>

          <div class="campo">
            <label for="fecha-tarea">Fecha límite *</label>
            <input id="fecha-tarea" v-model="formulario.fechaLimite" type="datetime-local" required />
          </div>

          <div class="campo">
            <label for="ponderacion-tarea">Ponderación (%) — opcional</label>
            <input
              id="ponderacion-tarea"
              v-model="formulario.ponderacion"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Ej. 20"
            />
          </div>

          <div class="acciones ancho">
            <button
              type="submit"
              class="boton-primario"
              :disabled="guardando || periodoId === null || competencias.length === 0"
            >
              {{ guardando ? 'Registrando...' : 'Registrar tarea' }}
            </button>
          </div>
        </form>
      </section>

      <section class="tarjeta" aria-labelledby="titulo-listado">
        <div class="encabezado-seccion">
          <h2 id="titulo-listado">3. Tareas y seguimiento</h2>
          <button
            type="button"
            class="boton-secundario"
            :disabled="periodoId === null || cargandoTareas"
            @click="cargarTareas"
          >
            Actualizar listado
          </button>
        </div>
        <p v-if="cargandoTareas" role="status">Consultando tareas...</p>
        <p v-else-if="!tareasOrdenadas.length" class="estado-vacio">
          Todavía no hay tareas en el período seleccionado.
        </p>

        <div v-else class="lista-tareas">
          <article v-for="tarea in tareasOrdenadas" :key="tarea.id" class="tarea">
            <div class="encabezado-tarea">
              <div>
                <h3>{{ tarea.titulo }}</h3>
                <p class="subtitulo">{{ tarea.competencia }} · Fecha límite: {{ formatearFecha(tarea.fechaLimite) }}</p>
              </div>
              <span class="contador">{{ cantidadCumplidas(tarea) }} / {{ tarea.entregas.length }} entregadas</span>
            </div>
            <p class="descripcion">{{ tarea.descripcion }}</p>
            <p v-if="tarea.ponderacion !== null" class="ayuda">Ponderación: {{ tarea.ponderacion }}%</p>
            <details>
              <summary>Ver seguimiento de estudiantes</summary>
              <p v-if="tarea.entregas.length === 0" class="estado-vacio">
                No hay matrículas confirmadas asociadas a esta tarea.
              </p>
              <div v-else class="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Estado</th>
                      <th>Fecha de cumplimiento</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="entrega in tarea.entregas" :key="entrega.matriculaId">
                      <td>{{ entrega.estudiante }}</td>
                      <td>
                        <span :class="entrega.cumplida ? 'cumplida' : 'pendiente'">{{
                          entrega.cumplida ? 'Entregada' : 'Pendiente'
                        }}</span>
                      </td>
                      <td>{{ entrega.fechaCumplimiento ? formatearFecha(entrega.fechaCumplimiento) : '—' }}</td>
                      <td>
                        <button
                          type="button"
                          class="boton-secundario"
                          :disabled="entregaEnProceso === `${tarea.id}-${entrega.matriculaId}`"
                          @click="cambiarEntrega(tarea, entrega)"
                        >
                          {{ entrega.cumplida ? 'Revertir entrega' : 'Marcar entregada' }}
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </article>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.pagina-tareas {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}
.cabecera-pagina {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
h1 {
  margin: 0 0 4px;
  font-size: 28px;
  color: #191c1e;
}
h2 {
  margin: 0 0 16px;
  font-size: 20px;
  color: #191c1e;
}
h3 {
  margin: 0 0 6px;
  font-size: 17px;
}
.cabecera-pagina p,
.subtitulo,
.ayuda,
.campo small {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}
.etiqueta {
  padding: 8px 12px;
  border-radius: 100px;
  background: #e7edff;
  color: #1e40af;
  font-size: 12px;
  font-weight: 600;
}
.tarjeta {
  padding: 24px;
  background: #fff;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
}
.formulario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin-top: 14px;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.campo label {
  font-size: 13px;
  font-weight: 600;
  color: #434655;
}
.campo input,
.campo select,
.campo textarea {
  min-width: 0;
  width: 100%;
  min-height: 40px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: #f7f9fb;
  padding: 9px 12px;
  color: var(--color-text);
}
.campo textarea {
  resize: vertical;
}
.campo input:focus-visible,
.campo select:focus-visible,
.campo textarea:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}
.ancho {
  grid-column: 1 / -1;
}
.acciones {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}
.boton-primario {
  border: 0;
  border-radius: 8px;
  padding: 11px 20px;
  color: #fff;
  background: #004ac6;
  cursor: pointer;
  font-weight: 600;
}
.boton-primario:hover {
  background: #003e9f;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.boton-secundario {
  padding: 8px 12px;
  border-radius: 7px;
  border: 1px solid #aeb9cc;
  background: #f7f9fb;
  color: #1d3989;
  cursor: pointer;
  font-size: 12px;
}
.boton-secundario:hover:not(:disabled) {
  background: #e7edff;
}
.mensaje {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
}
.mensaje.error {
  border: 1px solid #fca5a5;
  background: #fff1f2;
  color: #991b1b;
}
.mensaje.exito {
  border: 1px solid #86efac;
  background: #f0fdf4;
  color: #166534;
}
.encabezado-seccion,
.encabezado-tarea {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
}
.estado-vacio {
  padding: 16px 0;
  color: var(--color-text-secondary);
  font-size: 14px;
}
.lista-tareas {
  display: grid;
  gap: 16px;
}
.tarea {
  padding: 18px;
  border: 1px solid #dde3ed;
  border-radius: 9px;
}
.descripcion {
  white-space: pre-wrap;
  line-height: 1.5;
  font-size: 14px;
}
.contador {
  padding: 5px 9px;
  border-radius: 20px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
  font-weight: 600;
}
summary {
  margin-top: 12px;
  cursor: pointer;
  color: #004ac6;
  font-weight: 600;
}
.tabla-contenedor {
  max-width: 100%;
  overflow-x: auto;
  margin-top: 12px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
}
th {
  background: #f2f4f6;
  white-space: nowrap;
}
.cumplida {
  color: #15803d;
  font-weight: 600;
}
.pendiente {
  color: #b45309;
  font-weight: 600;
}
@media (max-width: 760px) {
  .pagina-tareas {
    padding: 16px;
  }
  .tarjeta {
    padding: 16px;
  }
  .formulario {
    grid-template-columns: 1fr;
  }
  .ancho {
    grid-column: auto;
  }
}
</style>
