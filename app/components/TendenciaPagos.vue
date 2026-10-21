<script setup lang="ts">
import { computed } from 'vue'
import type { PagoMensualPanel } from '~/types/finanzas'

const propiedades = defineProps<{
  pagos: PagoMensualPanel[]
  escalaMaxima: number
}>()

const marcasEscala = computed(() => {
  return [4, 3, 2, 1, 0].map((nivel) => (propiedades.escalaMaxima / 4) * nivel)
})

function calcularAltura(monto: number): string {
  if (propiedades.escalaMaxima <= 0) {
    return '0%'
  }

  const porcentaje = Math.min(100, Math.max(0, (monto / propiedades.escalaMaxima) * 100))
  return `${porcentaje}%`
}
</script>

<template>
  <article class="tendencia-pagos">
    <div class="encabezado-grafico">
      <h2>Tendencia de Pagos Mensuales</h2>

      <div class="leyenda">
        <span class="elemento-leyenda">
          <span class="punto recaudado" />
          Recaudado
        </span>

        <span class="elemento-leyenda">
          <span class="punto proyectado" />
          Proyectado
        </span>
      </div>
    </div>

    <div class="contenedor-grafico">
      <div class="escala">
        <span v-for="marca in marcasEscala" :key="marca">
          {{ marca }}
        </span>
      </div>

      <div class="area-barras">
        <div class="lineas-grafico" aria-hidden="true" />

        <div
          v-for="pago in pagos"
          :key="pago.mes"
          class="grupo-barras"
          role="img"
          :aria-label="`${pago.mes}: recaudado ${pago.recaudado}, proyectado ${pago.proyectado}`"
        >
          <div class="barra barra-proyectado" :style="{ height: calcularAltura(pago.proyectado) }" aria-hidden="true" />

          <div class="barra barra-recaudado" :style="{ height: calcularAltura(pago.recaudado) }" aria-hidden="true" />
        </div>
      </div>
    </div>

    <div class="etiquetas-meses" aria-hidden="true">
      <span v-for="pago in pagos" :key="pago.mes">
        {{ pago.mes }}
      </span>
    </div>
  </article>
</template>

<style scoped>
.tendencia-pagos {
  display: flex;
  min-width: 0;
  min-height: 288px;
  flex-direction: column;
  padding: 34px 16px 16px;
  border: 1px solid #c3c6d7;
  border-radius: 12px;
  background: linear-gradient(155deg, #f5f8ff 0%, white 70%);
}

.encabezado-grafico {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

h2 {
  margin: 0;
  color: #191c1e;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
}

.leyenda {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.elemento-leyenda {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #434655;
  font-size: 12px;
  font-weight: 600;
}

.punto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.punto.recaudado {
  background: #004ac6;
}

.punto.proyectado {
  background: #c3c6d7;
}

.contenedor-grafico {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  flex: 1;
  min-height: 150px;
}

.escala {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0 12px 0 0;
  color: #737686;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}

.escala span {
  line-height: 1;
  transform: translateY(50%);
}

.escala span:first-child {
  transform: translateY(-50%);
}

.area-barras {
  position: relative;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  height: 100%;
  border-bottom: 1px solid #191c1e;
  border-left: 1px solid #191c1e;
}

.lineas-grafico {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(to bottom, #c3c6d7 1px, transparent 1px);
  background-size: 100% 25%;
  pointer-events: none;
}

.grupo-barras {
  position: relative;
  min-width: 0;
}

.barra {
  position: absolute;
  right: 15%;
  bottom: 0;
  left: 15%;
  max-width: 47px;
  margin: 0 auto;
  border-radius: 2px 2px 0 0;
}

.barra-proyectado {
  background: #e0e3e5;
}

.barra-recaudado {
  background: #004ac6;
}

.etiquetas-meses {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0;
  margin-top: 8px;
  margin-left: 64px;
}

.etiquetas-meses span {
  color: #737686;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}

@media (max-width: 600px) {
  .tendencia-pagos {
    padding: 20px 12px 16px;
  }

  .encabezado-grafico {
    flex-direction: column;
    align-items: flex-start;
  }

  h2 {
    font-size: 18px;
  }

  .contenedor-grafico {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .etiquetas-meses {
    margin-left: 48px;
  }

  .escala,
  .etiquetas-meses span {
    font-size: 10px;
  }
}
</style>
