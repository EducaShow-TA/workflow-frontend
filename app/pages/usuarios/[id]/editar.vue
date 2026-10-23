<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { CuentaUsuario, ErroresEdicion, SolicitudActualizarCuenta } from '~/types/cuentaUsuario'
import {
  LONGITUD_MAXIMA_CORREO,
  MOTIVO_ROL_FIJO,
  construirSolicitudEdicion,
  crearFormularioEdicion,
  esCuentaPropia,
  obtenerMotivoProteccion,
  tieneNombreSeparado,
  useCuentasUsuario,
  validarEdicion,
} from '~/composables/useCuentasUsuario'
import { ROLES, obtenerNombreRol } from '~/composables/usePermisosRol'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useCambioEstadoCuenta } from '~/composables/useCambioEstadoCuenta'
import { normalizarCorreo } from '~/composables/useMascarasFormulario'
import { obtenerPrimerError, tieneErrores } from '~/composables/useValidacion'
import { useAutenticacionStore } from '~/stores/autenticacion'

definePageMeta({
  middleware: 'autenticacion',
})

const { listarCuentas, actualizarCuenta } = useCuentasUsuario()
const autenticacion = useAutenticacionStore()
const ruta = useRoute()

const idCuenta = Number(ruta.params.id)

const cuenta = ref<CuentaUsuario | null>(null)
const cuentas = ref<CuentaUsuario[]>([])
const cargando = ref(true)
const errorCarga = ref('')

const formulario = reactive<SolicitudActualizarCuenta>({
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  username: '',
})
const errores = reactive<ErroresEdicion>({})
const guardando = ref(false)
const errorGuardado = ref('')

async function cargarCuenta(): Promise<void> {
  cargando.value = true
  errorCarga.value = ''

  try {
    cuentas.value = await listarCuentas()
    cuenta.value = cuentas.value.find((existente) => existente.id === idCuenta) ?? null

    if (!cuenta.value) {
      errorCarga.value = 'No existe la cuenta de usuario indicada.'
      return
    }

    Object.assign(formulario, crearFormularioEdicion(cuenta.value))
  } catch (error: unknown) {
    errorCarga.value = obtenerMensajeError(error, 'No se pudo cargar la cuenta de usuario.')
  } finally {
    cargando.value = false
  }
}

onMounted(cargarCuenta)

const nombreSeparadoDisponible = computed(() => (cuenta.value ? tieneNombreSeparado(cuenta.value) : false))

const motivoProteccion = computed(() =>
  cuenta.value ? obtenerMotivoProteccion(cuenta.value, cuentas.value, autenticacion.usuario?.username ?? '') : '',
)

const esPropia = computed(() =>
  cuenta.value ? esCuentaPropia(cuenta.value, autenticacion.usuario?.username ?? '') : false,
)

const ayudaEstado = computed(() => {
  if (motivoProteccion.value) {
    return motivoProteccion.value
  }

  return cuenta.value?.activo === false
    ? 'Actívala para que pueda volver a iniciar sesión.'
    : 'Si la desactivas, no podrá iniciar sesión.'
})

const mensajeEstado = ref('')
const confirmandoCambioCorreo = ref(false)

const {
  cuentaPorDesactivar,
  idProcesando,
  errorConfirmacion,
  errorEstado,
  solicitarCambio,
  confirmarDesactivacion,
  cancelarDesactivacion,
} = useCambioEstadoCuenta((actualizada, mensaje) => {
  cuenta.value = actualizada
  cuentas.value = cuentas.value.map((existente) => (existente.id === actualizada.id ? actualizada : existente))
  mensajeEstado.value = mensaje
})

const textoEstado = computed(() => {
  if (cuenta.value?.activo === undefined) {
    return 'Sin información del estado'
  }

  return cuenta.value.activo ? 'Activa: puede iniciar sesión' : 'Inactiva: no puede iniciar sesión'
})

function limpiarError(campo: keyof SolicitudActualizarCuenta): void {
  errores[campo] = undefined
  errorGuardado.value = ''
}

const cambiaCorreoPropio = computed(
  () =>
    esPropia.value &&
    cuenta.value !== null &&
    normalizarCorreo(formulario.username) !== normalizarCorreo(cuenta.value.username),
)

async function guardar(): Promise<void> {
  if (!cuenta.value) {
    return
  }

  Object.assign(errores, validarEdicion(formulario, cuentas.value, cuenta.value.id))

  if (tieneErrores(errores)) {
    errorGuardado.value = obtenerPrimerError(errores)
    return
  }

  if (cambiaCorreoPropio.value) {
    confirmandoCambioCorreo.value = true
    return
  }

  await enviarCambios()
}

async function enviarCambios(): Promise<void> {
  if (!cuenta.value) {
    return
  }

  guardando.value = true
  errorGuardado.value = ''
  const cerrarSesion = cambiaCorreoPropio.value

  try {
    const actualizada = await actualizarCuenta(cuenta.value.id, construirSolicitudEdicion(formulario))

    if (cerrarSesion) {
      autenticacion.cerrarSesionPorCambioDeCorreo(actualizada.username)
      await navigateTo('/login')
      return
    }

    if (esPropia.value && autenticacion.usuario) {
      autenticacion.usuario.nombreCompleto = actualizada.nombreCompleto
    }

    await navigateTo({ path: '/usuarios', query: { editado: actualizada.username } })
  } catch (error: unknown) {
    errorGuardado.value = obtenerMensajeError(error, 'No se pudieron guardar los cambios.')
    confirmandoCambioCorreo.value = false
  } finally {
    guardando.value = false
  }
}

async function cancelar(): Promise<void> {
  await navigateTo('/usuarios')
}
</script>

<template>
  <main class="pagina-editar-usuario">
    <EncabezadoPagina
      titulo="Editar usuario"
      :descripcion="cuenta ? `Actualiza los datos de ${cuenta.nombreCompleto}.` : 'Actualiza los datos de la cuenta.'"
    >
      <template #acciones>
        <BotonAccion variante="secundario" :deshabilitado="guardando" @click="cancelar">Cancelar</BotonAccion>
        <BotonAccion tipo="submit" form="formulario-edicion" :deshabilitado="guardando || !cuenta">
          {{ guardando ? 'Guardando...' : 'Guardar cambios' }}
        </BotonAccion>
      </template>
    </EncabezadoPagina>

    <PanelEstadoCarga :cargando="cargando" :error="errorCarga" @reintentar="cargarCuenta">
      <AvisoMensaje v-if="errorGuardado" :mensaje="errorGuardado" tipo="error" />
      <AvisoMensaje v-if="mensajeEstado" :mensaje="mensajeEstado" tipo="exito" cerrable @cerrar="mensajeEstado = ''" />
      <AvisoMensaje v-if="errorEstado" :mensaje="errorEstado" tipo="error" cerrable @cerrar="errorEstado = ''" />

      <form v-if="cuenta" id="formulario-edicion" class="cuadricula" novalidate @submit.prevent="guardar">
        <div class="columna-principal">
          <section class="tarjeta" aria-labelledby="titulo-informacion">
            <h2 id="titulo-informacion">Información básica</h2>

            <p v-if="!nombreSeparadoDisponible" class="referencia">
              Nombre registrado: <strong>{{ cuenta.nombreCompleto }}</strong
              >. El sistema todavía no envía los nombres y apellidos por separado.
            </p>

            <div class="campos">
              <div class="campo">
                <label for="dni">DNI</label>
                <input id="dni" :value="cuenta.dni" type="text" disabled aria-describedby="ayuda-dni" />
                <small id="ayuda-dni" class="ayuda">El DNI identifica a la persona y no se modifica.</small>
              </div>

              <div class="campo">
                <label for="nombre">Nombres <span class="obligatorio">*</span></label>
                <input
                  id="nombre"
                  v-model="formulario.nombre"
                  type="text"
                  autocomplete="off"
                  :aria-invalid="Boolean(errores.nombre)"
                  :aria-describedby="errores.nombre ? 'error-nombre' : undefined"
                  @input="limpiarError('nombre')"
                />
                <small v-if="errores.nombre" id="error-nombre" class="error">{{ errores.nombre }}</small>
              </div>

              <div class="campo">
                <label for="apellido-paterno">Apellido paterno <span class="obligatorio">*</span></label>
                <input
                  id="apellido-paterno"
                  v-model="formulario.apellidoPaterno"
                  type="text"
                  autocomplete="off"
                  :aria-invalid="Boolean(errores.apellidoPaterno)"
                  :aria-describedby="errores.apellidoPaterno ? 'error-apellido-paterno' : undefined"
                  @input="limpiarError('apellidoPaterno')"
                />
                <small v-if="errores.apellidoPaterno" id="error-apellido-paterno" class="error">
                  {{ errores.apellidoPaterno }}
                </small>
              </div>

              <div class="campo">
                <label for="apellido-materno">Apellido materno <span class="obligatorio">*</span></label>
                <input
                  id="apellido-materno"
                  v-model="formulario.apellidoMaterno"
                  type="text"
                  autocomplete="off"
                  :aria-invalid="Boolean(errores.apellidoMaterno)"
                  :aria-describedby="errores.apellidoMaterno ? 'error-apellido-materno' : undefined"
                  @input="limpiarError('apellidoMaterno')"
                />
                <small v-if="errores.apellidoMaterno" id="error-apellido-materno" class="error">
                  {{ errores.apellidoMaterno }}
                </small>
              </div>

              <div class="campo ancho-completo">
                <label for="correo">Correo electrónico <span class="obligatorio">*</span></label>
                <input
                  id="correo"
                  v-model="formulario.username"
                  type="email"
                  :maxlength="LONGITUD_MAXIMA_CORREO"
                  autocomplete="off"
                  :aria-invalid="Boolean(errores.username)"
                  aria-describedby="ayuda-correo"
                  @input="limpiarError('username')"
                />
                <small v-if="errores.username" class="error">{{ errores.username }}</small>
                <small v-if="esPropia" id="ayuda-correo" class="aviso-correo-propio">
                  Es tu cuenta: si cambias el correo, se cerrará tu sesión y deberás ingresar con el nuevo.
                </small>
                <small v-else id="ayuda-correo" class="ayuda">
                  Es el usuario con el que inicia sesión: si lo cambias, deberá ingresar con el nuevo correo.
                </small>
              </div>
            </div>
          </section>
        </div>

        <aside class="columna-lateral">
          <section class="tarjeta" aria-labelledby="titulo-acceso">
            <h2 id="titulo-acceso">Rol y estado</h2>

            <div class="campo">
              <label for="rol">Rol asignado</label>
              <select id="rol" :value="cuenta.rol" disabled aria-describedby="ayuda-rol">
                <option v-for="rol in ROLES" :key="rol" :value="rol">{{ obtenerNombreRol(rol) }}</option>
              </select>
              <small id="ayuda-rol" class="ayuda">{{ MOTIVO_ROL_FIJO }}</small>
            </div>

            <div class="fila-estado">
              <InterruptorEstado
                :activo="cuenta.activo"
                etiqueta="Estado de la cuenta"
                :motivo="motivoProteccion"
                :procesando="idProcesando === cuenta.id"
                @cambiar="(activo) => cuenta && solicitarCambio(cuenta, activo)"
              />

              <div>
                <span class="texto-estado">{{ textoEstado }}</span>
                <small class="ayuda">{{ ayudaEstado }}</small>
              </div>
            </div>
          </section>
        </aside>
      </form>
    </PanelEstadoCarga>

    <VentanaConfirmacion
      :abierta="cuentaPorDesactivar !== null"
      titulo="Desactivar cuenta"
      :mensaje="`¿Desactivar la cuenta de ${cuentaPorDesactivar?.nombreCompleto ?? ''}? No podrá iniciar sesión mientras esté inactiva. Su información histórica se conserva.`"
      texto-confirmar="Desactivar cuenta"
      :procesando="idProcesando !== null"
      :error="errorConfirmacion"
      @confirmar="confirmarDesactivacion"
      @cancelar="cancelarDesactivacion"
    />

    <VentanaConfirmacion
      :abierta="confirmandoCambioCorreo"
      titulo="Cambiar tu correo"
      :mensaje="`Tu nuevo correo será ${normalizarCorreo(formulario.username)}. Al guardar se cerrará tu sesión: ingresa de nuevo con el nuevo correo y tu misma contraseña.`"
      texto-confirmar="Guardar y cerrar sesión"
      :procesando="guardando"
      @confirmar="enviarCambios"
      @cancelar="confirmandoCambioCorreo = false"
    />
  </main>
</template>

<style scoped>
.pagina-editar-usuario {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.cuadricula {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  align-items: start;
  gap: 24px;
}

.columna-principal,
.columna-lateral {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 24px;
}

.tarjeta {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.tarjeta h2 {
  margin: 0;
  padding-bottom: 14px;
  border-bottom: 1px solid #e5e7eb;
  color: #191c1e;
  font-size: 17px;
}

.referencia {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f2f4f6;
  color: #434655;
  font-size: 13px;
  line-height: 1.5;
}

.referencia strong {
  color: #191c1e;
}

.campos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.ancho-completo {
  grid-column: 1 / -1;
}

.campo label {
  color: #191c1e;
  font-size: 13px;
  font-weight: 500;
}

.campo input,
.campo select {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #f2f4f6;
  color: #191c1e;
  font-size: 14px;
}

.campo input:disabled,
.campo select:disabled {
  border-color: #e5e7eb;
  background: #f7f9fb;
  color: #737686;
  cursor: not-allowed;
}

.campo input:focus,
.campo select:focus {
  border-color: #004ac6;
  outline: 2px solid rgb(0 74 198 / 15%);
}

.campo input[aria-invalid='true'] {
  border-color: #ba1a1a;
}

.obligatorio,
.error {
  color: #ba1a1a;
}

.error,
.ayuda {
  font-size: 12px;
}

.ayuda {
  display: block;
  color: #737686;
}

.fila-estado {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.texto-estado {
  display: block;
  color: #191c1e;
  font-size: 14px;
  font-weight: 500;
}

@media (max-width: 960px) {
  .cuadricula {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .pagina-editar-usuario {
    padding: 20px 16px;
  }

  .campos {
    grid-template-columns: 1fr;
  }
}
.aviso-correo-propio {
  padding: 8px 10px;
  border: 1px solid #fde68a;
  border-radius: 7px;
  background: #fffbeb;
  color: #92400e;
  font-size: 12px;
}
</style>
