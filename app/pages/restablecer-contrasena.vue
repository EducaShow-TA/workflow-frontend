<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { ErroresRestablecimiento } from '~/types/autenticacion'
import { ErrorSolicitudApi } from '~/types/api'
import { obtenerMensajeError } from '~/composables/useDatosPrueba'
import {
  LONGITUD_MINIMA_CONTRASENA,
  evaluarFuerzaContrasena,
  useRecuperacionContrasena,
  validarRestablecimiento,
} from '~/composables/useRecuperacionContrasena'

definePageMeta({
  layout: 'autenticacion',
})

type Estado = 'formulario' | 'exito' | 'enlace-invalido'

const ruta = useRoute()
const { restablecerContrasena } = useRecuperacionContrasena()

const token = typeof ruta.query.token === 'string' ? ruta.query.token.trim() : ''
const estado = ref<Estado>(token ? 'formulario' : 'enlace-invalido')
const contrasena = ref('')
const confirmacion = ref('')
const mostrarContrasena = ref(false)
const mostrarConfirmacion = ref(false)
const guardando = ref(false)
const errorGeneral = ref('')
const errores = reactive<ErroresRestablecimiento>({})

const fuerza = computed(() => evaluarFuerzaContrasena(contrasena.value))
const cumpleLongitud = computed(() => contrasena.value.length >= LONGITUD_MINIMA_CONTRASENA)

async function guardarContrasena(): Promise<void> {
  errorGeneral.value = ''
  const encontrados = validarRestablecimiento(contrasena.value, confirmacion.value)
  errores.contrasena = encontrados.contrasena
  errores.confirmacion = encontrados.confirmacion

  if (encontrados.contrasena || encontrados.confirmacion) {
    return
  }

  guardando.value = true

  try {
    await restablecerContrasena({ token, password: contrasena.value })
    estado.value = 'exito'
  } catch (error: unknown) {
    if (error instanceof ErrorSolicitudApi && error.estado === 400) {
      estado.value = 'enlace-invalido'
      return
    }

    errorGeneral.value = obtenerMensajeError(error, 'No se pudo restablecer la contraseña. Inténtalo nuevamente.')
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <section v-if="estado === 'formulario'">
    <EncabezadoAcceso titulo="Restablecer contraseña" icono="candado">
      Crea una nueva contraseña para tu cuenta de EducaShow.
    </EncabezadoAcceso>

    <form class="formulario" novalidate @submit.prevent="guardarContrasena">
      <div class="grupo">
        <CampoFormulario
          id="nueva-contrasena"
          v-model:valor="contrasena"
          etiqueta="Nueva contraseña"
          :tipo="mostrarContrasena ? 'text' : 'password'"
          marcador="Ingresa tu nueva contraseña"
          autocompletado="new-password"
          :error="errores.contrasena"
          @update:valor="errores.contrasena = undefined"
        >
          <template #derecha>
            <button
              type="button"
              class="boton-visibilidad"
              :aria-label="mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :aria-pressed="mostrarContrasena"
              @click="mostrarContrasena = !mostrarContrasena"
            >
              {{ mostrarContrasena ? 'Ocultar' : 'Mostrar' }}
            </button>
          </template>
        </CampoFormulario>

        <div class="fuerza" :class="`nivel-${fuerza.nivel}`" aria-live="polite">
          <div class="fila">
            <span>Fuerza de la contraseña</span>
            <strong>{{ fuerza.etiqueta }}</strong>
          </div>
          <div class="barras" aria-hidden="true">
            <i v-for="barra in 4" :key="barra" :class="{ activa: barra <= fuerza.nivel }" />
          </div>
          <p class="requisito" :class="{ cumplido: cumpleLongitud }">
            {{ cumpleLongitud ? '✓' : '○' }} Al menos {{ LONGITUD_MINIMA_CONTRASENA }} caracteres
          </p>
          <p class="sugerencia">Sugerencia: una frase larga es más segura que mezclar símbolos.</p>
        </div>
      </div>

      <CampoFormulario
        id="confirmar-contrasena"
        v-model:valor="confirmacion"
        etiqueta="Confirmar nueva contraseña"
        :tipo="mostrarConfirmacion ? 'text' : 'password'"
        marcador="Repite la nueva contraseña"
        autocompletado="new-password"
        :error="errores.confirmacion"
        @update:valor="errores.confirmacion = undefined"
      >
        <template #derecha>
          <button
            type="button"
            class="boton-visibilidad"
            :aria-label="mostrarConfirmacion ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            :aria-pressed="mostrarConfirmacion"
            @click="mostrarConfirmacion = !mostrarConfirmacion"
          >
            {{ mostrarConfirmacion ? 'Ocultar' : 'Mostrar' }}
          </button>
        </template>
      </CampoFormulario>

      <AvisoMensaje v-if="errorGeneral" :mensaje="errorGeneral" tipo="error" />

      <BotonPrincipal tipo="submit" :deshabilitado="guardando">
        {{ guardando ? 'Guardando...' : 'Restablecer contraseña' }}
      </BotonPrincipal>

      <NuxtLink to="/login" class="enlace">← Volver al inicio de sesión</NuxtLink>
    </form>
  </section>

  <section v-else-if="estado === 'exito'">
    <EncabezadoAcceso titulo="Contraseña actualizada" icono="exito">
      Ya puedes iniciar sesión con tu nueva contraseña.
    </EncabezadoAcceso>

    <BotonPrincipal @click="navigateTo('/login')">Ir al inicio de sesión</BotonPrincipal>
  </section>

  <section v-else>
    <EncabezadoAcceso titulo="El enlace ya no es válido" icono="alerta">
      Venció, ya se usó o se pidió uno más nuevo. Solicita otro para continuar.
    </EncabezadoAcceso>

    <div class="formulario">
      <BotonPrincipal @click="navigateTo('/recuperar-contrasena')">Solicitar un nuevo enlace</BotonPrincipal>
      <NuxtLink to="/login" class="enlace">← Volver al inicio de sesión</NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.grupo {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.boton-visibilidad {
  position: absolute;
  top: 50%;
  right: 10px;
  padding: 4px;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
  transform: translateY(-50%);
}

.fuerza {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.fila {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.barras {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin-bottom: 6px;
}

.barras i {
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);
}

.nivel-1 strong {
  color: var(--color-error);
}

.nivel-1 .barras i.activa {
  background: var(--color-error);
}

.nivel-2 strong {
  color: var(--color-warning);
}

.nivel-2 .barras i.activa {
  background: var(--color-warning);
}

.nivel-3 strong,
.nivel-4 strong {
  color: var(--color-success);
}

.nivel-3 .barras i.activa,
.nivel-4 .barras i.activa {
  background: var(--color-success);
}

.requisito,
.sugerencia {
  margin: 2px 0;
}

.requisito.cumplido {
  color: var(--color-success);
}

.sugerencia {
  font-style: italic;
}

.enlace {
  align-self: center;
  color: var(--color-primary);
  font-size: 13px;
  text-decoration: none;
}

.enlace:hover {
  text-decoration: underline;
}
</style>
