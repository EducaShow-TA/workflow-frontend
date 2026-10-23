<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ErroresPlantilla, PlantillaHorario, SolicitudPlantillaHorario } from '~/types/plantillaHorario'
import { ErrorSolicitudApi } from '~/types/api'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import { crearFormularioDesdePlantilla, usePlantillasHorario } from '~/composables/usePlantillasHorario'

definePageMeta({
  middleware: 'autenticacion',
})

const ruta = useRoute()
const { listarPlantillas, obtenerPlantilla, actualizarPlantilla } = usePlantillasHorario()

const id = Number(ruta.params.id)
const plantilla = ref<PlantillaHorario | null>(null)
const existentes = ref<PlantillaHorario[]>([])
const cargando = ref(true)
const errorCarga = ref('')
const guardando = ref(false)
const errorGuardado = ref('')
const erroresServidor = ref<ErroresPlantilla>({})

const formularioInicial = computed(() => (plantilla.value ? crearFormularioDesdePlantilla(plantilla.value) : null))

async function cargar(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    const [encontrada, todas] = await Promise.all([obtenerPlantilla(id), listarPlantillas()])
    plantilla.value = encontrada
    existentes.value = todas
  } catch (error: unknown) {
    errorCarga.value = obtenerMensajeError(error, 'No se pudo cargar la plantilla.')
  } finally {
    cargando.value = false
  }
}

async function guardar(solicitud: SolicitudPlantillaHorario): Promise<void> {
  guardando.value = true
  errorGuardado.value = ''

  try {
    const actualizada = await actualizarPlantilla(id, solicitud)
    await navigateTo({ path: '/horarios', query: { actualizada: actualizada.nombre } })
  } catch (error: unknown) {
    if (error instanceof ErrorSolicitudApi && error.estado === 409) {
      erroresServidor.value = { nombre: error.message }
    } else {
      errorGuardado.value = obtenerMensajeError(error, 'No se pudo actualizar la plantilla.')
    }
  } finally {
    guardando.value = false
  }
}

onMounted(cargar)
</script>

<template>
  <main class="pagina-plantilla">
    <EncabezadoPagina
      titulo="Editar plantilla de horario"
      :descripcion="plantilla ? plantilla.nombre : 'Modifica la jornada, la hora pedagógica y los recreos.'"
    >
      <template #acciones>
        <BotonAccion variante="secundario" destino="/horarios">Cancelar</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="errorGuardado" :mensaje="errorGuardado" tipo="error" />

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargar">
      <FormularioPlantillaHorario
        v-if="formularioInicial"
        :formulario-inicial="formularioInicial"
        :existentes="existentes"
        :id-en-edicion="id"
        :guardando="guardando"
        :errores-servidor="erroresServidor"
        @guardar="guardar"
      />
    </PanelEstadoCarga>
  </main>
</template>

<style scoped>
.pagina-plantilla {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

@media (max-width: 760px) {
  .pagina-plantilla {
    padding: 20px 16px;
  }
}
</style>
