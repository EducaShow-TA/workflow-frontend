<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const nota = ref<'AD' | 'A' | 'B' | 'C'>('A')
const observacion = ref('')
const evidenciaUrl = ref('')
const archivo = ref<File | null>(null)

function seleccionarArchivo(evento: Event): void {
  const elemento = evento.target as HTMLInputElement
  archivo.value = elemento.files?.[0] ?? null
}
</script>

<template>
  <main class="docente-vista">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-3.2 · US-3.8</span>
        <h1>Calificaciones y evidencias</h1>
        <p>Registra logros por competencia y agrega respaldo pedagógico.</p>
      </div>
      <span class="docente-insignia">Escala AD · A · B · C</span>
    </header>

    <div class="docente-aviso" role="status">
      <strong>Formulario visual, sin envío activo</strong
      ><span
        >Para registrar notas con la cuenta docente se necesita la lista de alumnos y competencias autorizados para sus
        secciones. La API de notas y evidencias ya existe.</span
      >
    </div>

    <section class="docente-tarjeta" aria-labelledby="contexto-notas-docente">
      <div class="docente-tarjeta__titulo"><h2 id="contexto-notas-docente">1. Contexto de evaluación</h2></div>
      <div class="docente-grid docente-grid--tres">
        <div class="docente-campo">
          <label for="nota-seccion">Grado y sección *</label
          ><select id="nota-seccion" disabled>
            <option>Sin secciones asignadas</option>
          </select>
        </div>
        <div class="docente-campo">
          <label for="nota-competencia">Competencia *</label
          ><select id="nota-competencia" disabled>
            <option>Selecciona una sección</option>
          </select>
        </div>
        <div class="docente-campo">
          <label for="nota-estudiante">Estudiante *</label
          ><select id="nota-estudiante" disabled>
            <option>Sin lista de estudiantes</option>
          </select>
        </div>
      </div>
    </section>

    <section class="docente-tarjeta" aria-labelledby="registrar-nota-docente">
      <div class="docente-tarjeta__titulo">
        <h2 id="registrar-nota-docente">2. Registrar calificación</h2>
        <span class="docente-insignia docente-insignia--neutral">Primera fase</span>
      </div>
      <div class="docente-formulario">
        <div class="docente-grid docente-grid--dos">
          <div class="docente-campo">
            <label for="nota-valor">Nota cualitativa *</label
            ><select id="nota-valor" v-model="nota">
              <option value="AD">AD — Logro destacado</option>
              <option value="A">A — Logro esperado</option>
              <option value="B">B — En proceso</option>
              <option value="C">C — En inicio</option>
            </select>
          </div>
          <div class="docente-campo">
            <label for="nota-url">URL de evidencia</label
            ><input id="nota-url" v-model="evidenciaUrl" type="url" placeholder="https://..." />
          </div>
        </div>
        <div class="docente-campo">
          <label for="nota-archivo">Archivo de evidencia (hasta 10 MB)</label
          ><input id="nota-archivo" type="file" @change="seleccionarArchivo" /><small v-if="archivo"
            >Archivo seleccionado: {{ archivo.name }}</small
          >
        </div>
        <div class="docente-campo">
          <label for="nota-observacion">Observación</label
          ><textarea
            id="nota-observacion"
            v-model="observacion"
            rows="3"
            maxlength="1000"
            placeholder="Retroalimentación del logro académico."
          />
        </div>
        <p class="docente-texto-secundario">
          Se deberá seleccionar un archivo o una URL, no ambos. Esta vista no envía información todavía.
        </p>
        <div class="docente-formulario__acciones">
          <button type="button" class="docente-boton" disabled title="Requiere secciones y estudiantes autorizados">
            Guardar calificación
          </button>
        </div>
      </div>
    </section>

    <section class="docente-tarjeta" aria-labelledby="seguimiento-nota-docente">
      <div class="docente-tarjeta__titulo">
        <h2 id="seguimiento-nota-docente">3. Seguimiento por competencia</h2>
        <button type="button" class="docente-boton docente-boton--secundario" disabled>Actualizar</button>
      </div>
      <DocenteEstadoVacio
        titulo="No hay calificaciones cargadas"
        descripcion="Las notas y evidencias aparecerán aquí cuando podamos obtener las competencias y los estudiantes que corresponden al docente autenticado."
      />
    </section>
  </main>
</template>
