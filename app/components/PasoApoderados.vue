<script setup lang="ts">
import { ref } from 'vue'
import type { ApoderadoRegistro, TipoDocumento } from '~/types/registroEstudiante'

import {
  formatearCelular,
  normalizarCelular,
  normalizarCorreo,
  normalizarDocumento,
  normalizarNombre,
} from '~/composables/useMascarasFormulario'

type CampoEditable = 'nombres' | 'apellidos' | 'numeroDocumento' | 'celular' | 'correoElectronico'

type ErroresApoderado = Record<
  'nombres' | 'apellidos' | 'parentesco' | 'numeroDocumento' | 'celular' | 'correoElectronico',
  string
>

const apoderados = defineModel<ApoderadoRegistro[]>({
  required: true,
})

const errores = ref<ErroresApoderado[]>([])
const mensajeGeneral = ref('')

function crearApoderado(): ApoderadoRegistro {
  return {
    nombres: '',
    apellidos: '',
    parentesco: '',
    tipoDocumento: 'DNI',
    numeroDocumento: '',
    celular: '',
    correoElectronico: '',
    esPrincipal: false,
  }
}

function agregarApoderado(): void {
  apoderados.value = [...apoderados.value, crearApoderado()]

  mensajeGeneral.value = ''
}

function eliminarApoderado(indice: number): void {
  if (apoderados.value.length <= 1) {
    return
  }

  const nuevos = apoderados.value.filter((_, i) => i !== indice)

  if (!nuevos.some((apoderado) => apoderado.esPrincipal)) {
    nuevos[0] = {
      ...nuevos[0]!,
      esPrincipal: true,
    }
  }

  apoderados.value = nuevos
  errores.value = []
  mensajeGeneral.value = ''
}

function seleccionarPrincipal(indice: number): void {
  apoderados.value = apoderados.value.map((apoderado, i) => ({
    ...apoderado,
    esPrincipal: i === indice,
  }))

  mensajeGeneral.value = ''
}

function cambiarParentesco(evento: Event, indice: number): void {
  const entrada = evento.target as HTMLSelectElement

  apoderados.value = apoderados.value.map((apoderado, i) =>
    i === indice ? { ...apoderado, parentesco: entrada.value } : apoderado,
  )

  if (errores.value[indice]) {
    errores.value[indice]!.parentesco = ''
  }
}

function cambiarTipoDocumento(evento: Event, indice: number): void {
  const entrada = evento.target as HTMLSelectElement

  apoderados.value = apoderados.value.map((apoderado, i) =>
    i === indice
      ? {
          ...apoderado,
          tipoDocumento: entrada.value as TipoDocumento,
          numeroDocumento: '',
        }
      : apoderado,
  )

  if (errores.value[indice]) {
    errores.value[indice]!.numeroDocumento = ''
  }
}

function cambiarCampo(evento: Event, indice: number, campo: CampoEditable): void {
  const entrada = evento.target as HTMLInputElement
  const apoderado = apoderados.value[indice]

  if (!apoderado) {
    return
  }

  let valor = entrada.value

  if (campo === 'numeroDocumento') {
    valor = normalizarDocumento(valor, apoderado.tipoDocumento)
    entrada.value = valor
  }

  if (campo === 'celular') {
    valor = normalizarCelular(valor)
    entrada.value = formatearCelular(valor)
  }

  apoderados.value = apoderados.value.map((actual, i) => (i === indice ? { ...actual, [campo]: valor } : actual))

  if (errores.value[indice]) {
    errores.value[indice]![campo] = ''
  }
}

function validar(): boolean {
  mensajeGeneral.value = ''

  apoderados.value = apoderados.value.map((apoderado) => ({
    ...apoderado,
    nombres: normalizarNombre(apoderado.nombres),
    apellidos: normalizarNombre(apoderado.apellidos),
    numeroDocumento: normalizarDocumento(apoderado.numeroDocumento, apoderado.tipoDocumento),
    celular: normalizarCelular(apoderado.celular),
    correoElectronico: normalizarCorreo(apoderado.correoElectronico),
  }))

  errores.value = apoderados.value.map((apoderado) => {
    const error: ErroresApoderado = {
      nombres: '',
      apellidos: '',
      parentesco: '',
      numeroDocumento: '',
      celular: '',
      correoElectronico: '',
    }

    if (!apoderado.nombres) {
      error.nombres = 'Los nombres son obligatorios.'
    }

    if (!apoderado.apellidos) {
      error.apellidos = 'Los apellidos son obligatorios.'
    }

    if (!apoderado.parentesco) {
      error.parentesco = 'Selecciona el parentesco.'
    }

    if (apoderado.tipoDocumento === 'DNI') {
      if (!/^\d{8}$/.test(apoderado.numeroDocumento)) {
        error.numeroDocumento = 'El DNI debe tener 8 dígitos.'
      }
    } else if (!/^[A-Z0-9]{6,12}$/.test(apoderado.numeroDocumento)) {
      error.numeroDocumento = 'El pasaporte debe tener entre 6 y 12 caracteres.'
    }

    if (!/^9\d{8}$/.test(apoderado.celular)) {
      error.celular = 'El celular debe tener 9 dígitos y comenzar en 9.'
    }

    if (apoderado.correoElectronico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(apoderado.correoElectronico)) {
      error.correoElectronico = 'Ingresa un correo válido.'
    }

    return error
  })

  const tienePrincipal = apoderados.value.filter((apoderado) => apoderado.esPrincipal).length === 1

  if (!tienePrincipal) {
    mensajeGeneral.value = 'Debes designar exactamente un apoderado principal.'
  }

  return (
    apoderados.value.length > 0 &&
    tienePrincipal &&
    errores.value.every((error) => Object.values(error).every((mensaje) => mensaje === ''))
  )
}

defineExpose({
  validar,
})
</script>

<template>
  <section class="paso-apoderados">
    <div class="encabezado-seccion">
      <div>
        <h2>Datos de los Apoderados</h2>

        <p>Registra al menos un apoderado y selecciona quién será el principal.</p>
      </div>

      <button type="button" class="boton-agregar" @click="agregarApoderado">+ Agregar apoderado</button>
    </div>

    <article v-for="(apoderado, indice) in apoderados" :key="indice" class="tarjeta-apoderado">
      <div class="encabezado-tarjeta">
        <h3>Apoderado {{ indice + 1 }}</h3>

        <button v-if="apoderados.length > 1" type="button" class="boton-eliminar" @click="eliminarApoderado(indice)">
          Eliminar
        </button>
      </div>

      <div class="cuadricula">
        <div class="campo">
          <label :for="`nombres-apoderado-${indice}`">Nombres *</label>
          <input
            :id="`nombres-apoderado-${indice}`"
            :value="apoderado.nombres"
            type="text"
            placeholder="Ej. María Elena"
            autocomplete="off"
            @input="cambiarCampo($event, indice, 'nombres')"
          />
          <small v-if="errores[indice]?.nombres" class="error">
            {{ errores[indice]?.nombres }}
          </small>
        </div>

        <div class="campo">
          <label :for="`apellidos-apoderado-${indice}`">Apellidos *</label>
          <input
            :id="`apellidos-apoderado-${indice}`"
            :value="apoderado.apellidos"
            type="text"
            placeholder="Ej. Pérez Gómez"
            autocomplete="off"
            @input="cambiarCampo($event, indice, 'apellidos')"
          />
          <small v-if="errores[indice]?.apellidos" class="error">
            {{ errores[indice]?.apellidos }}
          </small>
        </div>

        <div class="campo">
          <label :for="`parentesco-${indice}`">Parentesco *</label>
          <select
            :id="`parentesco-${indice}`"
            :value="apoderado.parentesco"
            @change="cambiarParentesco($event, indice)"
          >
            <option value="">Seleccione</option>
            <option value="MADRE">Madre</option>
            <option value="PADRE">Padre</option>
            <option value="TUTOR">Tutor legal</option>
            <option value="OTRO">Otro</option>
          </select>
          <small v-if="errores[indice]?.parentesco" class="error">
            {{ errores[indice]?.parentesco }}
          </small>
        </div>

        <div class="campo">
          <label :for="`documento-apoderado-${indice}`"> Documento de identidad * </label>

          <div class="grupo-documento">
            <select
              :value="apoderado.tipoDocumento"
              :aria-label="`Tipo de documento del apoderado ${indice + 1}`"
              @change="cambiarTipoDocumento($event, indice)"
            >
              <option value="DNI">DNI</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>

            <input
              :id="`documento-apoderado-${indice}`"
              :value="apoderado.numeroDocumento"
              type="text"
              :inputmode="apoderado.tipoDocumento === 'DNI' ? 'numeric' : 'text'"
              :maxlength="apoderado.tipoDocumento === 'DNI' ? 8 : 12"
              placeholder="Número de documento"
              @input="cambiarCampo($event, indice, 'numeroDocumento')"
            />
          </div>

          <small v-if="errores[indice]?.numeroDocumento" class="error">
            {{ errores[indice]?.numeroDocumento }}
          </small>
        </div>

        <div class="campo">
          <label :for="`celular-apoderado-${indice}`">Celular *</label>
          <input
            :id="`celular-apoderado-${indice}`"
            :value="formatearCelular(apoderado.celular)"
            type="tel"
            inputmode="numeric"
            maxlength="11"
            placeholder="999 999 999"
            autocomplete="off"
            @input="cambiarCampo($event, indice, 'celular')"
          />
          <small v-if="errores[indice]?.celular" class="error">
            {{ errores[indice]?.celular }}
          </small>
        </div>

        <div class="campo">
          <label :for="`correo-apoderado-${indice}`"> Correo electrónico (opcional) </label>
          <input
            :id="`correo-apoderado-${indice}`"
            :value="apoderado.correoElectronico"
            type="email"
            placeholder="apoderado@correo.com"
            autocomplete="off"
            @input="cambiarCampo($event, indice, 'correoElectronico')"
          />
          <small v-if="errores[indice]?.correoElectronico" class="error">
            {{ errores[indice]?.correoElectronico }}
          </small>
        </div>
      </div>

      <label class="selector-principal">
        <input
          type="radio"
          name="apoderado-principal"
          :checked="apoderado.esPrincipal"
          @change="seleccionarPrincipal(indice)"
        />
        <span>Designar como apoderado principal</span>
      </label>
    </article>

    <p v-if="mensajeGeneral" class="error-general" role="alert">
      {{ mensajeGeneral }}
    </p>
  </section>
</template>

<style scoped>
.paso-apoderados {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.encabezado-seccion,
.encabezado-tarjeta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

h2 {
  margin: 0 0 5px;
  color: #191c1e;
  font-size: 20px;
}

.encabezado-seccion p {
  margin: 0;
  color: #434655;
  font-size: 13px;
}

.boton-agregar {
  padding: 10px 14px;
  border: 1px solid #004ac6;
  border-radius: 8px;
  background: #ffffff;
  color: #004ac6;
  font-weight: 600;
  cursor: pointer;
}

.tarjeta-apoderado {
  padding: 20px;
  border: 1px solid #c3c6d7;
  border-radius: 10px;
  background: #ffffff;
}

.encabezado-tarjeta {
  margin-bottom: 20px;
}

.encabezado-tarjeta h3 {
  margin: 0;
  font-size: 16px;
}

.boton-eliminar {
  padding: 6px 10px;
  border: 0;
  background: transparent;
  color: #ba1a1a;
  cursor: pointer;
}

.cuadricula {
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

.campo label {
  color: #191c1e;
  font-size: 13px;
  font-weight: 500;
}

.campo input,
.campo select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: #f2f4f6;
  font-size: 14px;
}

.campo input:focus,
.campo select:focus {
  border-color: #004ac6;
  outline: 2px solid rgb(0 74 198 / 15%);
}

.grupo-documento {
  display: flex;
  gap: 8px;
}

.grupo-documento select {
  max-width: 125px;
}

.selector-principal {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 20px;
  color: #003e9f;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.selector-principal input {
  width: 16px;
  height: 16px;
  accent-color: #004ac6;
}

.error,
.error-general {
  color: #ba1a1a;
  font-size: 12px;
}

.error-general {
  margin: 0;
}

@media (max-width: 750px) {
  .encabezado-seccion {
    align-items: flex-start;
    flex-direction: column;
  }

  .cuadricula {
    grid-template-columns: 1fr;
  }
}
</style>
