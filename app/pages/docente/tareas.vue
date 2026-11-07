<script setup lang="ts">
import { reactive } from 'vue'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const formulario = reactive({
  titulo: '',
  descripcion: '',
  fechaLimite: '',
  ponderacion: '',
})
</script>

<template>
  <main class="docente-vista">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-3.7</span>
        <h1>Mis tareas</h1>
        <p>Registra actividades y revisa quiénes han cumplido sus entregas.</p>
      </div>
      <span class="docente-insignia">Seguimiento académico</span>
    </header>

    <div class="docente-aviso" role="status">
      <strong>Pendiente de integración docente</strong>
      <span
        >La API de tareas existe, pero falta consultar las secciones y competencias asignadas a tu cuenta. El formulario
        se muestra sin habilitar el envío para evitar registrar tareas en una sección incorrecta.</span
      >
    </div>

    <div class="docente-grid docente-grid--dos-tercios">
      <section class="docente-tarjeta" aria-labelledby="crear-tarea-docente">
        <div class="docente-tarjeta__titulo">
          <h2 id="crear-tarea-docente">Nueva tarea</h2>
          <span class="docente-insignia docente-insignia--neutral">Borrador de interfaz</span>
        </div>
        <div class="docente-formulario">
          <div class="docente-campo">
            <label for="tarea-seccion">Mi sección *</label
            ><select id="tarea-seccion" disabled>
              <option>Secciones pendientes de vinculación</option>
            </select>
          </div>
          <div class="docente-campo">
            <label for="tarea-competencia">Competencia *</label
            ><select id="tarea-competencia" disabled>
              <option>Selecciona primero una sección asignada</option>
            </select>
          </div>
          <div class="docente-campo">
            <label for="tarea-titulo">Título de la tarea *</label
            ><input
              id="tarea-titulo"
              v-model="formulario.titulo"
              maxlength="180"
              placeholder="Ej. Práctica de fracciones"
            />
          </div>
          <div class="docente-campo">
            <label for="tarea-descripcion">Descripción *</label
            ><textarea
              id="tarea-descripcion"
              v-model="formulario.descripcion"
              rows="4"
              maxlength="5000"
              placeholder="Describe las actividades y los entregables."
            />
          </div>
          <div class="docente-grid docente-grid--dos">
            <div class="docente-campo">
              <label for="tarea-fecha">Fecha límite *</label
              ><input id="tarea-fecha" v-model="formulario.fechaLimite" type="datetime-local" />
            </div>
            <div class="docente-campo">
              <label for="tarea-ponderacion">Ponderación (%)</label
              ><input
                id="tarea-ponderacion"
                v-model="formulario.ponderacion"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="Opcional"
              />
            </div>
          </div>
          <div class="docente-formulario__acciones">
            <button type="button" class="docente-boton" disabled title="Requiere secciones asignadas por la API">
              Publicar tarea
            </button>
          </div>
        </div>
      </section>
      <aside class="docente-tarjeta" aria-labelledby="criterios-tarea-docente">
        <h2 id="criterios-tarea-docente">Información de la tarea</h2>
        <p class="docente-texto-secundario">Las entregas se vincularán a estudiantes con matrículas confirmadas.</p>
        <div class="docente-ficha">
          <strong>Campos obligatorios</strong><span>Título, descripción y fecha límite.</span>
        </div>
        <div class="docente-ficha"><strong>Ponderación</strong><span>Opcional, entre 0 % y 100 %.</span></div>
        <div class="docente-ficha">
          <strong>Seguimiento</strong><span>Identificación de entregas pendientes y cumplidas.</span>
        </div>
      </aside>
    </div>

    <section class="docente-tarjeta" aria-labelledby="listado-tarea-docente">
      <div class="docente-tarjeta__titulo">
        <h2 id="listado-tarea-docente">Tareas de mis secciones</h2>
        <button type="button" class="docente-boton docente-boton--secundario" disabled>Actualizar</button>
      </div>
      <DocenteEstadoVacio
        titulo="No se cargaron tareas"
        descripcion="Cuando el backend proporcione las secciones asignadas al docente, se podrán consultar las tareas reales y marcar las entregas de los estudiantes."
        icono="/icons/menu-tareas.svg"
      />
    </section>
  </main>
</template>
