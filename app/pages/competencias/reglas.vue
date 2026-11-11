<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useApi } from '~/composables/useApi'
import { obtenerMensajeError } from '~/composables/useMensajesError'

definePageMeta({ middleware: 'autenticacion' })

interface CompetenciaCatalogo {
  codigo: string
  nombre: string
  activo: boolean
}
interface AreaCatalogo {
  nombre: string
  activo: boolean
  competencias: CompetenciaCatalogo[]
}
interface ReglaConsolidacion {
  competenciaCodigo: string
  valorC: number
  valorB: number
  valorA: number
  valorAd: number
  umbralB: number
  umbralA: number
  umbralAd: number
}

const { solicitar } = useApi()
const areas = ref<AreaCatalogo[]>([])
const competenciaCodigo = ref('')
const regla = ref<ReglaConsolidacion | null>(null)
const cargando = ref(true)
const guardando = ref(false)
const error = ref('')
const aviso = ref('')
const competencias = computed(() => areas.value
  .filter((area) => area.activo)
  .flatMap((area) => area.competencias
    .filter((competencia) => competencia.activo)
    .map((competencia) => ({ ...competencia, areaNombre: area.nombre })))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
const competenciaActual = computed(() => competencias.value.find((item) => item.codigo === competenciaCodigo.value))

async function cargarRegla(): Promise<void> {
  regla.value = null
  error.value = ''
  aviso.value = ''
  if (!competenciaCodigo.value) return
  try {
    regla.value = await solicitar<ReglaConsolidacion>(
      `/api/v1/competencias/${encodeURIComponent(competenciaCodigo.value)}/regla-consolidacion`,
    )
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo consultar la regla de consolidación.')
  }
}

async function cargarCatalogo(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    areas.value = await solicitar<AreaCatalogo[]>('/api/v1/areas')
    competenciaCodigo.value = competencias.value[0]?.codigo ?? ''
    await cargarRegla()
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar el catálogo de competencias.')
  } finally {
    cargando.value = false
  }
}

watch(competenciaCodigo, () => {
  if (!cargando.value) void cargarRegla()
})

async function guardar(): Promise<void> {
  if (!regla.value || guardando.value) return
  error.value = ''
  aviso.value = ''
  if (!(regla.value.umbralB > 1 && regla.value.umbralB < regla.value.umbralA
    && regla.value.umbralA < regla.value.umbralAd && regla.value.umbralAd <= 4)) {
    error.value = 'Los umbrales deben cumplir 1 < B < A < AD ≤ 4.'
    return
  }
  guardando.value = true
  try {
    regla.value = await solicitar<ReglaConsolidacion>(
      `/api/v1/competencias/${encodeURIComponent(competenciaCodigo.value)}/regla-consolidacion`,
      { metodo: 'PUT', cuerpo: {
        umbralB: regla.value.umbralB,
        umbralA: regla.value.umbralA,
        umbralAd: regla.value.umbralAd,
      } },
    )
    aviso.value = 'Regla guardada. Se recalcularon los logros de los períodos abiertos que usan esta competencia.'
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo guardar la regla.')
  } finally {
    guardando.value = false
  }
}

onMounted(cargarCatalogo)
</script>

<template>
  <main class="pagina-reglas">
    <nav aria-label="Secciones de competencias"><NuxtLink to="/competencias">Catálogo de competencias</NuxtLink><strong aria-current="page">Reglas de consolidación</strong></nav>
    <header><p>Gestión Académica / US-3.1</p><h1>Reglas de consolidación del logro</h1><p>Define los umbrales que convierten el promedio de evaluaciones en un nivel de logro.</p></header>
    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" />
    <p v-if="cargando" role="status">Cargando competencias…</p>
    <section v-else class="tarjeta">
      <label for="competencia-regla">Competencia</label>
      <select id="competencia-regla" v-model="competenciaCodigo" :disabled="!competencias.length">
        <option v-for="item in competencias" :key="item.codigo" :value="item.codigo">{{ item.areaNombre }} · {{ item.nombre }}</option>
      </select>
      <p v-if="competenciaActual">Código: {{ competenciaActual.codigo }}</p>
      <p v-if="!competencias.length">No hay competencias activas para configurar.</p>
      <div v-if="regla" class="umbrales">
        <label>Valor de C <input :value="regla.valorC" type="number" disabled /></label>
        <label>Umbral mínimo para B <input v-model.number="regla.umbralB" type="number" min="1.01" max="4" step="0.01" /></label>
        <label>Umbral mínimo para A <input v-model.number="regla.umbralA" type="number" min="1.01" max="4" step="0.01" /></label>
        <label>Umbral mínimo para AD <input v-model.number="regla.umbralAd" type="number" min="1.01" max="4" step="0.01" /></label>
        <div class="referencia">Escala: C = {{ regla.valorC }}, B = {{ regla.valorB }}, A = {{ regla.valorA }}, AD = {{ regla.valorAd }}. Los umbrales deben ser ascendentes.</div>
        <button type="button" :disabled="guardando" @click="guardar">{{ guardando ? 'Guardando…' : 'Guardar regla' }}</button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.pagina-reglas{display:flex;flex-direction:column;gap:20px;padding:32px;max-width:900px}.pagina-reglas nav{display:flex;gap:20px}.pagina-reglas header p{margin:0 0 6px;color:#475569}.pagina-reglas h1{margin:0 0 8px}.tarjeta{display:grid;gap:14px;padding:24px;border:1px solid #d8deea;border-radius:12px;background:white}.tarjeta>label,.umbrales label{display:grid;gap:6px;font-weight:600}.tarjeta select,.umbrales input{min-height:42px;padding:8px 10px;border:1px solid #aeb8c8;border-radius:7px;font:inherit}.umbrales{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:10px}.referencia{grid-column:1/-1;padding:12px;border-radius:8px;background:#f1f5f9}.umbrales button{width:fit-content;padding:10px 16px;border:0;border-radius:7px;background:#075eb3;color:white;font-weight:700;cursor:pointer}@media(max-width:650px){.pagina-reglas{padding:20px}.umbrales{grid-template-columns:1fr}}
</style>
