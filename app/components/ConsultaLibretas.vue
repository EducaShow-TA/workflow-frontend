<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAutenticacionStore } from '~/stores/autenticacion'
import { useLibretas } from '~/composables/useLibretas'
import { useEstudiantesMatriculables } from '~/composables/useEstudiantesMatriculables'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { useMisClases } from '~/composables/useMisClases'
import { useApi } from '~/composables/useApi'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { LibretaNotas } from '~/types/libreta'

interface OpcionEstudiante {
  id: number
  nombre: string
  periodos: number[]
}
interface OpcionPeriodo {
  id: number
  nombre: string
}
interface EstudianteVinculado {
  estudianteId: number
  nombreCompleto: string
  periodos: { periodoId: number; gradoNumero: number; seccion: string; fechaInicio: string; fechaFin: string }[]
}
const autenticacion = useAutenticacionStore()
const { solicitar } = useApi()
const { consultar: solicitarLibreta, descargar } = useLibretas()
const { listar: listarEstudiantes } = useEstudiantesMatriculables()
const { listar: listarPeriodos } = usePeriodosAcademicos()
const { listar: listarClases, listarAlumnos } = useMisClases()
const esAdministrador = computed(() => autenticacion.usuario?.rol === 'ADMINISTRADOR')
const esDocente = computed(() => autenticacion.usuario?.rol === 'DOCENTE')
const esApoderado = computed(() => autenticacion.usuario?.rol === 'APODERADO')
const estudiantes = ref<OpcionEstudiante[]>([])
const periodos = ref<OpcionPeriodo[]>([])
const estudianteId = ref<number | ''>('')
const periodoId = ref<number | ''>('')
const cargando = ref(true)
const consultando = ref(false)
const descargando = ref(false)
const errorCatalogos = ref('')
const error = ref('')
const aviso = ref('')
const libreta = ref<LibretaNotas | null>(null)
let consultaActual = 0
let catalogoActual = 0
const estudiantesDisponibles = computed(() =>
  esDocente.value
    ? estudiantes.value
    : estudiantes.value.filter((item) => periodoId.value !== '' && item.periodos.includes(periodoId.value)),
)

async function cargarCatalogos(): Promise<void> {
  cargando.value = true
  errorCatalogos.value = ''
  try {
    if (esAdministrador.value) {
      const [listaEstudiantes, listaPeriodos] = await Promise.all([listarEstudiantes(), listarPeriodos()])
      estudiantes.value = listaEstudiantes.map((item) => ({
        id: item.estudianteId,
        nombre: [item.nombre, item.apellidoPaterno, item.apellidoMaterno].filter(Boolean).join(' '),
        periodos: item.matriculas.filter((m) => m.estado === 'CONFIRMADA').map((m) => m.periodoId),
      }))
      periodos.value = listaPeriodos.map((item) => ({
        id: item.periodoId,
        nombre: `${item.numeroGrado}.° ${item.seccion} · ${item.fechaInicio} a ${item.fechaFin}`,
      }))
    } else if (esDocente.value) {
      const clases = await listarClases()
      periodos.value = [
        ...new Map(
          clases.map((item) => [
            item.periodoId,
            {
              id: item.periodoId,
              nombre: `${item.gradoNumero}.° ${item.seccionCodigo} · ${item.anhio}`,
            },
          ]),
        ).values(),
      ]
    } else if (esApoderado.value) {
      const vinculados = await solicitar<EstudianteVinculado[]>('/api/v1/apoderados/mis-estudiantes')
      estudiantes.value = vinculados.map((item) => ({
        id: item.estudianteId,
        nombre: item.nombreCompleto,
        periodos: item.periodos.map((periodo) => periodo.periodoId),
      }))
      const disponibles = new Map<number, OpcionPeriodo>()
      vinculados.forEach((estudiante) => estudiante.periodos.forEach((periodo) => {
        disponibles.set(periodo.periodoId, {
          id: periodo.periodoId,
          nombre: `${periodo.gradoNumero}.° ${periodo.seccion} · ${periodo.fechaInicio.slice(0, 4)}`,
        })
      }))
      periodos.value = [...disponibles.values()].sort((a, b) => b.id - a.id)
    }
  } catch (fallo: unknown) {
    errorCatalogos.value = obtenerMensajeError(fallo, 'No se pudieron cargar los datos para consultar las libretas.')
  } finally {
    cargando.value = false
  }
}

watch(periodoId, async (id) => {
  const turno = ++catalogoActual
  estudianteId.value = ''
  if (!esDocente.value) return
  estudiantes.value = []
  if (id === '') return
  cargando.value = true
  errorCatalogos.value = ''
  try {
    const alumnos = await listarAlumnos(id)
    if (turno === catalogoActual)
      estudiantes.value = alumnos.map((item) => ({
        id: item.estudianteId,
        nombre: item.nombreCompleto,
        periodos: [id],
      }))
  } catch (fallo: unknown) {
    if (turno === catalogoActual)
      errorCatalogos.value = obtenerMensajeError(fallo, 'No se pudieron cargar los alumnos.')
  } finally {
    if (turno === catalogoActual) cargando.value = false
  }
})

watch(
  [estudianteId, periodoId],
  () => {
    consultaActual++
    consultando.value = false
    libreta.value = null
    error.value = ''
    aviso.value = ''
  },
  { flush: 'sync' },
)

async function consultar(): Promise<void> {
  const turno = ++consultaActual
  libreta.value = null
  error.value = ''
  aviso.value = ''
  consultando.value = true
  try {
    const resultado = await solicitarLibreta(Number(estudianteId.value), Number(periodoId.value))
    if (turno === consultaActual) libreta.value = resultado
  } catch (fallo: unknown) {
    if (turno === consultaActual) error.value = obtenerMensajeError(fallo, 'No se pudo consultar la libreta.')
  } finally {
    if (turno === consultaActual) consultando.value = false
  }
}

async function descargarPdf(): Promise<void> {
  const actual = libreta.value
  if (!actual || descargando.value) return
  const turno = consultaActual
  descargando.value = true
  error.value = ''
  aviso.value = ''
  try {
    const archivo = await descargar(actual.estudianteId, actual.periodoSolicitadoId)
    const url = URL.createObjectURL(archivo)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `libreta-estudiante-${actual.estudianteId}-periodo-${actual.periodoSolicitadoId}.pdf`
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    if (turno === consultaActual) aviso.value = 'Se descargó el PDF generado por el colegio.'
  } catch (fallo: unknown) {
    if (turno === consultaActual) error.value = obtenerMensajeError(fallo, 'No se pudo descargar el PDF.')
  } finally {
    descargando.value = false
  }
}
onMounted(cargarCatalogos)
</script>

<template>
  <main class="libretas">
    <header>
      <p class="ruta">Calificaciones / Libretas · US-3.3</p>
      <h1>Libretas e informes de progreso</h1>
      <p>Consulta los avances por área y competencia y descarga el documento generado por el colegio.</p>
    </header>
    <nav v-if="esAdministrador || esDocente" class="pestanas" aria-label="Secciones de calificaciones">
      <NuxtLink :to="esDocente ? '/docente/calificaciones' : '/calificaciones'">Registro de calificaciones</NuxtLink>
      <span aria-current="page">Libretas e informes</span>
    </nav>
    <section class="tarjeta" aria-labelledby="titulo-consulta">
      <h2 id="titulo-consulta">Consultar libreta</h2>
      <p v-if="esDocente" class="ayuda">
        Solo se consultan tus clases y alumnos. El servidor limita las competencias a las áreas que dictas.
      </p>
      <p v-if="esApoderado" class="ayuda">
        Selecciona a uno de tus hijos y su período académico. Solo se muestran estudiantes vinculados a tu cuenta.
      </p>
      <p v-else-if="!esAdministrador && !esDocente" class="ayuda">
        Ingresa los identificadores de estudiante y periodo proporcionados por el colegio. La consulta está limitada a
        tu propio historial.
      </p>
      <form @submit.prevent="consultar">
        <div class="campos">
          <label v-if="esAdministrador || esDocente || esApoderado"
            >Periodo académico
            <select v-model="periodoId" required :disabled="cargando || descargando">
              <option value="">Selecciona un periodo</option>
              <option v-for="item in periodos" :key="item.id" :value="item.id">{{ item.nombre }}</option>
            </select>
          </label>
          <label v-else
            >Identificador del periodo
            <input v-model.number="periodoId" type="number" min="1" step="1" required :disabled="descargando" />
          </label>
          <label v-if="esAdministrador || esDocente || esApoderado"
            >Estudiante con matrícula confirmada
            <select v-model="estudianteId" required :disabled="!periodoId || cargando || descargando">
              <option value="">Selecciona un estudiante</option>
              <option v-for="item in estudiantesDisponibles" :key="item.id" :value="item.id">{{ item.nombre }}</option>
            </select>
          </label>
          <label v-else
            >Identificador del estudiante
            <input v-model.number="estudianteId" type="number" min="1" step="1" required :disabled="descargando" />
          </label>
        </div>
        <p v-if="cargando" role="status">Cargando opciones…</p>
        <p v-else-if="(esAdministrador || esDocente || esApoderado) && !periodos.length && !errorCatalogos" class="ayuda">
          No hay periodos disponibles para tu cuenta.
        </p>
        <p
          v-else-if="periodoId && (esAdministrador || esDocente || esApoderado) && !estudiantesDisponibles.length && !errorCatalogos"
          class="ayuda"
        >
          No hay estudiantes con matrícula confirmada para este periodo.
        </p>
        <AvisoMensaje v-if="errorCatalogos" :mensaje="errorCatalogos" tipo="error" />
        <button v-if="errorCatalogos" type="button" @click="cargarCatalogos">Reintentar carga</button>
        <button
          class="primario"
          type="submit"
          :disabled="cargando || consultando || descargando || !estudianteId || !periodoId || !!errorCatalogos"
        >
          {{ consultando ? 'Consultando…' : 'Consultar libreta' }}
        </button>
      </form>
    </section>
    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <p v-if="aviso" role="status" class="exito">{{ aviso }}</p>
    <p v-if="consultando" role="status">Consultando las calificaciones…</p>
    <section v-if="libreta" aria-label="Resultado de la consulta" :aria-busy="descargando">
      <div class="tarjeta resumen">
        <div>
          <h2>{{ libreta.estudiante }}</h2>
          <p>Año escolar {{ libreta.anhioEscolar }} · Estudiante #{{ libreta.estudianteId }}</p>
        </div>
        <button class="primario" type="button" :disabled="descargando" @click="descargarPdf">
          {{ descargando ? 'Descargando…' : 'Descargar PDF' }}
        </button>
      </div>
      <p class="ayuda">
        El informe incluye los periodos del año que devuelve el servidor hasta el seleccionado. Una competencia sin nota
        se muestra como «Sin calificación».
      </p>
      <p v-if="!libreta.periodos.length" class="tarjeta">No hay información académica para mostrar.</p>
      <article v-for="periodo in libreta.periodos" :key="periodo.periodoId" class="tarjeta periodo">
        <div class="resumen">
          <h2>{{ periodo.gradoNumero }}.° · Sección {{ periodo.seccion }} · {{ periodo.fechaInicio.slice(0, 4) }}</h2>
          <span class="estado" :class="periodo.actasCerradas ? 'oficial' : 'borrador'">
            {{ periodo.actasCerradas ? 'Actas cerradas · Libreta oficial' : 'Actas abiertas · Informe preliminar' }}
          </span>
        </div>
        <p class="ayuda">
          {{ periodo.fechaInicio }} a {{ periodo.fechaFin
          }}<strong v-if="periodo.periodoId === libreta.periodoSolicitadoId"> · Periodo seleccionado</strong>
        </p>
        <p v-if="!periodo.areas.length">No hay áreas o competencias disponibles para esta consulta.</p>
        <div v-for="area in periodo.areas" :key="area.codigo" class="area">
          <h3>{{ area.nombre }}</h3>
          <div class="tabla-contenedor" tabindex="0" :aria-label="`Notas de ${area.nombre}`">
            <table>
              <thead>
                <tr>
                  <th scope="col">Competencia</th>
                  <th scope="col">Logro</th>
                  <th scope="col">Observación</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="competencia in area.competencias" :key="competencia.codigo">
                  <td>
                    <strong>{{ competencia.codigo }}</strong
                    ><br />{{ competencia.nombre }}
                  </td>
                  <td>
                    <span class="nota">{{ competencia.nota ?? 'Sin calificación' }}</span>
                  </td>
                  <td>{{ competencia.observacion || 'Sin observaciones' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
      <p class="ayuda">Escala de logro: AD — destacado · A — esperado · B — en proceso · C — en inicio.</p>
    </section>
    <p v-else-if="!consultando && !error" class="ayuda">
      Selecciona los datos y pulsa «Consultar libreta» para visualizar el informe.
    </p>
  </main>
</template>

<style scoped>
.libretas {
  max-width: 1400px;
  margin: auto;
  padding: 32px;
  color: #172b42;
}
header {
  margin-bottom: 24px;
}
h1 {
  font-size: 28px;
  margin: 8px 0 12px;
}
h2 {
  font-size: 19px;
  margin: 0 0 12px;
}
h3 {
  font-size: 17px;
}
.ruta,
.ayuda {
  color: #526477;
  font-size: 14px;
  line-height: 1.7;
}
.tarjeta {
  border: 1px solid #e1e6ef;
  border-radius: 14px;
  background: white;
  padding: 24px;
  margin-bottom: 20px;
}
.pestanas {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 0 0 24px;
}
.pestanas a,
.pestanas span {
  padding: 10px 0;
  color: #2444b0;
}
.pestanas span {
  border-bottom: 3px solid #2444b0;
  font-weight: 700;
}
.campos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin: 20px 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-weight: 600;
}
select,
input {
  min-height: 44px;
  width: 100%;
  border: 1px solid #c9d4e5;
  border-radius: 7px;
  padding: 10px;
  background: white;
  color: inherit;
}
button {
  border: 1px solid #c9d4e5;
  border-radius: 7px;
  padding: 12px 18px;
  cursor: pointer;
  min-height: 44px;
}
.primario {
  background: #2444b0;
  color: white;
  font-weight: 600;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.resumen {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.estado {
  padding: 8px 12px;
  border-radius: 20px;
  background: #fff4d9;
  color: #795400;
  font-size: 13px;
}
.oficial,
.exito {
  background: #eaf8ef;
  color: #17623c;
}
.borrador {
  background: #fff4d9;
  color: #795400;
}
.exito {
  padding: 16px;
  border-radius: 8px;
}
.tabla-contenedor {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 640px;
}
th,
td {
  padding: 14px;
  text-align: left;
  border-bottom: 1px solid #e1e6ef;
  vertical-align: top;
}
th {
  background: #f5f7fb;
  font-size: 13px;
}
.nota {
  font-weight: 700;
}
.area + .area {
  margin-top: 28px;
}
@media (max-width: 700px) {
  .libretas {
    padding: 20px 12px;
  }
  .campos {
    grid-template-columns: 1fr;
  }
  .tarjeta {
    padding: 16px;
  }
}
</style>
