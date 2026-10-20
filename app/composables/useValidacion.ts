/** Indica si un objeto de errores de formulario tiene al menos un mensaje. */
export function tieneErrores(errores: Record<string, string | undefined>): boolean {
  return Object.values(errores).some(Boolean)
}

/** Primer mensaje de error de un formulario, para mostrarlo como resumen. */
export function obtenerPrimerError(errores: Record<string, string | undefined>): string {
  return Object.values(errores).find(Boolean) ?? ''
}
