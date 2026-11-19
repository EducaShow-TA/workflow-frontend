<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useCuadroMerito, type FormatoCuadroMerito } from '~/composables/useCuadroMerito'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import type { CuadroMerito } from '~/types/cuadroMerito'
import type { PeriodoAcademico } from '~/types/periodoAcademico'

definePageMeta({ middleware: 'autenticacion' })

const { consultar, descargar } = useCuadroMerito()
const { listar } = usePeriodosAcademicos()
const periodos = ref<PeriodoAcademico[]>([])
const periodoId = ref('')
const cuadro = ref<CuadroMerito | null>(null)
const cargandoCatalogo = ref(false)
const cargando = ref(false)
const descargando = ref<FormatoCuadroMerito | ''>('')
const errorCatalogo = ref('')
const errorConsulta = ref('')
const errorDescarga = ref('')
let secuenciaConsulta = 0

const periodosCerrados = computed(() =>
  periodos.value
    .filter((periodo) => periodo.actasCerradas)
    .sort(
      (primero, segundo) =>
        segundo.fechaInicio.localeCompare(primero.fechaInicio) ||
        primero.numeroGrado - segundo.numeroGrado ||
        primero.seccion.localeCompare(segundo.seccion),
    ),
)
const estudiantes = computed(() => cuadro.value?.estudiantes ?? [])
const promedioVisible = (promedio: number | null): string =>
  promedio === null
    ? '—'
    : new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(promedio)

async function cargarPeriodos(): Promise<void> {
  cargandoCatalogo.value = true
  errorCatalogo.value = ''
  try {
    periodos.value = await listar()
  } catch (error: unknown) {
    errorCatalogo.value = obtenerMensajeError(error, 'No se pudieron cargar los períodos académicos.')
  } finally {
    cargandoCatalogo.value = false
  }
}

async function generar(): Promise<void> {
  const id = Number(periodoId.value)
  const seleccionado = periodosCerrados.value.find((periodo) => periodo.periodoId === id)
  if (!seleccionado) {
    errorConsulta.value = 'Selecciona un período con las actas cerradas.'
    cuadro.value = null
    return
  }

  const consulta = ++secuenciaConsulta
  cargando.value = true
  errorConsulta.value = ''
  errorDescarga.value = ''
  cuadro.value = null
  try {
    const resultado = await consultar(id)
    if (consulta === secuenciaConsulta) cuadro.value = resultado
  } catch (error: unknown) {
    if (consulta === secuenciaConsulta) {
      errorConsulta.value = obtenerMensajeError(error, 'No se pudo generar el cuadro de mérito.')
    }
  } finally {
    if (consulta === secuenciaConsulta) cargando.value = false
  }
}

async function descargarArchivo(formato: FormatoCuadroMerito): Promise<void> {
  if (!cuadro.value) return
  descargando.value = formato
  errorDescarga.value = ''
  try {
    const archivo = await descargar(cuadro.value.periodoId, formato)
    const url = URL.createObjectURL(archivo)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `cuadro-merito-periodo-${cuadro.value.periodoId}.${formato === 'excel' ? 'xlsx' : 'pdf'}`
    enlace.click()
    URL.revokeObjectURL(url)
  } catch (error: unknown) {
    errorDescarga.value = obtenerMensajeError(error, `No se pudo descargar el archivo ${formato.toUpperCase()}.`)
  } finally {
    descargando.value = ''
  }
}

function etiquetaPeriodo(periodo: PeriodoAcademico): string {
  return `${periodo.numeroGrado}.° ${periodo.nivelEducativo.toLowerCase()} · Sección ${periodo.seccion} · ${periodo.fechaInicio.slice(0, 4)}`
}

onMounted(() => {
  void cargarPeriodos()
})
onUnmounted(() => {
  secuenciaConsulta++
})
</script>

<template>
  <main class="pagina-cuadro">
    <header class="encabezado">
      <p class="ubicacion">Reportes / Desempeño académico</p>
      <h1>Cuadro de mérito por sección</h1>
      <p>Compara el desempeño académico de los alumnos usando las calificaciones finales consolidadas.</p>
    </header>

    <section class="tarjeta filtros" aria-labelledby="titulo-filtros">
      <div>
        <h2 id="titulo-filtros">Período académico</h2>
        <p>El cuadro está disponible para períodos con actas cerradas.</p>
      </div>
      <form class="formulario" @submit.prevent="generar">
        <label for="periodo">Grado, sección y año</label>
        <select id="periodo" v-model="periodoId" :disabled="cargandoCatalogo || !!errorCatalogo">
          <option value="">Selecciona un período</option>
          <option v-for="periodo in periodosCerrados" :key="periodo.periodoId" :value="String(periodo.periodoId)">
            {{ etiquetaPeriodo(periodo) }}
          </option>
        </select>
        <button class="boton primario" type="submit" :disabled="cargando || !periodoId">
          {{ cargando ? 'Generando…' : 'Generar cuadro' }}
        </button>
      </form>
      <p v-if="cargandoCatalogo" class="aviso" role="status">Cargando períodos académicos…</p>
      <div v-else-if="errorCatalogo" class="aviso error" role="alert">
        {{ errorCatalogo }}
        <button class="enlace" type="button" @click="cargarPeriodos">Reintentar</button>
      </div>
      <p v-else-if="periodosCerrados.length === 0" class="aviso" role="status">
        No hay períodos con actas cerradas disponibles.
      </p>
    </section>

    <p v-if="cargando" class="aviso" role="status">Calculando promedios y puestos…</p>
    <div v-else-if="errorConsulta" class="aviso error" role="alert">{{ errorConsulta }}</div>

    <section v-if="cuadro && !cargando" class="tarjeta resultados" aria-labelledby="titulo-resultados">
      <div class="encabezado-resultados">
        <div>
          <h2 id="titulo-resultados">
            {{ cuadro.gradoNumero }}.° {{ cuadro.nivelEducativo.toLowerCase() }} · Sección {{ cuadro.seccion }}
          </h2>
          <p>Año escolar {{ cuadro.anhioEscolar }} · Actas cerradas</p>
        </div>
        <div class="acciones">
          <button
            class="boton secundario"
            type="button"
            :disabled="!!descargando"
            @click="descargarArchivo('pdf')"
          >
            {{ descargando === 'pdf' ? 'Descargando PDF…' : 'Descargar PDF' }}
          </button>
          <button
            class="boton secundario"
            type="button"
            :disabled="!!descargando"
            @click="descargarArchivo('excel')"
          >
            {{ descargando === 'excel' ? 'Descargando Excel…' : 'Descargar Excel' }}
          </button>
        </div>
      </div>
      <p v-if="errorDescarga" class="aviso error" role="alert">{{ errorDescarga }}</p>
      <p class="criterio">
        Promedio aritmético de puntajes finales por competencia (C=1, B=2, A=3, AD=4). Los empates comparten puesto.
      </p>
      <div v-if="estudiantes.length" class="contenedor-tabla">
        <table>
          <thead>
            <tr>
              <th scope="col">Puesto</th>
              <th scope="col">Estudiante</th>
              <th scope="col">Competencias calificadas</th>
              <th scope="col">Promedio</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="estudiante in estudiantes" :key="estudiante.matriculaId">
              <td>
                <span v-if="estudiante.puesto !== null" class="puesto">{{ estudiante.puesto }}</span>
                <span v-else class="sin-puesto">Sin calificaciones</span>
              </td>
              <td>{{ estudiante.estudiante }}</td>
              <td>{{ estudiante.competenciasCalificadas }}</td>
              <td>{{ promedioVisible(estudiante.promedio) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="aviso" role="status">No hay alumnos con matrícula confirmada en este período.</p>
      <p v-if="estudiantes.some((estudiante) => estudiante.puesto === null)" class="nota">
        Los alumnos sin puntajes consolidados aparecen al final sin puesto.
      </p>
    </section>
  </main>
</template>

<style scoped>
.pagina-cuadro {
  display: grid;
  gap: 20px;
  padding: 28px;
  color: #172b4d;
}

.encabezado h1 {
  margin: 4px 0 8px;
  font-size: 28px;
}

.encabezado p,
.filtros p,
.encabezado-resultados p {
  margin: 0;
  color: #5f6c7b;
}

.ubicacion {
  font-size: 13px;
}

.tarjeta {
  padding: 22px;
  border: 1px solid #e0e6ed;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 3px 12px rgb(23 43 77 / 5%);
}

.filtros {
  display: grid;
  gap: 16px;
}

.filtros h2,
.encabezado-resultados h2 {
  margin: 0 0 6px;
  font-size: 19px;
}

.formulario {
  display: flex;
  max-width: 760px;
  align-items: end;
  gap: 12px;
}

.formulario label {
  display: grid;
  flex: 1;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
}

select {
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid #c5ced8;
  border-radius: 7px;
  background: #fff;
  color: inherit;
}

.boton {
  min-height: 40px;
  padding: 8px 14px;
  border: 0;
  border-radius: 7px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.boton:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.primario {
  background: #07599d;
  color: #fff;
}

.secundario {
  border: 1px solid #b9c9d8;
  background: #fff;
  color: #07599d;
}

.aviso {
  margin: 0;
  color: #5f6c7b;
}

.error {
  color: #a4262c;
}

.enlace {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: none;
  color: #07599d;
  text-decoration: underline;
  cursor: pointer;
}

.encabezado-resultados {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.criterio {
  margin: 20px 0 14px;
  color: #5f6c7b;
  font-size: 14px;
}

.contenedor-tabla {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

th,
td {
  padding: 12px 14px;
  border-bottom: 1px solid #e5eaf0;
}

th {
  background: #f3f6f9;
  color: #364b63;
  font-size: 13px;
}

.puesto {
  display: inline-flex;
  min-width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e8f1fb;
  color: #07599d;
  font-weight: 700;
}

.sin-puesto,
.nota {
  color: #697887;
}

.nota {
  margin: 12px 0 0;
  font-size: 13px;
}

@media (max-width: 720px) {
  .pagina-cuadro {
    padding: 18px;
  }

  .formulario,
  .encabezado-resultados {
    align-items: stretch;
    flex-direction: column;
  }

  .formulario button {
    align-self: flex-start;
  }
}
</style>
