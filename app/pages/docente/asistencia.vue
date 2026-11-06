<script setup lang="ts">
import { computed, ref } from 'vue'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

type EstadoAsistencia = 'PRESENTE' | 'TARDANZA' | 'AUSENTE'

type OpcionEstado = {
  codigo: EstadoAsistencia
  etiqueta: string
}

interface EstudianteVistaPrevia {
  id: number
  nombre: string
  referencia: string
  estado: EstadoAsistencia | null
  observacion: string
}

const opcionesEstado: OpcionEstado[] = [
  { codigo: 'PRESENTE', etiqueta: 'Presente' },
  { codigo: 'TARDANZA', etiqueta: 'Tardanza' },
  { codigo: 'AUSENTE', etiqueta: 'Ausente' },
]

/** Fecha local de la computadora. El servidor deberá validar la fecha y hora reales de la sesión. */
function obtenerFechaLocal(): string {
  const ahora = new Date()
  const anhio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${anhio}-${mes}-${dia}`
}

const fechaReferencial = ref(obtenerFechaLocal())
const busqueda = ref('')
const modoDemostracion = ref(false)
const estudiantes = ref<EstudianteVistaPrevia[]>([])

/** Estos nombres son ficticios. No se consultan ni guardan datos de estudiantes reales. */
function activarVistaPrevia(): void {
  estudiantes.value = [
    { id: 1, nombre: 'Estudiante de ejemplo 01', referencia: 'DEMO-001', estado: null, observacion: '' },
    { id: 2, nombre: 'Estudiante de ejemplo 02', referencia: 'DEMO-002', estado: null, observacion: '' },
    { id: 3, nombre: 'Estudiante de ejemplo 03', referencia: 'DEMO-003', estado: null, observacion: '' },
    { id: 4, nombre: 'Estudiante de ejemplo 04', referencia: 'DEMO-004', estado: null, observacion: '' },
  ]
  busqueda.value = ''
  modoDemostracion.value = true
}

function cerrarVistaPrevia(): void {
  modoDemostracion.value = false
  estudiantes.value = []
  busqueda.value = ''
}

const estudiantesFiltrados = computed(() => {
  const texto = busqueda.value.trim().toLocaleLowerCase('es')
  if (!texto) return estudiantes.value
  return estudiantes.value.filter((estudiante) =>
    `${estudiante.nombre} ${estudiante.referencia}`.toLocaleLowerCase('es').includes(texto),
  )
})

const resumen = computed(() => ({
  total: estudiantes.value.length,
  presentes: estudiantes.value.filter((e) => e.estado === 'PRESENTE').length,
  tardanzas: estudiantes.value.filter((e) => e.estado === 'TARDANZA').length,
  ausentes: estudiantes.value.filter((e) => e.estado === 'AUSENTE').length,
  pendientes: estudiantes.value.filter((e) => e.estado === null).length,
}))

function marcarTodosPresentes(): void {
  if (!modoDemostracion.value) return
  estudiantes.value.forEach((estudiante) => {
    estudiante.estado = 'PRESENTE'
  })
}

function limpiarEstados(): void {
  if (!modoDemostracion.value) return
  estudiantes.value.forEach((estudiante) => {
    estudiante.estado = null
    estudiante.observacion = ''
  })
}
</script>

<template>
  <main class="docente-vista asistencia">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-2.1 · Control de asistencia</span>
        <h1>Asistencia de alumnos</h1>
        <p>Consulta una sesión y registra presentes, tardanzas o ausencias de sus estudiantes.</p>
      </div>
      <span class="docente-insignia">Diseño del Sprint 2</span>
    </header>

    <section class="asistencia-condiciones" aria-labelledby="asistencia-titulo-condiciones">
      <div class="asistencia-condiciones__encabezado">
        <h2 id="asistencia-titulo-condiciones">Condiciones para registrar asistencia</h2>
        <span class="asistencia-etiqueta asistencia-etiqueta--neutra">Validación pendiente</span>
      </div>
      <p>
        Según la US-2.1, el sistema solo debe aceptar asistencia durante la primera hora de una sesión, verificando al
        mismo tiempo que el docente esté presente y que la clase se esté dictando.
      </p>
      <div class="asistencia-verificaciones">
        <div>
          <span class="asistencia-verificaciones__indicador" aria-hidden="true" />
          <div><strong>Sesión asignada</strong><small>Sin datos del backend</small></div>
        </div>
        <div>
          <span class="asistencia-verificaciones__indicador" aria-hidden="true" />
          <div><strong>Primera hora de clase</strong><small>Por validar en el servidor</small></div>
        </div>
        <div>
          <span class="asistencia-verificaciones__indicador" aria-hidden="true" />
          <div><strong>Presencia del docente</strong><small>Por validar en el servidor</small></div>
        </div>
      </div>
    </section>

    <section class="docente-tarjeta" aria-labelledby="asistencia-titulo-sesion">
      <div class="docente-tarjeta__titulo">
        <h2 id="asistencia-titulo-sesion">1. Seleccionar sesión</h2>
        <span class="asistencia-etiqueta asistencia-etiqueta--neutra">Sin sesión asignada</span>
      </div>
      <p class="docente-texto-secundario">
        La selección real de clases se habilitará al integrar las asignaciones del docente.
      </p>
      <div class="docente-grid docente-grid--tres">
        <div class="docente-campo">
          <label for="asistencia-fecha">Fecha referencial</label>
          <input id="asistencia-fecha" v-model="fechaReferencial" type="date" readonly />
          <small>La fecha y hora oficiales vendrán de la sesión.</small>
        </div>
        <div class="docente-campo">
          <label for="asistencia-seccion">Grado y sección</label>
          <select id="asistencia-seccion" disabled>
            <option>Sin secciones asignadas</option>
          </select>
        </div>
        <div class="docente-campo">
          <label for="asistencia-sesion">Curso y bloque horario</label>
          <select id="asistencia-sesion" disabled>
            <option>Sin sesiones disponibles</option>
          </select>
        </div>
      </div>
    </section>

    <section class="docente-tarjeta" aria-labelledby="asistencia-titulo-lista">
      <div class="docente-tarjeta__titulo asistencia-titulo-lista">
        <div>
          <h2 id="asistencia-titulo-lista">2. Lista de asistencia</h2>
          <p class="asistencia-subtitulo">Los estados se registran por estudiante y por sesión de clase.</p>
        </div>
        <button
          type="button"
          class="docente-boton docente-boton--secundario"
          @click="modoDemostracion ? cerrarVistaPrevia() : activarVistaPrevia()"
        >
          {{ modoDemostracion ? 'Cerrar vista previa' : 'Ver diseño con datos de ejemplo' }}
        </button>
      </div>

      <div v-if="modoDemostracion" class="asistencia-demostracion" role="status">
        <strong>Vista previa interactiva — datos ficticios</strong>
        Puedes marcar estados y escribir observaciones solo para revisar la interfaz. No se envía ni se guarda nada.
      </div>

      <div class="asistencia-indicadores" aria-label="Resumen de la lista de asistencia">
        <div class="asistencia-indicador">
          <strong>{{ modoDemostracion ? resumen.total : '—' }}</strong
          ><span>Estudiantes</span>
        </div>
        <div class="asistencia-indicador asistencia-indicador--presente">
          <strong>{{ modoDemostracion ? resumen.presentes : '—' }}</strong
          ><span>Presentes</span>
        </div>
        <div class="asistencia-indicador asistencia-indicador--tardanza">
          <strong>{{ modoDemostracion ? resumen.tardanzas : '—' }}</strong
          ><span>Tardanzas</span>
        </div>
        <div class="asistencia-indicador asistencia-indicador--ausente">
          <strong>{{ modoDemostracion ? resumen.ausentes : '—' }}</strong
          ><span>Ausentes</span>
        </div>
        <div class="asistencia-indicador">
          <strong>{{ modoDemostracion ? resumen.pendientes : '—' }}</strong
          ><span>Sin marcar</span>
        </div>
      </div>

      <template v-if="modoDemostracion">
        <div class="asistencia-herramientas">
          <div class="docente-campo asistencia-busqueda">
            <label for="asistencia-busqueda">Buscar estudiante</label>
            <input
              id="asistencia-busqueda"
              v-model="busqueda"
              type="search"
              placeholder="Nombre o referencia de ejemplo"
            />
          </div>
          <div class="asistencia-herramientas__acciones">
            <button type="button" class="docente-boton docente-boton--secundario" @click="limpiarEstados">
              Limpiar marcaciones
            </button>
            <button type="button" class="docente-boton docente-boton--secundario" @click="marcarTodosPresentes">
              Marcar todos presentes
            </button>
          </div>
        </div>

        <div class="docente-tabla-contenedor">
          <table class="docente-tabla asistencia-tabla">
            <thead>
              <tr>
                <th scope="col">Estudiante</th>
                <th scope="col">Estado de asistencia</th>
                <th scope="col">Observación opcional</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="estudiante in estudiantesFiltrados" :key="estudiante.id">
                <td>
                  <strong class="asistencia-alumno">{{ estudiante.nombre }}</strong>
                  <small class="asistencia-referencia">{{ estudiante.referencia }}</small>
                </td>
                <td>
                  <fieldset class="asistencia-estados">
                    <legend class="asistencia-solo-lectores">Estado de {{ estudiante.nombre }}</legend>
                    <label
                      v-for="opcion in opcionesEstado"
                      :key="opcion.codigo"
                      class="asistencia-estado"
                      :class="[
                        `asistencia-estado--${opcion.codigo.toLowerCase()}`,
                        { 'asistencia-estado--seleccionado': estudiante.estado === opcion.codigo },
                      ]"
                    >
                      <input
                        v-model="estudiante.estado"
                        type="radio"
                        :name="`asistencia-${estudiante.id}`"
                        :value="opcion.codigo"
                      />
                      <span>{{ opcion.etiqueta }}</span>
                    </label>
                  </fieldset>
                </td>
                <td>
                  <label class="asistencia-solo-lectores" :for="`observacion-${estudiante.id}`">
                    Observación de {{ estudiante.nombre }}
                  </label>
                  <input
                    :id="`observacion-${estudiante.id}`"
                    v-model="estudiante.observacion"
                    class="asistencia-observacion"
                    type="text"
                    maxlength="250"
                    placeholder="Agregar observación..."
                  />
                </td>
              </tr>
              <tr v-if="estudiantesFiltrados.length === 0">
                <td colspan="3" class="docente-tabla__vacia">No hay estudiantes que coincidan con la búsqueda.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <div v-else class="asistencia-sin-datos">
        <div class="asistencia-sin-datos__icono" aria-hidden="true">☑</div>
        <strong>Sin lista de alumnos disponible</strong>
        <p>
          Cuando exista un servicio de sesiones asignadas, aquí aparecerán los estudiantes matriculados en la clase
          seleccionada. Mientras tanto, puedes revisar el diseño usando datos ficticios.
        </p>
      </div>

      <div class="asistencia-pie">
        <p>
          <strong>Guardado deshabilitado.</strong> Se habilitará únicamente cuando el backend valide la sesión, la
          primera hora de clase y la presencia del docente.
        </p>
        <button type="button" class="docente-boton" disabled title="Pendiente de integración con el backend">
          Guardar asistencia
        </button>
      </div>
    </section>
  </main>
</template>

<style scoped>
.asistencia {
  gap: 22px;
}
.asistencia-condiciones {
  padding: 19px 23px;
  border: 1px solid #bfdbfe;
  border-left: 4px solid #2563eb;
  border-radius: 12px;
  background: #eff6ff;
}
.asistencia-condiciones__encabezado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.asistencia-condiciones h2 {
  margin: 0;
  font-size: 17px;
  color: #1e3a8a;
}
.asistencia-condiciones p {
  margin: 9px 0 17px;
  color: #334155;
  font-size: 13px;
  line-height: 1.6;
}
.asistencia-etiqueta {
  display: inline-flex;
  align-items: center;
  padding: 5px 11px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
.asistencia-etiqueta--neutra {
  background: #e2e8f0;
  color: #475569;
}
.asistencia-verificaciones {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.asistencia-verificaciones > div {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 11px;
  border: 1px solid #dbeafe;
  border-radius: 9px;
  background: white;
}
.asistencia-verificaciones__indicador {
  flex: 0 0 9px;
  width: 9px;
  height: 9px;
  margin-top: 5px;
  border-radius: 50%;
  background: #94a3b8;
}
.asistencia-verificaciones strong,
.asistencia-verificaciones small {
  display: block;
}
.asistencia-verificaciones strong {
  color: #1e293b;
  font-size: 12px;
}
.asistencia-verificaciones small {
  margin-top: 4px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.45;
}
.asistencia-titulo-lista {
  align-items: flex-start;
}
.asistencia-titulo-lista h2 {
  margin: 0 0 4px;
}
.asistencia-subtitulo {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}
.asistencia-demostracion {
  margin: 12px 0 18px;
  padding: 12px 15px;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  background: #fffbeb;
  color: #92400e;
  font-size: 12px;
  line-height: 1.5;
}
.asistencia-demostracion strong {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
}
.asistencia-indicadores {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin: 15px 0 19px;
}
.asistencia-indicador {
  display: flex;
  min-height: 86px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 12px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  text-align: center;
}
.asistencia-indicador strong {
  color: #1e40af;
  font-size: 25px;
}
.asistencia-indicador span {
  color: #475569;
  font-size: 12px;
}
.asistencia-indicador--presente strong {
  color: #15803d;
}
.asistencia-indicador--tardanza strong {
  color: #b45309;
}
.asistencia-indicador--ausente strong {
  color: #b91c1c;
}
.asistencia-herramientas {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 15px;
  margin: 8px 0 18px;
}
.asistencia-busqueda {
  width: 100%;
  max-width: 340px;
}
.asistencia-herramientas__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}
.asistencia-tabla {
  min-width: 700px;
}
.asistencia-tabla td {
  vertical-align: middle;
}
.asistencia-alumno {
  display: block;
  color: #1e293b;
  font-size: 13px;
}
.asistencia-referencia {
  display: block;
  margin-top: 5px;
  color: #64748b;
  font-size: 11px;
}
.asistencia-estados {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 270px;
  margin: 0;
  padding: 0;
  border: 0;
}
.asistencia-estado {
  display: inline-flex;
  position: relative;
  align-items: center;
  gap: 5px;
  padding: 7px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font-size: 11px;
  white-space: nowrap;
}
.asistencia-estado input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #1e40af;
  cursor: pointer;
}
.asistencia-estado--presente.asistencia-estado--seleccionado {
  border-color: #86efac;
  background: #f0fdf4;
  color: #166534;
}
.asistencia-estado--tardanza.asistencia-estado--seleccionado {
  border-color: #fcd34d;
  background: #fffbeb;
  color: #92400e;
}
.asistencia-estado--ausente.asistencia-estado--seleccionado {
  border-color: #fca5a5;
  background: #fef2f2;
  color: #991b1b;
}
.asistencia-estado:focus-within {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}
.asistencia-observacion {
  width: 100%;
  min-width: 155px;
  padding: 9px 11px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
}
.asistencia-observacion:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
.asistencia-sin-datos {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding: 32px 15px 38px;
  text-align: center;
}
.asistencia-sin-datos__icono {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  background: #eaf1ff;
  color: #1e40af;
  font-size: 24px;
}
.asistencia-sin-datos strong {
  color: #0f172a;
  font-size: 14px;
}
.asistencia-sin-datos p {
  max-width: 540px;
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}
.asistencia-pie {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 15px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}
.asistencia-pie p {
  max-width: 580px;
  margin: 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.55;
}
.asistencia-pie strong {
  color: #475569;
}
.asistencia-solo-lectores {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
@media (max-width: 1120px) {
  .asistencia-indicadores {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .asistencia-verificaciones {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .asistencia-condiciones {
    padding: 16px;
  }
  .asistencia-indicadores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .asistencia-herramientas {
    align-items: stretch;
    flex-direction: column;
  }
  .asistencia-busqueda {
    max-width: none;
  }
  .asistencia-herramientas__acciones {
    justify-content: flex-start;
  }
  .asistencia-pie {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
