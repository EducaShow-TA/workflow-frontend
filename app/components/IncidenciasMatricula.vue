<script setup lang="ts">
import type { IncidenciaConfirmacionMatricula } from '~/types/matricula'

defineProps<{
  incidencias: IncidenciaConfirmacionMatricula[]
}>()
</script>

<template>
  <section
    v-if="incidencias.length"
    class="incidencias-matricula"
    aria-label="Estudiantes que requieren atención"
  >
    <h2>Estudiantes que requieren atención</h2>
    <p>No se confirmó ninguna matrícula del grupo. Corrige los problemas indicados y vuelve a intentarlo.</p>
    <ul>
      <li v-for="incidencia in incidencias" :key="incidencia.estudianteId">
        <strong>{{ incidencia.nombreEstudiante }}</strong>
        <small>
          Estudiante #{{ incidencia.estudianteId }}
          <template v-if="incidencia.matriculaId !== null"> · Matrícula #{{ incidencia.matriculaId }}</template>
        </small>
        <ul>
          <li v-for="problema in incidencia.problemas" :key="problema">{{ problema }}</li>
        </ul>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.incidencias-matricula {
  margin: 14px 0;
  padding: 16px 18px;
  border: 1px solid #f3c477;
  border-left: 4px solid #c77711;
  border-radius: 10px;
  background: #fffbeb;
  color: #713f12;
}

.incidencias-matricula h2 {
  margin: 0 0 6px;
  font-size: 16px;
}

.incidencias-matricula p {
  margin: 0 0 10px;
  line-height: 1.5;
}

.incidencias-matricula > ul,
.incidencias-matricula ul ul {
  margin: 0;
  padding-left: 20px;
}

.incidencias-matricula > ul > li + li {
  margin-top: 10px;
}

.incidencias-matricula small {
  display: block;
  margin: 2px 0 4px;
  color: #854d0e;
}
</style>
