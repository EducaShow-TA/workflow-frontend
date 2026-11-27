<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { SolicitudCompromisoPago } from '~/types/compromisoPago'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useApi } from '~/composables/useApi'
import { useConstanciaMatricula } from '~/composables/useConstanciaMatricula'
import type { MatriculaApi } from '~/types/matricula'

definePageMeta({ middleware: 'autenticacion', layout: 'familia' })

interface MatriculaPendiente {
  estudianteId: number
  estudiante: string
  periodoId: number
  anhioEscolar: number
  gradoNumero: number
  seccion: string
  montoMatricula: number
  montoPension: number
}

const { solicitar } = useApi()
const { descargar: descargarConstanciaPdf } = useConstanciaMatricula()
const pendientes = ref<MatriculaPendiente[]>([])
const seleccionada = ref<MatriculaPendiente | null>(null)
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
const aviso = ref('')
const modalAbierto = ref(false)
const matriculaConfirmadaId = ref<number | null>(null)
const descargandoConstancia = ref(false)
const errorConstancia = ref('')

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    pendientes.value = await solicitar<MatriculaPendiente[]>('/api/v1/apoderados/matriculas/pendientes')
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar las matrículas por confirmar.')
  } finally {
    cargando.value = false
  }
}

function abrirConfirmacion(matricula: MatriculaPendiente): void {
  seleccionada.value = matricula
  modalAbierto.value = true
}

async function confirmar(compromiso: SolicitudCompromisoPago): Promise<void> {
  const actual = seleccionada.value
  if (!actual || guardando.value) return
  guardando.value = true
  error.value = ''
  aviso.value = ''
  errorConstancia.value = ''
  try {
    const resultado = await solicitar<MatriculaApi>(
      `/api/v1/apoderados/matriculas/${actual.periodoId}/${actual.estudianteId}/confirmar`,
      { metodo: 'PATCH', cuerpo: compromiso },
    )
    pendientes.value = pendientes.value.filter(
      (item) => item.estudianteId !== actual.estudianteId || item.periodoId !== actual.periodoId,
    )
    modalAbierto.value = false
    matriculaConfirmadaId.value = resultado.matriculaId
    aviso.value = `Matrícula de ${actual.estudiante} confirmada. Se generó su constancia, el cargo de matrícula y el cronograma de pensiones.`
    seleccionada.value = null
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo confirmar la matrícula.')
  } finally {
    guardando.value = false
  }
}

async function descargarConstancia(): Promise<void> {
  if (matriculaConfirmadaId.value === null) return
  descargandoConstancia.value = true
  errorConstancia.value = ''
  try {
    await descargarConstanciaPdf(matriculaConfirmadaId.value, true)
  } catch (fallo: unknown) {
    errorConstancia.value = obtenerMensajeError(fallo, 'No se pudo descargar la constancia de matrícula.')
  } finally {
    descargandoConstancia.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <main class="matricula-familia">
    <header>
      <h1>Matrícula anual</h1>
      <p>La dirección académica preasigna el grado y la sección; aquí confirmas la renovación anual de tus hijos.</p>
    </header>
    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <p v-if="aviso" role="status" class="exito">{{ aviso }}</p>
    <button
      v-if="matriculaConfirmadaId !== null"
      type="button"
      :disabled="descargandoConstancia"
      @click="descargarConstancia"
    >
      {{ descargandoConstancia ? 'Descargando…' : 'Descargar constancia de matrícula' }}
    </button>
    <AvisoMensaje v-if="errorConstancia" :mensaje="errorConstancia" tipo="error" />
    <p v-if="cargando" role="status">Cargando matrículas…</p>
    <section v-else-if="!pendientes.length" class="vacio">
      No tienes matrículas anuales pendientes de confirmación.
    </section>
    <section v-else class="lista">
      <article v-for="item in pendientes" :key="`${item.periodoId}-${item.estudianteId}`" class="tarjeta">
        <div>
          <h2>{{ item.estudiante }}</h2>
          <p>
            Año escolar {{ item.anhioEscolar }} ·
            {{ formatearSeccionCompleta(item.gradoNumero, item.seccion) }}
          </p>
        </div>
        <button type="button" :disabled="guardando" @click="abrirConfirmacion(item)">Confirmar matrícula</button>
      </article>
    </section>
    <ModalCompromisoPago
      :abierta="modalAbierto"
      :cantidad="1"
      :anhio-escolar="seleccionada?.anhioEscolar ?? new Date().getFullYear()"
      :monto-matricula="seleccionada?.montoMatricula ?? 0"
      :monto-pension="seleccionada?.montoPension ?? 0"
      :destino="
        seleccionada
          ? `${seleccionada.estudiante} · ${formatearSeccionCompleta(seleccionada.gradoNumero, seleccionada.seccion)}`
          : ''
      "
      :procesando="guardando"
      :error="error"
      @confirmar="confirmar"
      @cerrar="modalAbierto = false"
    />
  </main>
</template>

<style scoped>
.matricula-familia { max-width: 1000px; margin: auto; padding: 28px; color: #172b42; }
header { margin-bottom: 20px; }
header p, .tarjeta p { color: #5b6675; }
.lista { display: grid; gap: 14px; }
.tarjeta { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px; border: 1px solid #dfe4eb; border-radius: 12px; background: white; }
.tarjeta h2 { margin: 0 0 8px; font-size: 19px; }
.tarjeta p { margin: 0; }
button { padding: 11px 16px; border: 0; border-radius: 8px; background: #174ea6; color: white; cursor: pointer; font-weight: 700; }
button:disabled { opacity: .6; cursor: not-allowed; }
.vacio { padding: 20px; border-radius: 12px; background: white; }
.exito { color: #187443; }
@media (max-width: 640px) { .matricula-familia { padding: 16px; } .tarjeta { align-items: flex-start; flex-direction: column; } }
</style>
