import type { ResumenFinancieroPanel } from '~/types/finanzas'

export function useResumenFinanciero(): ResumenFinancieroPanel {
  return {
    estadoFinanciero: {
      pagosPendientes: 4500,
      alumnosPendientes: 25,
      pagosVencidos: 1200,
      alumnosVencidos: 8,
    },

    tendenciaPagos: [
      { mes: 'Ene', recaudado: 15000, proyectado: 18000 },
      { mes: 'Feb', recaudado: 17000, proyectado: 23000 },
      { mes: 'Mar', recaudado: 26000, proyectado: 29000 },
      { mes: 'Abr', recaudado: 31000, proyectado: 36000 },
      { mes: 'May', recaudado: 25000, proyectado: 36000 },
      { mes: 'Jun', recaudado: 19000, proyectado: 32000 },
    ],

    escalaMaxima: 40000,
  }
}
