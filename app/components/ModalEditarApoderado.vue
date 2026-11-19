<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import {
  NOMBRES_PARENTESCO,
  nombreApoderado,
  solicitudDesdeVinculo,
  useApoderadosEstudiante,
  validarEdicionApoderado,
} from '~/composables/useApoderadosEstudiante'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type { ParentescoApoderado, SolicitudEditarApoderado, VinculoApoderado } from '~/types/apoderado'

const propiedades = defineProps<{
  vinculo: VinculoApoderado | null
  estudianteId: number
  nombreEstudiante: string
}>()

const emitir = defineEmits<{
  cerrar: []
  guardado: [vinculo: VinculoApoderado]
}>()

const { actualizar } = useApoderadosEstudiante()
const PARENTESCOS = Object.entries(NOMBRES_PARENTESCO) as [ParentescoApoderado, string][]

const formulario = reactive<SolicitudEditarApoderado>({
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  celular: '',
  correoElectronico: '',
  parentesco: 'OTRO',
  esPrincipal: false,
})
const errores = ref<Partial<Record<keyof SolicitudEditarApoderado, string>>>({})
const error = ref('')
const guardando = ref(false)

async function guardar(): Promise<void> {
  const vinculo = propiedades.vinculo
  if (!vinculo || guardando.value) return
  errores.value = validarEdicionApoderado(formulario)
  if (Object.keys(errores.value).length) return

  guardando.value = true
  error.value = ''
  try {
    emitir('guardado', await actualizar(propiedades.estudianteId, vinculo.apoderadoId, formulario))
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudieron guardar los cambios.')
  } finally {
    guardando.value = false
  }
}

function limpiarError(campo: keyof SolicitudEditarApoderado): void {
  errores.value = { ...errores.value, [campo]: undefined }
}

watch(
  () => propiedades.vinculo,
  (vinculo) => {
    if (!vinculo) return
    Object.assign(formulario, solicitudDesdeVinculo(vinculo))
    errores.value = {}
    error.value = ''
  },
  { immediate: true },
)
</script>

<template>
  <VentanaModal
    :abierta="vinculo !== null"
    :titulo="vinculo ? `Editar datos de ${nombreApoderado(vinculo)}` : ''"
    descripcion="Los cambios de contacto se aplican a todos sus hijos vinculados."
    :bloqueada="guardando"
    ancho="amplia"
    @cerrar="emitir('cerrar')"
  >
    <form v-if="vinculo" class="formulario" novalidate @submit.prevent="guardar">
      <div class="campo ancho">
        <label for="editar-documento">Documento</label>
        <input id="editar-documento" :value="`${vinculo.tipoDocumento} ${vinculo.numeroDocumento}`" disabled />
      </div>
      <div class="campo">
        <label for="editar-nombres">Nombres</label>
        <input id="editar-nombres" v-model="formulario.nombres" maxlength="100" @input="limpiarError('nombres')" />
        <small v-if="errores.nombres" class="error">{{ errores.nombres }}</small>
      </div>
      <div class="campo">
        <label for="editar-paterno">Apellido paterno</label>
        <input
          id="editar-paterno"
          v-model="formulario.apellidoPaterno"
          maxlength="100"
          @input="limpiarError('apellidoPaterno')"
        />
        <small v-if="errores.apellidoPaterno" class="error">{{ errores.apellidoPaterno }}</small>
      </div>
      <div class="campo">
        <label for="editar-materno">Apellido materno</label>
        <input
          id="editar-materno"
          v-model="formulario.apellidoMaterno"
          maxlength="100"
          @input="limpiarError('apellidoMaterno')"
        />
        <small v-if="errores.apellidoMaterno" class="error">{{ errores.apellidoMaterno }}</small>
      </div>
      <div class="campo">
        <label for="editar-parentesco">Parentesco con {{ nombreEstudiante }}</label>
        <select id="editar-parentesco" v-model="formulario.parentesco">
          <option v-for="[valor, texto] in PARENTESCOS" :key="valor" :value="valor">{{ texto }}</option>
        </select>
      </div>
      <div class="campo">
        <label for="editar-celular">Celular</label>
        <input
          id="editar-celular"
          v-model="formulario.celular"
          inputmode="numeric"
          maxlength="9"
          @input="limpiarError('celular')"
        />
        <small v-if="errores.celular" class="error">{{ errores.celular }}</small>
      </div>
      <div class="campo">
        <label for="editar-correo">Correo</label>
        <input
          id="editar-correo"
          v-model="formulario.correoElectronico"
          type="email"
          maxlength="254"
          @input="limpiarError('correoElectronico')"
        />
        <small v-if="errores.correoElectronico" class="error">{{ errores.correoElectronico }}</small>
      </div>
      <AvisoMensaje
        v-if="vinculo.esPrincipal"
        class="ancho"
        tipo="informacion"
        mensaje="Es el apoderado principal. Para cambiarlo, usa «Hacer principal» en otro apoderado: así el estudiante nunca se queda sin principal."
      />
      <AvisoMensaje v-if="error" class="ancho" :mensaje="error" tipo="error" />
      <button type="submit" hidden aria-hidden="true" tabindex="-1" />
    </form>

    <template #pie>
      <BotonAccion variante="secundario" :deshabilitado="guardando" @click="emitir('cerrar')">Cancelar</BotonAccion>
      <BotonAccion :deshabilitado="guardando" @click="guardar">
        {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
      </BotonAccion>
    </template>
  </VentanaModal>
</template>

<style scoped>
.formulario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ancho {
  grid-column: 1 / -1;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  color: #191c1e;
  font-size: 14px;
  font-weight: 600;
}

.campo input,
.campo select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 14px;
}

.campo input:disabled {
  background: #f1f5f9;
  color: #475569;
}

.error {
  color: #dc2626;
  font-size: 12px;
}

@media (max-width: 640px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
