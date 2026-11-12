<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { useCompetencias } from '~/composables/useCompetencias'
import { describirAccionAuditoria, describirCambioAuditoria } from '~/composables/useAuditoriaCalificaciones'
import { useEstudiantesMatriculables } from '~/composables/useEstudiantesMatriculables'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import type { Area } from '~/types/competencia'
import type { EstudianteMatriculable } from '~/types/matricula'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import type { RegistroAuditoriaCalificacion } from '~/types/auditoriaCalificacion'

definePageMeta({ middleware: 'autenticacion' })

interface ResultadoPagina {
  content: RegistroAuditoriaCalificacion[]
  page: {
    number: number
    totalPages: number
    totalElements: number
  }
}

interface FiltrosAuditoria {
  periodoId: string
  matriculaId: string
  estudianteId: string
  competenciaCodigo: string
  tipo: '' | 'FINAL' | 'PARCIAL'
}

const TAMANO_PAGINA = 20
const { solicitar } = useApi()
const { listar: listarPeriodos } = usePeriodosAcademicos()
const { listar: listarEstudiantes } = useEstudiantesMatriculables()
const { listarAreas } = useCompetencias()

const periodos = ref<PeriodoAcademico[]>([])
const estudiantes = ref<EstudianteMatriculable[]>([])
const areas = ref<Area[]>([])
const registros = ref<RegistroAuditoriaCalificacion[]>([])
const filtros = reactive<FiltrosAuditoria>({
  periodoId: '',
  matriculaId: '',
  estudianteId: '',
  competenciaCodigo: '',
  tipo: '',
})
const pagina = ref(0)
const paginas = ref(0)
const total = ref(0)
const cargando = ref(true)
const errorConsulta = ref('')
const errorCatalogos = ref('')
let secuenciaConsulta = 0

const estudiantesPorId = computed(
  () => new Map(estudiantes.value.map((estudiante) => [estudiante.estudianteId, estudiante] as const)),
)
const periodosPorId = computed(() => new Map(periodos.value.map((periodo) => [periodo.periodoId, periodo] as const)))
const competenciasPorCodigo = computed(() => {
  const competencias = new Map<string, { nombre: string; area: string }>()

  for (const area of areas.value) {
    for (const competencia of area.competencias) {
      competencias.set(competencia.codigo, { nombre: competencia.nombre, area: area.nombre })
    }
  }

  return competencias
})

const hayFiltros = computed(() =>
  Boolean(
    filtros.periodoId ||
    filtros.matriculaId ||
    filtros.estudianteId ||
    filtros.competenciaCodigo.trim() ||
    filtros.tipo,
  ),
)

const descripcionRango = computed(() => {
  if (total.value === 0) {
    return 'No se encontraron cambios.'
  }

  const inicio = pagina.value * TAMANO_PAGINA + 1
  const fin = Math.min(inicio + registros.value.length - 1, total.value)
  return `Mostrando ${inicio}–${fin} de ${total.value.toLocaleString('es-PE')} cambios`
})

function rutaConsulta(): string {
  const parametros = new URLSearchParams({
    page: String(pagina.value),
    size: String(TAMANO_PAGINA),
  })
  parametros.append('sort', 'fechaHora,desc')
  parametros.append('sort', 'id,desc')

  for (const campo of ['periodoId', 'matriculaId', 'estudianteId', 'competenciaCodigo', 'tipo'] as const) {
    const valor = filtros[campo].trim()
    if (valor) {
      parametros.set(campo, valor)
    }
  }

  return `/api/v1/logs/calificaciones?${parametros.toString()}`
}

async function consultar(nuevaPagina = 0): Promise<void> {
  const consulta = ++secuenciaConsulta
  pagina.value = nuevaPagina
  cargando.value = true
  errorConsulta.value = ''

  try {
    const resultado = await solicitar<ResultadoPagina>(rutaConsulta())
    if (consulta !== secuenciaConsulta) {
      return
    }

    registros.value = resultado.content
    pagina.value = resultado.page.number
    paginas.value = resultado.page.totalPages
    total.value = resultado.page.totalElements
  } catch (fallo: unknown) {
    if (consulta === secuenciaConsulta) {
      registros.value = []
      paginas.value = 0
      total.value = 0
      errorConsulta.value = obtenerMensajeError(fallo, 'No se pudo consultar la auditoría de calificaciones.')
    }
  } finally {
    if (consulta === secuenciaConsulta) {
      cargando.value = false
    }
  }
}

async function cargarCatalogos(): Promise<void> {
  const [resultadoPeriodos, resultadoEstudiantes, resultadoAreas] = await Promise.allSettled([
    listarPeriodos(),
    listarEstudiantes(),
    listarAreas(),
  ])
  const errores: string[] = []

  if (resultadoPeriodos.status === 'fulfilled') {
    periodos.value = resultadoPeriodos.value
  } else {
    errores.push(obtenerMensajeError(resultadoPeriodos.reason, 'No se pudieron cargar los períodos académicos.'))
  }

  if (resultadoEstudiantes.status === 'fulfilled') {
    estudiantes.value = resultadoEstudiantes.value
  } else {
    errores.push(obtenerMensajeError(resultadoEstudiantes.reason, 'No se pudieron cargar los estudiantes.'))
  }

  if (resultadoAreas.status === 'fulfilled') {
    areas.value = resultadoAreas.value
  } else {
    errores.push(obtenerMensajeError(resultadoAreas.reason, 'No se pudieron cargar las competencias.'))
  }

  errorCatalogos.value = errores.length
    ? `No se pudieron cargar algunos datos descriptivos; se mostrarán los identificadores disponibles. ${errores.join(' ')}`
    : ''
}

function limpiarFiltros(): void {
  Object.assign(filtros, {
    periodoId: '',
    matriculaId: '',
    estudianteId: '',
    competenciaCodigo: '',
    tipo: '',
  })
  void consultar(0)
}

function fechaVisible(valor: string): string {
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime())
    ? valor
    : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(fecha)
}

function periodoEtiqueta(periodo: PeriodoAcademico): string {
  return `${periodo.numeroGrado}.° ${periodo.nivelEducativo} · Sección ${periodo.seccion} · ${periodo.fechaInicio.slice(0, 4)}`
}

function periodoVisible(id: number | null): string {
  if (id === null) {
    return 'Período no especificado'
  }

  const periodo = periodosPorId.value.get(id)
  return periodo ? `${periodoEtiqueta(periodo)} (ID ${id})` : `Período no encontrado (ID ${id})`
}

function estudianteVisible(id: number | null): string {
  if (id === null) {
    return 'Estudiante no especificado'
  }

  const estudiante = estudiantesPorId.value.get(id)
  if (!estudiante) {
    return `Estudiante no encontrado (ID ${id})`
  }

  const nombre = [estudiante.nombre, estudiante.apellidoPaterno, estudiante.apellidoMaterno].filter(Boolean).join(' ')
  return `${nombre || 'Estudiante'} (ID ${id})`
}

function matriculaVisible(id: number | null): string {
  return id === null ? 'Matrícula no especificada' : `Matrícula #${id}`
}

function competenciaVisible(codigo: string | null): string {
  if (!codigo) {
    return 'Competencia no especificada'
  }

  const competencia = competenciasPorCodigo.value.get(codigo)
  return competencia
    ? `${competencia.nombre} · Área: ${competencia.area} (código: ${codigo})`
    : `Competencia no encontrada (código: ${codigo})`
}

function rolVisible(rol: string): string {
  const roles: Record<string, string> = {
    ADMINISTRADOR: 'Administrador',
    DOCENTE: 'Docente',
    DIRECTOR: 'Director',
  }
  return (
    roles[rol] ??
    rol
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^./, (letra) => letra.toUpperCase())
  )
}

function tipoVisible(registro: RegistroAuditoriaCalificacion): string {
  return registro.tipoCalificacion === 'FINAL' ? 'Calificación por competencia' : 'Evaluación parcial'
}

function evaluacionVisible(registro: RegistroAuditoriaCalificacion): string {
  if (registro.evaluacionId !== null) {
    return `Evaluación parcial #${registro.evaluacionId}`
  }

  return registro.tipoCalificacion === 'FINAL' ? 'No aplica a una evaluación parcial' : 'Evaluación no especificada'
}

onMounted(() => {
  void Promise.all([cargarCatalogos(), consultar()])
})
</script>

<template>
  <main class="pagina-auditoria">
    <NavegacionCalificaciones />

    <EncabezadoPagina
      titulo="Auditoría de calificaciones"
      descripcion="Consulta quién modificó una calificación, cuándo y qué valores cambiaron. «Final» identifica la calificación de una competencia, no la nota global del curso; la consolidación indica si el logro ya fue calculado."
    >
      <template #acciones>
        <BotonAccion variante="secundario" :deshabilitado="cargando" @click="consultar(0)">
          {{ cargando ? 'Actualizando…' : 'Actualizar' }}
        </BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="errorCatalogos" :mensaje="errorCatalogos" tipo="advertencia" />

    <form class="panel-filtros" aria-label="Filtros de auditoría" @submit.prevent="consultar(0)">
      <div class="campo-filtro">
        <label for="filtro-periodo-auditoria">Período</label>
        <select id="filtro-periodo-auditoria" v-model="filtros.periodoId" :disabled="cargando">
          <option value="">Todos los períodos</option>
          <option v-for="item in periodos" :key="item.periodoId" :value="String(item.periodoId)">
            {{ periodoEtiqueta(item) }}
          </option>
        </select>
      </div>

      <div class="campo-filtro">
        <label for="filtro-estudiante-auditoria">ID de estudiante</label>
        <input
          id="filtro-estudiante-auditoria"
          v-model="filtros.estudianteId"
          type="number"
          min="1"
          placeholder="Ej. 125"
          :disabled="cargando"
        />
      </div>

      <div class="campo-filtro">
        <label for="filtro-matricula-auditoria">ID de matrícula</label>
        <input
          id="filtro-matricula-auditoria"
          v-model="filtros.matriculaId"
          type="number"
          min="1"
          placeholder="Ej. 460"
          :disabled="cargando"
        />
      </div>

      <div class="campo-filtro">
        <label for="filtro-competencia-auditoria">Código de competencia</label>
        <input
          id="filtro-competencia-auditoria"
          v-model="filtros.competenciaCodigo"
          type="search"
          maxlength="50"
          placeholder="Ej. COMP-01"
          :disabled="cargando"
        />
      </div>

      <div class="campo-filtro">
        <label for="filtro-tipo-auditoria">Tipo de calificación</label>
        <select id="filtro-tipo-auditoria" v-model="filtros.tipo" :disabled="cargando">
          <option value="">Todos</option>
          <option value="FINAL">Final</option>
          <option value="PARCIAL">Parcial</option>
        </select>
      </div>

      <div class="acciones-filtros">
        <BotonAccion tipo="submit" :deshabilitado="cargando">Aplicar filtros</BotonAccion>
        <BotonAccion variante="secundario" :deshabilitado="!hayFiltros || cargando" @click="limpiarFiltros">
          Limpiar
        </BotonAccion>
      </div>
    </form>

    <section class="panel-registros" aria-labelledby="titulo-registros">
      <header class="encabezado-registros">
        <div>
          <h2 id="titulo-registros">Historial de cambios</h2>
          <p>{{ descripcionRango }}</p>
          <p class="ayuda-cambios">
            En cada campo se muestran los valores anterior y nuevo; «Sin cambios» indica que el dato se mantuvo igual.
          </p>
        </div>
      </header>

      <PanelEstadoCarga
        :cargando="cargando"
        :error="errorConsulta"
        texto-carga="Consultando cambios de calificaciones…"
        @reintentar="consultar(pagina)"
      >
        <div v-if="registros.length" class="lista-registros">
          <article v-for="item in registros" :key="item.id" class="registro">
            <header class="encabezado-registro">
              <div class="accion-registro">
                <strong>{{ describirAccionAuditoria(item) }}</strong>
                <span>{{ fechaVisible(item.fechaHora) }}</span>
              </div>
              <span class="insignia-tipo">{{ tipoVisible(item) }}</span>
            </header>

            <dl class="datos-registro">
              <div>
                <dt>Usuario responsable</dt>
                <dd>{{ item.usuario }} · {{ rolVisible(item.rolUsuario) }}</dd>
              </div>
              <div>
                <dt>Estudiante</dt>
                <dd>{{ estudianteVisible(item.estudianteId) }}</dd>
              </div>
              <div>
                <dt>Matrícula</dt>
                <dd>{{ matriculaVisible(item.matriculaId) }}</dd>
              </div>
              <div>
                <dt>Período académico</dt>
                <dd>{{ periodoVisible(item.periodoId) }}</dd>
              </div>
              <div>
                <dt>Competencia</dt>
                <dd>{{ competenciaVisible(item.competenciaCodigo) }}</dd>
              </div>
              <div>
                <dt>Evaluación relacionada</dt>
                <dd>{{ evaluacionVisible(item) }}</dd>
              </div>
              <div>
                <dt>Nota de la competencia</dt>
                <dd>{{ describirCambioAuditoria(item.notaAnterior, item.notaNueva, 'nota') }}</dd>
              </div>
              <div>
                <dt>Puntaje de consolidación de la competencia</dt>
                <dd>{{ describirCambioAuditoria(item.puntajeAnterior, item.puntajeNuevo, 'puntaje') }}</dd>
              </div>
              <div>
                <dt>¿Logro de la competencia consolidado?</dt>
                <dd>{{ describirCambioAuditoria(item.consolidadaAnterior, item.consolidadaNueva, 'booleano') }}</dd>
              </div>
              <div>
                <dt>¿Calificación justificada?</dt>
                <dd>{{ describirCambioAuditoria(item.justificadaAnterior, item.justificadaNueva, 'booleano') }}</dd>
              </div>
              <div class="observacion">
                <dt>Observación</dt>
                <dd>{{ describirCambioAuditoria(item.observacionAnterior, item.observacionNueva, 'observacion') }}</dd>
              </div>
            </dl>
          </article>
        </div>

        <p v-else class="estado-vacio">No hay cambios para los filtros seleccionados.</p>
      </PanelEstadoCarga>
    </section>

    <footer v-if="paginas > 1" class="paginacion" aria-label="Paginación de auditoría">
      <BotonAccion variante="secundario" :deshabilitado="pagina === 0 || cargando" @click="consultar(pagina - 1)">
        Anterior
      </BotonAccion>
      <span>Página {{ pagina + 1 }} de {{ paginas }}</span>
      <BotonAccion
        variante="secundario"
        :deshabilitado="pagina + 1 >= paginas || cargando"
        @click="consultar(pagina + 1)"
      >
        Siguiente
      </BotonAccion>
    </footer>
  </main>
</template>

<style scoped>
.pagina-auditoria {
  display: flex;
  width: 100%;
  max-width: 1200px;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
  padding: 32px;
}

.panel-filtros,
.panel-registros {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.panel-filtros {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: end;
}

.campo-filtro {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.campo-filtro label {
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

.campo-filtro input,
.campo-filtro select {
  width: 100%;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: #f7f9fb;
  color: #191c1e;
  font-size: 14px;
}

.campo-filtro input:focus-visible,
.campo-filtro select:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 1px;
}

.acciones-filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.encabezado-registros {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.encabezado-registros h2 {
  margin: 0 0 4px;
  color: #191c1e;
  font-size: 18px;
}

.encabezado-registros p {
  margin: 0;
  color: #434655;
  font-size: 13px;
}

.encabezado-registros .ayuda-cambios {
  margin-top: 5px;
  color: #737686;
  font-size: 12px;
}

.lista-registros {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.registro {
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}

.encabezado-registro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.accion-registro {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.accion-registro strong {
  color: #191c1e;
  font-size: 15px;
}

.accion-registro span {
  color: #737686;
  font-size: 13px;
}

.insignia-tipo {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 16px;
  background: #eef2ff;
  color: #004ac6;
  font-size: 12px;
  font-weight: 600;
}

.datos-registro {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 18px;
  margin: 16px 0 0;
}

.datos-registro > div {
  min-width: 0;
}

.datos-registro dt {
  color: #737686;
  font-size: 12px;
}

.datos-registro dd {
  margin: 4px 0 0;
  color: #191c1e;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.observacion {
  grid-column: 1 / -1;
}

.estado-vacio {
  margin: 0;
  padding: 36px 16px;
  border: 1px dashed #c3c6d7;
  border-radius: 10px;
  color: #737686;
  font-size: 14px;
  text-align: center;
}

.paginacion {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #434655;
  font-size: 14px;
}

@media (max-width: 900px) {
  .panel-filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .datos-registro {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .pagina-auditoria {
    padding: 20px 14px;
  }

  .panel-filtros,
  .datos-registro {
    grid-template-columns: 1fr;
  }

  .encabezado-registro {
    flex-direction: column;
  }

  .observacion {
    grid-column: auto;
  }

  .paginacion {
    flex-wrap: wrap;
  }
}
</style>
