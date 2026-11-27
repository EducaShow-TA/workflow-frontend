<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'
import { useAutenticacionStore } from '~/stores/autenticacion'
import { useEstudiantesMatriculables } from '~/composables/useEstudiantesMatriculables'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { useMisClases } from '~/composables/useMisClases'
import { usePortalEstudiante } from '~/composables/usePortalEstudiante'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { EstudianteMatriculable } from '~/types/matricula'
import type { MiClase, AlumnoClase } from '~/types/calificacion'
import type { HijoVinculado } from '~/types/familia'
import type { FichaEstudiante } from '~/types/portalEstudiante'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import type { ReporteAnualNotas } from '~/types/reporteAnual'

interface OpcionEstudiante {
  id: number
  nombre: string
  periodoIds: number[]
}
interface OpcionPeriodo {
  id: number
  nombre: string
}

const autenticacion = useAutenticacionStore()
const { solicitar } = useApi()
const { listar: listarEstudiantes } = useEstudiantesMatriculables()
const { listar: listarPeriodos } = usePeriodosAcademicos()
const { listar: listarClases, listarAlumnos } = useMisClases()
const { obtenerFicha } = usePortalEstudiante()
const esAdministrador = computed(() => autenticacion.usuario?.rol === 'ADMINISTRADOR')
const esDocente = computed(() => autenticacion.usuario?.rol === 'DOCENTE')
const esApoderado = computed(() => autenticacion.usuario?.rol === 'APODERADO')
const esAlumno = computed(() => autenticacion.usuario?.rol === 'ALUMNO')

const estudiantes = ref<OpcionEstudiante[]>([])
const periodos = ref<OpcionPeriodo[]>([])
const periodoId = ref<number | ''>('')
const estudianteId = ref<number | ''>('')
const cursoCodigo = ref('')
const reporte = ref<ReporteAnualNotas | null>(null)
const cargando = ref(true)
const consultando = ref(false)
const error = ref('')
const cursosPorPeriodo = ref<MiClase[]>([])
let consultaActual = 0
const cursoSeleccionado = computed(
  () => reporte.value?.cursos.find((curso) => curso.codigo === cursoCodigo.value) ?? null,
)

const estudiantesDelPeriodo = computed(() =>
  esDocente.value
    ? estudiantes.value
    : estudiantes.value.filter((estudiante) => estudiante.periodoIds.includes(Number(periodoId.value))),
)

function nombrePeriodo(periodo: Pick<PeriodoAcademico, 'numeroGrado' | 'seccion' | 'fechaInicio'>): string {
  return `${formatearSeccionCompleta(periodo.numeroGrado, periodo.seccion)} · ${periodo.fechaInicio.slice(0, 4)}`
}

async function cargarCatalogos(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    if (esAdministrador.value) {
      const [listaEstudiantes, listaPeriodos] = await Promise.all([listarEstudiantes(), listarPeriodos()])
      estudiantes.value = listaEstudiantes.map((item: EstudianteMatriculable) => ({
        id: item.estudianteId,
        nombre: [item.nombre, item.apellidoPaterno, item.apellidoMaterno].filter(Boolean).join(' '),
        periodoIds: item.matriculas.filter((matricula) => matricula.estado === 'CONFIRMADA').map((m) => m.periodoId),
      }))
      periodos.value = listaPeriodos.map((item: PeriodoAcademico) => ({
        id: item.periodoId,
        nombre: nombrePeriodo(item),
      }))
    } else if (esDocente.value) {
      cursosPorPeriodo.value = await listarClases()
      periodos.value = [
        ...new Map(
          cursosPorPeriodo.value.map((item) => [
            item.periodoId,
            {
              id: item.periodoId,
              nombre: `${formatearSeccionCompleta(item.gradoNumero, item.seccionCodigo)} · ${item.anhio}`,
            },
          ]),
        ).values(),
      ]
    } else if (esApoderado.value) {
      const vinculados = await solicitar<HijoVinculado[]>('/api/v1/apoderados/mis-estudiantes')
      estudiantes.value = vinculados.map((item) => ({
        id: item.estudianteId,
        nombre: item.nombreCompleto,
        periodoIds: item.periodos.map((periodo) => periodo.periodoId),
      }))
      periodos.value = uniqueFamilyPeriods(vinculados)
    } else if (esAlumno.value) {
      const ficha: FichaEstudiante = await obtenerFicha()
      estudiantes.value = [
        { id: ficha.estudianteId, nombre: 'Mi reporte', periodoIds: ficha.periodos.map((p) => p.periodoId) },
      ]
      periodos.value = ficha.periodos.map((item) => ({
        id: item.periodoId,
        nombre: `${formatearSeccionCompleta(item.gradoNumero, item.seccion)} · ${item.fechaInicio.slice(0, 4)}`,
      }))
    }
    if (periodos.value.length) periodoId.value = periodos.value[0]?.id ?? ''
    if (esAlumno.value) estudianteId.value = estudiantes.value[0]?.id ?? ''
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar las opciones del reporte anual.')
  } finally {
    cargando.value = false
  }
}

function uniqueFamilyPeriods(vinculados: HijoVinculado[]): OpcionPeriodo[] {
  const opciones = new Map<number, OpcionPeriodo>()
  for (const hijo of vinculados) {
    for (const periodo of hijo.periodos) {
      opciones.set(periodo.periodoId, {
        id: periodo.periodoId,
        nombre: `${formatearSeccionCompleta(periodo.gradoNumero, periodo.seccion)} · ${periodo.fechaInicio.slice(0, 4)}`,
      })
    }
  }
  return [...opciones.values()].sort((a, b) => b.id - a.id)
}

watch(periodoId, async (id) => {
  estudianteId.value = esAlumno.value ? (estudiantes.value[0]?.id ?? '') : ''
  reporte.value = null
  cursoCodigo.value = ''
  if (!esDocente.value || id === '') return
  cargando.value = true
  error.value = ''
  try {
    const alumnos: AlumnoClase[] = await listarAlumnos(Number(id))
    estudiantes.value = alumnos.map((item) => ({
      id: item.estudianteId,
      nombre: item.nombreCompleto,
      periodoIds: [Number(id)],
    }))
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar los alumnos del período.')
  } finally {
    cargando.value = false
  }
})

async function consultar(): Promise<void> {
  if (periodoId.value === '' || estudianteId.value === '') return
  const turno = ++consultaActual
  consultando.value = true
  error.value = ''
  reporte.value = null
  try {
    const resultado = await solicitar<ReporteAnualNotas>(
      `/api/v1/estudiantes/${estudianteId.value}/reporte-anual?periodoId=${periodoId.value}`,
    )
    if (turno === consultaActual) {
      reporte.value = resultado
      cursoCodigo.value = resultado.cursos[0]?.codigo ?? ''
    }
  } catch (fallo: unknown) {
    if (turno === consultaActual) error.value = obtenerMensajeError(fallo, 'No se pudo consultar el reporte anual.')
  } finally {
    if (turno === consultaActual) consultando.value = false
  }
}

watch(
  [periodoId, estudianteId],
  () => {
    consultaActual++
    reporte.value = null
    cursoCodigo.value = ''
    if (periodoId.value !== '' && estudianteId.value !== '') void consultar()
  },
  { flush: 'sync' },
)
onMounted(cargarCatalogos)
</script>

<template>
  <main class="reporte-anual">
    <NavegacionCalificaciones v-if="esAdministrador" />
    <NavegacionCalificaciones v-else-if="esDocente" :docente="true" />
    <header>
      <h1>Reporte anual de notas</h1>
      <p>Elige un período, estudiante y curso para ver sus notas hasta el bimestre actual.</p>
    </header>
    <section class="panel">
      <div class="filtros">
        <label>
          Período
          <select v-model="periodoId" required :disabled="cargando">
            <option value="">Selecciona un período</option>
            <option v-for="periodo in periodos" :key="periodo.id" :value="periodo.id">{{ periodo.nombre }}</option>
          </select>
        </label>
        <label v-if="!esAlumno">
          Estudiante
          <select v-model="estudianteId" required :disabled="cargando || periodoId === ''">
            <option value="">Selecciona un estudiante</option>
            <option v-for="estudiante in estudiantesDelPeriodo" :key="estudiante.id" :value="estudiante.id">
              {{ estudiante.nombre }}
            </option>
          </select>
        </label>
        <label v-if="reporte?.cursos.length">
          Curso
          <select v-model="cursoCodigo" aria-label="Curso del reporte">
            <option v-for="curso in reporte.cursos" :key="curso.codigo" :value="curso.codigo">
              {{ curso.nombre }}
            </option>
          </select>
        </label>
      </div>
      <p v-if="cargando && !consultando" role="status">Cargando opciones…</p>
      <p v-if="consultando" role="status">Cargando reporte…</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="!periodos.length && !cargando && !error" class="ayuda">No hay períodos académicos disponibles.</p>
    </section>

    <section v-if="reporte" class="panel" aria-label="Reporte anual consultado">
      <div class="resumen">
        <div>
          <h2>{{ reporte.estudiante }}</h2>
          <p>
            Año escolar {{ reporte.anhioEscolar }} ·
            {{ formatearSeccionCompleta(reporte.gradoNumero, reporte.seccion) }}
          </p>
        </div>
        <span :class="reporte.actasCerradas ? 'oficial' : 'preliminar'">
          {{ reporte.actasCerradas ? 'Actas cerradas' : 'Reporte preliminar' }}
        </span>
      </div>
      <p v-if="!cursoSeleccionado" class="ayuda">Aún no hay cursos disponibles para mostrar.</p>
      <article v-else class="curso">
        <div class="curso__encabezado">
          <h3>{{ cursoSeleccionado.nombre }}</h3>
          <span>Bimestres 1–{{ reporte.ultimoBimestre }}</span>
        </div>
        <div class="tabla">
          <table>
            <thead>
              <tr>
                <th scope="col">Competencia</th>
                <th v-for="bimestre in reporte.ultimoBimestre" :key="bimestre" scope="col">Bim. {{ bimestre }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="competencia in cursoSeleccionado.competencias" :key="competencia.codigo">
                <th scope="row">{{ competencia.nombre }}</th>
                <td v-for="(nota, indice) in competencia.notasPorBimestre" :key="indice">{{ nota ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
      <p class="ayuda">Escala: AD — destacado · A — esperado · B — en proceso · C — en inicio. — indica sin nota.</p>
    </section>
  </main>
</template>

<style scoped>
.reporte-anual {
  max-width: 1280px;
  margin: auto;
  padding: 28px;
  color: #172b42;
}
header {
  margin-bottom: 20px;
}
h1 {
  margin: 0 0 8px;
}
header p,
.ayuda {
  color: #5b6675;
  line-height: 1.5;
}
.panel {
  margin-bottom: 20px;
  padding: 22px;
  border: 1px solid #dfe4eb;
  border-radius: 14px;
  background: white;
}
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 16px;
}
label {
  display: grid;
  min-width: 230px;
  gap: 7px;
  font-weight: 600;
}
select,
button {
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid #cbd3df;
  border-radius: 8px;
}
button {
  background: #174ea6;
  color: white;
  cursor: pointer;
  font-weight: 700;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  color: #b42318;
}
.resumen {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}
.resumen h2 {
  margin: 0;
}
.resumen p {
  margin: 7px 0 0;
}
.oficial,
.preliminar {
  border-radius: 999px;
  padding: 7px 11px;
  font-weight: 700;
}
.oficial {
  background: #e8f6ed;
  color: #187443;
}
.preliminar {
  background: #fff3d6;
  color: #8a5a00;
}
.curso {
  margin-top: 24px;
}
.curso h3 {
  margin-bottom: 10px;
}
.tabla {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 11px;
  border-bottom: 1px solid #e6eaf0;
  text-align: left;
}
thead {
  background: #f5f7fa;
}
@media (max-width: 640px) {
  .reporte-anual {
    padding: 16px;
  }
  .panel {
    padding: 16px;
  }
}
</style>
