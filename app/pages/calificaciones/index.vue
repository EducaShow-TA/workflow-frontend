<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'
import { useCalificaciones } from '~/composables/useCalificaciones'
import { useEstudiantesMatriculables } from '~/composables/useEstudiantesMatriculables'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { Calificacion, NotaCualitativa, SolicitudCalificacion } from '~/types/calificacion'
import type { EstudianteMatriculable } from '~/types/matricula'
import type { PeriodoAcademico } from '~/types/periodoAcademico'

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
interface MatriculaConfirmada {
  matriculaId: number
  estudiante: string
  dni: string
}
interface ConfirmacionRegistro {
  estudiante: string
  competencia: string
  nota: NotaCualitativa
}

const { solicitar } = useApi()
const { listar: listarPeriodos } = usePeriodosAcademicos()
const { listar: listarEstudiantes } = useEstudiantesMatriculables()
const { listar, registrar, descargarEvidencia } = useCalificaciones()

const periodos = ref<PeriodoAcademico[]>([])
const estudiantes = ref<EstudianteMatriculable[]>([])
const areas = ref<AreaCatalogo[]>([])
const calificaciones = ref<Calificacion[]>([])
const periodoId = ref<number | null>(null)
const competenciaCodigo = ref('')
const matriculaId = ref<number | null>(null)
const nota = ref<NotaCualitativa>('A')
const observacion = ref('')
const evidenciaUrl = ref('')
const archivo = ref<File | null>(null)
const inputArchivo = ref<HTMLInputElement | null>(null)
const cargando = ref(true)
const consultando = ref(false)
const guardando = ref(false)
const descargandoId = ref<number | null>(null)
const error = ref('')
const confirmacionRegistro = ref<ConfirmacionRegistro | null>(null)
let secuenciaConsulta = 0

const competencias = computed(() => {
  const unicas = new Map<string, CompetenciaCatalogo>()
  for (const area of areas.value) {
    if (!area.activo) continue
    for (const competencia of area.competencias) {
      if (competencia.activo && competencia.codigo) unicas.set(competencia.codigo, competencia)
    }
  }
  return [...unicas.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
})

const matriculas = computed<MatriculaConfirmada[]>(() => {
  if (periodoId.value === null) return []
  return estudiantes.value
    .flatMap((estudiante) =>
      estudiante.matriculas
        .filter((matricula) => matricula.periodoId === periodoId.value && matricula.estado === 'CONFIRMADA')
        .map((matricula) => ({
          matriculaId: matricula.matriculaId,
          estudiante: [estudiante.nombre, estudiante.apellidoPaterno, estudiante.apellidoMaterno]
            .filter(Boolean)
            .join(' '),
          dni: estudiante.dni,
        })),
    )
    .sort((a, b) => a.estudiante.localeCompare(b.estudiante, 'es'))
})

const notaExistente = computed(() => calificaciones.value.find((item) => item.matriculaId === matriculaId.value))
const matriculaSeleccionada = computed(() => matriculas.value.find((item) => item.matriculaId === matriculaId.value))
const periodoSeleccionado = computed(() => periodos.value.find((item) => item.periodoId === periodoId.value))
const competenciaSeleccionada = computed(() =>
  competencias.value.find((item) => item.codigo === competenciaCodigo.value),
)
const totalCalificados = computed(() => calificaciones.value.length)

function descripcionPeriodo(periodo: PeriodoAcademico): string {
  return `${periodo.numeroGrado}.° ${periodo.nivelEducativo} — Sección ${periodo.seccion} (${periodo.fechaInicio.slice(0, 4)})`
}
function formatearFecha(fecha: string): string {
  const valor = new Date(fecha)
  return Number.isNaN(valor.getTime())
    ? fecha
    : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(valor)
}
function limpiarAvisos(): void {
  error.value = ''
  confirmacionRegistro.value = null
}
function cambiarArchivo(evento: Event): void {
  const elemento = evento.target as HTMLInputElement
  archivo.value = elemento.files?.[0] ?? null
  limpiarAvisos()
}
function limpiarFormulario(): void {
  nota.value = 'A'
  observacion.value = ''
  evidenciaUrl.value = ''
  archivo.value = null
  if (inputArchivo.value) inputArchivo.value.value = ''
}

async function cargarCatalogos(): Promise<void> {
  cargando.value = true
  limpiarAvisos()
  try {
    const [listaPeriodos, listaEstudiantes, listaAreas] = await Promise.all([
      listarPeriodos(),
      listarEstudiantes(),
      solicitar<AreaCatalogo[]>('/api/v1/areas'),
    ])
    periodos.value = listaPeriodos
    estudiantes.value = listaEstudiantes
    areas.value = listaAreas
    periodoId.value = listaPeriodos[0]?.periodoId ?? null
    competenciaCodigo.value = competencias.value[0]?.codigo ?? ''
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No fue posible consultar los datos académicos.')
  } finally {
    cargando.value = false
  }
}

async function cargarCalificaciones(): Promise<void> {
  const secuencia = ++secuenciaConsulta
  calificaciones.value = []
  if (periodoId.value === null || !competenciaCodigo.value) return
  consultando.value = true
  try {
    const resultado = await listar(periodoId.value, competenciaCodigo.value)
    if (secuencia === secuenciaConsulta) calificaciones.value = resultado
  } catch (fallo: unknown) {
    if (secuencia === secuenciaConsulta) error.value = obtenerMensajeError(fallo, 'No se pudo cargar el seguimiento.')
  } finally {
    if (secuencia === secuenciaConsulta) consultando.value = false
  }
}

watch(periodoId, () => {
  matriculaId.value = null
  limpiarFormulario()
})
watch(matriculaId, () => {
  confirmacionRegistro.value = null
})
watch([periodoId, competenciaCodigo], () => {
  limpiarAvisos()
  void cargarCalificaciones()
})
onMounted(cargarCatalogos)

async function guardar(): Promise<void> {
  limpiarAvisos()
  if (guardando.value) return
  if (periodoId.value === null || !competenciaCodigo.value || matriculaId.value === null) {
    error.value = 'Selecciona el período, la competencia y el estudiante.'
    return
  }
  if (notaExistente.value) {
    error.value =
      'Este estudiante ya tiene una calificación en esta competencia. No se puede registrar otra desde este formulario.'
    return
  }
  if (observacion.value.trim().length > 1000) {
    error.value = 'La observación no puede superar los 1000 caracteres.'
    return
  }
  const url = evidenciaUrl.value.trim()
  if ((!archivo.value && !url) || (archivo.value && url)) {
    error.value = 'Adjunta un archivo o indica una URL, pero no ambas opciones.'
    return
  }
  if (archivo.value && archivo.value.size > 10 * 1024 * 1024) {
    error.value = 'El archivo de evidencia no puede superar los 10 MB.'
    return
  }
  if (url) {
    try {
      const direccion = new URL(url)
      if (!['http:', 'https:'].includes(direccion.protocol)) throw new Error('protocolo')
    } catch {
      error.value = 'Ingresa una URL válida que empiece con http:// o https://.'
      return
    }
  }
  const solicitud: SolicitudCalificacion = {
    periodoId: periodoId.value,
    matriculaId: matriculaId.value,
    competenciaCodigo: competenciaCodigo.value,
    nota: nota.value,
    observacion: observacion.value.trim(),
    evidenciaUrl: url || null,
  }
  guardando.value = true
  try {
    await registrar(solicitud, archivo.value)
    confirmacionRegistro.value = {
      estudiante: matriculaSeleccionada.value?.estudiante ?? 'Estudiante seleccionado',
      competencia: competenciaSeleccionada.value?.nombre ?? 'competencia seleccionada',
      nota: solicitud.nota,
    }
    await cargarCalificaciones()
    limpiarFormulario()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo registrar la calificación.')
  } finally {
    guardando.value = false
  }
}

async function descargar(item: Calificacion): Promise<void> {
  limpiarAvisos()
  descargandoId.value = item.id
  try {
    await descargarEvidencia(item)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo descargar el archivo.')
  } finally {
    descargandoId.value = null
  }
}
</script>

<template>
  <main class="pagina-calificaciones">
    <NavegacionCalificaciones class="navegacion-pagina" />
    <header class="cabecera">
      <div>
        <h1>Calificaciones y evidencias</h1>
        <p>Registra logros cualitativos y respáldalos con archivos o enlaces pedagógicos.</p>
      </div>
    </header>

    <p v-if="error" class="mensaje error" role="alert">{{ error }}</p>

    <section class="tarjeta" aria-labelledby="titulo-filtros">
      <h2 id="titulo-filtros">1. Contexto académico</h2>
      <p class="ayuda">Selecciona el período y la competencia para registrar o revisar el seguimiento.</p>
      <p v-if="cargando" role="status">Cargando datos académicos...</p>
      <div v-else class="campos">
        <div class="campo">
          <label for="periodo-calificacion">Período académico</label>
          <select id="periodo-calificacion" v-model.number="periodoId" :disabled="!periodos.length">
            <option v-for="periodo in periodos" :key="periodo.periodoId" :value="periodo.periodoId">
              {{ descripcionPeriodo(periodo) }}
            </option>
          </select>
          <small v-if="!periodos.length">Primero abre el año escolar desde Grados/Secciones.</small>
        </div>
        <div class="campo">
          <label for="competencia-calificacion">Competencia</label>
          <select id="competencia-calificacion" v-model="competenciaCodigo" :disabled="!competencias.length">
            <option v-for="competencia in competencias" :key="competencia.codigo" :value="competencia.codigo">
              {{ competencia.nombre }}
            </option>
          </select>
          <small v-if="!competencias.length">Primero registra competencias activas en el catálogo.</small>
        </div>
      </div>
    </section>

    <section class="tarjeta" aria-labelledby="titulo-registro">
      <div class="encabezado-seccion">
        <h2 id="titulo-registro">2. Registrar calificación</h2>
        <span class="etiqueta">AD · A · B · C</span>
      </div>
      <p class="ayuda">La evidencia es obligatoria: adjunta un archivo de hasta 10 MB o proporciona una URL.</p>
      <form class="campos" @submit.prevent="guardar">
        <div class="campo ancho">
          <label for="matricula-calificacion">Estudiante con matrícula confirmada *</label>
          <select
            id="matricula-calificacion"
            v-model.number="matriculaId"
            required
            :disabled="!matriculas.length || cargando"
          >
            <option :value="null" disabled>Selecciona un estudiante</option>
            <option v-for="matricula in matriculas" :key="matricula.matriculaId" :value="matricula.matriculaId">
              {{ matricula.estudiante }} · Documento: {{ matricula.dni }}
            </option>
          </select>
          <small v-if="!matriculas.length && !cargando"
            >No hay matrículas confirmadas para este período. Confirma una matrícula antes de registrar notas.</small
          >
          <small v-else>Alumnos confirmados: {{ matriculas.length }}.</small>
        </div>
        <div class="campo">
          <label for="nota-calificacion">Nota cualitativa *</label>
          <select id="nota-calificacion" v-model="nota" :disabled="Boolean(notaExistente)">
            <option value="AD">AD — Logro destacado</option>
            <option value="A">A — Logro esperado</option>
            <option value="B">B — En proceso</option>
            <option value="C">C — En inicio</option>
          </select>
        </div>
        <div class="campo">
          <label for="url-calificacion">URL de evidencia</label>
          <input
            id="url-calificacion"
            v-model="evidenciaUrl"
            type="url"
            maxlength="2048"
            placeholder="https://..."
            :disabled="Boolean(notaExistente) || Boolean(archivo)"
          />
        </div>
        <div class="campo ancho">
          <label for="archivo-calificacion">Archivo de evidencia (máximo 10 MB)</label>
          <input
            id="archivo-calificacion"
            ref="inputArchivo"
            type="file"
            :disabled="Boolean(notaExistente) || Boolean(evidenciaUrl.trim())"
            @change="cambiarArchivo"
          />
          <small v-if="archivo"
            >Archivo seleccionado: {{ archivo.name }} ({{ (archivo.size / 1024 / 1024).toFixed(2) }} MB)</small
          >
        </div>
        <div class="campo ancho">
          <label for="observacion-calificacion">Observación (opcional)</label>
          <textarea
            id="observacion-calificacion"
            v-model="observacion"
            rows="3"
            maxlength="1000"
            placeholder="Observaciones sobre el logro del estudiante..."
            :disabled="Boolean(notaExistente)"
          />
        </div>
        <p v-if="confirmacionRegistro" class="aviso aviso-exito ancho" role="status">
          Calificación registrada correctamente para <strong>{{ confirmacionRegistro.estudiante }}</strong>: obtuvo
          <strong>{{ confirmacionRegistro.nota }}</strong> en <strong>{{ confirmacionRegistro.competencia }}</strong>.
        </p>
        <p v-else-if="notaExistente" class="aviso ancho" role="status">
          Este estudiante ya tiene nota <strong>{{ notaExistente.nota }}</strong> en la competencia seleccionada. La
          rectificación debe realizarse mediante el procedimiento definido por el colegio.
        </p>
        <div class="acciones ancho">
          <button
            type="submit"
            class="boton-primario"
            :disabled="
              guardando ||
              cargando ||
              consultando ||
              !periodoSeleccionado ||
              !competenciaSeleccionada ||
              !matriculas.length ||
              matriculaId === null ||
              Boolean(notaExistente)
            "
          >
            {{ guardando ? 'Guardando...' : 'Registrar calificación y evidencia' }}
          </button>
        </div>
      </form>
    </section>

    <section class="tarjeta" aria-labelledby="titulo-seguimiento">
      <div class="encabezado-seccion">
        <div>
          <h2 id="titulo-seguimiento">3. Seguimiento por competencia</h2>
          <p class="ayuda">{{ totalCalificados }} calificación(es) registradas para este período y competencia.</p>
        </div>
        <button
          type="button"
          class="boton-secundario"
          :disabled="consultando || !competenciaCodigo || periodoId === null"
          @click="cargarCalificaciones"
        >
          Actualizar listado
        </button>
      </div>
      <p v-if="consultando" role="status">Consultando seguimiento...</p>
      <p v-else-if="!calificaciones.length" class="vacio">Aún no hay calificaciones registradas para este filtro.</p>
      <div v-else class="tabla-contenedor">
        <table>
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Nota</th>
              <th>Observación</th>
              <th>Evidencia</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in calificaciones" :key="item.id">
              <td>{{ item.estudiante }}</td>
              <td>
                <span class="nota" :class="`nota-${item.nota.toLowerCase()}`">{{ item.nota }}</span>
              </td>
              <td>{{ item.observacion || '—' }}</td>
              <td>
                <button
                  v-if="item.evidenciaTipo === 'ARCHIVO'"
                  type="button"
                  class="enlace-evidencia"
                  :disabled="descargandoId === item.id"
                  @click="descargar(item)"
                >
                  {{ descargandoId === item.id ? 'Descargando...' : item.evidenciaNombre || 'Descargar archivo' }}
                </button>
                <a
                  v-else-if="item.evidenciaUrl && /^https?:\/\//i.test(item.evidenciaUrl)"
                  :href="item.evidenciaUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="enlace-evidencia"
                  >Ver evidencia</a
                >
                <span v-else>—</span>
              </td>
              <td>{{ formatearFecha(item.fechaRegistro) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.pagina-calificaciones {
  max-width: 1320px;
  margin: 0 auto;
  padding: 32px 40px 56px;
}
.navegacion-pagina {
  margin-bottom: 24px;
}
.cabecera {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}
.cabecera h1 {
  margin: 0 0 6px;
  font-size: 28px;
  line-height: 1.25;
  color: var(--color-text);
}
.cabecera p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}
.tarjeta {
  margin: 0 0 20px;
  padding: 24px;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 2px 9px rgb(0 0 0 / 3%);
}
h2 {
  margin: 0 0 12px;
  color: var(--color-text);
  font-size: 19px;
}
.ayuda {
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}
.campos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 24px;
}
.campo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.campo label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.campo small {
  font-size: 12px;
  color: var(--color-text-secondary);
}
.campo input,
.campo select,
.campo textarea {
  width: 100%;
  min-height: 42px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  color: var(--color-text);
  font-size: 14px;
}
.campo input:focus,
.campo select:focus,
.campo textarea:focus {
  outline: 2px solid #93b4fa;
  outline-offset: 1px;
}
.campo input:disabled,
.campo select:disabled,
.campo textarea:disabled {
  background: #f4f6fa;
  color: #475569;
}
.campo textarea {
  resize: vertical;
}
.ancho {
  grid-column: 1 / -1;
}
.acciones {
  display: flex;
  justify-content: flex-end;
}
.boton-primario,
.boton-secundario {
  border-radius: 8px;
  border: 1px solid #1e40af;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 18px;
  cursor: pointer;
}
.boton-primario {
  background: #1e40af;
  color: #fff;
}
.boton-primario:hover {
  background: #17348d;
}
.boton-secundario {
  background: #fff;
  color: #1e40af;
}
.boton-primario:disabled,
.boton-secundario:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.encabezado-seccion {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
}
.mensaje {
  padding: 12px 16px;
  border-radius: 8px;
  margin: 0 0 18px;
  font-size: 14px;
}
.mensaje.error {
  color: #991b1b;
  border: 1px solid #fecaca;
  background: #fef2f2;
}
.aviso {
  padding: 12px;
  margin: 0;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 13px;
}
.aviso-exito {
  color: #166534;
  border-color: #bbf7d0;
  background: #f0fdf4;
}
.etiqueta {
  border-radius: 8px;
  padding: 8px 11px;
  color: #1e40af;
  background: #eff6ff;
  font-size: 12px;
  font-weight: 700;
}
.tabla-contenedor {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
  font-size: 13px;
}
th,
td {
  padding: 13px 10px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}
th {
  color: #475569;
  background: #f8fafc;
}
.nota {
  display: inline-flex;
  min-width: 36px;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  padding: 6px;
  border-radius: 6px;
  background: #e0e7ff;
  color: #1e3a8a;
}
.nota-ad {
  background: #dcfce7;
  color: #166534;
}
.nota-b {
  background: #fef3c7;
  color: #92400e;
}
.nota-c {
  background: #fee2e2;
  color: #991b1b;
}
.enlace-evidencia {
  border: 0;
  padding: 0;
  background: transparent;
  color: #1e40af;
  font-size: 13px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
.enlace-evidencia:disabled {
  opacity: 0.5;
}
.vacio {
  margin: 0;
  padding: 20px 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}
@media (max-width: 850px) {
  .pagina-calificaciones {
    padding: 24px 18px;
  }
  .campos {
    grid-template-columns: 1fr;
  }
  .cabecera,
  .encabezado-seccion {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
