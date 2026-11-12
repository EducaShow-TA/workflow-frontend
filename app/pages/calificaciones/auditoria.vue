<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import type { PeriodoAcademico } from '~/types/periodoAcademico'

definePageMeta({ middleware: 'autenticacion' })

interface RegistroAuditoria {
  id: number
  fechaHora: string
  usuario: string
  rolUsuario: string
  accion: string
  tipoCalificacion: 'FINAL' | 'PARCIAL'
  periodoId: number | null
  matriculaId: number | null
  estudianteId: number | null
  competenciaCodigo: string | null
  evaluacionId: number | null
  notaAnterior: string | null
  notaNueva: string | null
  puntajeAnterior: number | null
  puntajeNuevo: number | null
  consolidadaAnterior: boolean | null
  consolidadaNueva: boolean | null
  justificadaAnterior: boolean | null
  justificadaNueva: boolean | null
  observacionAnterior: string | null
  observacionNueva: string | null
}
interface ResultadoPagina {
  content?: RegistroAuditoria[]
  page?: { number: number; totalPages: number; totalElements: number }
  _embedded?: Record<string, RegistroAuditoria[]>
}

const { solicitar } = useApi()
const { listar: listarPeriodos } = usePeriodosAcademicos()
const periodos = ref<PeriodoAcademico[]>([])
const registros = ref<RegistroAuditoria[]>([])
const filtros = reactive({ periodoId: '', estudianteId: '', competenciaCodigo: '', tipo: '' })
const pagina = ref(0)
const paginas = ref(0)
const total = ref(0)
const cargando = ref(false)
const error = ref('')
const tamanoPagina = 20

function rutaConsulta(): string {
  const parametros = new URLSearchParams({
    page: String(pagina.value),
    size: String(tamanoPagina),
    sort: 'fechaHora,desc',
  })
  for (const campo of ['periodoId', 'estudianteId', 'competenciaCodigo', 'tipo'] as const) {
    if (filtros[campo].trim()) parametros.set(campo, filtros[campo].trim())
  }
  return `/api/v1/logs/calificaciones?${parametros.toString()}`
}

function extraerContenido(resultado: ResultadoPagina): RegistroAuditoria[] {
  if (Array.isArray(resultado.content)) return resultado.content
  return Object.values(resultado._embedded ?? {}).find(Array.isArray) ?? []
}

async function consultar(nuevaPagina = 0): Promise<void> {
  pagina.value = nuevaPagina
  cargando.value = true
  error.value = ''
  try {
    const resultado = await solicitar<ResultadoPagina>(rutaConsulta())
    registros.value = extraerContenido(resultado)
    paginas.value = resultado.page?.totalPages ?? 0
    total.value = resultado.page?.totalElements ?? registros.value.length
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo consultar la auditoría de calificaciones.')
  } finally {
    cargando.value = false
  }
}

async function cargarCatalogos(): Promise<void> {
  try {
    periodos.value = await listarPeriodos()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar los períodos académicos.')
  }
}

function fechaVisible(valor: string): string {
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime())
    ? valor
    : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'medium' }).format(fecha)
}

function valor(antes: string | number | boolean | null, despues: string | number | boolean | null): string {
  if (antes === null && despues === null) return '—'
  return `${antes ?? '∅'} → ${despues ?? '∅'}`
}

onMounted(async () => {
  await Promise.all([cargarCatalogos(), consultar()])
})
</script>

<template>
  <main class="pagina-auditoria">
    <nav aria-label="Secciones de calificaciones">
      <NuxtLink to="/calificaciones">Registro de calificaciones</NuxtLink>
      <NuxtLink to="/calificaciones/libretas">Libretas e informes</NuxtLink>
      <strong aria-current="page">Auditoría</strong>
    </nav>
    <header>
      <p>Seguridad y trazabilidad / US-5.3</p>
      <h1>Auditoría de calificaciones</h1>
      <p>Consulta quién modificó una calificación, cuándo y qué valores cambiaron.</p>
    </header>
    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <section class="filtros" aria-label="Filtros de auditoría">
      <label
        >Período<select v-model="filtros.periodoId">
          <option value="">Todos</option>
          <option v-for="item in periodos" :key="item.periodoId" :value="String(item.periodoId)">
            {{ item.numeroGrado }}.° {{ item.seccion }} · {{ item.fechaInicio.slice(0, 4) }}
          </option>
        </select></label
      >
      <label>ID de estudiante<input v-model="filtros.estudianteId" type="number" min="1" /></label>
      <label>Código de competencia<input v-model="filtros.competenciaCodigo" maxlength="50" /></label>
      <label
        >Tipo<select v-model="filtros.tipo">
          <option value="">Todos</option>
          <option value="FINAL">Calificación final</option>
          <option value="PARCIAL">Calificación parcial</option>
        </select></label
      >
      <div class="acciones">
        <button type="button" @click="consultar(0)">Aplicar filtros</button>
        <button
          type="button"
          class="secundario"
          @click="
            () => {
              Object.assign(filtros, {
                periodoId: '',
                estudianteId: '',
                competenciaCodigo: '',
                tipo: '',
              })
              consultar(0)
            }
          "
        >
          Limpiar
        </button>
      </div>
    </section>
    <p v-if="cargando" role="status">Consultando registros…</p>
    <p v-else class="total">{{ total }} cambios encontrados</p>
    <section v-if="!cargando && registros.length" class="registros" aria-label="Cambios de calificaciones">
      <article v-for="item in registros" :key="item.id" class="registro">
        <header>
          <div>
            <strong>{{ item.accion }}</strong
            ><span>{{ fechaVisible(item.fechaHora) }}</span>
          </div>
          <span class="tipo">{{ item.tipoCalificacion === 'FINAL' ? 'Final' : 'Parcial' }}</span>
        </header>
        <dl>
          <div>
            <dt>Responsable</dt>
            <dd>{{ item.usuario }} · {{ item.rolUsuario }}</dd>
          </div>
          <div>
            <dt>Estudiante / matrícula</dt>
            <dd>{{ item.estudianteId ?? '—' }} / {{ item.matriculaId ?? '—' }}</dd>
          </div>
          <div>
            <dt>Período / competencia</dt>
            <dd>{{ item.periodoId ?? '—' }} / {{ item.competenciaCodigo ?? '—' }}</dd>
          </div>
          <div>
            <dt>Evaluación</dt>
            <dd>{{ item.evaluacionId ?? '—' }}</dd>
          </div>
          <div>
            <dt>Nota</dt>
            <dd>{{ valor(item.notaAnterior, item.notaNueva) }}</dd>
          </div>
          <div>
            <dt>Puntaje</dt>
            <dd>{{ valor(item.puntajeAnterior, item.puntajeNuevo) }}</dd>
          </div>
          <div>
            <dt>Consolidada</dt>
            <dd>{{ valor(item.consolidadaAnterior, item.consolidadaNueva) }}</dd>
          </div>
          <div>
            <dt>Justificada</dt>
            <dd>{{ valor(item.justificadaAnterior, item.justificadaNueva) }}</dd>
          </div>
          <div class="observacion">
            <dt>Observación</dt>
            <dd>{{ valor(item.observacionAnterior, item.observacionNueva) }}</dd>
          </div>
        </dl>
      </article>
    </section>
    <p v-else-if="!cargando" class="vacio">No hay cambios para los filtros seleccionados.</p>
    <footer v-if="paginas > 1" class="paginacion">
      <button type="button" :disabled="pagina === 0 || cargando" @click="consultar(pagina - 1)">Anterior</button
      ><span>Página {{ pagina + 1 }} de {{ paginas }}</span
      ><button type="button" :disabled="pagina + 1 >= paginas || cargando" @click="consultar(pagina + 1)">
        Siguiente
      </button>
    </footer>
  </main>
</template>

<style scoped>
.pagina-auditoria {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 32px;
}
.pagina-auditoria nav {
  display: flex;
  gap: 20px;
}
.pagina-auditoria header p {
  margin: 0 0 5px;
  color: #536274;
}
.pagina-auditoria h1 {
  margin: 0 0 8px;
}
.filtros {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  padding: 20px;
  border: 1px solid #d5dce6;
  border-radius: 12px;
  background: white;
}
.filtros label {
  display: grid;
  gap: 6px;
  font-weight: 600;
}
.filtros input,
.filtros select {
  min-height: 40px;
  padding: 7px 9px;
  border: 1px solid #aeb8c8;
  border-radius: 7px;
  font: inherit;
}
.acciones {
  grid-column: 1/-1;
  display: flex;
  gap: 10px;
}
.acciones button,
.paginacion button {
  padding: 9px 14px;
  border: 0;
  border-radius: 7px;
  background: #075eb3;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
.acciones .secundario {
  background: #e8edf4;
  color: #24364b;
}
.total {
  color: #536274;
}
.registros {
  display: grid;
  gap: 14px;
}
.registro {
  padding: 18px;
  border: 1px solid #d5dce6;
  border-radius: 12px;
  background: white;
}
.registro > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.registro > header div {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.registro > header span {
  color: #536274;
  font-size: 13px;
}
.registro .tipo {
  align-self: flex-start;
  padding: 5px 9px;
  border-radius: 16px;
  background: #edf3ff;
  color: #194e92;
  font-weight: 600;
}
.registro dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0 0;
}
.registro dl div {
  min-width: 0;
}
.registro dt {
  color: #607084;
  font-size: 12px;
}
.registro dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
.observacion {
  grid-column: 1/-1;
}
.vacio {
  padding: 24px;
  text-align: center;
  border: 1px dashed #aab5c5;
  border-radius: 10px;
}
.paginacion {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}
.paginacion button:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (max-width: 850px) {
  .filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .registro dl {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 550px) {
  .pagina-auditoria {
    padding: 18px;
  }
  .filtros,
  .registro dl {
    grid-template-columns: 1fr;
  }
}
</style>
