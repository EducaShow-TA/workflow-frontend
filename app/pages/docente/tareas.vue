<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { AlumnoClase, MiClase } from '~/types/calificacion'
import type { EntregaTarea, SolicitudTarea, Tarea } from '~/types/tarea'
import { useTareas } from '~/composables/useTareas'
import { claveClase, nombreClase, useMisClases } from '~/composables/useMisClases'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { cuentaRegresivaTarea, formatearFechaTarea } from '~/composables/useTareasEstudiante'

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
const cursoElegido = ref('')
const vista = ref<'vigentes' | 'vencidas'>('vigentes')
const modalAbierto = ref(false)
const entregasAbiertas = ref(new Set<number>())
const consignasCompletas = ref(new Set<number>())
const ahora = ref(new Date())
let reloj: ReturnType<typeof setInterval> | undefined
const cursos = computed(() =>
  [...new Map(clases.value.map((clase) => [clase.areaCodigo, clase.areaNombre])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  ),
)
const clasesDelCurso = computed(() =>
  clases.value
    .filter((clase) => clase.areaCodigo === cursoElegido.value)
    .sort((a, b) => a.gradoNumero - b.gradoNumero || a.seccionCodigo.localeCompare(b.seccionCodigo)),
)
const vencida = (tarea: Tarea) => new Date(tarea.fechaLimite).getTime() < ahora.value.getTime()
const tareasVigentes = computed(() =>
  tareas.value.filter((tarea) => !vencida(tarea)).sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite)),
)
const tareasVencidas = computed(() =>
  tareas.value.filter(vencida).sort((a, b) => b.fechaLimite.localeCompare(a.fechaLimite)),
)
const tareasVisibles = computed(() => (vista.value === 'vigentes' ? tareasVigentes.value : tareasVencidas.value))
const cantidadAlumnos = computed(() => (alumnos.value.length || claseActual.value?.totalAlumnos) ?? 0)

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
    const primerCurso = cursos.value[0]
    if (primerCurso) {
      cursoElegido.value = primerCurso[0]
      const primera = clasesDelCurso.value[0]!
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
  entregasAbiertas.value = new Set()
  consignasCompletas.value = new Set()
  void cargarTareas()
}

function alCambiarCurso(): void {
  const primera = clasesDelCurso.value[0]
  claseElegida.value = primera ? claveClase(primera) : ''
  alCambiarClase()
}

function alternar(conjunto: 'entregas' | 'consignas', tareaId: number): void {
  const objetivo = conjunto === 'entregas' ? entregasAbiertas : consignasCompletas
  const copia = new Set(objetivo.value)
  if (copia.has(tareaId)) copia.delete(tareaId)
  else copia.add(tareaId)
  objetivo.value = copia
}

function consignaLarga(tarea: Tarea): boolean {
  return tarea.descripcion.length > 220 || tarea.descripcion.split('\n').length > 3
}

function abrirNuevaTarea(): void {
  limpiarAvisos()
  competenciaCodigo.value = competenciaCodigo.value || (competencias.value[0]?.codigo ?? '')
  modalAbierto.value = true
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
  const ponderacion = String(formulario.ponderacion ?? '').trim() ? Number(formulario.ponderacion) : null
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
    modalAbierto.value = false
    vista.value = 'vigentes'
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

function entregasCumplidas(tarea: Tarea): number {
  return tarea.entregas.filter((item) => item.cumplida).length
}

onMounted(() => {
  void cargarClases()
  reloj = setInterval(() => {
    ahora.value = new Date()
  }, 60_000)
})
onBeforeUnmount(() => clearInterval(reloj))
</script>

<template>
  <main class="docente-vista tareas-docente">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">Actividades y entregas</span>
        <h1>Mis tareas</h1>
        <p>Publica tareas y revisa quién entregó. Cada tarea crea una entrega pendiente por alumno matriculado.</p>
      </div>
      <div class="acciones-encabezado">
        <button
          type="button"
          class="docente-boton docente-boton--secundario"
          :disabled="cargando || cargandoTareas"
          @click="cargarTareas"
        >
          Actualizar
        </button>
        <button type="button" class="docente-boton" :disabled="!claseActual" @click="abrirNuevaTarea">
          + Nueva tarea
        </button>
      </div>
    </header>

    <AvisoMensaje v-if="error && !modalAbierto" :mensaje="error" tipo="error" />
    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />

    <p v-if="cargando" role="status">Consultando tus clases…</p>
    <template v-else>
      <p v-if="!clases.length" class="docente-aviso" role="status">No tienes clases asignadas para gestionar tareas.</p>
      <template v-else>
        <section class="docente-tarjeta filtros" aria-label="Elegir clase">
          <div class="docente-campo">
            <label for="curso-tareas">Curso</label>
            <select id="curso-tareas" v-model="cursoElegido" @change="alCambiarCurso">
              <option v-for="[codigo, nombre] in cursos" :key="codigo" :value="codigo">{{ nombre }}</option>
            </select>
          </div>
          <div class="docente-campo">
            <label for="seccion-tareas">Sección</label>
            <select id="seccion-tareas" v-model="claseElegida" @change="alCambiarClase">
              <option v-for="clase in clasesDelCurso" :key="claveClase(clase)" :value="claveClase(clase)">
                {{ nombreClase(clase) }} · {{ clase.anhio }}
              </option>
            </select>
          </div>
          <p class="filtros__dato">
            <strong>{{ cantidadAlumnos }}</strong>
            {{ cantidadAlumnos === 1 ? 'alumno con matrícula confirmada' : 'alumnos con matrícula confirmada' }}
          </p>
        </section>

        <section aria-labelledby="listado-tarea-docente" class="listado">
          <div class="listado__encabezado">
            <h2 id="listado-tarea-docente">
              Tareas de {{ claseActual?.areaNombre }} · {{ claseActual ? nombreClase(claseActual) : '' }}
            </h2>
            <div class="segmento" role="tablist" aria-label="Estado de las tareas">
              <button
                type="button"
                role="tab"
                :aria-selected="vista === 'vigentes'"
                :class="{ activo: vista === 'vigentes' }"
                @click="vista = 'vigentes'"
              >
                Vigentes ({{ tareasVigentes.length }})
              </button>
              <button
                type="button"
                role="tab"
                :aria-selected="vista === 'vencidas'"
                :class="{ activo: vista === 'vencidas' }"
                @click="vista = 'vencidas'"
              >
                Vencidas ({{ tareasVencidas.length }})
              </button>
            </div>
          </div>

          <p v-if="cargandoTareas" role="status">Consultando tareas…</p>
          <p v-else-if="!tareasVisibles.length" class="vacio">
            {{
              vista === 'vigentes'
                ? 'No hay tareas vigentes para esta clase. Usa “+ Nueva tarea” para publicar una.'
                : 'No hay tareas vencidas para esta clase.'
            }}
          </p>
          <article v-for="tarea in tareasVisibles" :key="tarea.id" class="tarea">
            <div class="tarea__cuerpo">
              <div class="tarea__texto">
                <h3>{{ tarea.titulo }}</h3>
                <p class="tarea__meta">
                  {{ tarea.competencia }} · {{ vista === 'vigentes' ? 'vence' : 'venció' }}
                  <strong>{{ formatearFechaTarea(tarea.fechaLimite, ahora) }}</strong>
                  <span
                    v-if="cuentaRegresivaTarea(tarea.fechaLimite, ahora).nivel === 'hoy'"
                    class="pastilla pastilla--hoy"
                  >
                    Hoy
                  </span>
                  <template v-if="tarea.ponderacion != null"> · {{ Number(tarea.ponderacion) }} %</template>
                </p>
                <p :class="['tarea__consigna', { 'tarea__consigna--completa': consignasCompletas.has(tarea.id) }]">
                  {{ tarea.descripcion }}
                </p>
                <button
                  v-if="consignaLarga(tarea)"
                  type="button"
                  class="enlace"
                  :aria-expanded="consignasCompletas.has(tarea.id)"
                  @click="alternar('consignas', tarea.id)"
                >
                  {{ consignasCompletas.has(tarea.id) ? 'Ver menos' : 'Ver más' }}
                </button>
              </div>
              <div class="avance">
                <small>
                  <strong>{{ entregasCumplidas(tarea) }} / {{ tarea.entregas.length }}</strong> entregadas<template
                    v-if="tarea.entregas.length - entregasCumplidas(tarea) > 0"
                  >
                    · faltan {{ tarea.entregas.length - entregasCumplidas(tarea) }}</template
                  >
                </small>
                <span
                  class="avance__barra"
                  role="progressbar"
                  :aria-valuenow="entregasCumplidas(tarea)"
                  aria-valuemin="0"
                  :aria-valuemax="tarea.entregas.length"
                  :aria-label="`Entregas de ${tarea.titulo}`"
                >
                  <span
                    :style="{
                      width: `${tarea.entregas.length ? (entregasCumplidas(tarea) / tarea.entregas.length) * 100 : 0}%`,
                    }"
                  />
                </span>
              </div>
            </div>
            <button
              type="button"
              :class="['desplegar', { 'desplegar--abierta': entregasAbiertas.has(tarea.id) }]"
              :aria-expanded="entregasAbiertas.has(tarea.id)"
              :aria-controls="`entregas-${tarea.id}`"
              @click="alternar('entregas', tarea.id)"
            >
              <span aria-hidden="true">{{ entregasAbiertas.has(tarea.id) ? '▾' : '▸' }}</span>
              Entregas de los alumnos
              <span class="contador">{{ entregasCumplidas(tarea) }} / {{ tarea.entregas.length }}</span>
            </button>
            <div v-if="entregasAbiertas.has(tarea.id)" :id="`entregas-${tarea.id}`" class="entregas">
              <p v-if="!tarea.entregas.length" class="docente-texto-secundario">No hay matrículas confirmadas.</p>
              <table v-else>
                <thead>
                  <tr>
                    <th scope="col">Alumno</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Entrega</th>
                    <th scope="col"><span class="solo-lectores">Acción</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entrega in tarea.entregas" :key="entrega.matriculaId">
                    <td class="alumno">{{ entrega.estudiante }}</td>
                    <td>
                      <span :class="['pastilla', entrega.cumplida ? 'pastilla--ok' : 'pastilla--pendiente']">
                        {{ entrega.cumplida ? 'Entregada' : vencida(tarea) ? 'No entregó' : 'Pendiente' }}
                      </span>
                    </td>
                    <td>
                      <ArchivoEntregaTarea :tarea-id="tarea.id" :entrega="entrega" />
                      <small v-if="entrega.fechaCumplimiento && entrega.origen !== 'ALUMNO'" class="fecha">
                        {{ formatearFechaTarea(entrega.fechaCumplimiento, ahora) }}
                      </small>
                      <span v-if="!entrega.cumplida && !entrega.archivoNombre" class="fecha">—</span>
                    </td>
                    <td class="accion">
                      <button
                        type="button"
                        class="docente-boton docente-boton--secundario boton-chico"
                        :disabled="entregaEnProceso === `${tarea.id}-${entrega.matriculaId}`"
                        @click="cambiarEntrega(tarea, entrega)"
                      >
                        {{ entrega.cumplida ? 'Revertir' : 'Marcar entregada' }}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </template>
    </template>

    <VentanaModal
      :abierta="modalAbierto"
      titulo="Nueva tarea"
      :descripcion="
        claseActual
          ? `${claseActual.areaNombre} · ${nombreClase(claseActual)} · ${cantidadAlumnos} ${cantidadAlumnos === 1 ? 'alumno recibirá' : 'alumnos recibirán'} la tarea`
          : ''
      "
      :bloqueada="guardando"
      @cerrar="modalAbierto = false"
    >
      <form id="formulario-tarea" class="docente-formulario" novalidate @submit.prevent="crearTarea">
        <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
        <div class="docente-campo">
          <label for="tarea-competencia">Competencia *</label>
          <select id="tarea-competencia" v-model="competenciaCodigo" required :disabled="!competencias.length">
            <option v-for="competencia in competencias" :key="competencia.codigo" :value="competencia.codigo">
              {{ competencia.nombre }}
            </option>
          </select>
        </div>
        <div class="docente-campo">
          <label for="tarea-titulo">Título *</label>
          <input
            id="tarea-titulo"
            v-model="formulario.titulo"
            maxlength="180"
            placeholder="Ej. Ensayo sobre la amistad"
          />
        </div>
        <div class="docente-campo">
          <label for="tarea-descripcion">Consigna *</label>
          <textarea
            id="tarea-descripcion"
            v-model="formulario.descripcion"
            rows="4"
            maxlength="5000"
            placeholder="Qué deben hacer, formato y extensión"
          />
        </div>
        <div class="docente-grid docente-grid--dos">
          <div class="docente-campo">
            <label for="tarea-fecha">Fecha límite *</label>
            <input id="tarea-fecha" v-model="formulario.fechaLimite" type="datetime-local" />
          </div>
          <div class="docente-campo">
            <label for="tarea-ponderacion">Ponderación (%)</label>
            <input
              id="tarea-ponderacion"
              v-model="formulario.ponderacion"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="Opcional"
            />
          </div>
        </div>
      </form>
      <template #pie>
        <button
          type="button"
          class="docente-boton docente-boton--secundario"
          :disabled="guardando"
          @click="modalAbierto = false"
        >
          Cancelar
        </button>
        <button type="submit" form="formulario-tarea" class="docente-boton" :disabled="guardando || !competenciaCodigo">
          {{ guardando ? 'Publicando…' : 'Publicar tarea' }}
        </button>
      </template>
    </VentanaModal>
  </main>
</template>

<style scoped>
.acciones-encabezado {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filtros {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 14px;
  align-items: end;
}

.filtros__dato {
  margin: 0;
  padding-bottom: 10px;
  color: #475569;
  font-size: 13px;
}

.filtros__dato strong {
  color: #0f172a;
  font-size: 22px;
}

.listado {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.listado__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.listado__encabezado h2 {
  margin: 0;
  font-size: 17px;
}

.segmento {
  display: inline-flex;
  padding: 3px;
  border-radius: 9px;
  background: #eceef0;
}

.segmento button {
  padding: 7px 14px;
  border: 0;
  border-radius: 7px;
  background: none;
  color: #434655;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.segmento button.activo {
  background: white;
  color: #004ac6;
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);
}

.vacio {
  margin: 0;
  padding: 24px 16px;
  border: 1px dashed #c3c6d7;
  border-radius: 12px;
  background: white;
  color: #475569;
  font-size: 14px;
  text-align: center;
}

.tarea {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tarea__cuerpo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 13rem;
  gap: 16px;
  align-items: start;
  padding: 14px 16px;
}

.tarea__texto {
  min-width: 0;
}

.tarea h3 {
  margin: 0;
  font-size: 15.5px;
  overflow-wrap: anywhere;
}

.tarea__meta {
  margin: 2px 0 0;
  color: #475569;
  font-size: 13px;
}

.tarea__consigna {
  display: -webkit-box;
  overflow: hidden;
  margin: 6px 0 0;
  color: #434655;
  font-size: 13.5px;
  overflow-wrap: anywhere;
  white-space: pre-line;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.tarea__consigna--completa {
  display: block;
  -webkit-line-clamp: unset;
  line-clamp: unset;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: #1e40af;
  font: inherit;
  font-size: 12.5px;
  text-decoration: underline;
  cursor: pointer;
}

.avance small {
  display: block;
  margin-bottom: 4px;
  color: #475569;
  font-size: 12.5px;
}

.avance small strong {
  color: #0f172a;
}

.avance__barra {
  display: block;
  overflow: hidden;
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
}

.avance__barra span {
  display: block;
  height: 100%;
  background: #16a34a;
}

.pastilla {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.pastilla--hoy {
  margin-left: 4px;
  background: #fee2e2;
  color: #991b1b;
}

.pastilla--ok {
  background: #dcfce7;
  color: #166534;
}

.pastilla--pendiente {
  background: #fef3c7;
  color: #92400e;
}

.desplegar {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border: 0;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
  color: #434655;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.desplegar--abierta {
  background: #eff4ff;
  color: #004ac6;
}

.contador {
  padding: 0 8px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #334155;
  font-size: 12px;
}

.enlace:focus-visible,
.desplegar:focus-visible,
.segmento button:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.entregas {
  overflow-x: auto;
  padding: 4px 16px 12px;
  border-top: 1px solid #e5e7eb;
  background: #fafbfc;
}

.entregas table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.entregas th {
  padding: 8px 10px;
  border-bottom: 1px solid #e5e7eb;
  color: #475569;
  font-size: 12px;
  text-align: left;
}

.entregas td {
  padding: 8px 10px;
  border-bottom: 1px solid #eef0f2;
  vertical-align: middle;
}

.alumno {
  font-weight: 600;
}

.fecha {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.accion {
  text-align: right;
  white-space: nowrap;
}

.boton-chico {
  min-height: 32px;
  padding: 5px 10px;
  font-size: 12.5px;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 760px) {
  .filtros,
  .tarea__cuerpo {
    grid-template-columns: 1fr;
  }

  .filtros__dato {
    padding-bottom: 0;
  }
}
</style>
