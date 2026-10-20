<script setup lang="ts">
import { useAutenticacionStore } from '~/stores/autenticacion'
definePageMeta({
  layout: 'autenticacion',
})

const autenticacion = useAutenticacionStore()

const correoElectronico = ref('')
const contrasenia = ref('')
const mostrarContrasenia = ref(false)
const mensajeInformativo = ref('')

const errores = reactive({
  correoElectronico: '',
  contrasenia: '',
})

function validarFormulario(): boolean {
  const correo = correoElectronico.value.trim()
  const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  errores.correoElectronico = ''
  errores.contrasenia = ''

  if (!correo) {
    errores.correoElectronico = 'El correo electrónico es obligatorio.'
  } else if (!formatoCorreo.test(correo)) {
    errores.correoElectronico = 'Ingresa un correo electrónico válido.'
  }

  if (!contrasenia.value) {
    errores.contrasenia = 'La contraseña es obligatoria.'
  }

  return !errores.correoElectronico && !errores.contrasenia
}

async function procesarInicioSesion(): Promise<void> {
  mensajeInformativo.value = ''

  if (!validarFormulario()) {
    return
  }

  const resultado = await autenticacion.iniciarSesion(correoElectronico.value.trim(), contrasenia.value)

  if (!resultado.exito) {
    mensajeInformativo.value = resultado.mensaje
    return
  }

  await navigateTo('/panel')
}

function informarRecuperacion(): void {
  mensajeInformativo.value = 'La recuperación de contraseña se implementará en el siguiente paso.'
}
</script>

<template>
  <section class="inicio-sesion">
    <div class="marca">
      <div class="marca-icono" aria-hidden="true">E</div>

      <span>EducaShow</span>
    </div>

    <header class="encabezado">
      <h1>Bienvenido de nuevo</h1>

      <p>Ingresa tus credenciales para acceder al portal.</p>
    </header>

    <form class="formulario" novalidate @submit.prevent="procesarInicioSesion">
      <CampoFormulario
        id="correo-electronico"
        v-model:valor="correoElectronico"
        etiqueta="Correo Electrónico"
        tipo="email"
        marcador="a@a.com"
        autocompletado="username"
        :error="errores.correoElectronico"
      />

      <CampoFormulario
        id="contrasenia"
        v-model:valor="contrasenia"
        etiqueta="Contraseña"
        :tipo="mostrarContrasenia ? 'text' : 'password'"
        marcador="Ingresa tu contraseña"
        autocompletado="current-password"
        :error="errores.contrasenia"
      >
        <template #derecha>
          <button
            type="button"
            class="boton-visibilidad"
            :aria-label="mostrarContrasenia ? 'Ocultar contraseña' : 'Mostrar contraseña'"
            :aria-pressed="mostrarContrasenia"
            @click="mostrarContrasenia = !mostrarContrasenia"
          >
            {{ mostrarContrasenia ? 'Ocultar' : 'Mostrar' }}
          </button>
        </template>
      </CampoFormulario>

      <div class="opciones">
        <label class="recordar-sesion" title="Disponible al conectar el servicio REST">
          <input type="checkbox" disabled />
          <span>Recordar sesión</span>
        </label>

        <button type="button" class="enlace-recuperacion" @click="informarRecuperacion">
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      <BotonPrincipal tipo="submit"> Iniciar sesión </BotonPrincipal>

      <p v-if="mensajeInformativo" class="mensaje-informativo" role="status">
        {{ mensajeInformativo }}
      </p>
    </form>
  </section>
</template>

<style scoped>
.marca {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 48px;
  color: var(--color-text);
  font-size: 24px;
  font-weight: 700;
}

.marca-icono {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: white;
  font-weight: 700;
}

.encabezado {
  margin-bottom: 32px;
}

.encabezado h1 {
  margin: 0 0 4px;
  font-size: 32px;
  font-weight: 600;
}

.encabezado p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 16px;
  line-height: 1.5;
}

.formulario {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.opciones {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.recordar-sesion {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.recordar-sesion input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.enlace-recuperacion {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-primary);
  font-size: 12px;
  cursor: pointer;
}

.enlace-recuperacion:hover {
  text-decoration: underline;
}

.mensaje-informativo {
  margin: 0;
  padding: 12px;
  border-radius: var(--radius-md);
  background-color: var(--color-background);
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 480px) {
  .opciones {
    align-items: flex-start;
    flex-direction: column;
  }

  .encabezado h1 {
    font-size: 28px;
  }
}
</style>
