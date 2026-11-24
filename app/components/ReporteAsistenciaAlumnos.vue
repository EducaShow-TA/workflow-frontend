<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { formatearFecha } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  crearFiltrosReporteAsistencia,
  gradosDisponibles,
  guardarArchivo,
  seccionAjustadaAlGrado,
  seccionesDelGrado,
  useReporteAsistencia,
} from '~/composables/useReporteAsistencia'
import type { FiltrosReporteAsistencia, ReporteAsistencia, SeccionReporteAsistencia } from '~/types/reporteAsistencia'

/** Porcentaje de faltas sin justificar a partir del cual una fila se resalta para intervenir. */
const UMBRAL_RESALTADO = 30
const TAMANIO_PAGINA = 20

const { listarSecciones, consultar, descargarCsv } = useReporteAsistencia()
const filtros = reactive<FiltrosReporteAsistencia>(crearFiltrosReporteAsistencia())
const filtrosAplicados = ref<FiltrosReporteAsistencia | null>(null)
const reporte = ref<ReporteAsistencia | null>(null)
const secciones = ref<SeccionReporteAsistencia[]>([])
const cargando = ref(false)
const exportando = ref(false)
const errorConsulta = ref('')
const errorCatalogo = ref('')
const errorExportacion = ref('')
const pagina = ref(1)
let ultimaSolicitud = 0

const grados = computed(() => gradosDisponibles(secciones.value))
const seccionesFiltradas = computed(() => seccionesDelGrado(secciones.value, filtros.gradoId))
const errorFechas = computed(() => {
  if (!filtros.desde || !filtros.hasta) return 'Indica la fecha inicial y la fecha final.'
  return filtros.desde > filtros.hasta ? 'La fecha inicial no puede ser posterior a la fecha final.' : ''
})
const cambiosSinAplicar = computed(
  () => filtrosAplicados.value !== null && JSON.stringify(filtros) !== JSON.stringify(filtrosAplicados.value),
)
const alumnos = computed(() => reporte.value?.alumnos ?? [])
const totalPaginas = computed(() => Math.max(1, Math.ceil(alumnos.value.length / TAMANIO_PAGINA)))
const alumnosVisibles = computed(() =>
  alumnos.value.slice((pagina.value - 1) * TAMANIO_PAGINA, pagina.value * TAMANIO_PAGINA),
)
const alumnosEnRiesgo = computed(
  () => alumnos.value.filter((alumno) => alumno.porcentajeInasistencia >= UMBRAL_RESALTADO).length,
)
const resumenFiltros = computed(() => {
  const aplicados = filtrosAplicados.value
  if (!aplicados) return ''
  const grado = grados.value.find((opcion) => opcion.gradoId === aplicados.gradoId)
  const seccion = secciones.value.find((opcion) => opcion.seccionId === aplicados.seccionId)
  return [
    `Del ${formatearFecha(aplicados.desde)} al ${formatearFecha(aplicados.hasta)}`,
    grado ? grado.grado : 'Todos los grados',
    seccion ? `Sección ${seccion.seccion}` : 'Todas las secciones',
  ].join(' · ')
})

watch(
  () => filtros.gradoId,
  (gradoId) => {
    filtros.seccionId = seccionAjustadaAlGrado(secciones.value, gradoId, filtros.seccionId)
  },
)

onUnmounted(() => {
  ultimaSolicitud++
})

async function cargarCatalogo(): Promise<void> {
  errorCatalogo.value = ''
  try {
    secciones.value = await listarSecciones()
  } catch (error: unknown) {
    errorCatalogo.value = obtenerMensajeError(error, 'No se pudieron cargar los grados y secciones.')
  }
}

async function generarReporte(): Promise<void> {
  if (errorFechas.value) return
  const solicitud = ++ultimaSolicitud
  const seleccion = { ...filtros }
  cargando.value = true
  errorConsulta.value = ''
  errorExportacion.value = ''
  try {
    const resultado = await consultar(seleccion)
    if (solicitud !== ultimaSolicitud) return
    reporte.value = resultado
    filtrosAplicados.value = seleccion
    pagina.value = 1
  } catch (error: unknown) {
    if (solicitud !== ultimaSolicitud) return
    reporte.value = null
    errorConsulta.value = obtenerMensajeError(error, 'No se pudo generar el reporte. Intenta nuevamente.')
  } finally {
    if (solicitud === ultimaSolicitud) cargando.value = false
  }
}

async function exportar(): Promise<void> {
  const aplicados = filtrosAplicados.value
  if (!aplicados || exportando.value) return
  exportando.value = true
  errorExportacion.value = ''
  try {
    const { archivo, nombre } = await descargarCsv(aplicados)
    guardarArchivo(archivo, nombre)
  } catch (error: unknown) {
    errorExportacion.value = obtenerMensajeError(error, 'No se pudo exportar el reporte.')
  } finally {
    exportando.value = false
  }
}

function limpiarFiltros(): void {
  Object.assign(filtros, crearFiltrosReporteAsistencia())
}

onMounted(async () => {
  await Promise.all([cargarCatalogo(), generarReporte()])
})
</script>

<template>
  <div class="reporte-asistencia">
    <section class="tarjeta" aria-labelledby="titulo-filtros-asistencia">
      <h2 id="titulo-filtros-asistencia">Filtros del reporte</h2>
      <p class="nota">Se cuentan sesiones de clase. Las faltas justificadas no suman al porcentaje de inasistencia.</p>
      <div v-if="errorCatalogo" class="aviso aviso-error" role="alert">
        {{ errorCatalogo }} Puedes consultar todos los grados mientras tanto.
        <button type="button" class="enlace" @click="cargarCatalogo">Reintentar carga</button>
      </div>
      <form @submit.prevent="generarReporte">
        <fieldset class="filtros">
          <label
            >Desde
            <input
              v-model="filtros.desde"
              type="date"
              required
              :aria-invalid="!!errorFechas"
              :aria-describedby="errorFechas ? 'error-fechas-asistencia' : undefined"
            />
          </label>
          <label
            >Hasta
            <input
              v-model="filtros.hasta"
              type="date"
              required
              :aria-invalid="!!errorFechas"
              :aria-describedby="errorFechas ? 'error-fechas-asistencia' : undefined"
            />
          </label>
          <label
            >Grado
            <select v-model="filtros.gradoId" :disabled="!!errorCatalogo">
              <option :value="null">Todos los grados</option>
              <option v-for="grado in grados" :key="grado.gradoId" :value="grado.gradoId">{{ grado.grado }}</option>
            </select>
          </label>
          <label
            >Sección
            <select v-model="filtros.seccionId" :disabled="!!errorCatalogo">
              <option :value="null">Todas las secciones</option>
              <option v-for="seccion in seccionesFiltradas" :key="seccion.seccionId" :value="seccion.seccionId">
                {{ formatearSeccionCompleta(seccion.gradoNumero, seccion.seccion) }}
              </option>
            </select>
          </label>
        </fieldset>
        <p v-if="errorFechas" id="error-fechas-asistencia" class="texto-error" role="alert">{{ errorFechas }}</p>
        <div class="acciones">
          <button type="submit" class="boton primario" :disabled="cargando || !!errorFechas">
            {{ cargando ? 'Consultando…' : 'Generar reporte' }}
          </button>
          <button type="button" class="boton secundario" :disabled="cargando" @click="limpiarFiltros">
            Limpiar filtros
          </button>
        </div>
      </form>
    </section>

    <p v-if="cargando" class="aviso" role="status">Consultando la asistencia de los alumnos…</p>
    <div v-else-if="errorConsulta" class="aviso aviso-error" role="alert">
      {{ errorConsulta }}
      <button type="button" class="enlace" @click="generarReporte">Reintentar consulta</button>
    </div>

    <template v-if="reporte && !cargando">
      <p v-if="cambiosSinAplicar" class="aviso" role="status">
        Hay filtros sin aplicar. Pulsa «Generar reporte» para actualizar los resultados.
      </p>
      <div class="resumen" aria-label="Totales del reporte">
        <article class="tarjeta">
          <p>Asistencias</p>
          <strong>{{ reporte.totales.presentes }}</strong>
        </article>
        <article class="tarjeta">
          <p>Tardanzas</p>
          <strong>{{ reporte.totales.tardanzas }}</strong>
        </article>
        <article class="tarjeta">
          <p>Inasistencias</p>
          <strong>{{ reporte.totales.inasistencias }}</strong>
          <small>Sin justificar.</small>
        </article>
        <article class="tarjeta">
          <p>Justificadas</p>
          <strong>{{ reporte.totales.justificadas }}</strong>
        </article>
        <article class="tarjeta">
          <p>Sesiones registradas</p>
          <strong>{{ reporte.totales.totalSesiones }}</strong>
        </article>
      </div>

      <section class="tarjeta" aria-labelledby="titulo-detalle-asistencia">
        <div class="cabecera-detalle">
          <div>
            <h2 id="titulo-detalle-asistencia">Detalle por alumno</h2>
            <p class="filtros-aplicados">{{ resumenFiltros }}</p>
            <p v-if="alumnosEnRiesgo" class="nota">
              {{ alumnosEnRiesgo }} alumno(s) con {{ UMBRAL_RESALTADO }} % o más de inasistencias sin justificar.
            </p>
          </div>
          <button
            type="button"
            class="boton secundario"
            :disabled="exportando || cambiosSinAplicar || !alumnos.length"
            @click="exportar"
          >
            {{ exportando ? 'Exportando…' : 'Exportar CSV' }}
          </button>
        </div>
        <p v-if="errorExportacion" class="texto-error" role="alert">{{ errorExportacion }}</p>

        <div v-if="!alumnos.length" class="vacio" role="status">
          <h3>No hay asistencias registradas en el rango</h3>
          <p>Prueba con otro rango de fechas, grado o sección.</p>
        </div>
        <template v-else>
          <div
            class="tabla-contenedor"
            tabindex="0"
            role="region"
            aria-label="Detalle por alumno, desplazamiento horizontal"
          >
            <table>
              <caption class="solo-lectores">
                Inasistencias y tardanzas por alumno, ordenadas de mayor a menor porcentaje de inasistencia
              </caption>
              <thead>
                <tr>
                  <th scope="col">Alumno</th>
                  <th scope="col">Grado / Sección</th>
                  <th scope="col" class="numero">Asistencias</th>
                  <th scope="col" class="numero">Tardanzas</th>
                  <th scope="col" class="numero">Inasistencias</th>
                  <th scope="col" class="numero">Justificadas</th>
                  <th scope="col" class="numero">Total</th>
                  <th scope="col" class="numero">% inasistencia</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="alumno in alumnosVisibles"
                  :key="`${alumno.estudianteId}-${alumno.seccionId}`"
                  :class="{ 'fila--riesgo': alumno.porcentajeInasistencia >= UMBRAL_RESALTADO }"
                >
                  <td>{{ alumno.nombreCompleto }}</td>
                  <td>{{ formatearSeccion(alumno.gradoNumero, alumno.seccion) }}</td>
                  <td class="numero">{{ alumno.presentes }}</td>
                  <td class="numero">{{ alumno.tardanzas }}</td>
                  <td class="numero">{{ alumno.inasistencias }}</td>
                  <td class="numero">{{ alumno.justificadas }}</td>
                  <td class="numero">{{ alumno.totalSesiones }}</td>
                  <td class="numero porcentaje">{{ alumno.porcentajeInasistencia.toFixed(1) }} %</td>
                </tr>
              </tbody>
            </table>
          </div>
          <nav class="paginacion" aria-label="Páginas del reporte">
            <span>{{ alumnos.length }} alumnos · Página {{ pagina }} de {{ totalPaginas }}</span>
            <div class="acciones">
              <button type="button" class="boton secundario" :disabled="pagina === 1" @click="pagina--">Anterior</button
              ><button type="button" class="boton secundario" :disabled="pagina === totalPaginas" @click="pagina++">
                Siguiente
              </button>
            </div>
          </nav>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 12px;
  font-size: 18px;
}
p {
  line-height: 1.5;
}
.nota,
small {
  color: var(--color-text-secondary);
  font-size: 13px;
}
.tarjeta {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
}
.filtros {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}
select,
input {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 10px;
  background: white;
  color: var(--color-text);
}
.acciones {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
form > .acciones {
  margin-top: 20px;
}
.boton {
  min-height: 42px;
  padding: 9px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.primario {
  background: var(--color-primary);
  color: white;
  border: 1px solid var(--color-primary);
}
.secundario {
  background: white;
  border: 1px solid #cbd5e1;
  color: var(--color-text);
}
button:disabled,
select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.aviso {
  padding: 16px;
  margin: 20px 0;
  background: #eff6ff;
  border-radius: 8px;
  color: #1e40af;
}
.aviso-error {
  background: #fef2f2;
  color: #991b1b;
}
.texto-error {
  color: #991b1b;
}
.enlace {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
  padding: 8px;
}
.resumen {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 18px;
  margin: 24px 0;
}
.resumen p {
  margin: 0 0 12px;
}
.resumen strong {
  display: block;
  font-size: 30px;
  font-variant-numeric: tabular-nums;
}
small {
  display: block;
  margin-top: 8px;
}
.cabecera-detalle {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.filtros-aplicados {
  font-size: 14px;
  margin: 0;
}
.tabla-contenedor {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
th,
td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
}
th {
  background: #f8fafc;
  font-size: 12px;
  color: #475569;
}
.numero {
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.fila--riesgo {
  background: #fef2f2;
}
.fila--riesgo .porcentaje {
  color: #991b1b;
  font-weight: 700;
}
.vacio {
  padding: 32px 16px;
  text-align: center;
}
.paginacion {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  font-size: 13px;
  flex-wrap: wrap;
}
.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
:focus-visible {
  outline: 3px solid #93b4fa;
  outline-offset: 3px;
}
@media (max-width: 1100px) {
  .filtros {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .resumen {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .filtros,
  .resumen {
    grid-template-columns: 1fr;
  }
  .tarjeta {
    padding: 18px;
  }
}
</style>
