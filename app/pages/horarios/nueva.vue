<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ErroresPlantilla, PlantillaHorario, SolicitudPlantillaHorario } from '~/types/plantillaHorario'
import { ErrorSolicitudApi } from '~/types/api'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import { crearPlantillaVacia, usePlantillasHorario } from '~/composables/usePlantillasHorario'

definePageMeta({
  middleware: 'autenticacion',
})

const { listarPlantillas, crearPlantilla } = usePlantillasHorario()

const existentes = ref<PlantillaHorario[]>([])
const guardando = ref(false)
const errorGuardado = ref('')
const erroresServidor = ref<ErroresPlantilla>({})

onMounted(async () => {
  try {
    existentes.value = await listarPlantillas()
  } catch {
    existentes.value = []
  }
})

async function guardar(solicitud: SolicitudPlantillaHorario): Promise<void> {
  guardando.value = true
  errorGuardado.value = ''

  try {
    const creada = await crearPlantilla(solicitud)
    await navigateTo({ path: '/horarios', query: { creada: creada.nombre } })
  } catch (error: unknown) {
    if (error instanceof ErrorSolicitudApi && error.estado === 409) {
      erroresServidor.value = { nombre: error.message }
    } else {
      errorGuardado.value = obtenerMensajeError(error, 'No se pudo crear la plantilla.')
    }
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <main class="pagina-plantilla">
    <EncabezadoPagina
      titulo="Nueva plantilla de horario"
      descripcion="Define la jornada, la hora pedagógica y los recreos. La vista previa se actualiza mientras escribes."
    >
      <template #acciones>
        <BotonAccion variante="secundario" destino="/horarios">Cancelar</BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="errorGuardado" :mensaje="errorGuardado" tipo="error" />

    <FormularioPlantillaHorario
      :formulario-inicial="crearPlantillaVacia()"
      :existentes="existentes"
      :guardando="guardando"
      :errores-servidor="erroresServidor"
      @guardar="guardar"
    />
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
