import { useApi } from '~/composables/useApi'

export interface UmbralesConsolidacion {
  umbralB: number
  umbralA: number
  umbralAd: number
}

export interface ReglaConsolidacion extends UmbralesConsolidacion {
  competenciaCodigo: string
  valorC: number
  valorB: number
  valorA: number
  valorAd: number
}

export function validarUmbralesConsolidacion(umbrales: UmbralesConsolidacion): string {
  const { umbralB, umbralA, umbralAd } = umbrales

  if (![umbralB, umbralA, umbralAd].every(Number.isFinite)) {
    return 'Ingresa un valor válido para cada umbral.'
  }

  if (umbralB <= 1 || umbralB >= umbralA || umbralA >= umbralAd || umbralAd > 4) {
    return 'Los umbrales deben cumplir: 1 < B < A < AD ≤ 4.'
  }

  return ''
}

export function useReglasConsolidacion() {
  const { solicitar } = useApi()

  function rutaRegla(codigo: string): string {
    return `/api/v1/competencias/${encodeURIComponent(codigo)}/regla-consolidacion`
  }

  function obtener(codigo: string): Promise<ReglaConsolidacion> {
    return solicitar<ReglaConsolidacion>(rutaRegla(codigo))
  }

  function guardar(codigo: string, umbrales: UmbralesConsolidacion): Promise<ReglaConsolidacion> {
    return solicitar<ReglaConsolidacion>(rutaRegla(codigo), { metodo: 'PUT', cuerpo: umbrales })
  }

  return { obtener, guardar }
}
