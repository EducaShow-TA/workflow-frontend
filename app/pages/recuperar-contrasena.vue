<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import {
  MINUTOS_VIGENCIA_ENLACE,
  SEGUNDOS_ESPERA_REENVIO,
  useRecuperacionContrasena,
} from '~/composables/useRecuperacionContrasena'

definePageMeta({
  layout: 'autenticacion',
})

const ruta = useRoute()
const { solicitarRecuperacion } = useRecuperacionContrasena()

const correo = ref(typeof ruta.query.correo === 'string' ? ruta.query.correo : '')
const errorCorreo = ref('')
const errorEnvio = ref('')
const enviando = ref(false)
const enviado = ref(false)
const reenviado = ref(false)
const segundosParaReenviar = ref(0)
let temporizador: ReturnType<typeof setInterval> | undefined

function validarCorreo(): boolean {
  const valor = correo.value.trim()

  if (!valor) {
    errorCorreo.value = 'El correo electrónico es obligatorio.'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
    errorCorreo.value = 'Ingresa un correo electrónico válido.'
  } else {
    errorCorreo.value = ''
  }

  return !errorCorreo.value
}

function iniciarEsperaReenvio(): void {
  clearInterval(temporizador)
  segundosParaReenviar.value = SEGUNDOS_ESPERA_REENVIO
  temporizador = setInterval(() => {
    segundosParaReenviar.value -= 1

    if (segundosParaReenviar.value <= 0) {
      clearInterval(temporizador)
    }
  }, 1000)
}

async function enviarInstrucciones(): Promise<void> {
  errorEnvio.value = ''

  if (!validarCorreo()) {
    return
  }

  enviando.value = true

  try {
    await solicitarRecuperacion({ username: correo.value.trim() })
    reenviado.value = enviado.value
    enviado.value = true
    iniciarEsperaReenvio()
  } catch (error: unknown) {
    errorEnvio.value = obtenerMensajeError(error, 'No se pudieron enviar las instrucciones. Inténtalo nuevamente.')
  } finally {
    enviando.value = false
  }
}

function usarOtroCorreo(): void {
  enviado.value = false
  reenviado.value = false
  errorEnvio.value = ''
}

onBeforeUnmount(() => clearInterval(temporizador))
</script>

<template>
  <section v-if="!enviado">
    <EncabezadoAcceso titulo="Recuperar contraseña" icono="llave">
      Ingresa el correo con el que inicias sesión y te enviaremos un enlace para crear una nueva contraseña.
    </EncabezadoAcceso>

    <form class="formulario" novalidate @submit.prevent="enviarInstrucciones">
      <CampoFormulario
        id="correo-recuperacion"
        v-model:valor="correo"
        etiqueta="Correo electrónico"
        tipo="email"
        marcador="tu@correo.com"
        autocompletado="username"
        :error="errorCorreo"
      />

      <AvisoMensaje v-if="errorEnvio" :mensaje="errorEnvio" tipo="error" />

      <BotonPrincipal tipo="submit" :deshabilitado="enviando">
        {{ enviando ? 'Enviando...' : 'Enviar instrucciones' }}
      </BotonPrincipal>

      <NuxtLink to="/login" class="enlace centrado">← Volver a iniciar sesión</NuxtLink>
    </form>
  </section>

  <section v-else>
    <EncabezadoAcceso titulo="Revisa tu correo" icono="correo">
      Si <strong>{{ correo.trim() }}</strong> está registrado, recibirás un enlace para restablecer tu contraseña.
    </EncabezadoAcceso>

    <div class="formulario">
      <p class="vigencia" role="status">
        <template v-if="reenviado">Te enviamos un nuevo enlace; el anterior ya no funciona. </template>
        El enlace vence en <strong>{{ MINUTOS_VIGENCIA_ENLACE }} minutos</strong> y solo se puede usar una vez. Revisa
        también la carpeta de spam.
      </p>

      <AvisoMensaje v-if="errorEnvio" :mensaje="errorEnvio" tipo="error" />

      <BotonPrincipal @click="navigateTo('/login')">← Volver al inicio de sesión</BotonPrincipal>

      <p class="reenvio">
        ¿No recibiste el correo?
        <button
          type="button"
          class="enlace"
          :disabled="enviando || segundosParaReenviar > 0"
          @click="enviarInstrucciones"
        >
          {{ segundosParaReenviar > 0 ? `Reenviar en ${segundosParaReenviar} s` : 'Reenviar instrucciones' }}
        </button>
      </p>

      <button type="button" class="enlace centrado" @click="usarOtroCorreo">Usar otro correo</button>
    </div>
  </section>
</template>

<style scoped>
.formulario {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.enlace {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
}

.enlace:hover:not(:disabled) {
  text-decoration: underline;
}

.enlace:disabled {
  color: var(--color-text-secondary);
  cursor: not-allowed;
}

.centrado {
  align-self: center;
}

.vigencia {
  margin: 0;
  padding: 12px;
  border: 1px solid #bfdbfe;
  border-radius: var(--radius-md);
  background: #eff6ff;
  color: #1e3a8a;
  font-size: 13px;
  line-height: 1.5;
}

.reenvio {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-align: center;
}
</style>
