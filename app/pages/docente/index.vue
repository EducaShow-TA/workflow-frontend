<script setup lang="ts">
import { computed } from 'vue'
import { useAutenticacionStore } from '~/stores/autenticacion'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const autenticacion = useAutenticacionStore()
const saludo = computed(() => autenticacion.usuario?.nombreCompleto?.trim().split(/\s+/)[0] || 'docente')
const indicadores = [
  { nombre: 'Clases de hoy', descripcion: 'A la espera del horario asignado', icono: '/icons/menu-horarios.svg' },
  { nombre: 'Tareas activas', descripcion: 'Pendiente de consulta por docente', icono: '/icons/menu-tareas.svg' },
  {
    nombre: 'Notas por registrar',
    descripcion: 'Pendiente de consulta por docente',
    icono: '/icons/menu-competencias.svg',
  },
]
const accesos = [
  {
    titulo: 'Mis tareas',
    descripcion: 'Crear tareas y consultar las entregas por sección.',
    destino: '/docente/tareas',
    icono: '/icons/menu-tareas.svg',
  },
  {
    titulo: 'Calificaciones',
    descripcion: 'Registrar notas AD, A, B o C y sus evidencias.',
    destino: '/docente/calificaciones',
    icono: '/icons/menu-competencias.svg',
  },
  {
    titulo: 'Asistencia',
    descripcion: 'Controlar la asistencia de alumnos en cada sesión.',
    destino: '/docente/asistencia',
    icono: '/icons/menu-estudiantes.svg',
  },
  {
    titulo: 'Mi horario',
    descripcion: 'Consultar la agenda semanal o del día.',
    destino: '/docente/horario',
    icono: '/icons/menu-horarios.svg',
  },
]
</script>

<template>
  <main class="docente-vista">
    <div class="docente-titulo docente-titulo--principal">
      <div>
        <span class="docente-sobrelinea">Panel académico</span>
        <h1>Bienvenido, {{ saludo }}</h1>
        <p>Accede a las herramientas de enseñanza y seguimiento de tus estudiantes.</p>
      </div>
      <span class="docente-insignia">Portal Docente</span>
    </div>

    <div class="docente-aviso" role="status">
      <strong>Primera versión de interfaz</strong>
      <span
        >Las pantallas están disponibles para revisión visual. Los datos del docente y sus secciones se conectarán
        cuando el backend exponga los servicios correspondientes.</span
      >
    </div>

    <section aria-labelledby="resumen-docente">
      <h2 id="resumen-docente" class="docente-seccion-titulo">Resumen académico</h2>
      <div class="docente-grid docente-grid--tres">
        <article v-for="indicador in indicadores" :key="indicador.nombre" class="docente-tarjeta docente-indicador">
          <div class="docente-indicador__icono"><img :src="indicador.icono" alt="" /></div>
          <span class="docente-indicador__nombre">{{ indicador.nombre }}</span>
          <strong class="docente-indicador__valor">—</strong>
          <small>{{ indicador.descripcion }}</small>
        </article>
      </div>
    </section>

    <section aria-labelledby="acciones-docente">
      <h2 id="acciones-docente" class="docente-seccion-titulo">Accesos rápidos</h2>
      <div class="docente-grid docente-grid--dos">
        <NuxtLink v-for="acceso in accesos" :key="acceso.destino" :to="acceso.destino" class="docente-acceso">
          <span class="docente-acceso__icono"><img :src="acceso.icono" alt="" /></span>
          <span class="docente-acceso__texto"
            ><strong>{{ acceso.titulo }}</strong
            ><small>{{ acceso.descripcion }}</small></span
          >
          <span class="docente-acceso__flecha" aria-hidden="true">›</span>
        </NuxtLink>
      </div>
    </section>

    <section class="docente-tarjeta" aria-labelledby="mis-secciones">
      <div class="docente-tarjeta__titulo">
        <h2 id="mis-secciones">Mis secciones asignadas</h2>
        <span class="docente-insignia docente-insignia--neutral">Sin sincronizar</span>
      </div>
      <DocenteEstadoVacio
        titulo="Todavía no se pueden consultar tus secciones"
        descripcion="Es necesario un endpoint que devuelva únicamente los cursos y las secciones asignados al docente autenticado. No se muestran datos de otros docentes."
        icono="/icons/menu-clases.svg"
      />
    </section>
  </main>
</template>
