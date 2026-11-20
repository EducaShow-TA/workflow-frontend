<script setup lang="ts">
import { esFechaIsoValida, formatearFecha } from '~/composables/useFechas'
import { useHistorialAsistencia, type AsistenciaHistorial } from '~/composables/useHistorialAsistencia'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useAutenticacionStore } from '~/stores/autenticacion'

definePageMeta({ middleware: 'autenticacion', layout: 'familia' })

const autenticacion = useAutenticacionStore()
const { listarVinculados, consultar } = useHistorialAsistencia()
const esApoderado = computed(() => autenticacion.usuario?.rol === 'APODERADO')
const vinculados = ref<Awaited<ReturnType<typeof listarVinculados>>>([])
const estudianteId = ref<number | ''>('')
const desde = ref('')
const hasta = ref('')
const registros = ref<AsistenciaHistorial[] | null>(null)
const cargando = ref(false)
const cargandoVinculados = ref(false)
const error = ref('')
const errorVinculados = ref('')
let solicitud = 0

const etiquetas: Record<AsistenciaHistorial['estado'], string> = {
  PENDIENTE_MARCAJE: 'Pendiente de marcaje',
  PRESENTE: 'Presente',
  AUSENTE: 'Ausente',
  TARDANZA: 'Tardanza',
  JUSTIFICADA: 'Justificada',
}

watch(
  [estudianteId, desde, hasta],
  () => {
    solicitud++
    registros.value = null
    error.value = ''
    cargando.value = false
  },
  { flush: 'sync' },
)

async function cargarVinculados() {
  cargandoVinculados.value = true
  errorVinculados.value = ''
  try {
    vinculados.value = await listarVinculados()
    if (vinculados.value.length === 1) estudianteId.value = vinculados.value[0]!.estudianteId
  } catch (fallo) {
    errorVinculados.value = obtenerMensajeError(fallo, 'No se pudieron cargar los estudiantes vinculados.')
  } finally {
    cargandoVinculados.value = false
  }
}

async function buscar() {
  const id = estudianteId.value
  registros.value = null
  error.value = ''
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) {
    error.value = 'Indica un número de estudiante válido.'
    return
  }
  if (esApoderado.value && !vinculados.value.some((item) => item.estudianteId === id)) {
    error.value = 'Selecciona un estudiante vinculado a tu cuenta.'
    return
  }
  if ((desde.value && !esFechaIsoValida(desde.value)) || (hasta.value && !esFechaIsoValida(hasta.value))) {
    error.value = 'Ingresa fechas válidas.'
    return
  }
  if (desde.value && hasta.value && desde.value > hasta.value) {
    error.value = 'La fecha inicial debe ser anterior o igual a la fecha final.'
    return
  }
  const actual = ++solicitud
  cargando.value = true
  try {
    const resultado = await consultar(id, desde.value, hasta.value)
    if (actual === solicitud && autenticacion.autenticado) registros.value = resultado
  } catch (fallo) {
    if (actual === solicitud) error.value = obtenerMensajeError(fallo, 'No se pudo consultar el historial.')
  } finally {
    if (actual === solicitud) cargando.value = false
  }
}

onMounted(() => {
  if (esApoderado.value) void cargarVinculados()
})
</script>

<template>
  <main class="historial">
    <h1>Historial de asistencia</h1>
    <form class="tarjeta filtros" @submit.prevent="buscar">
      <label v-if="esApoderado">
        Estudiante
        <select v-model="estudianteId" required :disabled="cargandoVinculados || !vinculados.length">
          <option value="">Selecciona un estudiante</option>
          <option v-for="item in vinculados" :key="item.estudianteId" :value="item.estudianteId">
            {{ item.nombreCompleto }}
          </option>
        </select>
      </label>
      <label v-else>
        Número de estudiante
        <input v-model.number="estudianteId" type="number" min="1" step="1" required aria-describedby="ayuda-id" />
        <small id="ayuda-id">Ingresa el número de estudiante asignado por el colegio.</small>
      </label>
      <label>Desde <input v-model="desde" type="date" /></label>
      <label>Hasta <input v-model="hasta" type="date" /></label>
      <button type="submit" :disabled="cargando || cargandoVinculados || (esApoderado && !vinculados.length)">
        {{ cargando ? 'Consultando…' : 'Consultar historial' }}
      </button>
    </form>
    <p v-if="cargandoVinculados" role="status">Cargando estudiantes vinculados…</p>
    <div v-else-if="errorVinculados">
      <p role="alert">{{ errorVinculados }}</p>
      <button type="button" @click="cargarVinculados">Reintentar</button>
    </div>
    <p v-else-if="esApoderado && !vinculados.length" role="status">Tu cuenta no tiene estudiantes vinculados.</p>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="registros?.length === 0" class="tarjeta" role="status">
      No hay registros de asistencia para esta consulta.
    </p>
    <section v-if="registros?.length" class="tarjeta tabla" aria-label="Registros de asistencia" tabindex="0">
      <table>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Hora</th>
            <th scope="col">Clase</th>
            <th scope="col">Sección</th>
            <th scope="col">Docente</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="registro in registros" :key="registro.asistenciaId">
            <td>{{ formatearFecha(registro.fecha) }}</td>
            <td>{{ registro.horaInicio.slice(0, 5) }} a {{ registro.horaFin.slice(0, 5) }}</td>
            <td>{{ registro.areaNombre }}</td>
            <td>{{ registro.seccionCodigo }}</td>
            <td>{{ registro.docenteNombre }}</td>
            <td>
              <strong>{{ etiquetas[registro.estado] }}</strong>
              <small v-if="registro.motivoJustificacion">{{ registro.motivoJustificacion }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
.historial {
  max-width: 1400px;
  margin: auto;
  padding: 28px;
  color: #172b42;
}
h1 {
  margin: 0 0 20px;
  font-size: 26px;
}
.tarjeta {
  margin: 0 0 18px;
  padding: 18px;
  border: 1px solid #e1e6ef;
  border-radius: 12px;
  background: white;
}
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  gap: 14px;
}
label {
  display: grid;
  gap: 6px;
  font-weight: 600;
}
input,
select {
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid #c9d4e5;
  border-radius: 7px;
  background: white;
}
button {
  align-self: start;
  min-height: 42px;
  padding: 10px 16px;
  border: 0;
  border-radius: 7px;
  color: white;
  background: #2444b0;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.tabla {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 660px;
}
th,
td {
  padding: 12px;
  border-bottom: 1px solid #e1e6ef;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f5f7fb;
}
small {
  display: block;
  max-width: 32ch;
  font-weight: 400;
  overflow-wrap: anywhere;
}
</style>
