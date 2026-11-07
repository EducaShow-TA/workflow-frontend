<script setup lang="ts">
import { computed, ref } from 'vue'
import type { RolUsuario } from '~/types/autenticacion'
import { ROLES, listarPermisosPorModulo, obtenerDescripcionRol, obtenerNombreRol } from '~/composables/usePermisosRol'

definePageMeta({
  middleware: 'autenticacion',
})

const ICONOS_MODULO: Record<string, string> = {
  Panel: '/icons/modulo-panel.svg',
  Estudiantes: '/icons/modulo-estudiantes.svg',
  Matrícula: '/icons/modulo-matricula.svg',
  'Grados y secciones': '/icons/modulo-secciones.svg',
  Competencias: '/icons/modulo-competencias.svg',
  'Usuarios y permisos': '/icons/modulo-usuarios.svg',
}

const rolSeleccionado = ref<RolUsuario>('ADMINISTRADOR')

const modulos = computed(() => listarPermisosPorModulo(rolSeleccionado.value))
const cantidadPermisos = computed(() => modulos.value.reduce((total, grupo) => total + grupo.permisos.length, 0))
const tieneSensibles = computed(() => modulos.value.some((grupo) => grupo.permisos.some((permiso) => permiso.sensible)))

const resumenPermisos = computed(() => {
  const permisos = cantidadPermisos.value === 1 ? 'permiso' : 'permisos'
  const modulosTexto = modulos.value.length === 1 ? 'módulo' : 'módulos'
  return `${cantidadPermisos.value} ${permisos} en ${modulos.value.length} ${modulosTexto}.`
})

function seleccionarRol(rol: RolUsuario): void {
  rolSeleccionado.value = rol
}

function moverEntrePestanas(evento: KeyboardEvent): void {
  const indice = ROLES.indexOf(rolSeleccionado.value)
  const desplazamiento = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0

  if (desplazamiento === 0) {
    return
  }

  evento.preventDefault()
  const siguiente = ROLES[(indice + desplazamiento + ROLES.length) % ROLES.length]

  if (siguiente) {
    rolSeleccionado.value = siguiente
    document.getElementById(`pestana-${siguiente}`)?.focus()
  }
}
</script>

<template>
  <main class="pagina-roles">
    <EncabezadoPagina
      titulo="Roles y permisos"
      descripcion="Consulta qué puede hacer cada tipo de usuario en EducaShow. Los permisos vienen definidos por el rol."
    />

    <div class="pestanas" role="tablist" aria-label="Roles del sistema" @keydown="moverEntrePestanas">
      <button
        v-for="rol in ROLES"
        :id="`pestana-${rol}`"
        :key="rol"
        type="button"
        role="tab"
        class="pestana"
        :class="{ activa: rol === rolSeleccionado }"
        :aria-selected="rol === rolSeleccionado"
        :tabindex="rol === rolSeleccionado ? 0 : -1"
        aria-controls="panel-permisos"
        @click="seleccionarRol(rol)"
      >
        {{ obtenerNombreRol(rol) }}
      </button>
    </div>

    <section id="panel-permisos" class="panel-permisos" role="tabpanel" :aria-labelledby="`pestana-${rolSeleccionado}`">
      <p class="resumen-rol">
        {{ obtenerDescripcionRol(rolSeleccionado) }}
        <strong v-if="cantidadPermisos > 0">{{ resumenPermisos }}</strong>
      </p>

      <div v-if="tieneSensibles" class="aviso-sensible">
        <img src="/icons/aviso-sensible.svg" alt="" />

        <div>
          <strong>Acciones sensibles resaltadas</strong>
          <p>Los permisos resaltados en rojo permiten eliminar información del sistema.</p>
        </div>
      </div>

      <p v-if="modulos.length === 0" class="sin-permisos">
        Este rol todavía no tiene permisos en el sistema. Sus módulos (asistencia, calificaciones y pagos) llegarán en
        los sprints 2 y 3.
      </p>

      <div v-else class="cuadricula-modulos">
        <article v-for="grupo in modulos" :key="grupo.modulo" class="tarjeta-modulo">
          <header class="encabezado-modulo">
            <span class="icono-modulo">
              <img :src="ICONOS_MODULO[grupo.modulo]" alt="" />
            </span>
            <h2>{{ grupo.modulo }}</h2>
          </header>

          <ul class="lista-permisos">
            <li
              v-for="permiso in grupo.permisos"
              :key="permiso.codigo"
              class="fila-permiso"
              :class="{ sensible: permiso.sensible }"
            >
              <span class="nombre-permiso">
                {{ permiso.nombre }}
                <img v-if="permiso.sensible" src="/icons/aviso-sensible.svg" alt="(acción sensible)" />
              </span>
              <small>{{ permiso.descripcion }}</small>
            </li>
          </ul>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped>
.pagina-roles {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: calc(100vh - 90px);
  padding: 32px;
}

.pestanas {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid #c3c6d7;
}

.pestana {
  padding: 8px 18px;
  border: 1px solid #c3c6d7;
  border-radius: 999px;
  background: white;
  color: #191c1e;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.pestana:hover:not(.activa) {
  background: #eef2ff;
}

.pestana.activa {
  border-color: #003e9f;
  background: #003e9f;
  color: white;
  font-weight: 600;
}

.pestana:focus-visible {
  outline: 2px solid #004ac6;
  outline-offset: 2px;
}

.panel-permisos {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.resumen-rol {
  margin: 0;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
}

.resumen-rol strong {
  color: #191c1e;
}

.aviso-sensible {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  border: 1px solid #fcd9a8;
  border-radius: 10px;
  background: #fff4e5;
  color: #c2410c;
}

.aviso-sensible strong {
  font-size: 14px;
}

.aviso-sensible p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.cuadricula-modulos {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 20px;
}

.tarjeta-modulo {
  overflow: hidden;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: white;
}

.encabezado-modulo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: #f7f9fb;
}

.encabezado-modulo h2 {
  margin: 0;
  color: #191c1e;
  font-size: 18px;
}

.icono-modulo {
  display: flex;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #dbe1ff;
}

.lista-permisos {
  margin: 0;
  padding: 0 18px;
  list-style: none;
}

.fila-permiso {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 0;
  border-top: 1px solid #e5e7eb;
}

.fila-permiso:first-child {
  border-top: 0;
}

.fila-permiso.sensible {
  margin: 0 -18px;
  padding: 14px 18px;
  background: #fef2f2;
}

.nombre-permiso {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #191c1e;
  font-size: 14px;
  font-weight: 500;
}

.nombre-permiso img {
  width: 16px;
  height: 16px;
}

.fila-permiso.sensible .nombre-permiso,
.fila-permiso.sensible small {
  color: #ba1a1a;
}

.fila-permiso small {
  color: #434655;
  font-size: 12px;
  line-height: 1.4;
}

.sin-permisos {
  margin: 0;
  padding: 40px 24px;
  border: 1px dashed #c3c6d7;
  border-radius: 12px;
  background: white;
  color: #434655;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
}

@media (max-width: 1200px) {
  .cuadricula-modulos {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .pagina-roles {
    padding: 20px 16px;
  }

  .cuadricula-modulos {
    grid-template-columns: 1fr;
  }
}
</style>
