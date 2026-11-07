<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAutenticacionStore } from '~/stores/autenticacion'

definePageMeta({ layout: 'docente', middleware: 'autenticacion' })

const autenticacion = useAutenticacionStore()
const nombreDocente = computed(() => autenticacion.usuario?.nombreCompleto?.trim() || 'Docente autenticado')

/** Vista previa sin solicitudes HTTP ni persistencia. No representa marcajes oficiales. */
const modoDemostracion = ref(false)
const fechaDemostracion = ref('')
const entradaDemostracion = ref<string | null>(null)
const salidaDemostracion = ref<string | null>(null)

function fechaLocal(): string {
  const fecha = new Date()
  const anhio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anhio}-${mes}-${dia}`
}

function horaLocal(): string {
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
}

function fechaVisible(fechaIso: string): string {
  if (!fechaIso) return '—'
  const [anhio = '', mes = '', dia = ''] = fechaIso.split('-')
  return `${dia}/${mes}/${anhio}`
}

function activarDemostracion(): void {
  modoDemostracion.value = true
  fechaDemostracion.value = fechaLocal()
  entradaDemostracion.value = null
  salidaDemostracion.value = null
}

function cerrarDemostracion(): void {
  modoDemostracion.value = false
  entradaDemostracion.value = null
  salidaDemostracion.value = null
  fechaDemostracion.value = ''
}

function simularEntrada(): void {
  if (!modoDemostracion.value || entradaDemostracion.value) return
  entradaDemostracion.value = horaLocal()
}

function simularSalida(): void {
  if (!modoDemostracion.value || !entradaDemostracion.value || salidaDemostracion.value) return
  salidaDemostracion.value = horaLocal()
}

function reiniciarDemostracion(): void {
  if (!modoDemostracion.value) return
  entradaDemostracion.value = null
  salidaDemostracion.value = null
  fechaDemostracion.value = fechaLocal()
}

const estadoDemostracion = computed(() => {
  if (!entradaDemostracion.value) return 'Pendiente de entrada'
  return salidaDemostracion.value ? 'Jornada simulada completa' : 'Entrada simulada'
})
</script>

<template>
  <main class="docente-vista marcaje">
    <header class="docente-titulo">
      <div>
        <span class="docente-sobrelinea">US-2.3 · Control de asistencia</span>
        <h1>Mi marcaje</h1>
        <p>Consulta tu jornada laboral y registra tus propias horas de entrada y salida.</p>
      </div>
      <span class="docente-insignia">Diseño del Sprint 2</span>
    </header>

    <section class="marcaje-condiciones" aria-labelledby="marcaje-titulo-condiciones">
      <div class="marcaje-cabecera">
        <h2 id="marcaje-titulo-condiciones">Condiciones para registrar tu marcaje</h2>
        <span class="marcaje-etiqueta marcaje-etiqueta--pendiente">Validación pendiente</span>
      </div>
      <p>
        Solo podrás registrar tus propias horas de entrada y salida dentro de la ventana habilitada para tu jornada. Los
        horarios y la tolerancia deberán verificarse en el servidor.
      </p>
      <div class="marcaje-verificaciones">
        <div class="marcaje-verificacion">
          <span class="marcaje-punto" aria-hidden="true" />
          <div><strong>Identidad del docente</strong><small>La cuenta autenticada será la única autorizada</small></div>
        </div>
        <div class="marcaje-verificacion">
          <span class="marcaje-punto" aria-hidden="true" />
          <div><strong>Horario asignado</strong><small>Pendiente de consulta por docente</small></div>
        </div>
        <div class="marcaje-verificacion">
          <span class="marcaje-punto" aria-hidden="true" />
          <div><strong>Ventana y tolerancia</strong><small>Parámetros X y Z por configurar (US-2.9)</small></div>
        </div>
      </div>
    </section>

    <div class="docente-grid docente-grid--dos marcaje-columnas">
      <section class="docente-tarjeta" aria-labelledby="marcaje-titulo-jornada">
        <div class="docente-tarjeta__titulo marcaje-cabecera">
          <h2 id="marcaje-titulo-jornada">1. Jornada de hoy</h2>
          <span
            class="marcaje-etiqueta"
            :class="modoDemostracion ? 'marcaje-etiqueta--demo' : 'marcaje-etiqueta--neutra'"
          >
            {{ modoDemostracion ? 'Simulación local' : 'Sin sincronizar' }}
          </span>
        </div>

        <div class="marcaje-datos">
          <div>
            <span>Docente</span><strong>{{ nombreDocente }}</strong>
          </div>
          <div>
            <span>Fecha de referencia</span
            ><strong>{{ modoDemostracion ? fechaVisible(fechaDemostracion) : '—' }}</strong>
          </div>
          <div><span>Hora de inicio programada</span><strong>—:—</strong></div>
          <div><span>Hora de fin programada</span><strong>—:—</strong></div>
        </div>

        <div class="marcaje-relojes" aria-label="Resumen de marcaje">
          <div>
            <span class="marcaje-relojes__rotulo">Entrada</span>
            <strong>{{ modoDemostracion ? (entradaDemostracion ?? '—:—') : '—:—' }}</strong>
            <small>{{ modoDemostracion ? 'Hora local ilustrativa' : 'Sin consulta del servidor' }}</small>
          </div>
          <div>
            <span class="marcaje-relojes__rotulo">Salida</span>
            <strong>{{ modoDemostracion ? (salidaDemostracion ?? '—:—') : '—:—' }}</strong>
            <small>{{ modoDemostracion ? 'Hora local ilustrativa' : 'Sin consulta del servidor' }}</small>
          </div>
        </div>

        <div class="marcaje-estado" role="status">
          <span class="marcaje-estado__punto" aria-hidden="true" />
          <div>
            <strong>{{ modoDemostracion ? estadoDemostracion : 'Marcaje no disponible' }}</strong>
            <small>{{
              modoDemostracion
                ? 'Este estado no se guarda en MySQL.'
                : 'Esperando integración con la asistencia del docente.'
            }}</small>
          </div>
        </div>

        <div class="docente-formulario__acciones marcaje-acciones">
          <button
            type="button"
            class="docente-boton docente-boton--secundario"
            disabled
            title="Necesita validación del backend"
          >
            Marcar entrada
          </button>
          <button type="button" class="docente-boton" disabled title="Necesita validación del backend">
            Marcar salida
          </button>
        </div>
        <p class="marcaje-ayuda">
          El servidor deberá registrar la hora oficial y validar la ventana de marcaje antes de aceptar una operación
          real.
        </p>
      </section>

      <section class="docente-tarjeta" aria-labelledby="marcaje-titulo-vista-previa">
        <div class="docente-tarjeta__titulo marcaje-cabecera">
          <h2 id="marcaje-titulo-vista-previa">2. Vista previa interactiva</h2>
          <span class="marcaje-etiqueta marcaje-etiqueta--neutra">Sin guardar datos</span>
        </div>
        <p class="docente-texto-secundario">
          Puedes simular el flujo de entrada y salida para revisar el diseño. No se enviará información a ningún API.
        </p>
        <button
          type="button"
          class="docente-boton docente-boton--secundario marcaje-boton-previa"
          @click="modoDemostracion ? cerrarDemostracion() : activarDemostracion()"
        >
          {{ modoDemostracion ? 'Cerrar vista previa' : 'Ver diseño con marcaje de ejemplo' }}
        </button>

        <div v-if="modoDemostracion" class="marcaje-demo" role="region" aria-label="Simulación de marcaje">
          <p class="marcaje-demo__aviso">
            <strong>Modo demostración activo.</strong> Las horas mostradas provienen del navegador y son ilustrativas,
            no oficiales.
          </p>
          <div class="marcaje-demo__pasos">
            <div class="marcaje-demo__paso" :class="{ 'marcaje-demo__paso--listo': entradaDemostracion !== null }">
              <span>1</span>
              <div>
                <strong>Entrada</strong><small>{{ entradaDemostracion ?? 'Sin simular' }}</small>
              </div>
            </div>
            <div class="marcaje-demo__paso" :class="{ 'marcaje-demo__paso--listo': salidaDemostracion !== null }">
              <span>2</span>
              <div>
                <strong>Salida</strong><small>{{ salidaDemostracion ?? 'Sin simular' }}</small>
              </div>
            </div>
          </div>
          <div class="marcaje-demo__acciones">
            <button
              type="button"
              class="docente-boton docente-boton--secundario"
              :disabled="entradaDemostracion !== null"
              @click="simularEntrada"
            >
              Simular entrada
            </button>
            <button
              type="button"
              class="docente-boton"
              :disabled="!entradaDemostracion || salidaDemostracion !== null"
              @click="simularSalida"
            >
              Simular salida
            </button>
          </div>
          <button type="button" class="marcaje-reiniciar" @click="reiniciarDemostracion">Reiniciar simulación</button>
        </div>
        <DocenteEstadoVacio
          v-else
          titulo="Vista previa disponible"
          descripcion="Activa la demostración para revisar cómo cambian los estados después de una entrada y una salida."
          icono="/icons/menu-docentes.svg"
        />
      </section>
    </div>

    <section class="docente-tarjeta" aria-labelledby="marcaje-titulo-historial">
      <div class="docente-tarjeta__titulo marcaje-cabecera">
        <h2 id="marcaje-titulo-historial">3. Historial de marcajes</h2>
        <span
          class="marcaje-etiqueta"
          :class="modoDemostracion ? 'marcaje-etiqueta--demo' : 'marcaje-etiqueta--neutra'"
        >
          {{ modoDemostracion ? 'Ejemplo local' : 'Pendiente de API' }}
        </span>
      </div>
      <p class="docente-texto-secundario">
        Los marcajes reales aparecerán aquí cuando esté disponible el servicio de consulta del docente autenticado.
      </p>
      <div class="docente-tabla-contenedor">
        <table class="docente-tabla">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Entrada</th>
              <th scope="col">Salida</th>
              <th scope="col">Estado</th>
              <th scope="col">Origen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="modoDemostracion && entradaDemostracion">
              <td>{{ fechaVisible(fechaDemostracion) }}</td>
              <td>{{ entradaDemostracion }}</td>
              <td>{{ salidaDemostracion ?? '—:—' }}</td>
              <td>{{ estadoDemostracion }}</td>
              <td><span class="marcaje-etiqueta marcaje-etiqueta--demo">Demostración</span></td>
            </tr>
            <tr v-else>
              <td colspan="5" class="docente-tabla__vacia">
                {{
                  modoDemostracion
                    ? 'Simula la entrada para visualizar un registro de ejemplo.'
                    : 'No se han consultado registros reales. No se puede determinar aún si existen marcajes.'
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.marcaje-condiciones {
  padding: 20px 24px;
  border: 1px solid #bfdbfe;
  border-left: 4px solid #2563eb;
  border-radius: 12px;
  background: #eff6ff;
}
.marcaje-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.marcaje-cabecera h2 {
  margin: 0;
  font-size: 18px;
}
.marcaje-condiciones > p {
  margin: 10px 0 16px;
  color: #1e3a8a;
  font-size: 13px;
  line-height: 1.65;
}
.marcaje-etiqueta {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 5px 11px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.marcaje-etiqueta--pendiente,
.marcaje-etiqueta--neutra {
  background: #e2e8f0;
  color: #475569;
}
.marcaje-etiqueta--demo {
  background: #dbeafe;
  color: #1d4ed8;
}
.marcaje-verificaciones {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.marcaje-verificacion {
  display: flex;
  align-items: center;
  min-height: 68px;
  gap: 11px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 9px;
  background: #fff;
}
.marcaje-punto {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
  border-radius: 50%;
  background: #94a3b8;
}
.marcaje-verificacion strong,
.marcaje-verificacion small {
  display: block;
}
.marcaje-verificacion strong {
  font-size: 12px;
}
.marcaje-verificacion small {
  margin-top: 5px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.45;
}
.marcaje-columnas {
  align-items: stretch;
}
.marcaje-datos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 12px 0 20px;
}
.marcaje-datos > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
}
.marcaje-datos span {
  color: #64748b;
  font-size: 12px;
}
.marcaje-datos strong {
  overflow-wrap: anywhere;
  color: #0f172a;
  font-size: 14px;
}
.marcaje-relojes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}
.marcaje-relojes > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 18px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}
.marcaje-relojes__rotulo {
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}
.marcaje-relojes strong {
  color: #0f172a;
  font-size: clamp(22px, 3vw, 30px);
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}
.marcaje-relojes small {
  color: #64748b;
  font-size: 11px;
}
.marcaje-estado {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
}
.marcaje-estado__punto {
  width: 10px;
  height: 10px;
  flex: 0 0 10px;
  margin-top: 3px;
  border-radius: 50%;
  background: #64748b;
}
.marcaje-estado strong,
.marcaje-estado small {
  display: block;
}
.marcaje-estado strong {
  font-size: 13px;
}
.marcaje-estado small {
  margin-top: 3px;
  color: #64748b;
  font-size: 11px;
  line-height: 1.4;
}
.marcaje-acciones {
  flex-wrap: wrap;
}
.marcaje-ayuda {
  margin: 12px 0 0;
  color: #64748b;
  font-size: 11px;
  line-height: 1.5;
}
.marcaje-boton-previa {
  width: 100%;
}
.marcaje-demo {
  margin-top: 18px;
}
.marcaje-demo__aviso {
  padding: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 9px;
  background: #eff6ff;
  color: #1e40af;
  font-size: 12px;
  line-height: 1.6;
}
.marcaje-demo__pasos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 14px 0;
}
.marcaje-demo__paso {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
}
.marcaje-demo__paso > span {
  display: grid;
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  place-items: center;
  border-radius: 50%;
  background: #e2e8f0;
  color: #475569;
  font-size: 12px;
  font-weight: 700;
}
.marcaje-demo__paso--listo > span {
  background: #dcfce7;
  color: #166534;
}
.marcaje-demo__paso strong,
.marcaje-demo__paso small {
  display: block;
}
.marcaje-demo__paso strong {
  font-size: 12px;
}
.marcaje-demo__paso small {
  margin-top: 4px;
  color: #64748b;
  font-size: 11px;
}
.marcaje-demo__acciones {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.marcaje-reiniciar {
  margin-top: 14px;
  padding: 3px 0;
  border: 0;
  background: none;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
@media (max-width: 1050px) {
  .marcaje-verificaciones {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 700px) {
  .marcaje-cabecera {
    align-items: flex-start;
    flex-direction: column;
  }
  .marcaje-datos,
  .marcaje-demo__pasos {
    grid-template-columns: 1fr;
  }
}
</style>
