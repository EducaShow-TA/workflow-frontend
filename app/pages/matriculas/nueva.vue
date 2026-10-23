<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { EstudianteMatriculable, MatriculaApi } from '~/types/matricula'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useEstudiantesMatriculables } from '~/composables/useEstudiantesMatriculables'
import { useMatriculas } from '~/composables/useMatriculas'
import { obtenerAnhio } from '~/composables/useAnhioEscolar'
import { usePeriodoMatricula } from '~/composables/usePeriodoMatricula'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'

definePageMeta({ middleware: 'autenticacion' })

const { listar } = useEstudiantesMatriculables()
const { listarPorAnhio } = usePeriodosAcademicos()
const { obtenerPeriodoVigente } = usePeriodoMatricula()
const { registrar, confirmar } = useMatriculas()

const estudiantes = ref<EstudianteMatriculable[]>([])
const periodos = ref<PeriodoAcademico[]>([])
const ventanaVigente = ref<Awaited<ReturnType<typeof obtenerPeriodoVigente>>>(null)
const estudianteId = ref<number | null>(null)
const periodoId = ref<number | null>(null)
const matriculaPendiente = ref<MatriculaApi | null>(null)
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
const aviso = ref('')

const anhioMatricula = computed(() => (ventanaVigente.value ? obtenerAnhio(ventanaVigente.value.fechaLimite) : null))
const periodoSeleccionado = computed(() => periodos.value.find((periodo) => periodo.periodoId === periodoId.value))
const estudiantesDisponibles = computed(() => {
  if (!periodoSeleccionado.value) return []

  return estudiantes.value.filter((estudiante) =>
    !estudiante.matriculas.some(
      (matricula) =>
        matricula.periodoId === periodoSeleccionado.value!.periodoId && matricula.estado !== 'RETIRADA',
    ),
  )
})

const estudianteSeleccionado = computed(() =>
  estudiantesDisponibles.value.find((estudiante) => estudiante.estudianteId === estudianteId.value),
)

const vacantesDisponibles = computed(() => periodoSeleccionado.value?.vacantesDisponibles ?? 0)
const capacidadMaxima = computed(() => periodoSeleccionado.value?.vacantesTotales ?? 0)
const matriculados = computed(() => periodoSeleccionado.value?.matriculasActivas ?? 0)
const ocupacion = computed(() =>
  capacidadMaxima.value > 0 ? Math.min(100, Math.round((matriculados.value / capacidadMaxima.value) * 100)) : 0,
)

const estadoCupos = computed(() => {
  if (!periodoSeleccionado.value) return 'sin-datos'
  if (vacantesDisponibles.value === 0) return 'agotado'
  if (vacantesDisponibles.value <= 2) return 'limitado'
  return 'disponible'
})

const etiquetaEstado = computed(() => {
  if (estadoCupos.value === 'agotado') return 'Sin vacantes'
  if (estadoCupos.value === 'limitado') return 'Pocos cupos'
  if (estadoCupos.value === 'disponible') return 'Disponible'
  return 'Sin datos'
})

const mensajeCupos = computed(() => {
  if (!periodoSeleccionado.value) return 'No hay periodos académicos disponibles para seleccionar.'
  if (vacantesDisponibles.value === 0) {
    return 'Esta sección no dispone de vacantes. Selecciona otra sección.'
  }
  if (vacantesDisponibles.value <= 2) {
    return `Sección próxima a completarse. Quedan ${vacantesDisponibles.value} vacantes.`
  }
  return `Hay ${vacantesDisponibles.value} vacantes disponibles en esta sección.`
})

const grados = computed(() => [...new Set(periodos.value.map((periodo) => periodo.numeroGrado))].sort((a, b) => a - b))

const nombreCompleto = (estudiante: EstudianteMatriculable) =>
  [estudiante.nombre, estudiante.apellidoPaterno, estudiante.apellidoMaterno].filter(Boolean).join(' ')

async function cargarDatos(): Promise<void> {
  cargando.value = true
  error.value = ''
  aviso.value = ''

  try {
    const vigente = await obtenerPeriodoVigente()
    ventanaVigente.value = vigente
    if (!vigente) {
      estudiantes.value = []
      periodos.value = []
      estudianteId.value = null
      periodoId.value = null
      return
    }

    const [estudiantesCargados, periodosCargados] = await Promise.all([
      listar(),
      listarPorAnhio(obtenerAnhio(vigente.fechaLimite)),
    ])
    estudiantes.value = estudiantesCargados
    periodos.value = periodosCargados
    periodoId.value =
      periodosCargados.find((periodo) => periodo.vacantesDisponibles > 0)?.periodoId ??
      periodosCargados[0]?.periodoId ??
      null
    estudianteId.value = null
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar estudiantes y vacantes.')
  } finally {
    cargando.value = false
  }
}

async function registrarMatricula(): Promise<void> {
  if (!periodoSeleccionado.value || !estudianteSeleccionado.value || vacantesDisponibles.value < 1) return

  guardando.value = true
  error.value = ''
  aviso.value = ''
  try {
    matriculaPendiente.value = await registrar(periodoSeleccionado.value.periodoId, estudianteSeleccionado.value.estudianteId)
    await cargarDatos()
    aviso.value = 'La matrícula se registró y quedó pendiente de confirmación.'
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo registrar la matrícula.')
  } finally {
    guardando.value = false
  }
}

async function confirmarMatricula(): Promise<void> {
  if (!matriculaPendiente.value) return

  guardando.value = true
  error.value = ''
  try {
    const resultado = await confirmar(matriculaPendiente.value.periodoId, matriculaPendiente.value.estudianteId)
    matriculaPendiente.value = null
    await cargarDatos()
    aviso.value = `Matrícula confirmada correctamente (N.° ${resultado.matriculaId}).`
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'La matrícula quedó registrada, pero no se pudo confirmar.')
  } finally {
    guardando.value = false
  }
}

async function cancelar(): Promise<void> {
  await navigateTo('/matriculas')
}

onMounted(cargarDatos)
</script>

<template>
  <main class="pagina-matricula">
    <header class="encabezado-pagina">
      <div>
        <h1>Crear Matrícula</h1>
        <p>Selecciona un estudiante y consulta la disponibilidad de vacantes.</p>
      </div>
      <span class="etiqueta-anhio">Año escolar {{ anhioMatricula ?? '—' }}</span>
    </header>

    <section class="tarjeta" aria-labelledby="titulo-estudiante">
      <div class="encabezado-tarjeta">
        <h2 id="titulo-estudiante">Información del estudiante</h2>
      </div>

      <div v-if="!cargando" class="contenido-tarjeta">
        <div class="campo">
          <label for="estudiante">Seleccionar estudiante</label>
          <select id="estudiante" v-model="estudianteId" :disabled="estudiantesDisponibles.length === 0">
            <option :value="null" disabled>Selecciona un estudiante</option>
            <option
              v-for="estudiante in estudiantesDisponibles"
              :key="estudiante.estudianteId"
              :value="estudiante.estudianteId"
            >
              {{ nombreCompleto(estudiante) }} — DNI {{ estudiante.dni }}
            </option>
          </select>
        </div>

        <div v-if="estudianteSeleccionado" class="perfil-estudiante">
          <div class="avatar-estudiante avatar-iniciales" aria-hidden="true">
            {{ estudianteSeleccionado.nombre.charAt(0) }}{{ estudianteSeleccionado.apellidoPaterno.charAt(0) }}
          </div>

          <div class="detalle-estudiante">
            <div class="nombre-estudiante">
              <h3>{{ nombreCompleto(estudianteSeleccionado) }}</h3>
              <span class="etiqueta-activo">Registrado</span>
            </div>
            <div class="datos-estudiante">
              <p><strong>Documento:</strong> {{ estudianteSeleccionado.dni }}</p>
              <p><strong>Correo:</strong> {{ estudianteSeleccionado.correo || 'No registrado' }}</p>
            </div>
          </div>
        </div>
        <p v-else-if="estudiantesDisponibles.length" class="aviso-neutral" role="status">
          Selecciona un estudiante para visualizar su información.
        </p>
        <p v-else class="aviso-neutral" role="status">
          {{ estudiantes.length ? 'Todos los estudiantes ya tienen matrícula en este periodo.' : 'No hay estudiantes registrados. Registra un estudiante antes de continuar.' }}
        </p>
      </div>
    </section>

    <section class="tarjeta" aria-labelledby="titulo-parametros">
      <div class="encabezado-tarjeta">
        <h2 id="titulo-parametros">Parámetros de Matrícula</h2>
      </div>

      <div class="contenido-tarjeta">
        <div class="cuadricula-campos">
          <div class="campo">
            <label for="anhio-academico">Año Académico</label>
            <input id="anhio-academico" :value="anhioMatricula ?? ''" type="text" readonly aria-describedby="ayuda-anhio" />
            <small id="ayuda-anhio">Año de la ventana de matrícula vigente.</small>
          </div>
          <div class="campo">
            <label for="grado-matricula">Grado</label>
            <select id="grado-matricula" :value="periodoSeleccionado?.numeroGrado ?? ''" disabled>
              <option v-for="grado in grados" :key="grado" :value="grado">
                {{ grado }}.° de secundaria
              </option>
            </select>
          </div>
          <div class="campo">
            <label for="seccion-matricula">Sección</label>
            <select id="seccion-matricula" v-model.number="periodoId">
              <option v-for="periodo in periodos" :key="periodo.periodoId" :value="periodo.periodoId">
                {{ periodo.numeroGrado }}.° {{ periodo.nivelEducativo }} — Sección {{ periodo.seccion }}
              </option>
            </select>
          </div>
        </div>

        <div class="panel-vacantes">
          <div class="encabezado-vacantes">
            <h3>
              Estado de cupos —
              {{
                periodoSeleccionado
                  ? `${periodoSeleccionado.numeroGrado}.° ${periodoSeleccionado.nivelEducativo}, sección ${periodoSeleccionado.seccion}`
                  : 'sin periodo'
              }}
            </h3>
            <span class="etiqueta-estado" :class="estadoCupos">{{ etiquetaEstado }}</span>
          </div>
          <p class="mensaje-disponibilidad" :class="estadoCupos" role="status" aria-live="polite">
            {{ mensajeCupos }}
          </p>
          <div
            class="barra-progreso"
            role="progressbar"
            :aria-valuenow="ocupacion"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="`Ocupación de ${periodoSeleccionado?.numeroGrado ?? ''}.° ${periodoSeleccionado?.nivelEducativo ?? ''}, sección ${periodoSeleccionado?.seccion ?? ''}`"
          >
            <div class="avance-progreso" :class="estadoCupos" :style="{ width: `${ocupacion}%` }" />
          </div>
          <div class="leyenda-ocupacion">
            <span>Matriculados: {{ matriculados }}</span>
            <span>Máximo: {{ capacidadMaxima }}</span>
          </div>
          <div class="cuadricula-indicadores">
            <div class="indicador">
              <span>Capacidad máxima</span>
              <strong>{{ capacidadMaxima }}</strong>
            </div>
            <div class="indicador">
              <span>Matriculados</span>
              <strong>{{ matriculados }}</strong>
            </div>
            <div class="indicador destacado" :class="estadoCupos">
              <span>Vacantes disponibles</span>
              <strong>{{ vacantesDisponibles }}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>

    <PanelEstadoCarga v-if="cargando" :cargando="true" texto-carga="Cargando estudiantes y vacantes..." />
    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />
    <AvisoMensaje
      v-if="!cargando && !ventanaVigente"
      mensaje="No hay un periodo de matrícula vigente. Configura uno antes de registrar matrículas."
      tipo="advertencia"
    />
    <AvisoMensaje
      v-if="!cargando && ventanaVigente && periodos.length === 0"
      mensaje="No hay periodos académicos abiertos para el año de matrícula vigente."
      tipo="advertencia"
    />

    <div class="acciones-matricula">
      <button type="button" class="boton-cancelar" @click="cancelar">Cancelar</button>
      <button
        type="button"
        class="boton-confirmar"
        :disabled="guardando || !estudianteSeleccionado || !periodoSeleccionado || vacantesDisponibles < 1"
        @click="registrarMatricula"
      >
        {{ guardando ? 'Registrando...' : 'Registrar matrícula' }}
      </button>
      <button
        v-if="matriculaPendiente"
        type="button"
        class="boton-confirmar"
        :disabled="guardando"
        @click="confirmarMatricula"
      >
        {{ guardando ? 'Confirmando...' : 'Confirmar matrícula' }}
      </button>
    </div>
  </main>
</template>

<style scoped>
.pagina-matricula {
  display: flex;
  width: 100%;
  max-width: 1000px;
  flex-direction: column;
  gap: 24px;
  margin: 0 auto;
  padding: 32px;
}
.encabezado-pagina,
.nombre-estudiante,
.encabezado-vacantes,
.leyenda-ocupacion,
.acciones-matricula {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.encabezado-pagina h1 {
  margin: 0 0 6px;
  color: #191c1e;
  font-size: 28px;
}
.encabezado-pagina p,
.datos-estudiante p {
  margin: 0;
  color: #434655;
  font-size: 14px;
}
.etiqueta-anhio {
  padding: 7px 12px;
  border-radius: 20px;
  background: #eef2ff;
  color: #1e40af;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.tarjeta {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}
.encabezado-tarjeta {
  margin: 0 24px;
  padding: 20px 0 16px;
  border-bottom: 1px solid #e5e7eb;
}
.encabezado-tarjeta h2 {
  margin: 0;
  color: #191c1e;
  font-size: 20px;
}
.contenido-tarjeta {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
}
.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}
.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}
.campo select,
.campo input {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font-size: 14px;
}
.campo input[readonly] {
  background: #f2f4f6;
}
.campo small {
  color: #6b7280;
  font-size: 12px;
}
.campo select:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}
.perfil-estudiante {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f7f9fb;
}
.avatar-estudiante {
  display: flex;
  width: 90px;
  height: 90px;
  flex: 0 0 90px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-iniciales {
  background: #dbeafe;
  color: #1e40af;
  font-size: 24px;
  font-weight: 700;
}
.detalle-estudiante {
  min-width: 0;
  flex: 1;
}
.nombre-estudiante {
  justify-content: flex-start;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.nombre-estudiante h3 {
  margin: 0;
  font-size: 20px;
}
.etiqueta-activo {
  padding: 5px 10px;
  border-radius: 20px;
  background: #e8f5e9;
  color: #2e7d32;
  font-size: 12px;
  font-weight: 600;
}
.datos-estudiante {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 20px;
}
.datos-estudiante p {
  overflow-wrap: anywhere;
}
.cuadricula-campos,
.cuadricula-indicadores {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}
.panel-vacantes {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
  border-radius: 10px;
  background: #f2f4f6;
}
.encabezado-vacantes h3 {
  margin: 0;
  color: #191c1e;
  font-size: 16px;
}
.etiqueta-estado {
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.etiqueta-estado.disponible {
  background: #dcfce7;
  color: #166534;
}
.etiqueta-estado.limitado {
  background: #fef3c7;
  color: #92400e;
}
.etiqueta-estado.agotado {
  background: #fee2e2;
  color: #991b1b;
}
.etiqueta-estado.sin-datos {
  background: #e5e7eb;
  color: #374151;
}
.mensaje-disponibilidad {
  margin: 0;
  font-size: 14px;
}
.mensaje-disponibilidad.agotado {
  color: #b91c1c;
}
.mensaje-disponibilidad.limitado {
  color: #92400e;
}
.mensaje-disponibilidad.disponible {
  color: #166534;
}
.barra-progreso {
  height: 12px;
  overflow: hidden;
  border-radius: 20px;
  background: #d1d5db;
}
.avance-progreso {
  height: 100%;
  border-radius: 20px;
  background: #22c55e;
  transition: width 0.2s ease;
}
.avance-progreso.limitado {
  background: #f59e0b;
}
.avance-progreso.agotado {
  background: #dc2626;
}
.leyenda-ocupacion {
  color: #434655;
  font-size: 13px;
}
.indicador {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: white;
}
.indicador span {
  color: #434655;
  font-size: 12px;
}
.indicador strong {
  color: #191c1e;
  font-size: 30px;
}
.indicador.destacado {
  background: #ecfdf5;
}
.indicador.destacado.limitado {
  background: #fffbeb;
}
.indicador.destacado.agotado {
  background: #fef2f2;
}
.aviso-neutral,
.aviso-integracion {
  margin: 0;
  padding: 16px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: #f7f9fb;
  color: #434655;
  font-size: 13px;
  line-height: 1.6;
}
.acciones-matricula {
  justify-content: flex-end;
}
.boton-cancelar,
.boton-confirmar {
  min-height: 42px;
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.boton-cancelar {
  border: 1px solid #c3c6d7;
  background: white;
  color: #434655;
}
.boton-confirmar {
  border: none;
  background: #004ac6;
  color: white;
}
.boton-confirmar:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
@media (max-width: 760px) {
  .cuadricula-campos,
  .cuadricula-indicadores,
  .datos-estudiante {
    grid-template-columns: 1fr;
  }
  .encabezado-pagina,
  .encabezado-vacantes {
    align-items: flex-start;
    flex-direction: column;
  }
  .perfil-estudiante {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 520px) {
  .pagina-matricula {
    padding: 20px 14px;
  }
  .contenido-tarjeta {
    padding: 16px;
  }
  .acciones-matricula {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
