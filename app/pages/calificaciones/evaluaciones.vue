<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useCompetencias } from '~/composables/useCompetencias'
import { useEvaluacionesParciales } from '~/composables/useEvaluacionesParciales'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { Competencia, Area } from '~/types/competencia'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import type { EvaluacionParcial, SolicitudEvaluacionParcial } from '~/types/evaluacionParcial'

definePageMeta({ middleware: 'autenticacion' })

interface CompetenciaOpcion extends Competencia {
  areaNombre: string
}

const BIMESTRES = [1, 2, 3, 4]
const { listar: listarPeriodos } = usePeriodosAcademicos()
const { listarAreas } = useCompetencias()
const { listar, crear, actualizar } = useEvaluacionesParciales()

const periodos = ref<PeriodoAcademico[]>([])
const areas = ref<Area[]>([])
const evaluaciones = ref<EvaluacionParcial[]>([])
const periodoId = ref<number | null>(null)
const competenciaCodigo = ref('')
const editandoId = ref<number | null>(null)
const cargandoCatalogos = ref(true)
const cargandoEvaluaciones = ref(false)
const guardando = ref(false)
const errorCatalogos = ref('')
const errorLista = ref('')
const errorFormulario = ref('')
const aviso = ref('')
let secuenciaLista = 0

const competencias = computed<CompetenciaOpcion[]>(() =>
  areas.value
    .filter((area) => area.activo)
    .flatMap((area) =>
      area.competencias
        .filter((competencia) => competencia.activo)
        .map((competencia) => ({ ...competencia, areaNombre: area.nombre })),
    )
    .sort((primera, segunda) => primera.nombre.localeCompare(segunda.nombre, 'es')),
)
const nombreCompetencia = computed(
  () => competencias.value.find((item) => item.codigo === competenciaCodigo.value)?.nombre ?? '',
)
const evaluacionesSinBimestre = computed(() => evaluaciones.value.filter((item) => item.bimestre === null).length)

const formulario = reactive<{
  titulo: string
  descripcion: string
  ponderacion: string
  bimestre: number | ''
}>({
  titulo: '',
  descripcion: '',
  ponderacion: '100',
  bimestre: '',
})

function descripcionPeriodo(periodo: PeriodoAcademico): string {
  return `${periodo.numeroGrado}.° ${periodo.nivelEducativo} · Sección ${periodo.seccion} · ${periodo.fechaInicio.slice(0, 4)}`
}

function limpiarFormulario(): void {
  editandoId.value = null
  formulario.titulo = ''
  formulario.descripcion = ''
  formulario.ponderacion = '100'
  formulario.bimestre = ''
  errorFormulario.value = ''
  aviso.value = ''
}

async function cargarEvaluaciones(): Promise<void> {
  const turno = ++secuenciaLista
  if (periodoId.value === null || !competenciaCodigo.value) {
    evaluaciones.value = []
    errorLista.value = ''
    cargandoEvaluaciones.value = false
    return
  }

  cargandoEvaluaciones.value = true
  errorLista.value = ''
  try {
    const resultado = await listar(periodoId.value, competenciaCodigo.value)
    if (turno === secuenciaLista) {
      evaluaciones.value = resultado
    }
  } catch (fallo: unknown) {
    if (turno === secuenciaLista) {
      evaluaciones.value = []
      errorLista.value = obtenerMensajeError(fallo, 'No se pudieron cargar las evaluaciones parciales.')
    }
  } finally {
    if (turno === secuenciaLista) {
      cargandoEvaluaciones.value = false
    }
  }
}

async function cargarCatalogos(): Promise<void> {
  cargandoCatalogos.value = true
  errorCatalogos.value = ''
  try {
    const [periodosCargados, areasCargadas] = await Promise.all([listarPeriodos(), listarAreas()])
    periodos.value = periodosCargados
    areas.value = areasCargadas
    periodoId.value = periodosCargados[0]?.periodoId ?? null
    competenciaCodigo.value =
      areasCargadas.find((area) => area.activo)?.competencias.find((competencia) => competencia.activo)?.codigo ?? ''
  } catch (fallo: unknown) {
    errorCatalogos.value = obtenerMensajeError(fallo, 'No se pudieron cargar grados, secciones y competencias.')
  } finally {
    cargandoCatalogos.value = false
  }
}

function editar(evaluacion: EvaluacionParcial): void {
  editandoId.value = evaluacion.id
  formulario.titulo = evaluacion.titulo
  formulario.descripcion = evaluacion.descripcion ?? ''
  formulario.ponderacion = String(evaluacion.ponderacion)
  formulario.bimestre = evaluacion.bimestre ?? ''
  errorFormulario.value = ''
  aviso.value = ''
}

async function guardar(): Promise<void> {
  errorFormulario.value = ''
  aviso.value = ''
  if (guardando.value) return

  const ponderacion = Number(formulario.ponderacion)
  if (periodoId.value === null || !competenciaCodigo.value) {
    errorFormulario.value = 'Selecciona el grado, la sección y la competencia.'
    return
  }
  if (!formulario.titulo.trim() || formulario.titulo.trim().length > 180) {
    errorFormulario.value = 'El título es obligatorio y no debe superar los 180 caracteres.'
    return
  }
  if (formulario.descripcion.trim().length > 1000) {
    errorFormulario.value = 'La descripción no debe superar los 1000 caracteres.'
    return
  }
  if (!Number.isFinite(ponderacion) || ponderacion <= 0 || ponderacion > 100) {
    errorFormulario.value = 'La ponderación debe ser mayor que 0 y no superar el 100%.'
    return
  }
  if (formulario.bimestre === '') {
    errorFormulario.value = 'Selecciona el bimestre al que pertenece esta evaluación.'
    return
  }

  const solicitud: SolicitudEvaluacionParcial = {
    periodoId: periodoId.value,
    competenciaCodigo: competenciaCodigo.value,
    titulo: formulario.titulo.trim(),
    descripcion: formulario.descripcion.trim(),
    ponderacion,
    bimestre: formulario.bimestre,
  }

  guardando.value = true
  try {
    let mensajeExito: string
    if (editandoId.value === null) {
      await crear(solicitud)
      mensajeExito = 'Evaluación creada y asignada al bimestre.'
    } else {
      await actualizar(editandoId.value, solicitud)
      mensajeExito = 'Evaluación actualizada.'
    }
    limpiarFormulario()
    aviso.value = mensajeExito
    await cargarEvaluaciones()
  } catch (fallo: unknown) {
    errorFormulario.value = obtenerMensajeError(fallo, 'No se pudo guardar la evaluación.')
  } finally {
    guardando.value = false
  }
}

watch([periodoId, competenciaCodigo], () => {
  limpiarFormulario()
  void cargarEvaluaciones()
})

onMounted(cargarCatalogos)
</script>

<template>
  <main class="pagina-evaluaciones">
    <NavegacionCalificaciones />

    <EncabezadoPagina
      titulo="Evaluaciones parciales"
      descripcion="Asigna cada evaluación a uno de los cuatro bimestres para calcular los informes de progreso."
    />

    <AvisoMensaje v-if="errorCatalogos" :mensaje="errorCatalogos" tipo="error" />

    <section class="panel filtros" aria-label="Grado, sección y competencia">
      <label>
        Grado y sección
        <select v-model.number="periodoId" :disabled="cargandoCatalogos || !periodos.length">
          <option v-for="periodo in periodos" :key="periodo.periodoId" :value="periodo.periodoId">
            {{ descripcionPeriodo(periodo) }}
          </option>
        </select>
      </label>
      <label>
        Competencia
        <select v-model="competenciaCodigo" :disabled="cargandoCatalogos || !competencias.length">
          <option v-for="competencia in competencias" :key="competencia.codigo" :value="competencia.codigo">
            {{ competencia.areaNombre }} · {{ competencia.nombre }}
          </option>
        </select>
      </label>
    </section>

    <AvisoMensaje v-if="errorFormulario" :mensaje="errorFormulario" tipo="error" />
    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />

    <section class="panel" aria-labelledby="titulo-formulario">
      <h2 id="titulo-formulario">{{ editandoId === null ? 'Crear evaluación' : 'Editar evaluación' }}</h2>
      <form class="formulario" @submit.prevent="guardar">
        <label>
          Título de la evaluación *
          <input v-model="formulario.titulo" maxlength="180" required placeholder="Ej. Comprensión lectora" />
        </label>
        <label>
          Bimestre *
          <select v-model.number="formulario.bimestre" required>
            <option value="">Selecciona un bimestre</option>
            <option v-for="bimestre in BIMESTRES" :key="bimestre" :value="bimestre">Bimestre {{ bimestre }}</option>
          </select>
        </label>
        <label>
          Ponderación (%) *
          <input v-model="formulario.ponderacion" type="number" min="0.01" max="100" step="0.01" required />
        </label>
        <label class="ancho">
          Descripción
          <textarea v-model="formulario.descripcion" maxlength="1000" rows="3" />
        </label>
        <div class="acciones ancho">
          <BotonAccion tipo="submit" :deshabilitado="guardando || cargandoCatalogos">
            {{ guardando ? 'Guardando…' : editandoId === null ? 'Crear evaluación' : 'Guardar cambios' }}
          </BotonAccion>
          <BotonAccion
            v-if="editandoId !== null"
            tipo="button"
            variante="secundario"
            :deshabilitado="guardando"
            @click="limpiarFormulario"
          >
            Cancelar edición
          </BotonAccion>
        </div>
      </form>
    </section>

    <section class="panel" aria-labelledby="titulo-listado">
      <div class="encabezado-lista">
        <div>
          <h2 id="titulo-listado">Evaluaciones de {{ nombreCompetencia || 'la competencia' }}</h2>
          <p>Las evaluaciones sin bimestre deben asignarse antes de aparecer en un informe.</p>
        </div>
        <span class="contador">{{ evaluaciones.length }}</span>
      </div>

      <p v-if="evaluacionesSinBimestre" class="aviso-pendiente" role="status">
        {{ evaluacionesSinBimestre }} evaluación(es) sin bimestre asignado.
      </p>
      <p v-if="cargandoEvaluaciones" role="status">Cargando evaluaciones…</p>
      <AvisoMensaje v-else-if="errorLista" :mensaje="errorLista" tipo="error" />
      <ul v-else-if="evaluaciones.length" class="lista">
        <li v-for="evaluacion in evaluaciones" :key="evaluacion.id" class="evaluacion">
          <div>
            <strong>{{ evaluacion.titulo }}</strong>
            <p>{{ evaluacion.descripcion || 'Sin descripción' }}</p>
            <small>
              {{ evaluacion.bimestre === null ? 'Sin bimestre asignado' : `Bimestre ${evaluacion.bimestre}` }}
              · Ponderación {{ evaluacion.ponderacion }}%
            </small>
          </div>
          <BotonAccion variante="secundario" :deshabilitado="guardando" @click="editar(evaluacion)">
            {{ evaluacion.bimestre === null ? 'Asignar bimestre' : 'Editar' }}
          </BotonAccion>
        </li>
      </ul>
      <p v-else-if="periodoId !== null && competenciaCodigo" class="vacio">
        Aún no hay evaluaciones para esta competencia en el grado y sección seleccionados.
      </p>
      <p v-else class="vacio">Selecciona un grado, sección y competencia para administrar las evaluaciones.</p>
    </section>
  </main>
</template>

<style scoped>
.pagina-evaluaciones {
  display: flex;
  width: 100%;
  max-width: 1200px;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
  padding: 32px;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.filtros,
.formulario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: end;
  gap: 16px;
}

label {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  color: #434655;
  font-size: 13px;
  font-weight: 600;
}

input,
select,
textarea {
  width: 100%;
  min-height: 42px;
  padding: 9px 10px;
  border: 1px solid #c3c6d7;
  border-radius: 7px;
  background: #f7f9fb;
  color: #191c1e;
  font: inherit;
}

textarea {
  resize: vertical;
}

h2 {
  margin: 0;
  color: #191c1e;
  font-size: 18px;
}

.ancho {
  grid-column: 1 / -1;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.encabezado-lista {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.encabezado-lista p,
.evaluacion p {
  margin: 5px 0 0;
  color: #737686;
  font-size: 13px;
}

.contador {
  min-width: 32px;
  padding: 5px 10px;
  border-radius: 16px;
  background: #eef2ff;
  color: #004ac6;
  font-weight: 700;
  text-align: center;
}

.aviso-pendiente {
  margin: 0;
  padding: 12px;
  border: 1px solid #facc15;
  border-radius: 8px;
  background: #fefce8;
  color: #854d0e;
  font-size: 13px;
}

.lista {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.evaluacion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.evaluacion small {
  display: block;
  margin-top: 6px;
  color: #434655;
}

.vacio {
  margin: 0;
  padding: 24px;
  color: #737686;
  text-align: center;
}

@media (max-width: 650px) {
  .pagina-evaluaciones {
    padding: 20px 14px;
  }

  .filtros,
  .formulario {
    grid-template-columns: 1fr;
  }

  .ancho {
    grid-column: auto;
  }

  .evaluacion {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
