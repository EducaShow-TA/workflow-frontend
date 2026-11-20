<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  NOMBRES_PARENTESCO,
  formatearCelularApoderado,
  nombreApoderado,
  solicitudDesdeVinculo,
  useApoderadosEstudiante,
} from '~/composables/useApoderadosEstudiante'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { VinculoApoderado } from '~/types/apoderado'

definePageMeta({ middleware: 'autenticacion' })

const ruta = useRoute()
const { listar, actualizar } = useApoderadosEstudiante()

const estudianteId = Number(ruta.params.id)
const nombreEstudiante = computed(() => String(ruta.query.nombre ?? '').trim() || `Estudiante EST-${estudianteId}`)
const detalleEstudiante = computed(() =>
  [ruta.query.documento ? `DNI ${ruta.query.documento}` : '', String(ruta.query.grado ?? '')]
    .filter(Boolean)
    .join(' · '),
)
const iniciales = computed(() =>
  nombreEstudiante.value
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra.charAt(0).toUpperCase())
    .join(''),
)

const vinculos = ref<VinculoApoderado[]>([])
const cargando = ref(true)
const error = ref('')
const aviso = ref('')
const errorAccion = ref('')
const vinculando = ref(false)
const editando = ref<VinculoApoderado | null>(null)
const cambiandoPrincipal = ref<number | null>(null)

const principal = computed(() => vinculos.value.find((vinculo) => vinculo.esPrincipal) ?? null)
const ordenados = computed(() =>
  [...vinculos.value].sort((primero, segundo) => Number(segundo.esPrincipal) - Number(primero.esPrincipal)),
)

async function cargar(): Promise<void> {
  cargando.value = true
  error.value = ''
  try {
    vinculos.value = await listar(estudianteId)
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron cargar los apoderados del estudiante.')
  } finally {
    cargando.value = false
  }
}

async function alVincular(vinculo: VinculoApoderado): Promise<void> {
  aviso.value = `${nombreApoderado(vinculo)} ya es apoderado de ${nombreEstudiante.value}.`
  await cargar()
}

async function alGuardar(vinculo: VinculoApoderado): Promise<void> {
  editando.value = null
  aviso.value = `Se actualizaron los datos de ${nombreApoderado(vinculo)}.`
  await cargar()
}

async function hacerPrincipal(vinculo: VinculoApoderado): Promise<void> {
  aviso.value = ''
  errorAccion.value = ''
  cambiandoPrincipal.value = vinculo.apoderadoId
  try {
    await actualizar(estudianteId, vinculo.apoderadoId, solicitudDesdeVinculo(vinculo, true))
    aviso.value = `${nombreApoderado(vinculo)} ahora es el apoderado principal.`
    await cargar()
  } catch (fallo: unknown) {
    errorAccion.value = obtenerMensajeError(fallo, 'No se pudo cambiar el apoderado principal.')
  } finally {
    cambiandoPrincipal.value = null
  }
}

function abrirVinculacion(): void {
  aviso.value = ''
  errorAccion.value = ''
  vinculando.value = true
}

onMounted(cargar)
</script>

<template>
  <main class="pagina-apoderados">
    <nav class="migas" aria-label="Ruta">
      <NuxtLink to="/estudiantes">Estudiantes</NuxtLink>
      <span aria-hidden="true">/</span>
      <strong>Apoderados</strong>
    </nav>

    <header class="encabezado">
      <div class="estudiante">
        <span class="avatar" aria-hidden="true">{{ iniciales }}</span>
        <div>
          <h1>{{ nombreEstudiante }}</h1>
          <p v-if="detalleEstudiante">{{ detalleEstudiante }}</p>
        </div>
      </div>
      <BotonAccion :deshabilitado="cargando || Boolean(error)" @click="abrirVinculacion">
        + Vincular apoderado
      </BotonAccion>
    </header>

    <p class="descripcion">
      El apoderado <strong>principal</strong> recibe los compromisos de pago y las notificaciones del colegio.
    </p>

    <AvisoMensaje v-if="aviso" :mensaje="aviso" tipo="exito" cerrable @cerrar="aviso = ''" />
    <AvisoMensaje v-if="errorAccion" :mensaje="errorAccion" tipo="error" cerrable @cerrar="errorAccion = ''" />

    <PanelEstadoCarga v-if="cargando || error" :cargando="cargando" :error="error" @reintentar="cargar" />

    <AvisoMensaje
      v-else-if="!vinculos.length"
      tipo="advertencia"
      mensaje="Este estudiante aún no tiene apoderados vinculados. Vincula al menos uno y desígnalo como principal."
    />

    <section v-else class="apoderados" aria-label="Apoderados vinculados">
      <article
        v-for="vinculo in ordenados"
        :key="vinculo.apoderadoId"
        class="apoderado"
        :class="{ principal: vinculo.esPrincipal }"
      >
        <header>
          <h2>{{ nombreApoderado(vinculo) }}</h2>
          <InsigniaEstado v-if="vinculo.esPrincipal" texto="★ Principal" variante="informacion" />
        </header>
        <dl>
          <div>
            <dt>Parentesco</dt>
            <dd>{{ NOMBRES_PARENTESCO[vinculo.parentesco] }}</dd>
          </div>
          <div>
            <dt>Documento</dt>
            <dd>{{ vinculo.tipoDocumento }} {{ vinculo.numeroDocumento }}</dd>
          </div>
          <div>
            <dt>Celular</dt>
            <dd>{{ formatearCelularApoderado(vinculo.celular) }}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd :class="{ vacio: !vinculo.correoElectronico }">{{ vinculo.correoElectronico || 'Sin correo' }}</dd>
          </div>
          <div>
            <dt>Usuario</dt>
            <dd :class="{ vacio: !vinculo.username }">{{ vinculo.username ?? 'Sin cuenta' }}</dd>
          </div>
        </dl>
        <div class="acciones">
          <BotonAccion variante="secundario" @click="editando = vinculo">Editar datos</BotonAccion>
          <BotonAccion
            v-if="!vinculo.esPrincipal"
            variante="secundario"
            :deshabilitado="cambiandoPrincipal !== null"
            @click="hacerPrincipal(vinculo)"
          >
            {{ cambiandoPrincipal === vinculo.apoderadoId ? 'Cambiando…' : '★ Hacer principal' }}
          </BotonAccion>
        </div>
      </article>
    </section>

    <ModalVincularApoderado
      :abierta="vinculando"
      :estudiante-id="estudianteId"
      :nombre-estudiante="nombreEstudiante"
      :principal-actual="principal ? nombreApoderado(principal) : null"
      @cerrar="vinculando = false"
      @vinculado="alVincular"
    />

    <ModalEditarApoderado
      :vinculo="editando"
      :estudiante-id="estudianteId"
      :nombre-estudiante="nombreEstudiante"
      @cerrar="editando = null"
      @guardado="alGuardar"
    />
  </main>
</template>

<style scoped>
.pagina-apoderados {
  display: flex;
  width: 100%;
  max-width: 1100px;
  flex-direction: column;
  gap: 16px;
  margin: 0 auto;
  padding: 32px;
}

.migas {
  display: flex;
  gap: 8px;
  color: #434655;
  font-size: 14px;
}

.migas a {
  color: #004ac6;
  font-weight: 600;
}

.encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.estudiante {
  display: flex;
  align-items: center;
  gap: 14px;
}

.avatar {
  display: grid;
  width: 48px;
  height: 48px;
  flex: none;
  place-items: center;
  border-radius: 999px;
  background: #dbeafe;
  color: #0f3d8c;
  font-weight: 700;
}

.estudiante h1 {
  margin: 0;
  font-size: 26px;
}

.estudiante p,
.descripcion {
  margin: 4px 0 0;
  color: #434655;
  font-size: 14px;
}

.descripcion {
  margin: 0;
}

.apoderados {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.apoderado {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.apoderado.principal {
  border-color: #1e40af;
  box-shadow: inset 0 0 0 1px #1e40af;
}

.apoderado header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.apoderado h2 {
  margin: 0;
  font-size: 17px;
}

dl {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  font-size: 14px;
}

dl div {
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 8px;
}

dt,
.vacio {
  color: #434655;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}

@media (max-width: 640px) {
  .pagina-apoderados {
    padding: 20px 16px;
  }

  .apoderados {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
