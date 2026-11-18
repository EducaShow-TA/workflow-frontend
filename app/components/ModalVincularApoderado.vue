<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  NOMBRES_PARENTESCO,
  nombreApoderado,
  useApoderadosEstudiante,
  validarApoderado,
  validarDocumentoApoderado,
} from '~/composables/useApoderadosEstudiante'
import type { ErroresApoderado } from '~/composables/useApoderadosEstudiante'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import type {
  CredencialApoderado,
  ParentescoApoderado,
  SolicitudVincularApoderado,
  VerificacionApoderado,
  VinculoApoderado,
} from '~/types/apoderado'

type Paso = 'documento' | 'nuevo' | 'existente' | 'rechazado' | 'credenciales'

const propiedades = defineProps<{
  abierta: boolean
  estudianteId: number
  nombreEstudiante: string
  principalActual: string | null
}>()

const emitir = defineEmits<{
  cerrar: []
  vinculado: [vinculo: VinculoApoderado]
}>()

const { verificar, vincular } = useApoderadosEstudiante()
const PARENTESCOS = Object.entries(NOMBRES_PARENTESCO) as [ParentescoApoderado, string][]

const formulario = reactive<SolicitudVincularApoderado>(formularioVacio())
const paso = ref<Paso>('documento')
const verificacion = ref<VerificacionApoderado | null>(null)
const errores = ref<ErroresApoderado>({})
const errorDocumento = ref('')
const error = ref('')
const verificando = ref(false)
const guardando = ref(false)
const credenciales = ref<CredencialApoderado[]>([])
const documentoVerificado = ref('')

const sinPrincipal = computed(() => !propiedades.principalActual)
const puedeVincular = computed(() => paso.value === 'nuevo' || paso.value === 'existente')

function formularioVacio(): SolicitudVincularApoderado {
  return {
    tipoDocumento: 'DNI',
    numeroDocumento: '',
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    celular: '',
    correoElectronico: '',
    parentesco: '',
    esPrincipal: false,
  }
}

function claveDocumento(): string {
  return `${formulario.tipoDocumento}:${formulario.numeroDocumento.trim().toUpperCase()}`
}

function reiniciar(): void {
  Object.assign(formulario, formularioVacio())
  formulario.esPrincipal = sinPrincipal.value
  paso.value = 'documento'
  verificacion.value = null
  errores.value = {}
  errorDocumento.value = ''
  error.value = ''
  credenciales.value = []
  documentoVerificado.value = ''
}

async function buscar(): Promise<void> {
  error.value = ''
  errorDocumento.value = validarDocumentoApoderado(formulario.tipoDocumento, formulario.numeroDocumento)
  if (errorDocumento.value) return
  if (documentoVerificado.value === claveDocumento() && paso.value !== 'documento') return

  verificando.value = true
  try {
    const resultado = await verificar(propiedades.estudianteId, formulario.tipoDocumento, formulario.numeroDocumento)
    verificacion.value = resultado
    documentoVerificado.value = claveDocumento()
    errores.value = {}
    paso.value = !resultado.puedeVincularse ? 'rechazado' : resultado.existe ? 'existente' : 'nuevo'
  } catch (fallo: unknown) {
    errorDocumento.value = obtenerMensajeError(fallo, 'No se pudo verificar el documento.')
  } finally {
    verificando.value = false
  }
}

function cambiarDocumento(): void {
  errorDocumento.value = ''
  if (paso.value !== 'documento' && documentoVerificado.value !== claveDocumento()) {
    paso.value = 'documento'
    verificacion.value = null
  }
}

async function confirmar(): Promise<void> {
  if (!puedeVincular.value || guardando.value) return
  const esNuevo = paso.value === 'nuevo'
  errores.value = validarApoderado(formulario, esNuevo)
  if (Object.keys(errores.value).length) return

  guardando.value = true
  error.value = ''
  try {
    const vinculo = await vincular(propiedades.estudianteId, formulario, esNuevo)
    emitir('vinculado', vinculo)
    if (vinculo.contrasenhaTemporal && vinculo.username) {
      credenciales.value = [
        {
          nombre: nombreApoderado(vinculo),
          username: vinculo.username,
          contrasenhaTemporal: vinculo.contrasenhaTemporal,
        },
      ]
      paso.value = 'credenciales'
    } else {
      emitir('cerrar')
    }
  } catch (fallo: unknown) {
    error.value = obtenerMensajeError(fallo, 'No se pudo vincular al apoderado.')
  } finally {
    guardando.value = false
  }
}

function cerrar(): void {
  if (guardando.value || verificando.value) return
  emitir('cerrar')
}

function limpiarError(campo: keyof SolicitudVincularApoderado): void {
  errores.value = { ...errores.value, [campo]: undefined }
}

watch(
  () => propiedades.abierta,
  (abierta) => {
    if (abierta) reiniciar()
  },
  { immediate: true },
)
</script>

<template>
  <VentanaModal
    :abierta="abierta"
    :titulo="paso === 'credenciales' ? 'Apoderado vinculado' : `Vincular apoderado a ${nombreEstudiante}`"
    :descripcion="
      paso === 'credenciales'
        ? `${credenciales[0]?.nombre ?? 'El apoderado'} ya es apoderado de ${nombreEstudiante}.`
        : 'Ingresa el documento del apoderado para ver si ya está registrado.'
    "
    :bloqueada="guardando || verificando"
    ancho="amplia"
    @cerrar="cerrar"
  >
    <CredencialesApoderado v-if="paso === 'credenciales'" :credenciales="credenciales" />

    <form v-else class="contenido" novalidate @submit.prevent="puedeVincular ? confirmar() : buscar()">
      <div class="documento">
        <div class="campo">
          <label for="vincular-tipo">Tipo de documento</label>
          <select id="vincular-tipo" v-model="formulario.tipoDocumento" @change="cambiarDocumento">
            <option value="DNI">DNI</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </div>
        <div class="campo">
          <label for="vincular-numero">Número de documento</label>
          <div class="buscar">
            <input
              id="vincular-numero"
              v-model="formulario.numeroDocumento"
              type="text"
              inputmode="text"
              maxlength="12"
              autocomplete="off"
              :aria-invalid="Boolean(errorDocumento)"
              @input="cambiarDocumento"
              @blur="formulario.numeroDocumento && buscar()"
            />
            <BotonAccion variante="secundario" :deshabilitado="verificando" @click="buscar">
              {{ verificando ? 'Buscando…' : 'Buscar' }}
            </BotonAccion>
          </div>
          <small v-if="errorDocumento" class="error">{{ errorDocumento }}</small>
        </div>
      </div>

      <AvisoMensaje
        v-if="paso === 'rechazado'"
        tipo="advertencia"
        :mensaje="verificacion?.motivo ?? 'No se puede vincular.'"
      />

      <template v-if="paso === 'nuevo'">
        <AvisoMensaje
          tipo="informacion"
          mensaje="No hay nadie registrado con este documento. Completa sus datos: se creará su cuenta para el portal del apoderado."
        />
        <div class="formulario">
          <div class="campo">
            <label for="vincular-nombres">Nombres</label>
            <input
              id="vincular-nombres"
              v-model="formulario.nombres"
              maxlength="100"
              @input="limpiarError('nombres')"
            />
            <small v-if="errores.nombres" class="error">{{ errores.nombres }}</small>
          </div>
          <div class="campo">
            <label for="vincular-paterno">Apellido paterno</label>
            <input
              id="vincular-paterno"
              v-model="formulario.apellidoPaterno"
              maxlength="100"
              @input="limpiarError('apellidoPaterno')"
            />
            <small v-if="errores.apellidoPaterno" class="error">{{ errores.apellidoPaterno }}</small>
          </div>
          <div class="campo">
            <label for="vincular-materno">Apellido materno</label>
            <input
              id="vincular-materno"
              v-model="formulario.apellidoMaterno"
              maxlength="100"
              @input="limpiarError('apellidoMaterno')"
            />
            <small v-if="errores.apellidoMaterno" class="error">{{ errores.apellidoMaterno }}</small>
          </div>
          <div class="campo">
            <label for="vincular-celular">Celular</label>
            <input
              id="vincular-celular"
              v-model="formulario.celular"
              inputmode="numeric"
              maxlength="9"
              placeholder="987654321"
              @input="limpiarError('celular')"
            />
            <small v-if="errores.celular" class="error">{{ errores.celular }}</small>
          </div>
          <div class="campo">
            <label for="vincular-correo">Correo (opcional)</label>
            <input
              id="vincular-correo"
              v-model="formulario.correoElectronico"
              type="email"
              maxlength="254"
              @input="limpiarError('correoElectronico')"
            />
            <small v-if="errores.correoElectronico" class="error">{{ errores.correoElectronico }}</small>
          </div>
        </div>
      </template>

      <div v-if="paso === 'existente' && verificacion" class="ficha">
        <div class="ficha__titulo">
          <strong>{{ verificacion.nombreCompleto }}</strong>
          <InsigniaEstado texto="Ya registrada" variante="exito" />
        </div>
        <dl>
          <div>
            <dt>Celular</dt>
            <dd>{{ verificacion.celularEnmascarado ?? 'Sin celular' }}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{{ verificacion.correoEnmascarado ?? 'Sin correo' }}</dd>
          </div>
          <div>
            <dt>Cuenta</dt>
            <dd>{{ verificacion.tieneCuenta ? 'Ya tiene cuenta para el portal' : 'Se le creará una cuenta' }}</dd>
          </div>
        </dl>
        <small
          >Se usarán sus datos guardados. Si cambió su celular o correo, edítalos después con "Editar datos".</small
        >
      </div>

      <div v-if="puedeVincular" class="formulario">
        <div class="campo">
          <label for="vincular-parentesco">Parentesco con {{ nombreEstudiante }}</label>
          <select id="vincular-parentesco" v-model="formulario.parentesco" @change="limpiarError('parentesco')">
            <option value="" disabled>Selecciona</option>
            <option v-for="[valor, texto] in PARENTESCOS" :key="valor" :value="valor">{{ texto }}</option>
          </select>
          <small v-if="errores.parentesco" class="error">{{ errores.parentesco }}</small>
        </div>
        <label class="principal">
          <input v-model="formulario.esPrincipal" type="checkbox" :disabled="sinPrincipal" />
          <span>
            Apoderado principal
            <small v-if="sinPrincipal">El estudiante aún no tiene principal: este lo será.</small>
            <small v-else-if="formulario.esPrincipal">{{ principalActual }} dejará de ser el principal.</small>
            <small v-else>Recibe los compromisos de pago y las notificaciones.</small>
          </span>
        </label>
      </div>

      <AvisoMensaje v-if="error" :mensaje="error" tipo="error" />
      <button type="submit" hidden aria-hidden="true" tabindex="-1" />
    </form>

    <template #pie>
      <template v-if="paso === 'credenciales'">
        <BotonAccion @click="emitir('cerrar')">Ya los copié</BotonAccion>
      </template>
      <template v-else>
        <BotonAccion variante="secundario" :deshabilitado="guardando || verificando" @click="cerrar">
          Cancelar
        </BotonAccion>
        <BotonAccion :deshabilitado="!puedeVincular || guardando" @click="confirmar">
          {{ guardando ? 'Vinculando…' : 'Vincular' }}
        </BotonAccion>
      </template>
    </template>
  </VentanaModal>
</template>

<style scoped>
.contenido {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.documento,
.formulario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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

.campo [aria-invalid='true'] {
  border-color: #dc2626;
}

.buscar {
  display: flex;
  gap: 8px;
}

.buscar input {
  flex: 1;
}

.error {
  color: #dc2626;
  font-size: 12px;
}

.ficha {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
}

.ficha__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ficha dl {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  font-size: 14px;
}

.ficha dl div {
  display: grid;
  grid-template-columns: 90px 1fr;
}

.ficha dt,
.ficha small {
  color: #434655;
}

.principal {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding-top: 28px;
  font-size: 14px;
  font-weight: 600;
}

.principal input {
  width: 18px;
  height: 18px;
  flex: none;
  margin-top: 1px;
}

.principal small {
  display: block;
  margin-top: 2px;
  color: #434655;
  font-weight: 400;
}

@media (max-width: 640px) {
  .documento,
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }

  .principal {
    padding-top: 0;
  }
}
</style>
