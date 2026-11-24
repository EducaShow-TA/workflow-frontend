<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatearFecha, obtenerFechaHoyIso } from '~/composables/useFechas'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { obtenerEtiquetaEstadoBimestre, useBimestres } from '~/composables/useBimestres'
import { usePeriodosAcademicos } from '~/composables/usePeriodosAcademicos'
import { describirFechaSistema, leerFechaHoraSistema, useParametrosSistema } from '~/composables/useParametrosSistema'
import type { BimestreAcademico } from '~/types/bimestre'
import type { PeriodoAcademico } from '~/types/periodoAcademico'
import type { ParametrosSistema } from '~/types/parametrosSistema'

const MOTIVO_MINIMO = 10

const { obtener, simularFecha, volverAFechaReal, configurarPagoEnLinea } = useParametrosSistema()
const { listarPorAnhio } = usePeriodosAcademicos()
const { listar: listarBimestres } = useBimestres()

const parametros = ref<ParametrosSistema | null>(null)
const periodos = ref<PeriodoAcademico[]>([])
const bimestres = ref<BimestreAcademico[]>([])
const cargando = ref(true)
const error = ref('')
const mensajeExito = ref('')
const guardando = ref(false)

const modalFecha = ref(false)
const fechaNueva = ref('')
const horaNueva = ref('')
const motivo = ref('')
const errorModal = ref('')
const intentoGuardar = ref(false)

const fechaSistema = computed(() =>
  parametros.value ? describirFechaSistema(leerFechaHoraSistema(parametros.value.fechaSistema)) : '',
)
const anhioSistema = computed(() => (parametros.value ? Number(parametros.value.fechaSistema.slice(0, 4)) : null))
const simuladaEn = computed(() => {
  const valor = parametros.value?.fechaSimuladaEn
  if (!valor) return ''
  const fecha = leerFechaHoraSistema(valor)
  return `${formatearFecha(obtenerFechaHoyIso(fecha)).slice(0, 5)} ${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`
})
const anhioEscolar = computed(() => {
  if (!periodos.value.length) return null
  const inicio = periodos.value.map((periodo) => periodo.fechaInicio).sort()[0] ?? ''
  const fin =
    periodos.value
      .map((periodo) => periodo.fechaFin)
      .sort()
      .at(-1) ?? ''
  const estados = new Set(periodos.value.map((periodo) => periodo.estado))
  const estado = estados.has('EN_CURSO') ? 'En curso' : estados.has('PLANIFICADO') ? 'Planificado' : 'Finalizado'
  return { inicio, fin, estado }
})
const bimestreVigente = computed(
  () =>
    bimestres.value.find((bimestre) => bimestre.estado === 'EN_CURSO') ??
    bimestres.value.find((bimestre) => bimestre.estado === 'POR_CERRAR'),
)
const descripcionAnhio = computed(() => {
  if (!anhioEscolar.value) return ''
  const clases = `clases del ${formatearFecha(anhioEscolar.value.inicio)} al ${formatearFecha(anhioEscolar.value.fin)}`
  const bimestre = bimestreVigente.value
  return bimestre
    ? `${clases} · bimestre ${bimestre.numero} ${obtenerEtiquetaEstadoBimestre(bimestre.estado).toLowerCase()} (hasta el ${formatearFecha(bimestre.fechaFin).slice(0, 5)}).`
    : `${clases}.`
})
const varianteAnhio = computed(() =>
  anhioEscolar.value?.estado === 'En curso'
    ? 'exito'
    : anhioEscolar.value?.estado === 'Planificado'
      ? 'informacion'
      : 'neutro',
)
const errorMotivo = computed(() =>
  intentoGuardar.value && motivo.value.trim().length < MOTIVO_MINIMO
    ? `Escribe el motivo (al menos ${MOTIVO_MINIMO} caracteres).`
    : '',
)
const errorFecha = computed(() =>
  intentoGuardar.value && (!fechaNueva.value || !horaNueva.value) ? 'Elige la fecha y la hora.' : '',
)

async function cargarAnhio() {
  periodos.value = anhioSistema.value ? await listarPorAnhio(anhioSistema.value) : []
  bimestres.value = periodos.value.length && anhioSistema.value ? await listarBimestres(anhioSistema.value) : []
}

async function cargar() {
  cargando.value = true
  error.value = ''
  try {
    parametros.value = await obtener()
    await cargarAnhio()
  } catch (causa: unknown) {
    error.value = obtenerMensajeError(causa, 'No se pudieron cargar los parámetros del sistema.')
  } finally {
    cargando.value = false
  }
}

function abrirCambioFecha() {
  const actual = parametros.value ? leerFechaHoraSistema(parametros.value.fechaSistema) : new Date()
  fechaNueva.value = obtenerFechaHoyIso(actual)
  horaNueva.value = `${String(actual.getHours()).padStart(2, '0')}:${String(actual.getMinutes()).padStart(2, '0')}`
  motivo.value = ''
  errorModal.value = ''
  intentoGuardar.value = false
  modalFecha.value = true
}

async function guardarFecha() {
  intentoGuardar.value = true
  if (errorFecha.value || errorMotivo.value) return
  guardando.value = true
  errorModal.value = ''
  try {
    parametros.value = await simularFecha({
      fecha: `${fechaNueva.value}T${horaNueva.value}:00`,
      motivo: motivo.value.trim(),
    })
    modalFecha.value = false
    mensajeExito.value = 'El sistema ahora trabaja con la fecha simulada.'
    await cargarAnhio()
  } catch (causa: unknown) {
    errorModal.value = obtenerMensajeError(causa, 'No se pudo cambiar la fecha del sistema.')
  } finally {
    guardando.value = false
  }
}

async function usarFechaReal() {
  guardando.value = true
  error.value = ''
  try {
    parametros.value = await volverAFechaReal()
    mensajeExito.value = 'El sistema volvió a la fecha real.'
    await cargarAnhio()
  } catch (causa: unknown) {
    error.value = obtenerMensajeError(causa, 'No se pudo volver a la fecha real.')
  } finally {
    guardando.value = false
  }
}

async function cambiarPago(activo: boolean) {
  guardando.value = true
  error.value = ''
  try {
    parametros.value = await configurarPagoEnLinea(activo)
    mensajeExito.value = activo
      ? 'Los apoderados ya pueden pagar en línea.'
      : 'El pago en línea quedó desactivado para los apoderados.'
  } catch (causa: unknown) {
    error.value = obtenerMensajeError(causa, 'No se pudo cambiar el pago en línea.')
  } finally {
    guardando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <main class="pagina-parametros">
    <EncabezadoPagina
      titulo="Parámetros del sistema"
      descripcion="Fecha del sistema, pago en línea y resumen del año escolar."
    />

    <AvisoMensaje v-if="mensajeExito" :mensaje="mensajeExito" tipo="exito" cerrable @cerrar="mensajeExito = ''" />
    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <PanelEstadoCarga v-if="cargando" :cargando="cargando" texto-carga="Cargando parámetros del sistema..." />

    <template v-else-if="parametros">
      <section class="tarjeta" aria-labelledby="titulo-fecha">
        <div class="encabezado-tarjeta">
          <h2 id="titulo-fecha">Fecha del sistema</h2>
        </div>
        <div class="contenido-tarjeta">
          <div class="situacion">
            <InsigniaEstado
              :texto="parametros.fechaSimulada ? 'Simulada' : 'Real'"
              :variante="parametros.fechaSimulada ? 'advertencia' : 'exito'"
            />
            <p v-if="parametros.fechaSimulada">
              El sistema trabaja con el <strong>{{ fechaSistema }}</strong>. Simulada desde el {{ simuladaEn }} (hora
              real) por {{ parametros.fechaSimuladaPor }} · motivo: “{{ parametros.motivoFecha }}”.
            </p>
            <p v-else>
              El sistema trabaja con la fecha real: <strong>{{ fechaSistema }}</strong>.
            </p>
          </div>
          <template v-if="parametros.fechaSimuladaPermitida">
            <p class="nota">
              Afecta al bimestre en curso, la ventana de marcaje, los plazos de tareas, las boletas y la mora. La
              auditoría sigue con la hora real y registra cada cambio de fecha.
            </p>
            <div class="acciones">
              <BotonAccion :deshabilitado="guardando" @click="abrirCambioFecha">Cambiar fecha</BotonAccion>
              <BotonAccion
                v-if="parametros.fechaSimulada"
                variante="secundario"
                :deshabilitado="guardando"
                @click="usarFechaReal"
              >
                Volver a la fecha real
              </BotonAccion>
            </div>
          </template>
          <p v-else class="nota">
            Este servidor no permite simular la fecha. Para una demostración se habilita con la variable
            DEMO_FECHA_PERMITIDA=true en el servidor.
          </p>
        </div>
      </section>

      <section class="tarjeta" aria-labelledby="titulo-anio">
        <div class="encabezado-tarjeta encabezado-tarjeta--acciones">
          <h2 id="titulo-anio">Año escolar</h2>
          <BotonAccion variante="secundario" destino="/secciones">Ir a Grados/Secciones</BotonAccion>
        </div>
        <div class="contenido-tarjeta">
          <div v-if="anhioEscolar" class="situacion">
            <InsigniaEstado :texto="anhioEscolar.estado" :variante="varianteAnhio" />
            <p>
              <strong>{{ anhioSistema }}</strong>: {{ descripcionAnhio }} Las fechas, los bimestres y su cierre se
              gestionan en Grados/Secciones, junto a los días no lectivos.
            </p>
          </div>
          <p v-else class="nota">
            El año escolar {{ anhioSistema }} todavía no está abierto. Ábrelo desde Grados/Secciones.
          </p>
        </div>
      </section>

      <section class="tarjeta" aria-labelledby="titulo-pago">
        <div class="encabezado-tarjeta encabezado-tarjeta--acciones">
          <h2 id="titulo-pago">Pago en línea (simulado)</h2>
          <div class="interruptor">
            <span
              >{{
                parametros.pagoEnLineaPermitido && parametros.pagoEnLineaActivo ? 'Disponible' : 'No disponible'
              }}
              para los apoderados</span
            >
            <InterruptorEstado
              :activo="parametros.pagoEnLineaPermitido && parametros.pagoEnLineaActivo"
              etiqueta="Disponible para los apoderados"
              :motivo="parametros.pagoEnLineaPermitido ? '' : 'Bloqueado por el servidor'"
              :procesando="guardando"
              @cambiar="cambiarPago"
            />
          </div>
        </div>
        <div class="contenido-tarjeta">
          <div class="situacion">
            <InsigniaEstado
              :texto="parametros.pagoEnLineaPermitido ? 'Permitido por el servidor' : 'Bloqueado por el servidor'"
              :variante="parametros.pagoEnLineaPermitido ? 'exito' : 'neutro'"
            />
            <p v-if="parametros.pagoEnLineaPermitido">
              Cuando está desactivado, los apoderados ven un aviso y pagan en la tesorería del colegio. Es un cobro
              simulado: los datos de la tarjeta no salen del navegador.
            </p>
            <p v-else>
              Este servidor no permite el pago simulado. Se habilita con la variable PAGOS_SIMULADO_ENABLED=true en el
              servidor.
            </p>
          </div>
        </div>
      </section>
    </template>

    <VentanaModal
      :abierta="modalFecha"
      titulo="Cambiar fecha del sistema"
      descripcion="Solo para la demostración"
      :bloqueada="guardando"
      @cerrar="modalFecha = false"
    >
      <form id="formulario-fecha-sistema" class="formulario" novalidate @submit.prevent="guardarFecha">
        <div class="dos-columnas">
          <div class="campo">
            <label for="fecha-sistema">Fecha <span class="obligatorio">*</span></label>
            <input id="fecha-sistema" v-model="fechaNueva" type="date" />
          </div>
          <div class="campo">
            <label for="hora-sistema">Hora <span class="obligatorio">*</span></label>
            <input id="hora-sistema" v-model="horaNueva" type="time" />
          </div>
        </div>
        <p v-if="errorFecha" class="error-campo">{{ errorFecha }}</p>
        <div class="campo">
          <label for="motivo-fecha">Motivo <span class="obligatorio">*</span></label>
          <textarea
            id="motivo-fecha"
            v-model="motivo"
            rows="2"
            maxlength="300"
            placeholder="Ej.: Demostración del cierre del bimestre 1"
          />
          <p v-if="errorMotivo" class="error-campo">{{ errorMotivo }}</p>
        </div>
        <AvisoMensaje
          tipo="advertencia"
          mensaje="Todo el sistema trabajará con esta fecha: bimestre en curso, ventana de marcaje, plazos de tareas, boletas y mora. Lo que se registre quedará con esta fecha aunque luego vuelvas a la real. El cambio queda en la auditoría con la hora real."
        />
        <AvisoMensaje v-if="errorModal" :mensaje="errorModal" tipo="error" />
      </form>
      <template #pie>
        <BotonAccion variante="secundario" :deshabilitado="guardando" @click="modalFecha = false">Cancelar</BotonAccion>
        <BotonAccion tipo="submit" form="formulario-fecha-sistema" :deshabilitado="guardando">
          {{ guardando ? 'Guardando...' : 'Usar esta fecha' }}
        </BotonAccion>
      </template>
    </VentanaModal>
  </main>
</template>

<style scoped>
.pagina-parametros {
  display: flex;
  width: 100%;
  max-width: 1000px;
  flex-direction: column;
  gap: 24px;
  margin: 0 auto;
  padding: 32px;
}

.tarjeta {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tarjeta--reservada {
  border-style: dashed;
  background: #f8fafc;
}

.encabezado-tarjeta {
  margin: 0 24px;
  padding: 20px 0 16px;
  border-bottom: 1px solid #e5e7eb;
}

.encabezado-tarjeta--acciones {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.encabezado-tarjeta h2 {
  margin: 0;
  color: #191c1e;
  font-size: 20px;
}

.contenido-tarjeta {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
}

.situacion {
  display: flex;
  align-items: center;
  gap: 16px;
}

.situacion p,
.nota {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.6;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.interruptor {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dos-columnas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.campo {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo input,
.campo textarea {
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
}

.error-campo {
  margin: 0;
  color: #b91c1c;
  font-size: 13px;
}

.obligatorio {
  color: #b91c1c;
}
</style>
