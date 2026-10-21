<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { CuentaUsuario, ErroresCuenta, FormularioCuenta } from '~/types/cuentaUsuario'
import {
  LONGITUD_DNI,
  LONGITUD_MAXIMA_CORREO,
  LONGITUD_MINIMA_PASSWORD,
  construirSolicitud,
  crearFormularioVacio,
  useCuentasUsuario,
  validarCuenta,
} from '~/composables/useCuentasUsuario'
import { ROLES, listarModulosPermitidos, obtenerDescripcionRol, obtenerNombreRol } from '~/composables/usePermisosRol'
import { normalizarDocumento } from '~/composables/useMascarasFormulario'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import { obtenerPrimerError, tieneErrores } from '~/composables/useValidacion'

definePageMeta({
  middleware: 'autenticacion',
})

const { listarCuentas, crearCuenta } = useCuentasUsuario()

const formulario = reactive<FormularioCuenta>(crearFormularioVacio())
const errores = reactive<ErroresCuenta>({})
const cuentasExistentes = ref<CuentaUsuario[]>([])
const guardando = ref(false)
const errorGuardado = ref('')
const mostrarPassword = ref(false)

onMounted(async () => {
  try {
    cuentasExistentes.value = await listarCuentas()
  } catch {
    cuentasExistentes.value = []
  }
})

const modulosDelRol = computed(() => (formulario.rol ? listarModulosPermitidos(formulario.rol) : []))

function limpiarError(campo: keyof FormularioCuenta): void {
  errores[campo] = undefined
  errorGuardado.value = ''
}

function cambiarDni(evento: Event): void {
  const elemento = evento.target as HTMLInputElement
  formulario.dni = normalizarDocumento(elemento.value, 'DNI')
  elemento.value = formulario.dni
  limpiarError('dni')
}

async function guardar(): Promise<void> {
  Object.assign(errores, validarCuenta(formulario, cuentasExistentes.value))

  if (tieneErrores(errores) || !formulario.rol) {
    errorGuardado.value = obtenerPrimerError(errores)
    return
  }

  guardando.value = true
  errorGuardado.value = ''

  try {
    const cuenta = await crearCuenta(construirSolicitud(formulario, formulario.rol))
    await navigateTo({ path: '/usuarios', query: { creado: cuenta.username } })
  } catch (error: unknown) {
    errorGuardado.value = obtenerMensajeError(error, 'No se pudo crear la cuenta.')
  } finally {
    guardando.value = false
  }
}

async function cancelar(): Promise<void> {
  await navigateTo('/usuarios')
}
</script>

<template>
  <main class="pagina-nuevo-usuario">
    <EncabezadoPagina
      titulo="Crear nuevo usuario"
      descripcion="Registra a una persona y asígnale el rol con el que ingresará al sistema."
    >
      <template #acciones>
        <BotonAccion variante="secundario" :deshabilitado="guardando" @click="cancelar">Cancelar</BotonAccion>
        <BotonAccion tipo="submit" form="formulario-usuario" :deshabilitado="guardando">
          {{ guardando ? 'Guardando...' : 'Guardar usuario' }}
        </BotonAccion>
      </template>
    </EncabezadoPagina>

    <AvisoMensaje v-if="errorGuardado" :mensaje="errorGuardado" tipo="error" />

    <form id="formulario-usuario" class="cuadricula" novalidate @submit.prevent="guardar">
      <div class="columna-principal">
        <section class="tarjeta" aria-labelledby="titulo-informacion">
          <h2 id="titulo-informacion">Información básica</h2>

          <div class="campos">
            <div class="campo">
              <label for="dni">DNI <span class="obligatorio">*</span></label>
              <input
                id="dni"
                :value="formulario.dni"
                type="text"
                inputmode="numeric"
                :maxlength="LONGITUD_DNI"
                placeholder="12345678"
                autocomplete="off"
                :aria-invalid="Boolean(errores.dni)"
                :aria-describedby="errores.dni ? 'error-dni' : undefined"
                @input="cambiarDni"
              />
              <small v-if="errores.dni" id="error-dni" class="error">{{ errores.dni }}</small>
            </div>

            <div class="campo">
              <label for="nombre">Nombres <span class="obligatorio">*</span></label>
              <input
                id="nombre"
                v-model="formulario.nombre"
                type="text"
                placeholder="Ej. María Fernanda"
                autocomplete="given-name"
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
                placeholder="Ej. Quispe"
                autocomplete="family-name"
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
                placeholder="Ej. Rojas"
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
                placeholder="nombre@colegio.edu.pe"
                autocomplete="off"
                :aria-invalid="Boolean(errores.username)"
                aria-describedby="ayuda-correo"
                @input="limpiarError('username')"
              />
              <small v-if="errores.username" class="error">{{ errores.username }}</small>
              <small id="ayuda-correo" class="ayuda">Es el usuario con el que iniciará sesión.</small>
            </div>
          </div>
        </section>

        <section class="tarjeta" aria-labelledby="titulo-rol">
          <h2 id="titulo-rol">Rol y acceso</h2>

          <div class="campo">
            <label for="rol">Rol asignado <span class="obligatorio">*</span></label>
            <select
              id="rol"
              v-model="formulario.rol"
              :aria-invalid="Boolean(errores.rol)"
              :aria-describedby="errores.rol ? 'error-rol' : undefined"
              @change="limpiarError('rol')"
            >
              <option value="" disabled>Selecciona un rol...</option>
              <option v-for="rol in ROLES" :key="rol" :value="rol">{{ obtenerNombreRol(rol) }}</option>
            </select>
            <small v-if="errores.rol" id="error-rol" class="error">{{ errores.rol }}</small>
          </div>

          <div class="capacidades" aria-live="polite">
            <h3>Capacidades del rol</h3>

            <template v-if="formulario.rol">
              <p>{{ obtenerDescripcionRol(formulario.rol) }}</p>

              <ul v-if="modulosDelRol.length > 0" class="lista-modulos">
                <li v-for="modulo in modulosDelRol" :key="modulo">{{ modulo }}</li>
              </ul>

              <p v-else class="sin-modulos">
                Este rol todavía no tiene pantallas en el sistema; podrá iniciar sesión, pero verá un aviso de acceso
                denegado.
              </p>

              <NuxtLink to="/roles-permisos" class="enlace-permisos">Ver el detalle en Roles y permisos</NuxtLink>
            </template>

            <p v-else>Selecciona un rol para ver un resumen de lo que podrá hacer en el sistema.</p>
          </div>
        </section>
      </div>

      <aside class="columna-lateral">
        <section class="tarjeta" aria-labelledby="titulo-seguridad">
          <h2 id="titulo-seguridad">Seguridad de la cuenta</h2>

          <div class="campo">
            <label for="password">Contraseña inicial <span class="obligatorio">*</span></label>
            <input
              id="password"
              v-model="formulario.password"
              :type="mostrarPassword ? 'text' : 'password'"
              autocomplete="new-password"
              :aria-invalid="Boolean(errores.password)"
              aria-describedby="ayuda-password"
              @input="limpiarError('password')"
            />
            <small v-if="errores.password" class="error">{{ errores.password }}</small>
            <small id="ayuda-password" class="ayuda">Mínimo {{ LONGITUD_MINIMA_PASSWORD }} caracteres.</small>
          </div>

          <div class="campo">
            <label for="confirmacion-password">Confirmar contraseña <span class="obligatorio">*</span></label>
            <input
              id="confirmacion-password"
              v-model="formulario.confirmacionPassword"
              :type="mostrarPassword ? 'text' : 'password'"
              autocomplete="new-password"
              :aria-invalid="Boolean(errores.confirmacionPassword)"
              :aria-describedby="errores.confirmacionPassword ? 'error-confirmacion' : undefined"
              @input="limpiarError('confirmacionPassword')"
            />
            <small v-if="errores.confirmacionPassword" id="error-confirmacion" class="error">
              {{ errores.confirmacionPassword }}
            </small>
          </div>

          <label class="casilla">
            <input v-model="mostrarPassword" type="checkbox" />
            Mostrar contraseña
          </label>

          <p class="nota">
            La cuenta se crea <strong>activa</strong>. Comparte la contraseña con el usuario por un medio seguro: el
            sistema todavía no envía correos de bienvenida.
          </p>
        </section>
      </aside>
    </form>
  </main>
</template>

<style scoped>
.pagina-nuevo-usuario {
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

.campo input::placeholder {
  color: #737686;
}

.campo input:focus,
.campo select:focus {
  border-color: #004ac6;
  outline: 2px solid rgb(0 74 198 / 15%);
}

.campo input[aria-invalid='true'],
.campo select[aria-invalid='true'] {
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
  color: #737686;
}

.capacidades {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 10px;
  background: #f7f9fb;
  color: #434655;
  font-size: 13px;
  line-height: 1.5;
}

.capacidades h3 {
  margin: 0;
  color: #191c1e;
  font-size: 14px;
}

.capacidades p {
  margin: 0;
}

.lista-modulos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista-modulos li {
  padding: 4px 10px;
  border-radius: 999px;
  background: #dbe1ff;
  color: #003e9f;
  font-size: 12px;
  font-weight: 600;
}

.sin-modulos {
  color: #92400e;
}

.enlace-permisos {
  align-self: flex-start;
  color: #004ac6;
  font-weight: 600;
}

.casilla {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #434655;
  font-size: 13px;
  cursor: pointer;
}

.nota {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f2f4f6;
  color: #434655;
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 960px) {
  .cuadricula {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .pagina-nuevo-usuario {
    padding: 20px 16px;
  }

  .campos {
    grid-template-columns: 1fr;
  }
}
</style>
