<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAutenticacionStore } from '~/stores/autenticacion'
import { useLibretas } from '~/composables/useLibretas'
import { useEstudiantesMatriculables } from '~/composables/useEstudiantesMatriculables'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { useMisClases } from '~/composables/useMisClases'
import { useApi } from '~/composables/useApi'
import { useBimestres } from '~/composables/useBimestres'
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
  anhio: number
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
const { listar: listarBimestres } = useBimestres()
const esAdministrador = computed(() => autenticacion.usuario?.rol === 'ADMINISTRADOR')
const esDocente = computed(() => autenticacion.usuario?.rol === 'DOCENTE')
const esApoderado = computed(() => autenticacion.usuario?.rol === 'APODERADO')
const estudiantes = ref<OpcionEstudiante[]>([])
const periodos = ref<OpcionPeriodo[]>([])
const estudianteId = ref<number | ''>('')
const periodoId = ref<number | ''>('')
const bimestreHasta = ref<number | ''>('')
const ultimoBimestreDisponible = ref(0)
const cargando = ref(true)
const consultando = ref(false)
const descargandoBimestre = ref<number | null>(null)
const errorCatalogos = ref('')
const error = ref('')
const aviso = ref('')
const libretas = ref<LibretaNotas[]>([])
const comentarioPeriodo = ref('')
const autorComentario = ref('')
const guardandoComentario = ref(false)
const comentarioError = ref('')
const comentarioAviso = ref('')
const comentariosPorPeriodo = computed(
  () =>
    new Map(
      libretas.value[0]?.periodos.map((periodo) => [
        periodo.periodoId,
        periodo.areas.flatMap((area) =>
          area.competencias.flatMap((competencia) => {
            const comentario = competencia.observacion?.trim()
            return comentario
              ? [
                  {
                    clave: `${area.codigo}:${competencia.codigo}`,
                    area: area.nombre,
                    competencia: competencia.nombre,
                    comentario,
                  },
                ]
              : []
          }),
        ),
      ]),
    ),
)
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
        nombre: conAnhio(
          formatearSeccionCompleta(item.numeroGrado, item.seccion, item.nivelEducativo),
          item.fechaInicio.slice(0, 4),
        ),
        anhio: Number(item.fechaInicio.slice(0, 4)),
      }))
    } else if (esDocente.value) {
      const clases = await listarClases()
      periodos.value = [
        ...new Map(
          clases.map((item) => [
            item.periodoId,
            {
              id: item.periodoId,
              nombre: conAnhio(formatearSeccionCompleta(item.gradoNumero, item.seccionCodigo), item.anhio),
              anhio: item.anhio,
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
      vinculados.forEach((estudiante) =>
        estudiante.periodos.forEach((periodo) => {
          disponibles.set(periodo.periodoId, {
            id: periodo.periodoId,
            nombre: conAnhio(
              formatearSeccionCompleta(periodo.gradoNumero, periodo.seccion),
              periodo.fechaInicio.slice(0, 4),
            ),
            anhio: Number(periodo.fechaInicio.slice(0, 4)),
          })
        }),
      )
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
  bimestreHasta.value = ''
  ultimoBimestreDisponible.value = 0
  libretas.value = []
  if (id === '') return
  const periodoSeleccionado = periodos.value.find((item) => item.id === Number(id))
  if (!periodoSeleccionado) return
  cargando.value = true
  errorCatalogos.value = ''
  try {
    const bimestres = await listarBimestres(periodoSeleccionado.anhio)
    if (turno !== catalogoActual) return
    ultimoBimestreDisponible.value = bimestres
      .filter((item) => item.estado !== 'PROXIMO')
      .reduce((ultimo, item) => Math.max(ultimo, item.numero), 0)
    bimestreHasta.value = ultimoBimestreDisponible.value || ''
  } catch (fallo: unknown) {
    if (turno === catalogoActual)
      errorCatalogos.value = obtenerMensajeError(fallo, 'No se pudo cargar el calendario escolar.')
  } finally {
    if (turno === catalogoActual && !esDocente.value) cargando.value = false
  }
  if (!esDocente.value || turno !== catalogoActual) return
  cargando.value = true
  estudiantes.value = []
  try {
    const alumnos = await listarAlumnos(Number(id))
    if (turno === catalogoActual)
      estudiantes.value = alumnos.map((item) => ({
        id: item.estudianteId,
        nombre: item.nombreCompleto,
        periodos: [Number(id)],
      }))
  } catch (fallo: unknown) {
    if (turno === catalogoActual)
      errorCatalogos.value = obtenerMensajeError(fallo, 'No se pudieron cargar los alumnos.')
  } finally {
    if (turno === catalogoActual) cargando.value = false
  }
})

watch(
  [estudianteId, periodoId, bimestreHasta],
  () => {
    consultaActual++
    consultando.value = false
    libretas.value = []
    comentarioPeriodo.value = ''
    autorComentario.value = ''
    comentarioError.value = ''
    comentarioAviso.value = ''
    error.value = ''
    aviso.value = ''
  },
  { flush: 'sync' },
)

async function consultar(): Promise<void> {
  const maximo = Number(bimestreHasta.value)
  if (!estudianteId.value || !periodoId.value || maximo < 1 || maximo > ultimoBimestreDisponible.value) return
  const turno = ++consultaActual
  libretas.value = []
  error.value = ''
  aviso.value = ''
  consultando.value = true
  try {
    const resultado = await Promise.all(
      Array.from({ length: maximo }, (_, indice) =>
        solicitarLibreta(Number(estudianteId.value), Number(periodoId.value), indice + 1),
      ),
    )
    if (turno === consultaActual) {
      libretas.value = resultado
      const base = resultado[0]
      if (!base) return
      try {
        const comentario = await solicitar<{ comentario: string | null; autorNombre: string | null }>(
          `/api/v1/estudiantes/${base.estudianteId}/libreta/comentario-periodo?periodoId=${base.periodoSolicitadoId}`,
        )
        if (turno === consultaActual) {
          comentarioPeriodo.value = comentario.comentario ?? ''
          autorComentario.value = comentario.autorNombre ?? ''
        }
      } catch (fallo: unknown) {
        if (turno === consultaActual)
          comentarioError.value = obtenerMensajeError(fallo, 'No se pudo cargar el comentario.')
      }
    }
  } catch (fallo: unknown) {
    if (turno === consultaActual) error.value = obtenerMensajeError(fallo, 'No se pudo consultar la libreta.')
  } finally {
    if (turno === consultaActual) consultando.value = false
  }
}

async function descargarPdf(actual: LibretaNotas): Promise<void> {
  if (descargandoBimestre.value !== null) return
  const turno = consultaActual
  descargandoBimestre.value = actual.bimestre
  error.value = ''
  aviso.value = ''
  try {
    const archivo = await descargar(actual.estudianteId, actual.periodoSolicitadoId, actual.bimestre)
    const url = URL.createObjectURL(archivo)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `libreta-estudiante-${actual.estudianteId}-periodo-${actual.periodoSolicitadoId}-bimestre-${actual.bimestre}.pdf`
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    if (turno === consultaActual) aviso.value = 'Se descargó el PDF generado por el colegio.'
  } catch (fallo: unknown) {
    if (turno === consultaActual) error.value = obtenerMensajeError(fallo, 'No se pudo descargar el PDF.')
  } finally {
    descargandoBimestre.value = null
  }
}

async function guardarComentario(): Promise<void> {
  const actual = libretas.value[0]
  if (!actual || !comentarioPeriodo.value.trim() || guardandoComentario.value) return
  guardandoComentario.value = true
  comentarioError.value = ''
  comentarioAviso.value = ''
  try {
    const respuesta = await solicitar<{ comentario: string; autorNombre: string | null }>(
      `/api/v1/estudiantes/${actual.estudianteId}/libreta/comentario-periodo?periodoId=${actual.periodoSolicitadoId}`,
      { metodo: 'PUT', cuerpo: { comentario: comentarioPeriodo.value.trim() } },
    )
    comentarioPeriodo.value = respuesta.comentario
    autorComentario.value = respuesta.autorNombre ?? ''
    comentarioAviso.value = 'Comentario guardado.'
  } catch (fallo: unknown) {
    comentarioError.value = obtenerMensajeError(fallo, 'No se pudo guardar el comentario.')
  } finally {
    guardandoComentario.value = false
  }
}
onMounted(cargarCatalogos)
</script>

<template>
  <main class="libretas" :class="{ 'libretas--docente': esDocente }">
    <NavegacionCalificaciones v-if="esAdministrador" />
    <header v-if="esDocente" class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">Seguimiento académico</span>
        <h1>Libretas e informes de progreso</h1>
        <p>Consulta los avances por área y competencia y descarga el documento generado por el colegio.</p>
      </div>
    </header>
    <header v-else>
      <h1>Libretas e informes de progreso</h1>
      <p>Consulta los avances por área y competencia y descarga el documento generado por el colegio.</p>
    </header>
    <NavegacionCalificaciones v-if="esDocente" :docente="true" />
    <section class="tarjeta" aria-labelledby="titulo-consulta">
      <h2 id="titulo-consulta">Consultar libretas</h2>
      <p v-if="esDocente" class="ayuda">
        Solo puedes consultar los alumnos y las competencias de las clases que tienes asignadas.
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
            >Período
            <select v-model="periodoId" required :disabled="cargando || descargandoBimestre !== null">
              <option value="">Elige un período</option>
              <option v-for="item in periodos" :key="item.id" :value="item.id">{{ item.nombre }}</option>
            </select>
          </label>
          <label v-else
            >Identificador del periodo
            <input
              v-model.number="periodoId"
              type="number"
              min="1"
              step="1"
              required
              :disabled="descargandoBimestre !== null"
            />
          </label>
          <label>
            Mostrar hasta
            <select v-model.number="bimestreHasta" required :disabled="cargando || descargandoBimestre !== null">
              <option value="">Elige un bimestre</option>
              <option v-for="numero in ultimoBimestreDisponible" :key="numero" :value="numero">
                Bimestres 1 al {{ numero }}
              </option>
            </select>
            <small>Se mostrarán juntos desde el primer bimestre hasta el elegido.</small>
          </label>
          <label v-if="esAdministrador || esDocente || esApoderado"
            >Estudiante con matrícula confirmada
            <select v-model="estudianteId" required :disabled="!periodoId || cargando || descargandoBimestre !== null">
              <option value="">Elige un estudiante</option>
              <option v-for="item in estudiantesDisponibles" :key="item.id" :value="item.id">{{ item.nombre }}</option>
            </select>
          </label>
          <label v-else
            >Identificador del estudiante
            <input
              v-model.number="estudianteId"
              type="number"
              min="1"
              step="1"
              required
              :disabled="descargandoBimestre !== null"
            />
          </label>
        </div>
        <p v-if="cargando" role="status">Cargando opciones…</p>
        <p
          v-else-if="(esAdministrador || esDocente || esApoderado) && !periodos.length && !errorCatalogos"
          class="ayuda"
        >
          No hay periodos disponibles para tu cuenta.
        </p>
        <p
          v-else-if="
            periodoId &&
            (esAdministrador || esDocente || esApoderado) &&
            !estudiantesDisponibles.length &&
            !errorCatalogos
          "
          class="ayuda"
        >
          No hay estudiantes con matrícula confirmada para este periodo.
        </p>
        <p v-else-if="periodoId && !ultimoBimestreDisponible && !cargando && !errorCatalogos" class="ayuda">
          Aún no hay bimestres iniciados para este período.
        </p>
        <AvisoMensaje v-if="errorCatalogos" :mensaje="errorCatalogos" tipo="error" />
        <button v-if="errorCatalogos" type="button" @click="cargarCatalogos">Reintentar</button>
        <button
          class="primario"
          type="submit"
          :disabled="
            cargando ||
            consultando ||
            descargandoBimestre !== null ||
            !estudianteId ||
            !periodoId ||
            !bimestreHasta ||
            !!errorCatalogos
          "
        >
          {{ consultando ? 'Consultando…' : 'Ver libretas' }}
        </button>
      </form>
    </section>
    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <p v-if="aviso" role="status" class="exito">{{ aviso }}</p>
    <p v-if="consultando" role="status">Consultando las calificaciones…</p>
    <section v-if="libretas.length" aria-label="Resultados de la consulta">
      <article
        v-for="libreta in libretas"
        :key="libreta.bimestre"
        class="tarjeta resultado-bimestre"
        :aria-busy="descargandoBimestre === libreta.bimestre"
      >
        <div class="resumen">
          <div>
            <h2>{{ libreta.estudiante }} · Bimestre {{ libreta.bimestre }}</h2>
            <p>Año escolar {{ libreta.anhioEscolar }} · Estudiante #{{ libreta.estudianteId }}</p>
          </div>
          <button
            class="primario"
            type="button"
            :disabled="descargandoBimestre !== null"
            @click="descargarPdf(libreta)"
          >
            {{ descargandoBimestre === libreta.bimestre ? 'Descargando…' : `PDF bimestre ${libreta.bimestre}` }}
          </button>
        </div>
        <AvisoMensaje
          v-if="libreta.bimestre === 1 && libreta.evaluacionesSinBimestre > 0"
          :mensaje="`${libreta.evaluacionesSinBimestre} evaluación(es) sin bimestre no aparecen en estas libretas.`"
          tipo="advertencia"
        />
        <p class="ayuda">El logro y las evaluaciones corresponden a este bimestre.</p>
        <p v-if="!libreta.periodos.length" class="tarjeta">No hay información académica para mostrar.</p>
        <article v-for="periodo in libreta.periodos" :key="periodo.periodoId" class="periodo">
          <div class="resumen">
            <h3>
              {{
                conAnhio(
                  formatearSeccionCompleta(periodo.gradoNumero, periodo.seccion),
                  periodo.fechaInicio.slice(0, 4),
                )
              }}
            </h3>
            <span class="estado" :class="periodo.actasCerradas ? 'oficial' : 'borrador'">
              {{ periodo.actasCerradas ? 'Actas cerradas · Oficial' : 'Actas abiertas · Preliminar' }}
            </span>
          </div>
          <p class="ayuda">{{ periodo.fechaInicio }} a {{ periodo.fechaFin }}</p>
          <p v-if="!periodo.areas.length">No hay áreas o competencias para este bimestre.</p>
          <div v-for="area in periodo.areas" :key="area.codigo" class="area">
            <h4>{{ area.nombre }}</h4>
            <div class="tabla-contenedor" tabindex="0" :aria-label="`Notas de ${area.nombre}`">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Competencia</th>
                    <th scope="col">Logro</th>
                    <th scope="col">Evaluaciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="competencia in area.competencias" :key="competencia.codigo">
                    <td>{{ competencia.nombre }}</td>
                    <td>
                      <span class="nota">{{ competencia.nota ?? 'Sin calificación' }}</span>
                      <small v-if="competencia.puntajeConsolidado !== null" class="puntaje">
                        Puntaje: {{ competencia.puntajeConsolidado }}
                      </small>
                    </td>
                    <td>
                      <ul v-if="competencia.evaluaciones.length" class="evaluaciones">
                        <li v-for="evaluacion in competencia.evaluaciones" :key="evaluacion.evaluacionId">
                          <strong>{{ evaluacion.titulo }}</strong> ·
                          {{ evaluacion.justificada ? 'Justificada' : (evaluacion.nota ?? 'Sin calificación') }}
                          · {{ evaluacion.ponderacion }}%
                        </li>
                      </ul>
                      <span v-else>Sin evaluaciones</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </article>
      </article>
      <section v-if="libretas[0]?.periodos[0]" class="tarjeta comentarios" aria-labelledby="comentario-periodo">
        <h3 id="comentario-periodo">Comentario cualitativo del período</h3>
        <template v-if="esDocente || esAdministrador">
          <label for="comentario-docente">Comentario del docente (máximo 2000 caracteres)</label>
          <textarea
            id="comentario-docente"
            v-model="comentarioPeriodo"
            maxlength="2000"
            rows="5"
            :disabled="guardandoComentario"
          />
          <p class="ayuda">
            {{ comentarioPeriodo.length }}/2000 caracteres<span v-if="autorComentario">
              · Última edición: {{ autorComentario }}</span
            >
          </p>
          <button
            class="primario"
            type="button"
            :disabled="guardandoComentario || !comentarioPeriodo.trim()"
            @click="guardarComentario"
          >
            {{ guardandoComentario ? 'Guardando…' : 'Guardar comentario' }}
          </button>
        </template>
        <p v-else-if="comentarioPeriodo" class="comentario-periodo">{{ comentarioPeriodo }}</p>
        <p v-else class="ayuda">No hay un comentario registrado para este período.</p>
        <AvisoMensaje v-if="comentarioError" :mensaje="comentarioError" tipo="error" />
        <p v-if="comentarioAviso" role="status" class="exito">{{ comentarioAviso }}</p>
      </section>
      <section v-if="libretas[0]" class="tarjeta comentarios" aria-label="Comentarios cualitativos">
        <h3>Comentarios de competencias</h3>
        <template v-for="periodo in libretas[0].periodos" :key="periodo.periodoId">
          <ul v-if="comentariosPorPeriodo.get(periodo.periodoId)?.length" class="lista-comentarios">
            <li v-for="item in comentariosPorPeriodo.get(periodo.periodoId)" :key="item.clave">
              <h4>{{ item.area }} · {{ item.competencia }}</h4>
              <p>{{ item.comentario }}</p>
            </li>
          </ul>
        </template>
        <p v-if="!comentariosPorPeriodo.size" class="ayuda">No hay comentarios registrados.</p>
      </section>
      <p class="ayuda">Escala de logro: AD — destacado · A — esperado · B — en proceso · C — en inicio.</p>
    </section>
    <p v-else-if="!consultando && !error" class="ayuda">
      Elige el período, el estudiante y el bimestre hasta el que quieres comparar.
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
.libretas--docente {
  padding: 0;
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
.libretas > :deep(.navegacion-calificaciones) {
  margin-bottom: 24px;
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
textarea {
  min-height: 120px;
  width: 100%;
  border: 1px solid #c9d4e5;
  border-radius: 7px;
  padding: 10px;
  font: inherit;
  resize: vertical;
}
.comentario-periodo {
  white-space: pre-wrap;
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
  min-width: 900px;
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
.puntaje {
  display: block;
  margin-top: 4px;
  color: #526477;
  font-size: 12px;
}
.evaluaciones {
  margin: 0;
  padding-left: 18px;
}
.evaluaciones li + li {
  margin-top: 6px;
}
.area + .area {
  margin-top: 28px;
}
.comentarios {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e1e6ef;
}
.lista-comentarios {
  display: grid;
  gap: 12px;
  padding: 0;
  list-style: none;
}
.lista-comentarios li {
  padding: 12px 16px;
  border-radius: 8px;
  background: #f5f7fb;
}
.lista-comentarios h4 {
  margin: 0 0 6px;
  font-size: 14px;
}
.lista-comentarios p {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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
