<script setup lang="ts">
import { ref } from 'vue'
import type { CredencialTemporal } from '~/types/credencial'

defineProps<{
  credenciales: CredencialTemporal[]
}>()

const visibles = ref(new Set<string>())
const copiado = ref('')

function alternar(username: string): void {
  const siguiente = new Set(visibles.value)
  if (siguiente.has(username)) siguiente.delete(username)
  else siguiente.add(username)
  visibles.value = siguiente
}

async function copiar(credencial: CredencialTemporal): Promise<void> {
  try {
    await navigator.clipboard.writeText(credencial.contrasenhaTemporal)
    copiado.value = credencial.username
    setTimeout(() => {
      if (copiado.value === credencial.username) copiado.value = ''
    }, 2000)
  } catch {
    alternar(credencial.username)
  }
}
</script>

<template>
  <div class="credenciales">
    <div v-for="credencial in credenciales" :key="credencial.username" class="credencial">
      <strong>Cuenta creada para {{ credencial.nombre }}</strong>
      <dl>
        <div>
          <dt>Usuario</dt>
          <dd>
            <code>{{ credencial.username }}</code>
          </dd>
        </div>
        <div>
          <dt>Contraseña temporal</dt>
          <dd>
            <code>{{ visibles.has(credencial.username) ? credencial.contrasenhaTemporal : '••••••••••••' }}</code>
            <button type="button" @click="alternar(credencial.username)">
              {{ visibles.has(credencial.username) ? 'Ocultar' : 'Mostrar' }}
            </button>
            <button type="button" @click="copiar(credencial)">
              {{ copiado === credencial.username ? 'Copiada' : 'Copiar' }}
            </button>
          </dd>
        </div>
      </dl>
    </div>
    <AvisoMensaje
      tipo="advertencia"
      mensaje="Entrega estos datos ahora. Por seguridad, la contraseña temporal no se volverá a mostrar."
    />
  </div>
</template>

<style scoped>
.credenciales {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.credencial {
  padding: 14px;
  border: 2px solid #16a34a;
  border-radius: 12px;
  background: #f0fdf4;
}

.credencial strong {
  color: #166534;
}

dl {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 10px 0 0;
}

dl div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

dt {
  width: 150px;
  color: #166534;
  font-size: 14px;
}

dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
}

code {
  padding: 4px 8px;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  background: white;
  font-size: 15px;
}

button {
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid #c3c6d7;
  border-radius: 8px;
  background: white;
  color: #191c1e;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
</style>
