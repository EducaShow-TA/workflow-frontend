<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { AsistenciaDocente } from '~/types/asistenciaDocente'
import { useMiAsistenciaDocente } from '~/composables/useMiAsistenciaDocente'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { obtenerFechaHoyIso } from '~/composables/useFechas'
import { useAutenticacionStore } from '~/stores/autenticacion'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const autenticacion = useAutenticacionStore()
const api = useMiAsistenciaDocente()
const hoy = obtenerFechaHoyIso()
const desde = `${hoy.slice(0, 7)}-01`
const hasta = hoy
const marcajes = ref<AsistenciaDocente[]>([])
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
const aviso = ref('')
const registroHoy = computed(() => marcajes.value.find((item) => item.fecha === hoy) ?? null)
const puedeMarcarEntrada = computed(() => !registroHoy.value || registroHoy.value.estado === 'PENDIENTE_MARCAJE')
const puedeMarcarSalida = computed(
  () => Boolean(registroHoy.value?.horaEntrada) && !registroHoy.value?.horaSalida,
)
const etiquetaEstado = (estado: AsistenciaDocente['estado']) => ({
  PENDIENTE_MARCAJE: 'Pendiente',
  PRESENTE: 'Presente',
  TARDANZA: 'Tardanza',
  INASISTENCIA: 'Inasistencia',
})[estado]
const fechaVisible = (fecha: string) => {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    marcajes.value = await api.listar(desde, hasta)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo consultar tu historial de marcajes.')
  } finally {
    cargando.value = false
  }
}

async function marcar(tipo: 'entrada' | 'salida'): Promise<void> {
  guardando.value = true
  error.value = ''
  aviso.value = ''
  try {
    const guardado = tipo === 'entrada' ? await api.marcarEntrada() : await api.marcarSalida()
    marcajes.value = [guardado, ...marcajes.value.filter((item) => item.id !== guardado.id)]
    aviso.value = tipo === 'entrada' ? 'La hora de entrada quedó registrada.' : 'La hora de salida quedó registrada.'
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo registrar el marcaje.')
  } finally {
    guardando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <main class="docente-vista marcaje">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-2.3 · Control de asistencia</span>
        <h1>Mi marcaje</h1>
        <p>Registra tu entrada y salida. El servidor valida el horario y conserva la hora oficial.</p>
      </div>
      <button type="button" class="docente-boton docente-boton--secundario" :disabled="cargando" @click="cargar">
        Actualizar
      </button>
    </header>

    <section class="marcaje-condiciones" aria-labelledby="marcaje-titulo-condiciones">
      <h2 id="marcaje-titulo-condiciones">Marcaje de hoy</h2>
      <p>Solo puedes registrar tu propia jornada dentro de la ventana habilitada. La fecha y hora se obtienen del servidor.</p>
      <div class="marcaje-datos">
        <div><span>Docente</span><strong>{{ autenticacion.usuario?.nombreCompleto || 'Docente autenticado' }}</strong></div>
        <div><span>Fecha</span><strong>{{ fechaVisible(hoy) }}</strong></div>
        <div><span>Estado</span><strong>{{ registroHoy ? etiquetaEstado(registroHoy.estado) : 'Sin marcaje' }}</strong></div>
        <div><span>Motivo de ajuste</span><strong>{{ registroHoy?.motivoAjuste || '—' }}</strong></div>
      </div>
      <div class="marcaje-relojes">
        <div><span class="marcaje-relojes__rotulo">Entrada</span><strong>{{ registroHoy?.horaEntrada || '—:—' }}</strong></div>
        <div><span class="marcaje-relojes__rotulo">Salida</span><strong>{{ registroHoy?.horaSalida || '—:—' }}</strong></div>
      </div>
      <div class="docente-formulario__acciones marcaje-acciones">
        <button type="button" class="docente-boton docente-boton--secundario" :disabled="guardando || !puedeMarcarEntrada" @click="marcar('entrada')">
          {{ guardando ? 'Guardando…' : registroHoy?.horaEntrada ? 'Entrada registrada' : 'Marcar entrada' }}
        </button>
        <button type="button" class="docente-boton" :disabled="guardando || !puedeMarcarSalida" @click="marcar('salida')">
          {{ registroHoy?.horaSalida ? 'Salida registrada' : 'Marcar salida' }}
        </button>
      </div>
    </section>

    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />

    <section class="docente-tarjeta" aria-labelledby="marcaje-titulo-historial">
      <div class="docente-tarjeta__titulo marcaje-cabecera">
        <h2 id="marcaje-titulo-historial">Historial del mes</h2>
        <span class="marcaje-etiqueta marcaje-etiqueta--neutra">{{ marcajes.length }} registros</span>
      </div>
      <p v-if="cargando" role="status">Consultando marcajes…</p>
      <div v-else class="docente-tabla-contenedor">
        <table class="docente-tabla">
          <thead><tr><th scope="col">Fecha</th><th scope="col">Entrada</th><th scope="col">Salida</th><th scope="col">Estado</th><th scope="col">Observación</th></tr></thead>
          <tbody>
            <tr v-for="item in marcajes" :key="item.id">
              <td>{{ fechaVisible(item.fecha) }}</td><td>{{ item.horaEntrada || '—' }}</td><td>{{ item.horaSalida || '—' }}</td>
              <td>{{ etiquetaEstado(item.estado) }}</td><td>{{ item.motivoAjuste || '—' }}</td>
            </tr>
            <tr v-if="!marcajes.length"><td colspan="5" class="docente-tabla__vacia">No hay marcajes registrados este mes.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.marcaje-condiciones {
  padding: 20px 24px;
  border: 1px solid #bfdbfe;
  border-left: 4px solid #2563eb;
  border-radius: 12px;
  background: #eff6ff;
}
.marcaje-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.marcaje-cabecera h2 {
  margin: 0;
  font-size: 18px;
}
.marcaje-condiciones > p {
  margin: 10px 0 16px;
  color: #1e3a8a;
  font-size: 13px;
  line-height: 1.65;
}
.marcaje-etiqueta {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 11px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.marcaje-etiqueta--pendiente,
.marcaje-etiqueta--neutra {
  background: #e2e8f0;
  color: #475569;
}
.marcaje-etiqueta--demo {
  background: #dbeafe;
  color: #1d4ed8;
}
.marcaje-verificaciones {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.marcaje-verificacion {
  display: flex;
  align-items: center;
  min-height: 68px;
  gap: 11px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 9px;
  background: #fff;
}
.marcaje-punto {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
  border-radius: 50%;
  background: #94a3b8;
}
.marcaje-verificacion strong,
.marcaje-verificacion small {
  display: block;
}
.marcaje-verificacion strong {
  font-size: 12px;
}
.marcaje-verificacion small {
  margin-top: 5px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.45;
}
.marcaje-columnas {
  align-items: stretch;
}
.marcaje-datos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 12px 0 20px;
}
.marcaje-datos > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
}
.marcaje-datos span {
  color: #64748b;
  font-size: 12px;
}
.marcaje-datos strong {
  overflow-wrap: anywhere;
  color: #0f172a;
  font-size: 14px;
}
.marcaje-relojes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}
.marcaje-relojes > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}
.marcaje-relojes__rotulo {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}
.marcaje-relojes strong {
  color: #0f172a;
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}
.marcaje-relojes small {
  color: #64748b;
  font-size: 11px;
}
.marcaje-estado {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}
.marcaje-estado__punto {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
  margin-top: 3px;
  border-radius: 50%;
  background: #64748b;
}
.marcaje-estado strong,
.marcaje-estado small {
  display: block;
}
.marcaje-estado strong {
  font-size: 13px;
}
.marcaje-estado small {
  margin-top: 3px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.4;
}
.marcaje-acciones {
  flex-wrap: wrap;
}
.marcaje-ayuda {
  margin: 12px 0 0;
  color: #64748b;
  font-size: 11px;
  line-height: 1.5;
}
.marcaje-boton-previa {
  width: 100%;
}
.marcaje-demo {
  margin-top: 18px;
}
.marcaje-demo__aviso {
  padding: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 9px;
  background: #eff6ff;
  color: #1e40af;
  font-size: 12px;
  line-height: 1.6;
}
.marcaje-demo__pasos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}
.marcaje-demo__paso {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
}
.marcaje-demo__paso > span {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  border-radius: 50%;
  background: #e2e8f0;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}
.marcaje-demo__paso--listo > span {
  background: #dcfce7;
  color: #166534;
}
.marcaje-demo__paso strong,
.marcaje-demo__paso small {
  display: block;
}
.marcaje-demo__paso strong {
  font-size: 12px;
}
.marcaje-demo__paso small {
  margin-top: 4px;
  color: #64748b;
  font-size: 11px;
}
.marcaje-demo__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.marcaje-reiniciar {
  margin-top: 14px;
  padding: 3px 0;
  border: 0;
  background: none;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
@media (max-width: 1050px) {
  .marcaje-verificaciones {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .marcaje-cabecera {
    align-items: flex-start;
    flex-direction: column;
  }
  .marcaje-datos,
  .marcaje-demo__pasos {
    grid-template-columns: 1fr;
  }
}
</style>
