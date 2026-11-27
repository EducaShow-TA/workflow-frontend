<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { obtenerAnhio, obtenerAnhiosAbiertos } from '~/composables/useAnhioEscolar'
import { formatearMomentoCierre, nombrePeriodo, ordenarPeriodos, useCierreActas } from '~/composables/useCierreActas'
import { formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import type { CierreActas } from '~/types/cierreActas'
import type { PeriodoAcademico } from '~/types/periodoAcademico'

definePageMeta({ middleware: 'autenticacion' })

const TODOS_LOS_GRADOS = 0

const { listar: listarPeriodos } = usePeriodosAcademicos()
const { consultar, cerrar } = useCierreActas()

const fechaHoy = obtenerFechaHoyIso()
const periodos = ref<PeriodoAcademico[]>([])
const estados = ref<Record<number, CierreActas>>({})
const erroresEstado = ref<Record<number, string>>({})
const anhio = ref<number | ''>('')
const grado = ref(TODOS_LOS_GRADOS)
const cargando = ref(true)
const cargandoEstados = ref(false)
const error = ref('')
const aviso = ref('')

const periodoACerrar = ref<PeriodoAcademico | null>(null)
const confirmado = ref(false)
const cerrando = ref(false)
const errorCierre = ref('')

const anhios = computed(() => obtenerAnhiosAbiertos(periodos.value))
const periodosDelAnhio = computed(() =>
  ordenarPeriodos(periodos.value.filter((periodo) => obtenerAnhio(periodo.fechaInicio) === anhio.value)),
)
const grados = computed(() => {
  const mapa = new Map<number, string>()
  for (const periodo of periodosDelAnhio.value) {
    mapa.set(periodo.numeroGrado, formatearGrado(periodo.numeroGrado, periodo.nivelEducativo))
  }
  return [...mapa.entries()].map(([numero, nombre]) => ({ numero, nombre }))
})
const periodosVisibles = computed(() =>
  grado.value === TODOS_LOS_GRADOS
    ? periodosDelAnhio.value
    : periodosDelAnhio.value.filter((periodo) => periodo.numeroGrado === grado.value),
)
const cerradas = computed(
  () => periodosVisibles.value.filter((periodo) => estados.value[periodo.periodoId]?.actasCerradas).length,
)
const resumen = computed(() => {
  if (!periodosVisibles.value.length) return ''
  const total = periodosVisibles.value.length
  const ambito = grado.value === TODOS_LOS_GRADOS ? 'En el año' : `En ${formatearGrado(Number(grado.value))}`
  return `${ambito}: ${cerradas.value} de ${total} ${total === 1 ? 'sección' : 'secciones'} con actas cerradas.`
})
const clasesEnCurso = computed(() => (periodoACerrar.value ? fechaHoy <= periodoACerrar.value.fechaFin : false))

function elegirAnhioInicial(): void {
  const actual = obtenerAnhio(fechaHoy)
  anhio.value = anhios.value.includes(actual) ? actual : (anhios.value[0] ?? '')
}

function elegirGradoInicial(): void {
  grado.value = TODOS_LOS_GRADOS
}

async function cargarPeriodos(): Promise<void> {
  cargando.value = true
  error.value = ''

  try {
    periodos.value = await listarPeriodos()
    elegirAnhioInicial()
    elegirGradoInicial()
    await cargarEstados()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar las secciones del año escolar.')
  } finally {
    cargando.value = false
  }
}

async function cargarEstados(): Promise<void> {
  const pendientes = periodosVisibles.value.filter((periodo) => !estados.value[periodo.periodoId])
  if (!pendientes.length) return

  cargandoEstados.value = true
  await Promise.all(
    pendientes.map(async (periodo) => {
      try {
        estados.value[periodo.periodoId] = await consultar(periodo.periodoId)
        erroresEstado.value[periodo.periodoId] = ''
      } catch (fallo: unknown) {
        erroresEstado.value[periodo.periodoId] = obtenerMensajeError(fallo, 'No se pudo consultar.')
      }
    }),
  )
  cargandoEstados.value = false
}

function abrirCierre(periodo: PeriodoAcademico): void {
  periodoACerrar.value = periodo
  confirmado.value = false
  errorCierre.value = ''
  aviso.value = ''
}

function cancelarCierre(): void {
  if (cerrando.value) return
  periodoACerrar.value = null
}

async function confirmarCierre(): Promise<void> {
  const periodo = periodoACerrar.value
  if (!periodo || !confirmado.value) return

  cerrando.value = true
  errorCierre.value = ''

  try {
    estados.value[periodo.periodoId] = await cerrar(periodo.periodoId)
    aviso.value = `Se cerraron las actas de ${nombrePeriodo(periodo)}. Las libretas de la sección ya son oficiales.`
    periodoACerrar.value = null
  } catch (fallo: unknown) {
    errorCierre.value = obtenerMensajeError(fallo, 'No se pudieron cerrar las actas.')
    try {
      estados.value[periodo.periodoId] = await consultar(periodo.periodoId)
    } catch {
      /* se conserva el estado anterior */
    }
  } finally {
    cerrando.value = false
  }
}

watch(anhio, () => {
  elegirGradoInicial()
})

watch(periodosVisibles, () => {
  void cargarEstados()
})

onMounted(cargarPeriodos)
</script>

<template>
  <main class="pagina-cierre">
    <NavegacionCalificaciones />

    <EncabezadoPagina
      titulo="Cierre de actas"
      descripcion="Cierra las actas de una sección cuando sus notas del año estén completas. Al cerrarlas, las notas quedan finales y las libretas pasan a ser oficiales."
    />

    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" cerrable @cerrar="aviso = ''" />

    <section class="tarjeta" aria-label="Secciones y estado de sus actas">
      <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargarPeriodos" />

      <p v-else-if="!anhios.length" class="vacio">Aún no hay años escolares abiertos.</p>

      <template v-else>
        <div class="filtros">
          <div class="campo">
            <label for="filtro-anhio">Año escolar</label>
            <select id="filtro-anhio" v-model.number="anhio">
              <option v-for="opcion in anhios" :key="opcion" :value="opcion">{{ opcion }}</option>
            </select>
          </div>
          <div class="campo">
            <label for="filtro-grado">Grado</label>
            <select id="filtro-grado" v-model.number="grado">
              <option v-for="opcion in grados" :key="opcion.numero" :value="opcion.numero">{{ opcion.nombre }}</option>
              <option :value="TODOS_LOS_GRADOS">Todos los grados</option>
            </select>
          </div>
          <p class="resumen" role="status">{{ cargandoEstados ? 'Consultando el estado de las actas…' : resumen }}</p>
        </div>

        <div class="tabla-desplazable">
          <table>
            <thead>
              <tr>
                <th scope="col">Sección</th>
                <th scope="col" class="columna-clases">Clases</th>
                <th scope="col">Actas</th>
                <th scope="col"><span class="solo-lectores">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="periodo in periodosVisibles" :key="periodo.periodoId">
                <td class="seccion">{{ nombrePeriodo(periodo) }}</td>
                <td class="columna-clases secundario">
                  {{ formatearFecha(periodo.fechaInicio) }} – {{ formatearFecha(periodo.fechaFin) }}
                </td>
                <td>
                  <template v-if="estados[periodo.periodoId]?.actasCerradas">
                    <InsigniaEstado texto="Cerradas" variante="exito" />
                    <small class="detalle">
                      {{ formatearMomentoCierre(estados[periodo.periodoId]?.fechaCierre ?? null) }}
                      <template v-if="estados[periodo.periodoId]?.usuario">
                        · {{ estados[periodo.periodoId]?.usuario }}
                      </template>
                    </small>
                  </template>
                  <InsigniaEstado v-else-if="estados[periodo.periodoId]" texto="Abiertas" variante="advertencia" />
                  <small v-else-if="erroresEstado[periodo.periodoId]" class="error">
                    {{ erroresEstado[periodo.periodoId] }}
                  </small>
                  <small v-else class="secundario">Consultando…</small>
                </td>
                <td class="accion">
                  <button
                    v-if="estados[periodo.periodoId] && !estados[periodo.periodoId]?.actasCerradas"
                    type="button"
                    class="boton-peligro"
                    @click="abrirCierre(periodo)"
                  >
                    Cerrar actas
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <VentanaModal
      :abierta="periodoACerrar !== null"
      :titulo="periodoACerrar ? `Cerrar actas de ${nombrePeriodo(periodoACerrar)} (${anhio})` : ''"
      descripcion="Esta acción no se puede deshacer."
      :bloqueada="cerrando"
      @cerrar="cancelarCierre"
    >
      <div v-if="periodoACerrar" class="contenido-cierre">
        <AvisoMensaje
          tipo="error"
          mensaje="Las notas que falten se registrarán como C. Toda evaluación sin nota de un estudiante con matrícula confirmada se completa con C y entra al cálculo final. Las notas justificadas no se tocan."
        />

        <p>Además, al cerrar las actas:</p>
        <ul>
          <li>Se calcula la nota final de cada competencia con las reglas de consolidación.</li>
          <li>
            Nadie, ni docentes ni administradores, podrá registrar, cambiar o eliminar notas o evaluaciones de esta
            sección.
          </li>
          <li>Las libretas de sus estudiantes pasan a ser <strong>oficiales</strong>.</li>
        </ul>

        <AvisoMensaje
          v-if="clasesEnCurso"
          tipo="advertencia"
          :mensaje="`Las clases de esta sección terminan el ${formatearFecha(periodoACerrar.fechaFin)}. Si cierras antes, las notas que aún no se registren quedarán como C.`"
        />

        <p class="secundario">
          Antes de cerrar, confirma con los docentes de la sección que registraron todas sus notas.
        </p>

        <label class="confirmacion">
          <input v-model="confirmado" type="checkbox" :disabled="cerrando" />
          Confirmé con los docentes y entiendo que las notas faltantes quedarán como C y que no se puede reabrir.
        </label>

        <AvisoMensaje v-if="errorCierre" :mensaje="errorCierre" tipo="error" />
      </div>

      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="cerrando" @click="cancelarCierre">Cancelar</BotonAccion>
        <button type="button" class="boton-peligro" :disabled="!confirmado || cerrando" @click="confirmarCierre">
          {{ cerrando ? 'Cerrando…' : 'Cerrar actas' }}
        </button>
      </template>
    </VentanaModal>
  </main>
</template>

<style scoped>
.pagina-cierre {
  display: flex;
  width: 100%;
  max-width: 1100px;
  flex-direction: column;
  gap: 20px;
  margin: 0 auto;
  padding: 32px;
}

.tarjeta {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.campo {
  display: flex;
  min-width: 180px;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo select {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
}

.resumen {
  margin: 0 0 12px;
  color: #434655;
  font-size: 14px;
}

.vacio {
  margin: 0;
  padding: 24px 20px;
  color: #434655;
}

.tabla-desplazable {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th,
td {
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: middle;
}

th {
  color: #434655;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

tbody tr:last-child td {
  border-bottom: 0;
}

.seccion {
  font-weight: 600;
}

.secundario {
  color: #434655;
}

.detalle {
  display: block;
  margin-top: 4px;
  color: #434655;
  font-size: 12px;
}

.error {
  color: #dc2626;
  font-size: 12px;
}

.accion {
  text-align: right;
}

.boton-peligro {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  padding: 10px 18px;
  border: 0;
  border-radius: 8px;
  background: #dc2626;
  color: white;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.boton-peligro:hover:not(:disabled) {
  background: #b91c1c;
}

.boton-peligro:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.boton-peligro:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.contenido-cierre {
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #191c1e;
  font-size: 14px;
  line-height: 1.5;
}

.contenido-cierre p,
.contenido-cierre ul {
  margin: 0;
}

.contenido-cierre ul {
  padding-left: 20px;
}

.confirmacion {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-weight: 600;
}

.confirmacion input {
  width: 18px;
  height: 18px;
  flex: none;
  margin-top: 2px;
}

.solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .pagina-cierre {
    padding: 20px 16px;
  }

  .campo {
    min-width: 0;
    flex: 1 1 140px;
  }

  .columna-clases {
    display: none;
  }

  th,
  td {
    padding: 10px 12px;
  }
}
</style>
