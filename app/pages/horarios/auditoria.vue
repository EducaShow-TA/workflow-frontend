<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useApi } from '~/composables/useApi'
import { obtenerMensajeError } from '~/composables/useMensajesError'

definePageMeta({ middleware: 'autenticacion' })

interface RegistroAuditoria {
  id: number
  horarioId: number
  seccion: string
  accion: string
  fechaHora: string
  usuarioCuentaId: number
  usuarioNombre: string
  detalle: string
  valoresAnteriores: string | null
  valoresNuevos: string | null
  vigenciaTipo: string
  vigenteDesde: string | null
  vigenteHasta: string | null
}

const { solicitar } = useApi()
const fechaLocal = new Date()
const hoy = `${fechaLocal.getFullYear()}-${String(fechaLocal.getMonth() + 1).padStart(2, '0')}-${String(fechaLocal.getDate()).padStart(2, '0')}`
const desde = ref(`${hoy.slice(0, 4)}-01-01`)
const hasta = ref(hoy)
const registros = ref<RegistroAuditoria[]>([])
const cargando = ref(false)
const error = ref('')

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    registros.value = await solicitar<RegistroAuditoria[]>(
      `/api/v1/horarios/auditoria?desde=${desde.value}&hasta=${hasta.value}`,
    )
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo cargar la auditoría de horarios.')
  } finally {
    cargando.value = false
  }
}

function fecha(valor: string): string {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
}

onMounted(cargar)
</script>

<template>
  <main class="auditoria">
    <header>
      <div>
        <p class="sobrelinea">Administración de horarios</p>
        <h1>Historial de cambios</h1>
        <p>Consulta el responsable, el detalle del cambio, su vigencia y los valores anteriores y nuevos.</p>
      </div>
      <NuxtLink to="/horario-secciones">Volver a horarios</NuxtLink>
    </header>

    <form class="filtros" @submit.prevent="cargar">
      <label>Desde<input v-model="desde" type="date" required /></label>
      <label>Hasta<input v-model="hasta" type="date" :min="desde" required /></label>
      <button type="submit" :disabled="cargando || desde > hasta">{{ cargando ? 'Consultando…' : 'Consultar' }}</button>
    </form>

    <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
    <p v-else-if="cargando" role="status">Cargando cambios…</p>
    <p v-else-if="!registros.length" class="vacio">No hay cambios registrados en este rango.</p>
    <div v-else class="tabla-contenedor">
      <table>
        <thead>
          <tr>
            <th>Fecha y hora</th>
            <th>Sección / horario</th>
            <th>Responsable</th>
            <th>Acción y detalle</th>
            <th>Vigencia</th>
            <th>Antes</th>
            <th>Después</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="registro in registros" :key="registro.id">
            <td>{{ fecha(registro.fechaHora) }}</td>
            <td>
              {{ registro.seccion }}<small>Horario #{{ registro.horarioId }}</small>
            </td>
            <td>
              {{ registro.usuarioNombre }}<small>Cuenta #{{ registro.usuarioCuentaId }}</small>
            </td>
            <td>
              <strong>{{ registro.accion }}</strong><small>{{ registro.detalle }}</small>
            </td>
            <td>
              {{ registro.vigenciaTipo
              }}<small v-if="registro.vigenteDesde"
                >{{ registro.vigenteDesde }} – {{ registro.vigenteHasta ?? 'sin fin' }}</small
              >
            </td>
            <td>{{ registro.valoresAnteriores ?? '—' }}</td>
            <td>{{ registro.valoresNuevos ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<style scoped>
.auditoria {
  max-width: 1500px;
  margin: auto;
  padding: 32px;
  color: #172b42;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}
h1 {
  margin: 4px 0 8px;
}
header p {
  color: #526477;
}
.sobrelinea {
  margin: 0;
  color: #2444b0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}
.filtros {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  padding: 18px;
  border: 1px solid #e1e6ef;
  border-radius: 12px;
  background: white;
  margin-bottom: 20px;
}
label {
  display: grid;
  gap: 6px;
  font-weight: 600;
}
input,
button {
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid #c9d4e5;
  border-radius: 7px;
  font: inherit;
}
button {
  background: #2444b0;
  color: white;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.tabla-contenedor {
  overflow: auto;
  border: 1px solid #e1e6ef;
  border-radius: 12px;
  background: white;
}
table {
  width: 100%;
  min-width: 1050px;
  border-collapse: collapse;
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
  font-size: 13px;
}
td {
  white-space: pre-wrap;
}
small {
  display: block;
  margin-top: 4px;
  color: #526477;
}
.vacio {
  padding: 20px;
  color: #526477;
}
@media (max-width: 700px) {
  .auditoria {
    padding: 18px 12px;
  }
  header,
  .filtros {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
