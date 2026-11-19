<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AlumnoClase, Calificacion, MovimientoCalificacion } from '~/types/calificacion'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useCalificaciones } from '~/composables/useCalificaciones'
import { NOTAS } from '~/composables/useMisClases'

const propiedades = defineProps<{
  abierta: boolean
  alumno: AlumnoClase | null
  contexto: string
  bimestre: number
  actual: Calificacion | null
}>()

const emitir = defineEmits<{
  cerrar: []
  rectificar: []
}>()

const { historial } = useCalificaciones()
const movimientos = ref<MovimientoCalificacion[]>([])
const cargando = ref(false)
const error = ref('')

const descripcion = computed(() => NOTAS.find((opcion) => opcion.valor === propiedades.actual?.nota)?.descripcion ?? '')
const rectificaciones = computed(() => propiedades.actual?.rectificaciones ?? 0)

watch(
  () => propiedades.abierta,
  async (abierta) => {
    const actual = propiedades.actual
    if (!abierta || !actual) return
    movimientos.value = []
    error.value = ''
    cargando.value = true
    try {
      movimientos.value = await historial(actual.id)
    } catch (fallo: unknown) {
      error.value = obtenerMensajeError(fallo, 'No se pudo cargar el historial de la nota.')
    } finally {
      cargando.value = false
    }
  },
)

function fecha(valor: string): string {
  const dato = new Date(valor)
  return Number.isNaN(dato.getTime()) ? valor : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(dato)
}
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    titulo="Historial de la nota"
    :descripcion="alumno ? `${alumno.nombreCompleto} · ${contexto} · Bimestre ${bimestre}` : contexto"
    @cerrar="emitir('cerrar')"
  >
    <div v-if="actual" class="contenido">
      <div class="vigente">
        <span :class="['chip', `chip--${actual.nota}`]">{{ actual.nota }}</span>
        <strong>Nota vigente · {{ descripcion }}</strong>
        <span>
          {{ rectificaciones === 1 ? 'Rectificada 1 vez' : `Rectificada ${rectificaciones} veces` }} · última
          modificación el {{ fecha(actual.fechaRegistro) }}
        </span>
      </div>

      <p v-if="cargando" class="estado" role="status">Cargando historial…</p>
      <AvisoMensaje v-else-if="error" :mensaje="error" tipo="error" />
      <HistorialCalificacionLista v-else :movimientos="movimientos" />

      <p class="nota-privacidad">Los motivos solo los ven el docente y el administrador.</p>
    </div>

    <template #pie>
      <BotonAccion variante="secundario" @click="emitir('cerrar')">Cerrar</BotonAccion>
      <BotonAccion @click="emitir('rectificar')">Rectificar nota</BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.contenido {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.vigente {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 14px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 14px;
}

.vigente > span:last-child {
  color: #434655;
  font-size: 13px;
}

.chip {
  display: inline-flex;
  grid-row: span 2;
  min-width: 52px;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 18px;
  font-weight: 700;
}

.chip--AD {
  background: #dcfce7;
  color: #166534;
}

.chip--A {
  background: #dbeafe;
  color: #1e40af;
}

.chip--B {
  background: #fef3c7;
  color: #92400e;
}

.chip--C {
  background: #fee2e2;
  color: #991b1b;
}

.estado,
.nota-privacidad {
  margin: 0;
  color: #6b7280;
  font-size: 12.5px;
}
</style>
