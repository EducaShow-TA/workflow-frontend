<script setup lang="ts">
import { reactive, ref } from 'vue'
import PasoApoderados from '~/components/PasoApoderados.vue'
import PasoConfirmacion from '~/components/PasoConfirmacion.vue'
import type { RegistroEstudiante } from '~/types/registroEstudiante'
import { obtenerMensajeError } from '~/composables/useMensajesError'
import { useApi } from '~/composables/useApi'
import {
  formatearCelular,
  normalizarCelular,
  normalizarCorreo,
  normalizarDocumento,
  normalizarNombre,
} from '~/composables/useMascarasFormulario'

definePageMeta({
  middleware: 'autenticacion',
})

const pasoActual = ref<1 | 2 | 3 | 4>(1)
const mensajeEstado = ref('')
const pasoApoderados = ref<InstanceType<typeof PasoApoderados> | null>(null)

const pasos = ['Datos Personales', 'Contacto', 'Apoderados', 'Confirmación']
const { solicitar } = useApi()
const enviando = ref(false)

const formulario = reactive<RegistroEstudiante>({
  username: '',
  password: '',
  tipoDocumento: 'DNI',
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  numeroDocumento: '',
  fechaNacimiento: '',
  genero: '',
  nacionalidad: '',
  correoElectronico: '',
  celular: '',
  direccion: '',
  apoderados: [
    {
      nombres: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      parentesco: '',
      tipoDocumento: 'DNI',
      numeroDocumento: '',
      celular: '',
      correoElectronico: '',
      esPrincipal: true,
    },
  ],
})

const errores = reactive({
  nombres: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  numeroDocumento: '',
  fechaNacimiento: '',
  username: '',
  password: '',
  correoElectronico: '',
  celular: '',
})

const fechaActual = new Date()

const fechaMaxima = [
  fechaActual.getFullYear(),
  String(fechaActual.getMonth() + 1).padStart(2, '0'),
  String(fechaActual.getDate()).padStart(2, '0'),
].join('-')

function cambiarTipoDocumento(): void {
  formulario.numeroDocumento = ''
  errores.numeroDocumento = ''
}

function cambiarDocumento(evento: Event): void {
  const entrada = evento.target as HTMLInputElement

  const valor = normalizarDocumento(entrada.value, formulario.tipoDocumento)

  formulario.numeroDocumento = valor
  entrada.value = valor
  errores.numeroDocumento = ''
}

function cambiarCelular(evento: Event): void {
  const entrada = evento.target as HTMLInputElement
  const valor = normalizarCelular(entrada.value)

  formulario.celular = valor
  entrada.value = formatearCelular(valor)
  errores.celular = ''
}

function normalizarDatosPersonales(): void {
  formulario.nombres = normalizarNombre(formulario.nombres)
  formulario.apellidoPaterno = normalizarNombre(formulario.apellidoPaterno)
  formulario.apellidoMaterno = normalizarNombre(formulario.apellidoMaterno)
}

function validarDatosPersonales(): boolean {
  normalizarDatosPersonales()

  errores.nombres = ''
  errores.apellidoPaterno = ''
  errores.apellidoMaterno = ''
  errores.numeroDocumento = ''
  errores.fechaNacimiento = ''

  if (!formulario.nombres) {
    errores.nombres = 'Los nombres son obligatorios.'
  }

  if (!formulario.apellidoPaterno) {
    errores.apellidoPaterno = 'El apellido paterno es obligatorio.'
  }
  if (!formulario.apellidoMaterno) {
    errores.apellidoMaterno = 'El apellido materno es obligatorio.'
  }

  if (!formulario.numeroDocumento) {
    errores.numeroDocumento = 'El documento es obligatorio.'
  } else if (formulario.tipoDocumento === 'DNI' && !/^\d{8}$/.test(formulario.numeroDocumento)) {
    errores.numeroDocumento = 'El DNI debe contener exactamente 8 dígitos.'
  } else if (formulario.tipoDocumento === 'PASAPORTE' && !/^[A-Z0-9]{6,12}$/.test(formulario.numeroDocumento)) {
    errores.numeroDocumento = 'Ingresa un pasaporte alfanumérico de 6 a 12 caracteres.'
  }

  if (!formulario.fechaNacimiento) {
    errores.fechaNacimiento = 'La fecha de nacimiento es obligatoria.'
  } else if (formulario.fechaNacimiento > fechaMaxima) {
    errores.fechaNacimiento = 'La fecha no puede ser futura.'
  }

  return !(errores.nombres || errores.apellidoPaterno || errores.apellidoMaterno || errores.numeroDocumento || errores.fechaNacimiento)
}

function validarContacto(): boolean {
  errores.username = ''
  errores.password = ''

  if (!formulario.username.trim()) {
    errores.username = 'El usuario es obligatorio.'
  } else if (formulario.username.length > 50) {
    errores.username = 'El usuario no debe superar 50 caracteres.'
  }

  if (formulario.password.length < 8 || formulario.password.length > 72) {
    errores.password = 'La contraseña debe tener entre 8 y 72 caracteres.'
  }

  formulario.correoElectronico = normalizarCorreo(formulario.correoElectronico)

  formulario.direccion = formulario.direccion.trim()

  errores.correoElectronico = ''
  errores.celular = ''

  const formatoCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (formulario.correoElectronico && !formatoCorreo.test(formulario.correoElectronico)) {
    errores.correoElectronico = 'Ingresa un correo electrónico válido.'
  }

  if (formulario.celular && !/^9\d{8}$/.test(formulario.celular)) {
    errores.celular = 'El celular debe tener 9 dígitos y comenzar en 9.'
  }

  return !(errores.username || errores.password || errores.correoElectronico || errores.celular)
}

function siguientePaso(): void {
  mensajeEstado.value = ''

  if (pasoActual.value === 1) {
    if (validarDatosPersonales()) {
      pasoActual.value = 2
    }
    return
  }

  if (pasoActual.value === 2) {
    if (validarContacto()) {
      pasoActual.value = 3
    }
    return
  }

  if (pasoActual.value === 3 && pasoApoderados.value?.validar()) {
    pasoActual.value = 4
  }
}

function anteriorPaso(): void {
  mensajeEstado.value = ''

  if (pasoActual.value === 4) {
    pasoActual.value = 3
  } else if (pasoActual.value === 3) {
    pasoActual.value = 2
  } else if (pasoActual.value === 2) {
    pasoActual.value = 1
  }
}

function editarPaso(paso: 1 | 2 | 3): void {
  mensajeEstado.value = ''
  pasoActual.value = paso
}

async function cancelarRegistro(): Promise<void> {
  await navigateTo('/estudiantes')
}

async function registrarEstudiante(): Promise<void> {
  if (enviando.value) return
  enviando.value = true
  mensajeEstado.value = ''
  try {
    await solicitar('/api/v1/estudiantes', {
      metodo: 'POST',
      cuerpo: {
        username: formulario.username.trim(),
        password: formulario.password,
        tipoDocumento: formulario.tipoDocumento,
        numeroDocumento: formulario.numeroDocumento,
        nombres: formulario.nombres,
        apellidoPaterno: formulario.apellidoPaterno,
        apellidoMaterno: formulario.apellidoMaterno,
        fechaNacimiento: formulario.fechaNacimiento,
        genero: formulario.genero || null,
        nacionalidad: formulario.nacionalidad || null,
        direccion: formulario.direccion || null,
        celular: formulario.celular || null,
        correoElectronico: formulario.correoElectronico || null,
        apoderados: formulario.apoderados.map((apoderado) => ({
          tipoDocumento: apoderado.tipoDocumento,
          numeroDocumento: apoderado.numeroDocumento,
          nombres: apoderado.nombres,
          apellidoPaterno: apoderado.apellidoPaterno,
          apellidoMaterno: apoderado.apellidoMaterno,
          celular: apoderado.celular,
          correoElectronico: apoderado.correoElectronico || null,
          parentesco: apoderado.parentesco === 'TUTOR' ? 'TUTOR_LEGAL' : apoderado.parentesco,
          esPrincipal: apoderado.esPrincipal,
        })),
      },
    })
    mensajeEstado.value = 'Estudiante registrado correctamente.'
    await navigateTo('/estudiantes')
  } catch (error: unknown) {
    mensajeEstado.value = obtenerMensajeError(error, 'No se pudo registrar al estudiante.')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="pagina-registro">
    <header class="encabezado-registro">
      <div>
        <h1>Registro de Estudiante</h1>

        <p>Complete la información requerida para inscribir a un nuevo alumno en el sistema.</p>
      </div>

      <span class="nota-csv">La carga de estudiantes se realiza desde Usuarios &gt; Carga masiva.</span>
    </header>

    <section class="tarjeta-registro" aria-label="Registro de estudiante">
      <ol class="indicador-pasos" aria-label="Etapas del registro">
        <li
          v-for="(paso, indice) in pasos"
          :key="paso"
          :class="{
            actual: indice + 1 === pasoActual,
            completado: indice + 1 < pasoActual,
          }"
          :aria-current="indice + 1 === pasoActual ? 'step' : undefined"
        >
          <span class="numero-paso">
            {{ indice + 1 < pasoActual ? '✓' : indice + 1 }}
          </span>

          <span>{{ paso }}</span>
        </li>
      </ol>

      <form novalidate @submit.prevent="siguientePaso">
        <div v-if="pasoActual === 1" class="contenido-formulario">
          <div class="campo">
            <label for="nombres"> Nombres <span class="obligatorio">*</span> </label>

            <input
              id="nombres"
              v-model="formulario.nombres"
              type="text"
              placeholder="Ej. Juan Pablo"
              autocomplete="given-name"
              :aria-invalid="Boolean(errores.nombres)"
              :aria-describedby="errores.nombres ? 'error-nombres' : undefined"
              @input="errores.nombres = ''"
            />

            <small v-if="errores.nombres" id="error-nombres" class="error">
              {{ errores.nombres }}
            </small>
          </div>

          <div class="campo">
            <label for="apellido-paterno"> Apellido paterno <span class="obligatorio">*</span> </label>

            <input
              id="apellido-paterno"
              v-model="formulario.apellidoPaterno"
              type="text"
              placeholder="Ej. Pérez"
              autocomplete="family-name"
              :aria-invalid="Boolean(errores.apellidoPaterno)"
              :aria-describedby="errores.apellidoPaterno ? 'error-apellido-paterno' : undefined"
              @input="errores.apellidoPaterno = ''"
            />

            <small v-if="errores.apellidoPaterno" id="error-apellido-paterno" class="error">
              {{ errores.apellidoPaterno }}
            </small>
          </div>

          <div class="campo">
            <label for="apellido-materno"> Apellido materno <span class="obligatorio">*</span> </label>
            <input id="apellido-materno" v-model="formulario.apellidoMaterno" type="text" placeholder="Ej. Díaz" autocomplete="additional-name" :aria-invalid="Boolean(errores.apellidoMaterno)" @input="errores.apellidoMaterno = ''" />
            <small v-if="errores.apellidoMaterno" class="error">{{ errores.apellidoMaterno }}</small>
          </div>

          <div class="campo">
            <label for="numero-documento">
              Doc. Identidad (DNI/Pasaporte)
              <span class="obligatorio">*</span>
            </label>

            <div class="grupo-documento">
              <select v-model="formulario.tipoDocumento" aria-label="Tipo de documento" @change="cambiarTipoDocumento">
                <option value="DNI">DNI</option>
                <option value="PASAPORTE">Pasaporte</option>
              </select>

              <input
                id="numero-documento"
                :value="formulario.numeroDocumento"
                type="text"
                :inputmode="formulario.tipoDocumento === 'DNI' ? 'numeric' : 'text'"
                :maxlength="formulario.tipoDocumento === 'DNI' ? 8 : 12"
                :placeholder="formulario.tipoDocumento === 'DNI' ? '12345678' : 'Número de pasaporte'"
                autocomplete="off"
                :aria-invalid="Boolean(errores.numeroDocumento)"
                :aria-describedby="errores.numeroDocumento ? 'error-documento' : undefined"
                @input="cambiarDocumento"
              />
            </div>

            <small v-if="errores.numeroDocumento" id="error-documento" class="error">
              {{ errores.numeroDocumento }}
            </small>
          </div>

          <div class="campo">
            <label for="fecha-nacimiento"> Fecha de Nacimiento <span class="obligatorio">*</span> </label>

            <input
              id="fecha-nacimiento"
              v-model="formulario.fechaNacimiento"
              type="date"
              :max="fechaMaxima"
              autocomplete="bday"
              :aria-invalid="Boolean(errores.fechaNacimiento)"
              :aria-describedby="errores.fechaNacimiento ? 'error-fecha' : undefined"
              @input="errores.fechaNacimiento = ''"
            />

            <small v-if="errores.fechaNacimiento" id="error-fecha" class="error">
              {{ errores.fechaNacimiento }}
            </small>
          </div>

          <div class="campo">
            <label for="genero">Género</label>

            <select id="genero" v-model="formulario.genero">
              <option value="">Seleccione</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMENINO">Femenino</option>
              <option value="OTRO">Otro</option>
              <option value="NO_INDICA">Prefiero no indicar</option>
            </select>
          </div>

          <div class="campo">
            <label for="nacionalidad">Nacionalidad</label>

            <select id="nacionalidad" v-model="formulario.nacionalidad">
              <option value="">Seleccione</option>
              <option value="PERUANA">Peruana</option>
              <option value="EXTRANJERA">Extranjera</option>
              <option value="OTRA">Otra</option>
            </select>
          </div>
        </div>

        <div v-else-if="pasoActual === 2" class="contenido-formulario">
          <div class="campo">
            <label for="username">Usuario <span class="obligatorio">*</span></label>
            <input id="username" v-model="formulario.username" type="text" autocomplete="username" required placeholder="alumno01" :aria-invalid="Boolean(errores.username)" />
            <small v-if="errores.username" class="error">{{ errores.username }}</small>
          </div>
          <div class="campo">
            <label for="password">Contraseña inicial <span class="obligatorio">*</span></label>
            <input id="password" v-model="formulario.password" type="password" autocomplete="new-password" minlength="8" maxlength="72" required :aria-invalid="Boolean(errores.password)" />
            <small v-if="errores.password" class="error">{{ errores.password }}</small>
          </div>
          <div class="campo">
            <label for="correo-contacto"> Correo electrónico (opcional) </label>

            <input
              id="correo-contacto"
              v-model="formulario.correoElectronico"
              type="email"
              placeholder="estudiante@correo.com"
              autocomplete="email"
              :aria-invalid="Boolean(errores.correoElectronico)"
              :aria-describedby="errores.correoElectronico ? 'error-correo' : undefined"
              @blur="formulario.correoElectronico = normalizarCorreo(formulario.correoElectronico)"
              @input="errores.correoElectronico = ''"
            />

            <small v-if="errores.correoElectronico" id="error-correo" class="error">
              {{ errores.correoElectronico }}
            </small>
          </div>

          <div class="campo">
            <label for="celular-contacto"> Celular peruano (opcional) </label>

            <input
              id="celular-contacto"
              :value="formatearCelular(formulario.celular)"
              type="tel"
              inputmode="numeric"
              maxlength="11"
              placeholder="999 999 999"
              autocomplete="tel-national"
              :aria-invalid="Boolean(errores.celular)"
              :aria-describedby="errores.celular ? 'error-celular' : undefined"
              @input="cambiarCelular"
            />

            <small v-if="errores.celular" id="error-celular" class="error">
              {{ errores.celular }}
            </small>
          </div>

          <div class="campo ancho-completo">
            <label for="direccion-contacto"> Dirección de residencia (opcional) </label>

            <input
              id="direccion-contacto"
              v-model="formulario.direccion"
              type="text"
              placeholder="Ej. Av. Principal 123, Lima"
              autocomplete="street-address"
            />
          </div>

          <p class="aviso-contacto ancho-completo">
            Si el estudiante no tiene correo o celular propio, podrás registrar los datos de su apoderado en la
            siguiente etapa.
          </p>
        </div>

        <div v-else-if="pasoActual === 3" class="contenido-apoderados">
          <PasoApoderados ref="pasoApoderados" v-model="formulario.apoderados" />
        </div>
        <div v-else class="contenido-confirmacion">
          <PasoConfirmacion :datos="formulario" @editar="editarPaso" />
        </div>
        <footer class="acciones-formulario">
          <div class="acciones-izquierda">
            <button type="button" class="boton-cancelar" @click="cancelarRegistro">Cancelar</button>

            <button v-if="pasoActual > 1" type="button" class="boton-anterior" @click="anteriorPaso">← Anterior</button>
          </div>

          <button v-if="pasoActual < 4" type="submit" class="boton-siguiente">Siguiente →</button>

          <button v-else type="button" class="boton-siguiente" :disabled="enviando" @click="registrarEstudiante">
            {{ enviando ? 'Registrando…' : 'Registrar estudiante' }}
          </button>
        </footer>
      </form>
    </section>

    <p v-if="mensajeEstado" class="mensaje-estado" role="status">
      {{ mensajeEstado }}
    </p>

  </main>
</template>

<style scoped>
.pagina-registro {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 32px;
}

.encabezado-registro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

h1 {
  margin: 0 0 6px;
  color: #191c1e;
  font-size: 28px;
}

.encabezado-registro p {
  margin: 0;
  color: #434655;
  font-size: 14px;
}

.nota-csv {
  color: #434655;
  font-size: 13px;
}



.tarjeta-registro {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.indicador-pasos {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
  padding: 22px 24px;
  border-bottom: 1px solid #c3c6d7;
  list-style: none;
}

.indicador-pasos li {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #434655;
  font-size: 13px;
}

.indicador-pasos li.actual {
  color: #003e9f;
  font-weight: 600;
}

.indicador-pasos li.completado {
  color: #047857;
}

.numero-paso {
  display: flex;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e5e7eb;
  color: #434655;
}

.actual .numero-paso {
  background: #004ac6;
  color: white;
}

.completado .numero-paso {
  background: #047857;
  color: white;
}

.contenido-apoderados {
  padding: 32px;
}

.contenido-formulario {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  padding: 32px;
}

.campo {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.campo label {
  color: #191c1e;
  font-size: 13px;
  font-weight: 500;
}

.grupo-documento {
  display: flex;
  gap: 8px;
}

.campo .grupo-documento select {
  width: 125px;
  flex-shrink: 0;
}

.grupo-documento input {
  min-width: 0;
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

.campo input[aria-invalid='true'] {
  border-color: #ba1a1a;
}

.obligatorio,
.error {
  color: #ba1a1a;
}

.error {
  font-size: 12px;
}

.ancho-completo {
  grid-column: 1 / -1;
}

.aviso-contacto {
  margin: 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: #f2f4f6;
  color: #434655;
  font-size: 13px;
}

.acciones-formulario {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  border-top: 1px solid #c3c6d7;
  background: #f7f9fb;
}

.acciones-izquierda {
  display: flex;
  gap: 10px;
}

.boton-cancelar,
.boton-anterior,
.boton-siguiente {
  min-height: 36px;
  padding: 9px 18px;
  border: 0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.boton-cancelar {
  background: #ef535a;
  color: white;
}

.boton-anterior {
  border: 1px solid #c3c6d7;
  background: white;
  color: #191c1e;
}

.boton-siguiente {
  min-width: 130px;
  background: #003e9f;
  color: white;
}

.boton-siguiente:hover {
  background: #00307a;
}

.mensaje-estado {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid #a7d7ba;
  border-radius: 8px;
  background: #ecfdf5;
  color: #047857;
  font-size: 14px;
}

.nota-registro {
  margin: 0;
  color: #737686;
  font-size: 12px;
}

@media (max-width: 850px) {
  .indicador-pasos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .contenido-apoderados {
    padding: 32px;
  }

  .contenido-formulario {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .pagina-registro {
    padding: 16px;
  }

  .encabezado-registro {
    flex-direction: column;
  }

  .indicador-pasos {
    padding: 16px;
  }

  .contenido-apoderados {
    padding: 32px;
  }

  .contenido-formulario {
    padding: 20px 16px;
  }

  .acciones-formulario {
    flex-wrap: wrap;
  }
}

.contenido-confirmacion {
  padding: 32px;
}

.boton-siguiente:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .contenido-confirmacion {
    padding: 20px 16px;
  }
}
</style>
