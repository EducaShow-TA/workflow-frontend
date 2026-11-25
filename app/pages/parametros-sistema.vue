<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
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
const pasoFecha = ref<1 | 2>(1)
const fechaNueva = ref('')
const horaNueva = ref('')
const motivo = ref('')
const contrasenia = ref('')
const campoContrasenia = ref<HTMLInputElement | null>(null)
const errorModal = ref('')
const intentoGuardar = ref(false)
const intentoConfirmar = ref(false)
const bimestreDestino = ref<BimestreAcademico | null>(null)

const confirmandoFechaReal = ref(false)
const errorFechaReal = ref('')

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
const errorFecha = computed(() => {
  if (!intentoGuardar.value) return ''
  if (!fechaNueva.value || !horaNueva.value) return 'Elige la fecha y la hora.'
  const anhio = Number(fechaNueva.value.slice(0, 4))
  return anhio < 2020 || anhio > 2100 ? 'Elige una fecha entre 2020 y 2100.' : ''
})
const errorContrasenia = computed(() =>
  intentoConfirmar.value && !contrasenia.value ? 'Escribe tu contraseña para confirmar el cambio.' : '',
)

function formatearFechaHora(fecha: Date): string {
  const hora = `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`
  return `${formatearFecha(obtenerFechaHoyIso(fecha))} ${hora}`
}

function contarDias(desde: Date, hasta: Date): number {
  const inicio = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate())
  const fin = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate())
  return Math.round((fin - inicio) / 86_400_000)
}

const fechaActual = computed(() => (parametros.value ? leerFechaHoraSistema(parametros.value.fechaSistema) : null))
const fechaDestino = computed(() =>
  fechaNueva.value && horaNueva.value ? leerFechaHoraSistema(`${fechaNueva.value}T${horaNueva.value}:00`) : null,
)
const diferenciaFecha = computed(() => {
  if (!fechaActual.value || !fechaDestino.value) return ''
  const dias = contarDias(fechaActual.value, fechaDestino.value)
  if (dias === 0) return 'Mismo día: solo cambia la hora'
  const cantidad = `${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
  return dias > 0 ? `Avanza ${cantidad}` : `Retrocede ${cantidad}`
})
const textoBimestreDestino = computed(() => {
  const bimestre = bimestreDestino.value
  return bimestre
    ? `El bimestre en curso pasa a ser el bimestre ${bimestre.numero} (del ${formatearFecha(bimestre.fechaInicio).slice(0, 5)} al ${formatearFecha(bimestre.fechaFin).slice(0, 5)}).`
    : 'La fecha no cae dentro de un bimestre de clases (vacaciones o año escolar sin calendario).'
})
const mensajeFechaReal = computed(() => {
  const simulada = fechaActual.value ? formatearFechaHora(fechaActual.value) : ''
  return `El sistema pasará de la fecha simulada (${simulada}) a la fecha real (${formatearFechaHora(new Date())}). Lo registrado con la fecha simulada se mantiene y el cambio queda en la auditoría.`
})

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
  contrasenia.value = ''
  errorModal.value = ''
  intentoGuardar.value = false
  intentoConfirmar.value = false
  pasoFecha.value = 1
  modalFecha.value = true
}

function cerrarCambioFecha() {
  modalFecha.value = false
  contrasenia.value = ''
}

async function continuarCambioFecha() {
  intentoGuardar.value = true
  if (errorFecha.value || errorMotivo.value) return
  guardando.value = true
  errorModal.value = ''
  try {
    const lista = await listarBimestres(Number(fechaNueva.value.slice(0, 4)))
    bimestreDestino.value =
      lista.find((bimestre) => bimestre.fechaInicio <= fechaNueva.value && fechaNueva.value <= bimestre.fechaFin) ??
      null
  } catch {
    bimestreDestino.value = null
  } finally {
    guardando.value = false
  }
  contrasenia.value = ''
  intentoConfirmar.value = false
  pasoFecha.value = 2
  await nextTick()
  campoContrasenia.value?.focus()
}

function volverAlPasoUno() {
  contrasenia.value = ''
  errorModal.value = ''
  pasoFecha.value = 1
}

async function guardarFecha() {
  intentoConfirmar.value = true
  if (errorContrasenia.value) return
  guardando.value = true
  errorModal.value = ''
  try {
    parametros.value = await simularFecha({
      fecha: `${fechaNueva.value}T${horaNueva.value}:00`,
      motivo: motivo.value.trim(),
      contrasenia: contrasenia.value,
    })
    cerrarCambioFecha()
    mensajeExito.value = 'El sistema ahora trabaja con la fecha simulada.'
    await cargarAnhio()
  } catch (causa: unknown) {
    errorModal.value = obtenerMensajeError(causa, 'No se pudo cambiar la fecha del sistema.')
    contrasenia.value = ''
    intentoConfirmar.value = false
    await nextTick()
    campoContrasenia.value?.focus()
  } finally {
    guardando.value = false
  }
}

function pedirFechaReal() {
  errorFechaReal.value = ''
  confirmandoFechaReal.value = true
}

async function usarFechaReal() {
  guardando.value = true
  errorFechaReal.value = ''
  try {
    parametros.value = await volverAFechaReal()
    confirmandoFechaReal.value = false
    mensajeExito.value = 'El sistema volvió a la fecha real.'
    await cargarAnhio()
  } catch (causa: unknown) {
    errorFechaReal.value = obtenerMensajeError(causa, 'No se pudo volver a la fecha real.')
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
                @click="pedirFechaReal"
              >
                Volver a la fecha real
              </BotonAccion>
            </div>
          </template>
          <p v-else class="nota">
            La fecha simulada está desactivada en este servidor (variable DEMO_FECHA_PERMITIDA=false). Para usarla,
            quita esa variable o cámbiala a true.
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
              El pago simulado está desactivado en este servidor (variable PAGOS_SIMULADO_ENABLED=false). Para usarlo,
              quita esa variable o cámbiala a true.
            </p>
          </div>
        </div>
      </section>
    </template>

    <VentanaModal
      :abierta="modalFecha"
      :titulo="pasoFecha === 1 ? 'Cambiar fecha del sistema' : 'Confirma el cambio de fecha'"
      :descripcion="pasoFecha === 1 ? 'Paso 1 de 2 · Solo para la demostración' : 'Paso 2 de 2'"
      :bloqueada="guardando"
      @cerrar="cerrarCambioFecha"
    >
      <form
        v-if="pasoFecha === 1"
        id="formulario-fecha-sistema"
        class="formulario"
        novalidate
        @submit.prevent="continuarCambioFecha"
      >
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
      <form v-else id="confirmacion-fecha-sistema" class="formulario" novalidate @submit.prevent="guardarFecha">
        <div class="cambio-fecha">
          <div>
            <small>Fecha actual</small>
            <strong>{{ fechaActual ? formatearFechaHora(fechaActual) : '' }}</strong>
          </div>
          <span class="flecha" aria-hidden="true">→</span>
          <div>
            <small>Nueva fecha</small>
            <strong>{{ fechaDestino ? formatearFechaHora(fechaDestino) : '' }}</strong>
          </div>
        </div>
        <div>
          <InsigniaEstado :texto="diferenciaFecha" variante="advertencia" />
        </div>
        <div>
          <p class="nota">Al confirmar:</p>
          <ul class="consecuencias">
            <li>{{ textoBimestreDestino }}</li>
            <li>Asistencias, notas, tareas y pagos que se registren quedarán con esta fecha.</li>
            <li>Todos los usuarios verán el aviso de fecha simulada.</li>
          </ul>
        </div>
        <div class="campo">
          <label for="contrasenia-fecha">Tu contraseña de administrador <span class="obligatorio">*</span></label>
          <input
            id="contrasenia-fecha"
            ref="campoContrasenia"
            v-model="contrasenia"
            type="password"
            autocomplete="current-password"
          />
          <p v-if="errorContrasenia" class="error-campo">{{ errorContrasenia }}</p>
        </div>
        <AvisoMensaje v-if="errorModal" :mensaje="errorModal" tipo="error" />
      </form>
      <template #pie>
        <template v-if="pasoFecha === 1">
          <BotonAccion variante="secundario" :deshabilitado="guardando" @click="cerrarCambioFecha"
            >Cancelar</BotonAccion
          >
          <BotonAccion tipo="submit" form="formulario-fecha-sistema" :deshabilitado="guardando">
            {{ guardando ? 'Revisando...' : 'Continuar' }}
          </BotonAccion>
        </template>
        <template v-else>
          <BotonAccion variante="secundario" :deshabilitado="guardando" @click="volverAlPasoUno">Atrás</BotonAccion>
          <BotonAccion tipo="submit" form="confirmacion-fecha-sistema" :deshabilitado="guardando">
            {{ guardando ? 'Guardando...' : 'Confirmar y usar esta fecha' }}
          </BotonAccion>
        </template>
      </template>
    </VentanaModal>

    <VentanaConfirmacion
      :abierta="confirmandoFechaReal"
      titulo="¿Volver a la fecha real?"
      :mensaje="mensajeFechaReal"
      texto-confirmar="Volver a la fecha real"
      :procesando="guardando"
      :error="errorFechaReal"
      @confirmar="usarFechaReal"
      @cancelar="confirmandoFechaReal = false"
    />
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

.cambio-fecha {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  padding: 14px;
  border-radius: 10px;
  background: #f2f4f6;
  text-align: center;
}

.cambio-fecha small {
  display: block;
  color: #434655;
  font-size: 12px;
}

.cambio-fecha strong {
  color: #191c1e;
  font-size: 16px;
}

.flecha {
  color: #737686;
  font-size: 20px;
}

.consecuencias {
  margin: 6px 0 0;
  padding-left: 20px;
  color: #434655;
  font-size: 14px;
  line-height: 1.6;
}
</style>
