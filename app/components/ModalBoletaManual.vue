<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BoletaPension, EstadoBoleta } from '~/types/boletaPension'
import type { CompromisoPagoApi, MesCompromiso } from '~/types/compromisoPago'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { etiquetaEstadoBoleta, useBoletasPension } from '~/composables/useBoletasPension'
import { construirMesesCompromiso, nombreMes, useCompromisosPago } from '~/composables/useCompromisosPago'

const propiedades = defineProps<{
  abierta: boolean
  estudiantes: { id: number; nombre: string }[]
}>()

const emitir = defineEmits<{
  cerrar: []
  generada: [boleta: BoletaPension]
}>()

const { listarPorEstudiante, generarBoletaManual } = useCompromisosPago()
const { listar } = useBoletasPension()
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

const estudianteId = ref<number | ''>('')
const compromisos = ref<CompromisoPagoApi[]>([])
const compromisoId = ref<number | ''>('')
const boletas = ref<BoletaPension[]>([])
const mesElegido = ref('')
const cargando = ref(false)
const generando = ref(false)
const error = ref('')

const compromiso = computed(() => compromisos.value.find((item) => item.id === compromisoId.value) ?? null)
const meses = computed<MesCompromiso[]>(() =>
  compromiso.value ? construirMesesCompromiso(compromiso.value, boletas.value) : [],
)
const mesesPendientes = computed(() => meses.value.filter((mes) => !mes.boleta))
const montoCuota = computed(() =>
  compromiso.value ? Math.floor((compromiso.value.montoTotal * 100) / compromiso.value.numeroCuotas) / 100 : 0,
)

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (abierta) {
      estudianteId.value = ''
      compromisos.value = []
      compromisoId.value = ''
      boletas.value = []
      mesElegido.value = ''
      error.value = ''
    }
  },
)

watch(estudianteId, async (id) => {
  compromisos.value = []
  compromisoId.value = ''
  boletas.value = []
  mesElegido.value = ''
  error.value = ''
  if (!id) return

  cargando.value = true
  try {
    const [listaCompromisos, listaBoletas] = await Promise.all([
      listarPorEstudiante(id),
      listar({ estudianteId: String(id), periodoId: '', mes: '', estado: '' }),
    ])
    compromisos.value = listaCompromisos
    boletas.value = listaBoletas
    compromisoId.value = listaCompromisos.length === 1 ? listaCompromisos[0]!.id : ''
    if (!listaCompromisos.length) error.value = 'El estudiante no tiene un compromiso de pago activo.'
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo consultar el compromiso del estudiante.')
  } finally {
    cargando.value = false
  }
})

watch(compromisoId, () => {
  mesElegido.value = ''
})

function textoBoleta(mes: MesCompromiso): string {
  if (!mes.boleta) return 'Sin boleta'
  const mecanismo = mes.boleta.mecanismo === 'MANUAL' ? 'manual' : 'automática'
  return `Boleta #${mes.boleta.id} (${mecanismo}) · ${etiquetaEstadoBoleta(mes.boleta.estado as EstadoBoleta)}`
}

async function generar(): Promise<void> {
  if (!compromiso.value || !mesElegido.value) return
  generando.value = true
  error.value = ''

  try {
    const boleta = await generarBoletaManual(compromiso.value.matriculaId, mesElegido.value)
    emitir('generada', boleta)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo generar la boleta.')
  } finally {
    generando.value = false
  }
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    titulo="Generar boleta manual"
    descripcion="Emite una boleta pendiente que no se generó automáticamente. Queda asociada al compromiso de pago y registrada como manual."
    :bloqueada="generando"
    ancho="amplia"
    @cerrar="emitir('cerrar')"
  >
    <div class="contenido">
      <div class="campos">
        <div class="campo">
          <label for="boleta-estudiante">Estudiante <span class="obligatorio">*</span></label>
          <select id="boleta-estudiante" v-model.number="estudianteId" :disabled="generando">
            <option value="">Selecciona un estudiante</option>
            <option v-for="estudiante in estudiantes" :key="estudiante.id" :value="estudiante.id">
              {{ estudiante.nombre }} · #{{ estudiante.id }}
            </option>
          </select>
        </div>

        <div v-if="compromisos.length > 1" class="campo">
          <label for="boleta-compromiso">Compromiso <span class="obligatorio">*</span></label>
          <select id="boleta-compromiso" v-model.number="compromisoId" :disabled="generando">
            <option value="">Selecciona el compromiso</option>
            <option v-for="item in compromisos" :key="item.id" :value="item.id">
              {{ item.concepto }} · desde {{ nombreMes(item.mesInicio.slice(0, 7)) }}
            </option>
          </select>
        </div>
      </div>

      <p v-if="cargando" class="estado-carga" role="status">Consultando el compromiso…</p>

      <template v-else-if="compromiso">
        <dl class="resumen">
          <div>
            <dt>Concepto</dt>
            <dd>{{ compromiso.concepto }}</dd>
          </div>
          <div>
            <dt>Monto total</dt>
            <dd>{{ moneda.format(compromiso.montoTotal) }}</dd>
          </div>
          <div>
            <dt>Cuotas</dt>
            <dd>{{ compromiso.numeroCuotas }} × {{ moneda.format(montoCuota) }}</dd>
          </div>
          <div>
            <dt>Vencimiento</dt>
            <dd>Día {{ compromiso.diaVencimiento }} de cada mes</dd>
          </div>
        </dl>

        <fieldset class="meses">
          <legend>
            <span>Mes a generar <span class="obligatorio">*</span></span>
            <small>{{ mesesPendientes.length }} de {{ meses.length }} meses sin boleta</small>
          </legend>
          <p class="ayuda">
            Cronograma desde {{ nombreMes(compromiso.mesInicio.slice(0, 7)) }}, un mes por cuota. Solo se pueden generar
            los meses sin boleta.
          </p>
          <ul>
            <li v-for="mes in meses" :key="mes.mes" :class="{ emitida: mes.boleta, elegido: mesElegido === mes.mes }">
              <label>
                <input
                  v-model="mesElegido"
                  type="radio"
                  name="mes-boleta"
                  :value="mes.mes"
                  :disabled="Boolean(mes.boleta) || generando"
                />
                <span class="cuota">Cuota {{ mes.numeroCuota }}</span>
                <span class="mes">{{ nombreMes(mes.mes) }}</span>
                <span class="boleta">{{ textoBoleta(mes) }}</span>
              </label>
            </li>
          </ul>
        </fieldset>
      </template>

      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    </div>

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="generando" @click="emitir('cerrar')">Cancelar</BotonAccion>
      <BotonAccion :deshabilitado="generando || !mesElegido" @click="generar">
        {{ generando ? 'Generando...' : mesElegido ? `Generar boleta de ${nombreMes(mesElegido)}` : 'Generar boleta' }}
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.contenido {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.campos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.campo label,
.meses legend {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo select {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 14px;
}

.obligatorio {
  color: #dc2626;
}

.estado-carga,
.ayuda {
  margin: 0;
  color: #434655;
  font-size: 13px;
}

.resumen {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 12px;
  border-radius: 10px;
  background: #f7f9fb;
}

.resumen dt {
  color: #434655;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.resumen dd {
  margin: 2px 0 0;
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.meses {
  margin: 0;
  padding: 0;
  border: 0;
}

.meses legend {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.meses legend small {
  color: #434655;
  font-weight: 400;
}

.meses ul {
  display: grid;
  max-height: 260px;
  overflow: auto;
  gap: 6px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.meses label {
  display: grid;
  grid-template-columns: auto 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid #e0e3e5;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.meses li.emitida label {
  background: #f7f9fb;
  color: #6b7280;
  cursor: not-allowed;
}

.meses li.elegido label {
  border-color: #004ac6;
  box-shadow: 0 0 0 2px #dbeafe;
}

.cuota {
  color: #434655;
  font-size: 12px;
}

.mes {
  font-weight: 600;
}

.boleta {
  font-size: 12px;
  text-align: right;
}

@media (max-width: 720px) {
  .campos,
  .resumen {
    grid-template-columns: minmax(0, 1fr);
  }

  .meses label {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .cuota {
    display: none;
  }

  .boleta {
    grid-column: 2;
    text-align: left;
  }
}
</style>
