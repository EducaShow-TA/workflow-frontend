<script setup lang="ts">
import { computed } from 'vue'
import type { RegistroEstudiante } from '~/types/registroEstudiante'
import { formatearCelular } from '~/composables/useMascarasFormulario'

const propiedades = defineProps<{
  datos: RegistroEstudiante
}>()

const emitir = defineEmits<{
  editar: [paso: 1 | 2 | 3]
}>()

const fechaNacimiento = computed(() => {
  const fecha = propiedades.datos.fechaNacimiento

  if (!fecha) {
    return 'No registrado'
  }

  const [anhio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anhio}`
})

function mostrarValor(valor: string): string {
  return valor.trim() || 'No registrado'
}

function mostrarCelular(valor: string): string {
  return valor ? formatearCelular(valor) : 'No registrado'
}

function mostrarGenero(valor: string): string {
  const opciones: Record<string, string> = {
    MASCULINO: 'Masculino',
    FEMENINO: 'Femenino',
    OTRO: 'Otro',
    NO_INDICA: 'Prefiero no indicar',
  }

  return opciones[valor] ?? 'No registrado'
}

function mostrarNacionalidad(valor: string): string {
  const opciones: Record<string, string> = {
    PERUANA: 'Peruana',
    EXTRANJERA: 'Extranjera',
    OTRA: 'Otra',
  }

  return opciones[valor] ?? 'No registrado'
}

function mostrarParentesco(valor: string): string {
  const opciones: Record<string, string> = {
    MADRE: 'Madre',
    PADRE: 'Padre',
    TUTOR: 'Tutor legal',
    OTRO: 'Otro',
  }

  return opciones[valor] ?? valor
}
</script>

<template>
  <section class="paso-confirmacion" aria-label="Confirmación de datos">
    <div class="introduccion">
      <h2>Revisar información del estudiante</h2>

      <p>Comprueba que los datos sean correctos antes de realizar el registro definitivo.</p>
    </div>

    <section class="bloque-resumen">
      <div class="encabezado-bloque">
        <h3>Datos Personales</h3>

        <button type="button" @click="emitir('editar', 1)">Editar</button>
      </div>

      <dl class="cuadricula-datos">
        <div>
          <dt>Usuario de acceso</dt>
          <dd>{{ datos.username }}</dd>
        </div>
        <div>
          <dt>Nombres</dt>
          <dd>{{ datos.nombres }}</dd>
        </div>

        <div>
          <dt>Apellidos</dt>
          <dd>{{ datos.apellidoPaterno }} {{ datos.apellidoMaterno }}</dd>
        </div>

        <div>
          <dt>Tipo de documento</dt>
          <dd>{{ datos.tipoDocumento }}</dd>
        </div>

        <div>
          <dt>Número de documento</dt>
          <dd>{{ datos.numeroDocumento }}</dd>
        </div>

        <div>
          <dt>Fecha de nacimiento</dt>
          <dd>{{ fechaNacimiento }}</dd>
        </div>

        <div>
          <dt>Género</dt>
          <dd>{{ mostrarGenero(datos.genero) }}</dd>
        </div>

        <div>
          <dt>Nacionalidad</dt>
          <dd>{{ mostrarNacionalidad(datos.nacionalidad) }}</dd>
        </div>
      </dl>
    </section>

    <section class="bloque-resumen">
      <div class="encabezado-bloque">
        <h3>Contacto</h3>

        <button type="button" @click="emitir('editar', 2)">Editar</button>
      </div>

      <dl class="cuadricula-datos">
        <div>
          <dt>Correo electrónico</dt>
          <dd>{{ mostrarValor(datos.correoElectronico) }}</dd>
        </div>

        <div>
          <dt>Celular</dt>
          <dd>{{ mostrarCelular(datos.celular) }}</dd>
        </div>

        <div class="ancho-completo">
          <dt>Dirección de residencia</dt>
          <dd>{{ mostrarValor(datos.direccion) }}</dd>
        </div>
      </dl>
    </section>

    <section class="bloque-resumen">
      <div class="encabezado-bloque">
        <h3>Apoderados</h3>

        <button type="button" @click="emitir('editar', 3)">Editar</button>
      </div>

      <div v-for="(apoderado, indice) in datos.apoderados" :key="indice" class="resumen-apoderado">
        <div class="titulo-apoderado">
          <h4>Apoderado {{ indice + 1 }}</h4>

          <span v-if="apoderado.esPrincipal" class="etiqueta-principal"> Principal </span>
        </div>

        <dl class="cuadricula-datos">
          <div>
            <dt>Nombres y apellidos</dt>
            <dd>{{ apoderado.nombres }} {{ apoderado.apellidoPaterno }} {{ apoderado.apellidoMaterno }}</dd>
          </div>

          <div>
            <dt>Parentesco</dt>
            <dd>{{ mostrarParentesco(apoderado.parentesco) }}</dd>
          </div>

          <div>
            <dt>Documento</dt>
            <dd>
              {{ apoderado.tipoDocumento }}:
              {{ apoderado.numeroDocumento }}
            </dd>
          </div>

          <div>
            <dt>Celular</dt>
            <dd>{{ mostrarCelular(apoderado.celular) }}</dd>
          </div>

          <div class="ancho-completo">
            <dt>Correo electrónico</dt>
            <dd>{{ mostrarValor(apoderado.correoElectronico) }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <div class="aviso-pendiente" role="note">
      <strong>Cuenta de acceso</strong>

      <p>
        Se creará una cuenta para el estudiante con el usuario y la contraseña inicial indicados.
      </p>
    </div>
  </section>
</template>

<style scoped>
.paso-confirmacion {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.introduccion h2 {
  margin: 0 0 6px;
  color: #191c1e;
  font-size: 20px;
  font-weight: 600;
}

.introduccion p {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

.bloque-resumen {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 10px;
  background: #ffffff;
}

.encabezado-bloque {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e3e5;
  background: #f7f9fb;
}

.encabezado-bloque h3 {
  margin: 0;
  color: #191c1e;
  font-size: 16px;
  font-weight: 600;
}

.encabezado-bloque button {
  padding: 7px 12px;
  border: 1px solid #004ac6;
  border-radius: 6px;
  background: white;
  color: #004ac6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.encabezado-bloque button:hover {
  background: #eff4ff;
}

.encabezado-bloque button:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.cuadricula-datos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin: 0;
  padding: 20px;
}

.cuadricula-datos div {
  min-width: 0;
}

.cuadricula-datos dt {
  margin-bottom: 6px;
  color: #737686;
  font-size: 12px;
}

.cuadricula-datos dd {
  margin: 0;
  overflow-wrap: anywhere;
  color: #191c1e;
  font-size: 14px;
  font-weight: 500;
}

.ancho-completo {
  grid-column: 1 / -1;
}

.resumen-apoderado + .resumen-apoderado {
  border-top: 1px solid #e0e3e5;
}

.titulo-apoderado {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 0;
}

.titulo-apoderado h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.etiqueta-principal {
  padding: 5px 10px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  font-size: 12px;
  font-weight: 600;
}

.aviso-pendiente {
  padding: 16px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: #f7f9fb;
}

.aviso-pendiente strong {
  color: #003e9f;
  font-size: 14px;
}

.aviso-pendiente p {
  margin: 8px 0 0;
  color: #434655;
  font-size: 13px;
  line-height: 1.6;
}

@media (max-width: 650px) {
  .cuadricula-datos {
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 16px;
  }
}
</style>
