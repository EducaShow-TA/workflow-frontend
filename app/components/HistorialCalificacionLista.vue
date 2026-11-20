<script setup lang="ts">
import type { MovimientoCalificacion } from '~/types/calificacion'

defineProps<{
  movimientos: MovimientoCalificacion[]
}>()

function titulo(movimiento: MovimientoCalificacion): string {
  if (movimiento.accion === 'RECTIFICAR') return 'Rectificación'
  return movimiento.notaAnterior === null ? 'Registro inicial' : 'Actualización'
}

function rol(valor: string): string {
  return valor === 'ADMINISTRADOR' ? 'administrador' : valor === 'DOCENTE' ? 'docente' : valor.toLowerCase()
}

function fechaHora(valor: string): string {
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime())
    ? valor
    : new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(fecha)
}
</script>

<template>
  <p v-if="!movimientos.length" class="vacio">Aún no hay movimientos registrados para esta nota.</p>
  <ol v-else class="linea">
    <li
      v-for="(movimiento, indice) in movimientos"
      :key="movimiento.id"
      :class="['movimiento', { 'movimiento--vigente': indice === 0 }]"
    >
      <span class="cabecera">
        <span class="cambio">
          <span :class="['chip', movimiento.notaAnterior ? `chip--${movimiento.notaAnterior}` : 'chip--vacia']">
            {{ movimiento.notaAnterior ?? '—' }}
          </span>
          <span aria-label="cambió a">→</span>
          <span :class="['chip', movimiento.notaNueva ? `chip--${movimiento.notaNueva}` : 'chip--vacia']">
            {{ movimiento.notaNueva ?? '—' }}
          </span>
        </span>
        <strong>{{ titulo(movimiento) }}</strong>
      </span>
      <span class="quien"
        >{{ fechaHora(movimiento.fechaHora) }} · {{ movimiento.usuario }} ({{ rol(movimiento.rolUsuario) }})</span
      >
      <span v-if="movimiento.motivo" class="motivo"><b>Motivo</b>{{ movimiento.motivo }}</span>
    </li>
  </ol>
</template>

<style scoped>
.vacio {
  margin: 0;
  color: #434655;
  font-size: 13.5px;
}

.linea {
  margin: 0;
  padding: 0;
  list-style: none;
}

.movimiento {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 0 16px 26px;
}

.movimiento::before {
  position: absolute;
  top: 6px;
  left: 6px;
  width: 10px;
  height: 10px;
  border: 2px solid white;
  border-radius: 50%;
  background: #94a3b8;
  box-shadow: 0 0 0 1px #94a3b8;
  content: '';
}

.movimiento--vigente::before {
  background: #16a34a;
  box-shadow: 0 0 0 1px #16a34a;
}

.movimiento::after {
  position: absolute;
  top: 20px;
  bottom: 0;
  left: 11px;
  width: 2px;
  background: #e2e8f0;
  content: '';
}

.movimiento:last-child {
  padding-bottom: 0;
}

.movimiento:last-child::after {
  display: none;
}

.cabecera {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: #191c1e;
  font-size: 14px;
}

.cambio {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #6b7280;
}

.chip {
  display: inline-flex;
  min-width: 28px;
  justify-content: center;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.chip--AD {
  background: #dcfce7;
  color: #166534;
}

.chip--A {
  background: #dbeafe;
  color: #1e40af;
}

.chip--B {
  background: #fef3c7;
  color: #92400e;
}

.chip--C {
  background: #fee2e2;
  color: #991b1b;
}

.chip--vacia {
  background: #f3f4f6;
  color: #6b7280;
}

.quien {
  color: #6b7280;
  font-size: 12.5px;
}

.motivo {
  display: block;
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid #ddd6fe;
  border-radius: 8px;
  background: #faf7ff;
  color: #434655;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.motivo b {
  display: block;
  color: #5b21b6;
  font-size: 11.5px;
}
</style>
